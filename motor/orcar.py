"""
SupremoCut - quanto a dublagem vai custar de creditos.

A ElevenLabs cobra por caractere. Antes de disparar sete anuncios de uma vez,
vale saber se cabe no saldo — descobrir no meio da fila que acabou deixa metade
dublada e metade nao, e o que ja foi gasto nao volta.
"""

from __future__ import annotations

import json
from pathlib import Path

FICHAS = Path(__file__).resolve().parent.parent / "projetos" / "_dublagem"

# Os que ja foram sintetizados e renderizados numa rodada anterior.
PRONTOS = {"Origyn", "Origyn 2", "Homefaves uk", "Everyday Finds"}


def main() -> None:
    falta = 0
    feito = 0
    print()
    for p in sorted(FICHAS.glob("*.json")):
        ficha = json.loads(p.read_text(encoding="utf-8"))
        n = sum(len(f.get("pt", "")) for f in ficha.get("falas", []))
        if p.stem in PRONTOS:
            feito += n
            print(f"  {p.stem:<18} {n:>5} car   ja feito")
        else:
            falta += n
            print(f"  {p.stem:<18} {n:>5} car   A FAZER")

    print()
    print(f"  {'ja gasto antes':<18} {feito:>5} car")
    print(f"  {'falta sintetizar':<18} {falta:>5} car")
    print()


if __name__ == "__main__":
    main()
