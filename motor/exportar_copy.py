"""
SupremoCut - gera o documento com a copy dos anuncios.

Serve pra revisar antes de entregar e pra mandar ao cliente junto com os MP4:
tempo, o que o original dizia, e o que ficou em portugues, lado a lado.
"""

from __future__ import annotations

from pathlib import Path

from comum import RAIZ, ler_json, ok, passo

FICHAS = RAIZ / "projetos" / "_dublagem"
DESTINO = RAIZ / "saida" / "COPY DOS ANUNCIOS.md"

# a ordem em que o cliente recebe
ORDEM = [
    "Origyn", "Origyn 2", "Homefaves uk", "Everyday Finds", "Goltali",
    "Londonget Gift", "Ventra finds", "Waregami", "Genius finds",
    "Lilyrhyme", "Digg It",
]

IDIOMA = {"en": "inglês", "it": "italiano", "ru": "russo"}

# O Othor nao tem ficha: nao tem locucao. A copy dele vive em othor.py, como
# tarja sobre a legenda queimada em russo.
from othor import CARTAS as OTHOR


def mmss(s: float) -> str:
    return f"{int(s // 60)}:{s % 60:05.2f}"


def main() -> None:
    passo("montando o documento da copy")
    L: list[str] = []
    L.append("# Copy dos anúncios em português\n")
    L.append(
        "Não é tradução: é a frase que um anúncio brasileiro diria, escrita para "
        "caber no tempo da fala original. Por isso algumas linhas dizem menos que "
        "o inglês e outras dizem mais — o que manda é o relógio.\n"
    )
    L.append("Voz: **Bia** (ElevenLabs, `eleven_multilingual_v2`).\n")

    total_falas = 0

    for nome in ORDEM:
        caminho = FICHAS / f"{nome}.json"
        if not caminho.exists():
            continue
        ficha = ler_json(caminho)
        falas = ficha.get("falas", [])
        total_falas += len(falas)
        idioma = IDIOMA.get(ficha.get("idioma_original", ""), ficha.get("idioma_original", ""))
        dur = falas[-1]["fim"] if falas else 0

        L.append(f"\n---\n\n## {nome}\n")
        L.append(f"Original em {idioma} · {len(falas)} falas · {dur:.1f}s\n")
        L.append("| tempo | português | original |")
        L.append("|---|---|---|")
        for f in falas:
            pt = (f.get("pt") or "").replace("|", "\\|")
            orig = (f.get("original") or "").replace("|", "\\|")
            L.append(f"| {mmss(f['inicio'])} | **{pt}** | {orig} |")

    # ---- o sem locucao ----
    L.append("\n---\n\n## Othor shopping\n")
    L.append(
        "Sem locução: o anúncio tem música e **legenda queimada em russo**. "
        "O texto abaixo entra como tarja por cima da legenda original, e a "
        f"música do anúncio é mantida. {len(OTHOR)} cartas · 16,3s\n"
    )
    L.append("| tempo | português |")
    L.append("|---|---|")
    for ini, _fim, texto in OTHOR:
        L.append(f"| {mmss(ini)} | **{texto}** |")
    total_falas += len(OTHOR)

    L.append(f"\n---\n\n{total_falas} falas em 12 anúncios.\n")

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text("\n".join(L), encoding="utf-8")
    ok(f"{DESTINO.name} — {total_falas} falas")


if __name__ == "__main__":
    main()
