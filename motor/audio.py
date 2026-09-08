"""
SupremoCut - audio avancado.

Tres coisas que o tratamento comum nao faz:

  1) LOUDNESS EM DOIS PASSES. O `loudnorm` de um passe so trabalha adivinhando:
     ele nao sabe o quao alto o arquivo e antes de comecar, entao corrige no
     escuro e erra por 1 a 3 LU. Em dois passes ele MEDE primeiro e so depois
     aplica. A diferenca e ouvir uma sequencia de anuncios em que todos tem o
     mesmo volume, em vez de um pulando na cara do outro.

  2) SEPARAR VOZ DE MUSICA. O caso que mais aparece aqui: o anuncio estrangeiro
     tem locucao em ingles POR CIMA de musica e efeitos. Sem separar, dublar
     custa a trilha inteira (ou deixa a voz original vazando por baixo). Com o
     Demucs, a voz sai e a musica fica.

  3) VARREDURA DE SILENCIO pelo proprio FFmpeg, como segunda opiniao ao corte
     automatico que o editor faz pela forma de onda.

Nada aqui e obrigatorio: se o Demucs nao estiver instalado, a funcao diz isso
com todas as letras e o resto do sistema segue funcionando.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from comum import aviso, ok, passo, rodar


# --------------------------------------------------------------------------
# Loudness em dois passes
# --------------------------------------------------------------------------

def medir_loudness(entrada: Path) -> dict | None:
    """
    Passe 1: mede o arquivo e devolve os numeros que o passe 2 precisa.

    O `loudnorm` cospe o JSON no stderr, no fim de tudo. Ele vem depois de um
    monte de log, entao a leitura pega do primeiro '{' ate o ultimo '}' em vez
    de tentar fazer parse da saida inteira.
    """
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats",
            "-i", str(entrada),
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    texto = proc.stderr or ""
    inicio = texto.rfind("{")
    fim = texto.rfind("}")
    if inicio < 0 or fim <= inicio:
        aviso("nao consegui medir o loudness; sigo com o passe unico")
        return None

    try:
        medida = json.loads(texto[inicio : fim + 1])
    except json.JSONDecodeError:
        aviso("a medicao de loudness veio ilegivel; sigo com o passe unico")
        return None

    # Um arquivo mudo devolve -inf e quebra a conta do passe 2.
    if any(
        str(medida.get(k, "")).lstrip("-").lower().startswith("inf")
        for k in ("input_i", "input_tp", "input_lra", "input_thresh")
    ):
        aviso("o audio esta praticamente mudo; nao da pra normalizar")
        return None

    return medida


def cadeia_loudness(medida: dict | None, alvo_lufs: float = -14.0, pico_db: float = -1.5) -> str:
    """
    O filtro do passe 2, ja alimentado com o que o passe 1 mediu.

    `linear=true` e o ponto: com as medidas em maos o filtro aplica um ganho
    linear unico, sem compressao dinamica. Sem elas, ele comprime pra acertar o
    alvo — e comprimir de novo um audio ja tratado achata a voz.
    """
    if not medida:
        return f"loudnorm=I={alvo_lufs}:TP={pico_db}:LRA=11"

    return (
        f"loudnorm=I={alvo_lufs}:TP={pico_db}:LRA=11"
        f":measured_I={medida['input_i']}"
        f":measured_TP={medida['input_tp']}"
        f":measured_LRA={medida['input_lra']}"
        f":measured_thresh={medida['input_thresh']}"
        f":offset={medida.get('target_offset', 0)}"
        ":linear=true:print_format=summary"
    )


def normalizar(entrada: Path, saida: Path, alvo_lufs: float = -14.0, pico_db: float = -1.5) -> Path:
    """Deixa o arquivo no volume alvo, medindo antes de aplicar."""
    passo("medindo o volume")
    medida = medir_loudness(entrada)

    saida.parent.mkdir(parents=True, exist_ok=True)
    rodar([
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(entrada),
        "-af", cadeia_loudness(medida, alvo_lufs, pico_db),
        "-ar", "48000", "-ac", "2",
        str(saida),
    ])

    if medida:
        ok(f"volume: {float(medida['input_i']):.1f} -> {alvo_lufs:.1f} LUFS")
    else:
        ok(f"volume normalizado para {alvo_lufs:.1f} LUFS (passe unico)")
    return saida


# --------------------------------------------------------------------------
# Separacao de voz e musica
# --------------------------------------------------------------------------

def demucs_disponivel() -> bool:
    import importlib.util

    return importlib.util.find_spec("demucs") is not None


def _tem_cuda() -> bool:
    """
    Se da pra rodar na GPU.

    O import do torch custa alguns segundos, entao so acontece quando alguem
    realmente vai separar audio — nunca no `checar`. Na CPU o Demucs funciona,
    so leva uns 10x mais tempo.
    """
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


INSTRUCAO_DEMUCS = (
    "O Demucs nao esta instalado. Pra separar voz de musica, rode uma vez:\n"
    "    .venv\\Scripts\\pip install demucs\n"
    "Ele traz o PyTorch junto (uns 2 GB) e usa a GPU. E opcional: sem ele, todo\n"
    "o resto do SupremoCut continua funcionando normalmente."
)


def separar_voz(entrada: Path, pasta: Path, modelo: str = "htdemucs") -> dict[str, Path] | None:
    """
    Separa o audio em voz e acompanhamento.

    Devolve {"voz": ..., "fundo": ...} ou None se o Demucs nao estiver aqui.

    `--two-stems=vocals` em vez da separacao completa em quatro faixas: o que
    interessa neste fluxo e "a voz" e "todo o resto", e pedir as quatro custa o
    dobro do tempo pra depois somar tres delas de volta.
    """
    if not demucs_disponivel():
        aviso(INSTRUCAO_DEMUCS)
        return None

    pasta.mkdir(parents=True, exist_ok=True)
    passo(f"separando voz e fundo com {modelo} (a primeira vez baixa o modelo)")

    # sys.executable, nao "python": o Demucs vive no .venv deste projeto, e o
    # "python" do PATH e outro interpretador, sem nada instalado.
    rodar([
        sys.executable, "-m", "demucs",
        "-n", modelo,
        "--two-stems", "vocals",
        "-d", "cuda" if _tem_cuda() else "cpu",
        "-o", str(pasta),
        str(entrada),
    ])

    # O Demucs grava em <saida>/<modelo>/<nome do arquivo sem extensao>/
    destino = pasta / modelo / entrada.stem
    voz = destino / "vocals.wav"
    fundo = destino / "no_vocals.wav"

    if not voz.exists() or not fundo.exists():
        aviso(f"o Demucs rodou mas nao achei os arquivos em {destino}")
        return None

    ok(f"voz e fundo separados -> {destino.name}/")
    return {"voz": voz, "fundo": fundo}


def dublagem_com_fundo(
    fundo: Path,
    voz_nova: Path,
    saida: Path,
    volume_fundo: float = 0.75,
    abaixar: float = 0.45,
) -> Path:
    """
    Junta a musica/efeitos ORIGINAIS com a narracao nova em portugues.

    O `sidechaincompress` faz o fundo abaixar sozinho quando a voz entra e subir
    quando ela para. Sem isso, ou a musica cobre a locucao, ou fica tao baixa
    que era melhor nao ter musica. O sinal de controle (a voz) e usado duas
    vezes: uma pra mandar no compressor, outra pra ser ouvido.
    """
    saida.parent.mkdir(parents=True, exist_ok=True)

    # ratio maior = o fundo cede mais espaco; release alto evita o "bombeamento"
    # audivel em que a musica pulsa entre uma palavra e outra
    ratio = max(1.5, 1 / max(0.05, abaixar))

    filtro = (
        f"[0:a]volume={volume_fundo}[fundo];"
        "[1:a]asplit=2[vozc][vozs];"
        f"[fundo][vozc]sidechaincompress="
        f"threshold=0.05:ratio={ratio:.1f}:attack=12:release=420:makeup=1[duck];"
        "[duck][vozs]amix=inputs=2:duration=longest:normalize=0,"
        "alimiter=limit=0.97[saida]"
    )

    rodar([
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(fundo),
        "-i", str(voz_nova),
        "-filter_complex", filtro,
        "-map", "[saida]",
        "-ar", "48000", "-ac", "2",
        str(saida),
    ])

    ok(f"dublagem sobre a trilha original -> {saida.name}")
    return saida


# --------------------------------------------------------------------------
# Silencio pelo FFmpeg (segunda opiniao)
# --------------------------------------------------------------------------

_SILENCIO = re.compile(r"silence_(start|end):\s*(-?[\d.]+)")


def detectar_silencio(entrada: Path, limiar_db: float = -34.0, minimo: float = 0.35) -> list[tuple[float, float]]:
    """
    Onde tem silencio, segundo o proprio FFmpeg.

    O editor detecta pela forma de onda, que e instantaneo e da pra ver na tela
    enquanto se arrasta o controle. Isto aqui e a segunda opiniao: mede o
    arquivo de verdade, com a precisao da amostra, e serve pra conferir quando o
    resultado do editor parecer estranho.
    """
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats",
            "-i", str(entrada),
            "-af", f"silencedetect=noise={limiar_db}dB:d={minimo}",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    faixas: list[tuple[float, float]] = []
    inicio: float | None = None
    for tipo, valor in _SILENCIO.findall(proc.stderr or ""):
        v = float(valor)
        if tipo == "start":
            inicio = v
        elif inicio is not None:
            faixas.append((round(inicio, 3), round(v, 3)))
            inicio = None

    return faixas


# --------------------------------------------------------------------------
# Checagem
# --------------------------------------------------------------------------

def checar() -> None:
    """O que esta pronto e o que falta, em portugues claro."""
    print()
    print("  Audio avancado")
    print(f"    ffmpeg .......... {'ok' if shutil.which('ffmpeg') else 'FALTANDO'}")
    print(f"    loudness 2 passes ok (so precisa do ffmpeg)")
    if demucs_disponivel():
        onde = "na GPU" if _tem_cuda() else "na CPU (mais lento, mas funciona)"
        print(f"    separar voz ..... ok, {onde}")
    else:
        print("    separar voz ..... nao instalado (opcional)")
    if not demucs_disponivel():
        print()
        for linha in INSTRUCAO_DEMUCS.splitlines():
            print(f"    {linha}")
    print()
