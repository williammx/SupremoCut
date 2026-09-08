"""
SupremoCut - compara as duas versoes da dublagem.

Mede o que o Campelo reclamou, em numero em vez de impressao: quanto do video
tem fala, e quantas pausas longas sobram no meio. A pausa do FIM nao conta —
todo anuncio termina com o ultimo plano rodando.

Rodar:  python comparar.py
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from comum import RAIZ, sondar

ANTES = RAIZ / "saida"
AGORA = RAIZ / "saida" / "continuo"

_SIL = re.compile(r"silence_(start|end):\s*(-?[\d.]+)")
# acima disto o ouvido registra como "parou"
PAUSA_LONGA = 1.2


def medir(arquivo: Path) -> tuple[int, int] | None:
    if not arquivo.exists():
        return None
    dur = sondar(arquivo).duracao
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(arquivo),
         "-af", f"silencedetect=noise=-40dB:d={PAUSA_LONGA}", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )

    mudo = 0.0
    no_meio = 0
    ini = None
    for tipo, v in _SIL.findall(p.stderr or ""):
        val = float(v)
        if tipo == "start":
            ini = val
            # a pausa final e o plano acabando, nao um buraco na narracao
            if val < dur - 2.0:
                no_meio += 1
        elif ini is not None:
            mudo += val - ini
            ini = None

    cobertura = int(round(100 * max(0.0, dur - mudo) / dur)) if dur > 0 else 0
    return cobertura, no_meio


def main() -> None:
    nomes = [
        "origyn", "origyn-2", "homefaves-uk", "everyday-finds", "goltali",
        "londonget-gift", "ventra-finds", "waregami", "genius-finds",
        "lilyrhyme", "digg-it", "othor-shopping",
    ]

    print()
    print(f"  {'anúncio':<18} {'antes':>16} {'agora':>16}")
    print("  " + "-" * 52)

    soma_a = soma_b = soma_pa = soma_pb = n = 0

    for nome in nomes:
        a = medir(ANTES / f"{nome}-pt.mp4")
        b = medir(AGORA / f"{nome}-pt.mp4")
        ta = f"{a[0]}% · {a[1]} pausas" if a else "—"
        tb = f"{b[0]}% · {b[1]} pausas" if b else "—"
        print(f"  {nome:<18} {ta:>16} {tb:>16}")
        if a and b:
            soma_a += a[0]
            soma_b += b[0]
            soma_pa += a[1]
            soma_pb += b[1]
            n += 1

    if n:
        print("  " + "-" * 52)
        print(
            f"  {'média':<18} {f'{soma_a // n}% · {soma_pa} pausas':>16} "
            f"{f'{soma_b // n}% · {soma_pb} pausas':>16}"
        )
    print()


if __name__ == "__main__":
    main()
