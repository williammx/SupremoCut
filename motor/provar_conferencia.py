"""
SupremoCut - prova que o conferidor sabe reprovar.

POR QUE ISTO EXISTE

Um teste que aprova tudo nao e um teste, e um carimbo. Antes de acreditar no
"os 12 conferidos e certos", vale medir o Goltali contra a trilha dos OUTROS
anuncios: se a correlacao com o vizinho tambem der alta, o conferidor nao esta
vendo nada e o carimbo nao vale.

O numero que interessa nao e o acerto — e a DISTANCIA entre o acerto e o erro.

Rodar:  python provar_conferencia.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from conferir_entrega import LIMITE, envelope
from comum import RAIZ


def correlacao(a: Path, b: Path) -> float:
    x, y = envelope(a), envelope(b)
    n = min(len(x), len(y))
    if n < 20:
        return float("nan")
    x, y = x[:n], y[:n]
    mx, my = sum(x) / n, sum(y) / n
    num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
    den = (sum((x[i] - mx) ** 2 for i in range(n)) *
           sum((y[i] - my) ** 2 for i in range(n))) ** 0.5
    return num / den if den else float("nan")


def main() -> None:
    mp4 = RAIZ / "saida" / "aprovado" / "goltali-pt.mp4"
    trilhas = RAIZ / "trabalho" / "narracao"

    print()
    print(f"  goltali-pt.mp4 comparado com cada trilha    (limite: {LIMITE})")
    print()

    certo = correlacao(mp4, trilhas / "Goltali" / "trilha.wav")
    outros: list[tuple[str, float]] = []
    for pasta in sorted(trilhas.iterdir()):
        t = pasta / "trilha.wav"
        if not t.exists() or pasta.name == "Goltali":
            continue
        outros.append((pasta.name, correlacao(mp4, t)))

    print(f"  {'Goltali (a certa)':<22}{certo:>8.3f}   {'passa' if certo >= LIMITE else 'REPROVA'}")
    print("  " + "-" * 44)
    for nome, c in sorted(outros, key=lambda x: -x[1]):
        print(f"  {nome:<22}{c:>8.3f}   {'PASSOU — RUIM' if c >= LIMITE else 'reprova, ok'}")

    pior = max((c for _, c in outros), default=0.0)
    print()
    print(f"  margem entre o certo e o errado mais parecido: {certo - pior:.3f}")
    print("  " + ("o conferidor separa os dois casos" if certo - pior > 0.2
                  else "MARGEM CURTA — o conferidor não é confiável"))
    print()


if __name__ == "__main__":
    main()
