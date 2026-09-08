"""
SupremoCut - dublagem de lote.

Fluxo em tres passos, com uma parada humana no meio (de proposito):

  1) python motor/dublar.py preparar <pasta>
     Le a varredura e escreve um dublagem.json por video, com o texto original
     e o campo `pt` VAZIO, ja mostrando quantos segundos cada fala tem.

  2) Alguem escreve o `pt`.
     Nao e traducao, e transcriacao: copy brasileira que cabe na janela. Este
     passo e humano porque copy que converte nao sai de traducao automatica.

  3) python motor/dublar.py falar <arquivo.json> [--voz ID]
     Sintetiza, encaixa no tempo, monta a trilha e entrega o video dublado.

O QUE ELE VIGIA
- fala que estourou a janela (avisa quantos segundos, pra encurtar o texto)
- silencio grande entre falas (buraco em anuncio custa atencao)
- fala vazia que ficou pra tras
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import RAIZ, aviso, ler_json, ok, passo, rodar, salvar_json, sondar  # noqa: E402
import voz as tts  # noqa: E402

# silencio maior que isto entre duas falas ja soa como buraco num anuncio curto
BURACO = 0.8


# --------------------------------------------------------------------------

def preparar(varredura: Path, destino: Path) -> None:
    """Transforma a varredura em fichas de dublagem prontas pra escrever."""
    d = ler_json(varredura)
    destino.mkdir(parents=True, exist_ok=True)
    feitos = 0

    for r in d["arquivos"]:
        if not r.get("tem_narracao"):
            continue
        ficha = {
            "origem": str(Path(d["pasta"]) / r["arquivo"]),
            "idioma_original": r.get("idioma", "?"),
            "voz": None,
            "modelo": tts.MODELO_PADRAO,
            "_como_preencher": (
                "Escreva o campo 'pt' de cada fala. Nao traduza ao pe da letra: "
                "escreva a frase que voce diria num anuncio brasileiro, e que "
                "caiba nos segundos indicados em 'janela'."
            ),
            "falas": [
                {
                    "inicio": s["t"],
                    "fim": s["fim"],
                    "janela": round(s["fim"] - s["t"], 2),
                    "original": s["texto"],
                    "pt": "",
                }
                for s in r["segmentos"]
            ],
        }
        alvo = destino / f"{Path(r['arquivo']).stem}.json"
        salvar_json(alvo, ficha)
        feitos += 1
        print(f"   {alvo.name:<28} {len(ficha['falas']):>2} falas, {r['palavras']:>4} palavras")

    ok(f"{feitos} fichas em {destino}")


# --------------------------------------------------------------------------

def falar(ficha_path: Path, voz_id: str | None, saida_dir: Path) -> Path:
    ficha = ler_json(ficha_path)
    origem = Path(ficha["origem"])
    if not origem.exists():
        raise SystemExit(f"Video original nao encontrado: {origem}")

    voz_id = voz_id or ficha.get("voz")
    if not voz_id:
        raise SystemExit(
            "Falta a voz. Passe --voz <id> ou preencha o campo 'voz' na ficha.\n"
            "Veja as opcoes com:  python motor/voz.py vozes"
        )

    falas = [f for f in ficha["falas"] if (f.get("pt") or "").strip()]
    vazias = len(ficha["falas"]) - len(falas)
    if not falas:
        raise SystemExit(f"Nenhuma fala traduzida em {ficha_path.name}")
    if vazias:
        aviso(f"{vazias} fala(s) sem texto em portugues — vao ficar mudas")

    nome = ficha_path.stem
    tmp = RAIZ / "trabalho" / "dublagem" / nome
    tmp.mkdir(parents=True, exist_ok=True)
    passo(f"{nome} — {len(falas)} falas")

    pecas, avisos = [], []

    reaproveitadas = 0

    for i, f in enumerate(falas, 1):
        alvo = f["fim"] - f["inicio"]
        cru = tmp / f"{i:02d}_cru.mp3"
        pronto = tmp / f"{i:02d}.wav"
        # o texto que gerou aquele mp3, gravado ao lado dele
        marca = tmp / f"{i:02d}.txt"

        anterior = marca.read_text(encoding="utf-8") if marca.exists() else None
        igual = anterior == f["pt"] and cru.exists() and cru.stat().st_size > 0

        if igual:
            # Mesmo texto, mesmo audio: nao ha nada de novo pra sintetizar, e
            # a ElevenLabs cobra por caractere. Reencaixar em cima do mp3 que
            # ja esta no disco custa zero e demora um piscar.
            reaproveitadas += 1
        else:
            tts.falar(f["pt"], voz_id, cru, ficha.get("modelo", tts.MODELO_PADRAO))
            marca.write_text(f["pt"], encoding="utf-8")

        r = tts.encaixar(cru, pronto, alvo)

        sinal = "!" if r["precisa_encurtar"] else " "
        print(
            f"   {sinal} {i:>2}. janela {r['alvo']:>5.2f}s | falado {r['gerado']:>5.2f}s | "
            f"x{r['acelerado']:.2f} -> {r['final']:>5.2f}s"
        )
        if r["precisa_encurtar"]:
            avisos.append(
                f"fala {i} estoura {r['sobra']}s mesmo acelerada — encurte o texto: "
                f"\"{f['pt'][:50]}\""
            )

        # sobra grande do outro lado tambem e problema: buraco no anuncio
        folga = alvo - r["final"]
        if folga > BURACO:
            avisos.append(
                f"fala {i} deixa {folga:.2f}s de silencio — alongue o texto ou "
                f"encoste a fala seguinte"
            )

        pecas.append((f["inicio"], pronto))

    # ---- monta a trilha ----
    dur = sondar(origem).duracao
    entradas = ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=mono"]
    for _, arq in pecas:
        entradas += ["-i", str(arq)]

    filtros, rotulos = [], []
    for j, (ini, _) in enumerate(pecas, start=1):
        ms = int(round(ini * 1000))
        filtros.append(f"[{j}:a]adelay={ms}|{ms}[d{j}]")
        rotulos.append(f"[d{j}]")

    filtros.append(f"[0:a]{''.join(rotulos)}amix=inputs={len(pecas)+1}:normalize=0[m]")
    # normaliza a voz pro mesmo alvo do resto do sistema
    filtros.append("[m]loudnorm=I=-14:TP=-1.5:LRA=11[voz]")

    trilha = tmp / "trilha.wav"
    rodar([
        "ffmpeg", "-y", "-v", "error", *entradas,
        "-filter_complex", ";".join(filtros),
        "-map", "[voz]", "-ar", "48000", "-ac", "2", str(trilha),
    ])

    # ---- vira um PROJETO do editor, nao um MP4 solto ----
    #
    # Antes isto cuspia o video pronto e acabava. O problema: os videos que
    # mais precisam da tarja de cobertura eram justamente os que nao abriam no
    # editor. Agora a dublagem entrega material EDITAVEL, e o render final sai
    # do editor como qualquer outro projeto.
    projeto = criar_projeto(nome, origem, trilha, falas)

    if reaproveitadas:
        ok(f"{reaproveitadas} de {len(falas)} falas reaproveitadas (nao gastaram credito)")
    ok(f"projeto '{projeto}' pronto — abra no editor")
    for a in avisos:
        print(f"      [!] {a}")

    ficha["voz"] = voz_id
    ficha["projeto"] = projeto
    salvar_json(ficha_path, ficha)
    return RAIZ / "projetos" / projeto / "roteiro.json"


def criar_projeto(nome: str, origem: Path, trilha: Path, falas: list[dict]) -> str:
    """
    Monta um projeto completo a partir do video original e da trilha dublada.

    O video e ampliado pra 1080x1920 (o material chega em 360x640; ampliar nao
    recupera detalhe, mas faz a tarja e o texto serem DESENHADOS em 1080 em vez
    de ampliados junto com o video).
    """
    import ondas
    import tratar

    projeto = nome.replace(" ", "-").lower()
    pasta_proj = RAIZ / "projetos" / projeto
    publica = RAIZ / "estudio" / "public" / projeto
    (pasta_proj / "bruto").mkdir(parents=True, exist_ok=True)
    publica.mkdir(parents=True, exist_ok=True)

    cfg = tratar.carregar_config()
    cfg["ampliar"] = {"largura": 1080, "altura": 1920, "filtro": "lanczos"}

    passo(f"Montando o projeto '{projeto}'")
    tratar.preparar_video(origem, publica / "camera.mp4", "camera", cfg)
    tratar.preparar_preview(origem, publica / "camera-preview.mp4", "camera", cfg)

    # a trilha dublada entra no lugar do audio da fonte
    rodar([
        "ffmpeg", "-y", "-v", "error", "-i", str(trilha),
        "-ar", "48000", "-ac", "2", str(publica / "audio-fonte.wav"),
    ])
    tratar.audio_preview(publica / "audio-fonte.wav", publica / "audio-fonte-preview.m4a")
    ondas.gerar(publica / "audio-fonte.wav", publica / "picos.json")

    info = sondar(origem)
    fps = int(round(info.fps)) or 30
    dur = round(sondar(publica / "audio-fonte.wav").duracao, 3)

    roteiro = {
        "versao": 1,
        "projeto": projeto,
        "fps": fps,
        "largura": 1080,
        "altura": 1920,
        "fontes": {
            "camera": {
                "arquivo": "camera.mp4",
                "arquivo_preview": "camera-preview.mp4",
                "offset": 0.0,
                "duracao": round(info.duracao, 3),
                "largura": 1080,
                "altura": 1920,
            },
            "tela": None,
        },
        "audio": {
            "arquivo": "audio-fonte.wav",
            "arquivo_preview": "audio-fonte-preview.m4a",
            "picos": "picos.json",
            "offset": 0.0,
        },
        # um bloco só, cobrindo o vídeo inteiro: os cortes quem decide é você
        "cenas": [
            {
                "id": "c001",
                "fonte_inicio": 0.0,
                "duracao": dur,
                "layout": "camera",
                "entrada": {"tipo": "corte"},
                "foco": None,
                "velocidade": 1,
                "volume": 1,
                "nota": "dublado",
            }
        ],
        # a copy em português entra como legenda, DESLIGADA por padrão —
        # está ali pra você ligar se quiser queimar legenda no vídeo
        "legendas": {
            "estilo": "nenhum",
            "ligada_em": [],
            "base_tempo": "fonte",
            "palavras": [
                {
                    "t": round(f["inicio"], 3),
                    "fim": round(f["fim"], 3),
                    "texto": f["pt"],
                    "enfase": False,
                }
                for f in falas
            ],
        },
        "overlays": [],
        "musica": None,
        # uma bandeirinha no começo de cada fala: navegar pelo que foi dito
        "marcadores": [
            {"t": round(f["inicio"], 2), "texto": f["pt"][:40]} for f in falas
        ],
    }

    salvar_json(pasta_proj / "roteiro.json", roteiro)
    return projeto


# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(prog="dublar")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("preparar", help="cria as fichas a partir da varredura")
    p.add_argument("--varredura", default=str(RAIZ / "trabalho" / "varredura.json"))
    p.add_argument("--destino", default=str(RAIZ / "projetos" / "_dublagem"))

    p = sub.add_parser("falar", help="sintetiza e monta o video dublado")
    p.add_argument("ficha", help="caminho do .json, ou 'todas'")
    p.add_argument("--voz", default=None)
    p.add_argument("--pasta", default=str(RAIZ / "projetos" / "_dublagem"))
    p.add_argument("--saida", default=str(RAIZ / "saida"))

    a = ap.parse_args()

    if a.cmd == "preparar":
        preparar(Path(a.varredura), Path(a.destino))

    elif a.cmd == "falar":
        saida = Path(a.saida)
        if a.ficha == "todas":
            fichas = sorted(Path(a.pasta).glob("*.json"))
            if not fichas:
                raise SystemExit(f"Nenhuma ficha em {a.pasta}")
            passo(f"Dublando {len(fichas)} videos")
            for f in fichas:
                try:
                    falar(f, a.voz, saida)
                except SystemExit as e:
                    aviso(f"{f.name}: {e}")
        else:
            falar(Path(a.ficha), a.voz, saida)


if __name__ == "__main__":
    main()
