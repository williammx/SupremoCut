"""
SupremoCut - o portugues esta mais curto que o original, ou e o ritmo do anuncio?

O dublar.py avisa quando uma fala deixa mais de 0,8s de silencio na janela dela.
Mas a janela vem do Whisper rodado no ORIGINAL, e ela inclui a pausa natural
entre frases — se o ingles falava 3s numa janela de 4s, aquele segundo de
silencio JA ESTAVA no anuncio. Copiar esse silencio nao e defeito, e fidelidade.

Este script separa uma coisa da outra: mede quanto tempo de VOZ existe de fato
dentro de cada janela do original, e compara com a duracao da fala em portugues.

  diferenca perto de zero -> o portugues acompanha o ritmo do original
  portugues muito menor    -> a copy ficou curta mesmo, vale alongar

Rodar:  python medir_ritmo.py "Digg It"
"""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

from comum import RAIZ, ler_json, sondar

FICHAS = RAIZ / "projetos" / "_dublagem"
TRABALHO = RAIZ / "trabalho" / "dublagem"

_SIL = re.compile(r"silence_(start|end):\s*(-?[\d.]+)")


def silencios(audio: Path, limiar: float = -34.0, minimo: float = 0.2) -> list[tuple[float, float]]:
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(audio),
         "-af", f"silencedetect=noise={limiar}dB:d={minimo}", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    faixas, ini = [], None
    for tipo, v in _SIL.findall(p.stderr or ""):
        if tipo == "start":
            ini = float(v)
        elif ini is not None:
            faixas.append((ini, float(v)))
            ini = None
    return faixas


def voz_na_janela(sil: list[tuple[float, float]], a: float, b: float) -> float:
    """Quanto tempo de VOZ existe entre a e b (a janela menos os silencios)."""
    mudo = sum(max(0.0, min(b, s2) - max(a, s1)) for s1, s2 in sil)
    return max(0.0, (b - a) - mudo)


def main() -> None:
    ap = argparse.ArgumentParser(prog="medir_ritmo")
    ap.add_argument("nome", help="nome da ficha, ex.: \"Digg It\"")
    a = ap.parse_args()

    ficha = ler_json(FICHAS / f"{a.nome}.json")
    origem = Path(ficha["origem"])
    pasta = TRABALHO / a.nome

    bruto = RAIZ / "trabalho" / "ritmo.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(origem), "-vn",
         "-ar", "16000", "-ac", "1", str(bruto)],
        check=True,
    )
    sil = silencios(bruto)

    falas = [f for f in ficha["falas"] if (f.get("pt") or "").strip()]
    print()
    print(f"  {'#':>3}  {'janela':>7}  {'voz orig':>9}  {'voz pt':>7}  {'dif':>7}")
    print("  " + "-" * 44)

    soma_orig = soma_pt = 0.0
    curtas = []

    for i, f in enumerate(falas, 1):
        janela = f["fim"] - f["inicio"]
        orig = voz_na_janela(sil, f["inicio"], f["fim"])
        arq = pasta / f"{i:02d}.wav"
        pt = sondar(arq).duracao if arq.exists() else 0.0
        dif = pt - orig
        soma_orig += orig
        soma_pt += pt
        marca = ""
        if dif < -0.6:
            marca = "  <- curta"
            curtas.append(i)
        print(f"  {i:>3}  {janela:>6.2f}s  {orig:>8.2f}s  {pt:>6.2f}s  {dif:>+6.2f}s{marca}")

    print("  " + "-" * 44)
    print(f"  {'total':>3}  {'':>7}  {soma_orig:>8.2f}s  {soma_pt:>6.2f}s  {soma_pt - soma_orig:>+6.2f}s")
    print()
    if curtas:
        print(f"  falas mais de 0,6s abaixo do original: {curtas}")
    else:
        print("  o portugues acompanha o ritmo do original — os 'vazios' sao do anuncio")
    print()


if __name__ == "__main__":
    main()
