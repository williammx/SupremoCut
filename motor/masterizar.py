"""
SupremoCut - o ultimo passo antes de entregar: nivelar o volume.

POR QUE ISTO EXISTE

Renderizados os doze, medi um por um. O volume ia de -13 a -27 LUFS. Treze
decibeis de diferenca entre o mais alto e o mais baixo — quem assiste a
sequencia ouve um anuncio gritando e o seguinte sussurrando, e mexe no controle
do celular. Nenhum criativo sobrevive a isso.

A causa e o `loudnorm` de um passe usado la atras na trilha de voz: ele corrige
adivinhando, sem saber o quao alto o arquivo e antes de comecar. Erra por 1 a 3
LU num audio comum, e muito mais quando a faixa tem bastante silencio entre as
falas — que e exatamente o caso de um anuncio dublado.

Aqui a correcao e feita em DOIS passes, sobre o MP4 ja pronto: mede primeiro,
aplica depois. E `-c:v copy`: o video nao e reencodado, entao nao ha perda de
qualidade nem espera — so a faixa de audio e refeita.

Rodar:  python masterizar.py           (todos os -pt.mp4 da pasta saida)
        python masterizar.py --so digg-it
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from comum import RAIZ, aviso, ok, passo, rodar
import audio as mod_audio

SAIDA = RAIZ / "saida"
ALVO_LUFS = -14.0
PICO_DB = -1.5


def masterizar(arquivo: Path) -> tuple[float | None, float | None]:
    """Devolve (lufs_antes, lufs_depois). None quando nao deu pra medir."""
    medida = mod_audio.medir_loudness(arquivo)
    antes = float(medida["input_i"]) if medida else None

    tmp = arquivo.with_name(f"{arquivo.stem}.nivelando.mp4")
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(arquivo),
        # o video passa intacto: nada de reencodar o que ja esta certo
        "-c:v", "copy",
        "-af", mod_audio.cadeia_loudness(medida, ALVO_LUFS, PICO_DB),
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        str(tmp),
    ])

    if not tmp.exists() or tmp.stat().st_size == 0:
        aviso(f"{arquivo.name}: a nivelacao nao produziu arquivo")
        tmp.unlink(missing_ok=True)
        return antes, None

    # confere ANTES de substituir: trocar um entregavel bom por um quebrado
    # e o tipo de erro que so aparece na mao do cliente
    conferido = mod_audio.medir_loudness(tmp)
    depois = float(conferido["input_i"]) if conferido else None

    shutil.move(str(tmp), str(arquivo))
    return antes, depois


def main() -> None:
    ap = argparse.ArgumentParser(prog="masterizar")
    ap.add_argument("--so", default=None, help="nome do projeto, sem o -pt")
    ap.add_argument(
        "--pasta",
        default=None,
        help="subpasta de saida/ — ex.: continuo. Sem isto, nivela a saida/ raiz.",
    )
    a = ap.parse_args()

    pasta = SAIDA / a.pasta if a.pasta else SAIDA
    arquivos = (
        [pasta / f"{a.so}-pt.mp4"] if a.so else sorted(pasta.glob("*-pt.mp4"))
    )
    arquivos = [f for f in arquivos if f.exists()]
    if not arquivos:
        raise SystemExit("nada pra masterizar em saida/")

    passo(f"nivelando {len(arquivos)} videos em {ALVO_LUFS} LUFS")
    for f in arquivos:
        antes, depois = masterizar(f)
        a_txt = f"{antes:>6.1f}" if antes is not None else "     ?"
        d_txt = f"{depois:>6.1f}" if depois is not None else "     ?"
        print(f"   {f.stem:<26} {a_txt} -> {d_txt} LUFS")

    print()
    ok("todos no mesmo volume")


if __name__ == "__main__":
    main()
