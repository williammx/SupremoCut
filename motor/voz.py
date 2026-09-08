"""
SupremoCut - dublagem por sintese de voz (ElevenLabs TTS).

Usa o text-to-speech PURO, nao o produto de dublagem automatica. A diferenca
importa: a dublagem automatica traduz e sintetiza numa caixa fechada, sem
deixar escolher palavra nem ajustar duracao. Aqui a traducao e escrita por
fora (transcriacao, nao traducao literal), e este modulo so da voz a ela e
encaixa no tempo do original.

O ENCAIXE E O PROBLEMA REAL
Portugues fala mais longo que ingles. Uma frase de 3s vira 4s. As saidas sao
tres: acelerar a fala, encurtar o texto, ou deixar estourar. Acelerar acima de
~1,12x soa robotico; deixar estourar atropela a cena seguinte. Entao este
modulo ACELERA SO O POUCO que nao se percebe e, quando isso nao basta, ele
RECLAMA com numeros - pra quem escreveu o texto encurtar a frase, que e a
unica saida que preserva a qualidade.

Uso:
    python motor/voz.py vozes
    python motor/voz.py falar "texto" --voz <id> --saida arquivo.mp3
    python motor/voz.py dublar <projeto>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import RAIZ, aviso, ok, passo, rodar, salvar_json, sondar  # noqa: E402

API = "https://api.elevenlabs.io/v1"

# multilingual_v2 e o que soa melhor em portugues; os "turbo/flash" sao mais
# rapidos e baratos, mas entregam prosodia pior - num anuncio isso custa caro
MODELO_PADRAO = "eleven_multilingual_v2"

# acima disso a voz denuncia que foi acelerada
ACELERACAO_MAXIMA = 1.12


def _chave() -> str:
    """Le a chave do .env. Nunca aceita chave por argumento de linha de comando
    (ela ficaria no historico do terminal)."""
    env = RAIZ / ".env"
    if env.exists():
        for linha in env.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha.startswith("ELEVENLABS_API_KEY="):
                return linha.split("=", 1)[1].strip()
    chave = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not chave:
        raise SystemExit(
            "Falta a chave da ElevenLabs.\n"
            f"Crie {env} com a linha:  ELEVENLABS_API_KEY=sua_chave"
        )
    return chave


def _pedir(caminho: str, dados: dict | None = None, binario: bool = False):
    req = urllib.request.Request(
        f"{API}{caminho}",
        data=json.dumps(dados).encode("utf-8") if dados else None,
        headers={
            "xi-api-key": _chave(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg" if binario else "application/json",
        },
        method="POST" if dados else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read() if binario else json.loads(r.read())
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit(f"ElevenLabs respondeu {e.code}: {corpo}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Nao consegui falar com a ElevenLabs: {e.reason}")


# --------------------------------------------------------------------------

def listar_vozes() -> list[dict]:
    d = _pedir("/voices")
    saida = []
    for v in d.get("voices", []):
        rot = v.get("labels", {}) or {}
        saida.append(
            {
                "id": v.get("voice_id"),
                "nome": v.get("name"),
                "genero": rot.get("gender", "?"),
                "sotaque": rot.get("accent", "?"),
                "idade": rot.get("age", "?"),
                "uso": rot.get("use_case", rot.get("description", "?")),
            }
        )
    return saida


def falar(texto: str, voz: str, saida: Path, modelo: str = MODELO_PADRAO,
          estabilidade: float = 0.45, similaridade: float = 0.8,
          estilo: float = 0.35) -> Path:
    """Sintetiza um trecho. Devolve o caminho do mp3."""
    audio = _pedir(
        f"/text-to-speech/{voz}",
        {
            "text": texto,
            "model_id": modelo,
            "voice_settings": {
                "stability": estabilidade,
                "similarity_boost": similaridade,
                "style": estilo,
                "use_speaker_boost": True,
            },
        },
        binario=True,
    )
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_bytes(audio)
    return saida


def aparar_silencio(entrada: Path, saida: Path) -> Path:
    """
    Corta o silencio das PONTAS do que o TTS devolveu.

    POR QUE ISTO EXISTE

    A ElevenLabs entrega cada frase com um respiro antes e uma cauda depois —
    entre 0,15 e 0,4 segundo somando os dois. Numa fala de 5 segundos isso
    desaparece. Numa de 0,8 — "Link.", "Coça?", "Ponta grudenta." — esse
    respiro E a fala inteira: o motor mandava acelerar o audio pra caber, e o
    que estava sobrando era silencio, nao voz. O resultado era uma palavra
    curta saindo esganicada sem motivo.

    Aparando primeiro, o encaixe passa a medir a VOZ, e nao o ar em volta dela.
    Foi o que resolveu seis dos oito estouros da demanda de uma vez so, sem
    reescrever uma linha de copy.

    `-60dB` e proposital: acima disso comeca a comer a consoante inicial de
    palavras como "stop" e "ponta", e a fala vira "onta".
    """
    saida.parent.mkdir(parents=True, exist_ok=True)
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(entrada),
        "-af",
        # do comeco: para de cortar assim que aparece som
        "silenceremove=start_periods=1:start_silence=0:start_threshold=-60dB:detection=peak,"
        # do fim: inverte, corta o comeco (que era o fim), desinverte
        "areverse,"
        "silenceremove=start_periods=1:start_silence=0:start_threshold=-60dB:detection=peak,"
        "areverse",
        str(saida),
    ])
    return saida


def encaixar(entrada: Path, saida: Path, alvo_seg: float) -> dict:
    """
    Ajusta a fala pra caber em `alvo_seg`.

    Apara o silencio das pontas, depois acelera no maximo ACELERACAO_MAXIMA. Se
    ainda assim estourar, devolve `precisa_encurtar` com quantos segundos
    sobram - a correcao ali e no TEXTO, nao no audio.
    """
    bruto = sondar(entrada).duracao
    if bruto <= 0:
        raise RuntimeError(f"audio vazio: {entrada}")

    # Apara antes de medir: o que interessa e quanto tempo a VOZ ocupa.
    aparado = entrada.with_name(f"{entrada.stem}_aparado.wav")
    aparar_silencio(entrada, aparado)
    gerado = sondar(aparado).duracao

    # Se aparar levou tudo, o audio era so silencio — segue com o original em
    # vez de gravar um arquivo vazio na trilha.
    if gerado <= 0.02:
        aparado = entrada
        gerado = bruto

    fator = gerado / alvo_seg if alvo_seg > 0 else 1.0
    aplicado = min(max(fator, 1.0), ACELERACAO_MAXIMA)

    # atempo aceita 0.5..2.0 por etapa; aqui nunca passa disso
    filtro = f"atempo={aplicado:.4f}" if aplicado > 1.001 else "anull"
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(aparado),
        "-af", filtro,
        "-ar", "48000", "-ac", "1",
        str(saida),
    ])

    final = sondar(saida).duracao
    sobra = round(final - alvo_seg, 2)
    return {
        "bruto": round(bruto, 2),
        "gerado": round(gerado, 2),
        "aparado": round(bruto - gerado, 2),
        "alvo": round(alvo_seg, 2),
        "acelerado": round(aplicado, 3),
        "final": round(final, 2),
        "sobra": sobra,
        "precisa_encurtar": sobra > 0.15,
    }


# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(prog="voz")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("vozes", help="lista as vozes da sua conta")

    p = sub.add_parser("falar", help="sintetiza um texto")
    p.add_argument("texto")
    p.add_argument("--voz", required=True)
    p.add_argument("--saida", required=True)
    p.add_argument("--modelo", default=MODELO_PADRAO)

    a = ap.parse_args()

    if a.cmd == "vozes":
        vozes = listar_vozes()
        passo(f"{len(vozes)} vozes na conta")
        print(f"{'nome':<22} | {'genero':<8} | {'sotaque':<14} | id")
        print("-" * 78)
        for v in vozes:
            print(f"{str(v['nome'])[:22]:<22} | {str(v['genero'])[:8]:<8} | "
                  f"{str(v['sotaque'])[:14]:<14} | {v['id']}")
        salvar_json(RAIZ / "trabalho" / "vozes.json", {"vozes": vozes})

    elif a.cmd == "falar":
        destino = Path(a.saida)
        falar(a.texto, a.voz, destino, a.modelo)
        info = sondar(destino)
        ok(f"{destino.name} - {info.duracao:.2f}s")


if __name__ == "__main__":
    main()
