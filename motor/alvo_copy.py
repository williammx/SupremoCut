"""
SupremoCut - quantos caracteres cabem em cada fala.

A primeira calibragem chutou 11 a 13 caracteres por segundo. O `medir_ritmo.py`
mostrou o preco disso: no Lilyrhyme o portugues ficou 10,5 segundos mais curto
que o ingles num anuncio de 41 — um quarto do tempo virando silencio que o
original nao tinha.

Medindo o audio que a voz da Bia realmente entregou, a taxa dela e de uns 14
caracteres por segundo. E esse o alvo agora. O teto de 15,5 existe porque o
encaixe acelera ate 1,12x — acima disso a frase sai apressada.

Rodar:  python alvo_copy.py            (todas as fichas)
        python alvo_copy.py "Digg It"  (uma so)
"""

from __future__ import annotations

import argparse

from comum import RAIZ, ler_json

FICHAS = RAIZ / "projetos" / "_dublagem"

# caracteres por segundo que a voz entrega de verdade
TAXA = 14.0
# acima disto a locucao fica apressada mesmo com o encaixe
TETO = 15.5


def main() -> None:
    ap = argparse.ArgumentParser(prog="alvo_copy")
    ap.add_argument("nome", nargs="?", default=None)
    a = ap.parse_args()

    alvos = (
        [FICHAS / f"{a.nome}.json"] if a.nome else sorted(FICHAS.glob("*.json"))
    )

    for caminho in alvos:
        ficha = ler_json(caminho)
        print(f"\n### {caminho.stem}")
        for i, f in enumerate(ficha.get("falas", []), 1):
            janela = f["fim"] - f["inicio"]
            pt = f.get("pt", "")
            ideal = int(janela * TAXA)
            maximo = int(janela * TETO)
            atual = len(pt)
            if atual > maximo:
                estado = "LONGA"
            elif atual < ideal - 8:
                estado = f"curta (falta {ideal - atual})"
            else:
                estado = "ok"
            print(f"  [{i:>2}] {janela:>5.2f}s  cabe {ideal:>3}  tem {atual:>3}  {estado:<16} {pt}")


if __name__ == "__main__":
    main()
