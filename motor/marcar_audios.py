"""
SupremoCut - carimba os audios ja sintetizados com o texto que os gerou.

Os mp3 da primeira rodada foram gravados antes de o dublar.py passar a anotar,
ao lado de cada um, a frase que o originou. Sem essa anotacao ele nao tem como
saber se o audio ainda corresponde ao texto, e sintetiza tudo de novo — pagando
a ElevenLabs por algo que ja esta no disco.

Isto so precisa rodar uma vez. Daqui pra frente o proprio dublar.py carimba.
"""

from __future__ import annotations

from pathlib import Path

from comum import RAIZ, ler_json, ok, passo

FICHAS = RAIZ / "projetos" / "_dublagem"
TRABALHO = RAIZ / "trabalho" / "dublagem"


def main() -> None:
    passo("carimbando os audios ja gerados")
    total = 0

    for ficha_path in sorted(FICHAS.glob("*.json")):
        pasta = TRABALHO / ficha_path.stem
        if not pasta.exists():
            continue

        ficha = ler_json(ficha_path)
        falas = [f for f in ficha.get("falas", []) if (f.get("pt") or "").strip()]

        n = 0
        for i, f in enumerate(falas, 1):
            cru = pasta / f"{i:02d}_cru.mp3"
            marca = pasta / f"{i:02d}.txt"
            if not cru.exists() or marca.exists():
                continue
            marca.write_text(f["pt"], encoding="utf-8")
            n += 1

        if n:
            print(f"  {ficha_path.stem:<18} {n:>2} audios carimbados")
            total += n

    print()
    ok(f"{total} audios agora sabem de que texto vieram")


if __name__ == "__main__":
    main()
