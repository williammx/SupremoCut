"""
SupremoCut - quantos caracteres cabem em cada anuncio, no ritmo do Rafael.

POR QUE UMA TAXA NOVA

A taxa de 14 caracteres por segundo veio de medir a locucao original em ingles.
O Rafael, na voz que o Campelo escolheu, fala mais devagar — e a diferenca nao
e chute: dois anuncios ja gerados dao a mesma conta.

    Origyn     291 caracteres -> 22,46s   =  13,0 c/s
    Origyn 2   341 caracteres -> 26,28s   =  13,0 c/s

Duas medidas independentes batendo na terceira casa e o suficiente pra fixar a
taxa. Se uma voz nova entrar, e so gerar um bloco, medir, e trocar o numero
aqui — mas nunca adivinhar.

AS TAGS NAO CONTAM

`[curious]`, `[annoyed]` e companhia sao instrucoes pro modelo v3, nao texto
falado: ocupam caractere no editor e zero segundo no audio. Entao a conta
ignora tudo entre colchetes. Uma tag que produz SOM — `[exhales sharply]`,
`[chuckles]` — e outra historia: essa custa tempo real, e por isso o texto que
vai pro ar usa so as tonais.

Rodar:  python alvo_rafael.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from comum import sondar
from copy_continua import NARRACAO
from narracao import dados_do_anuncio

# medido, nao estimado — ver o cabecalho
TAXA = 13.0
# o respiro de imagem depois da ultima palavra
MARGEM = 0.4
# quanto da conta da pra errar sem que o encaixe force o audio
TOLERANCIA = 0.06

ORDEM = [
    "Origyn", "Origyn 2", "Homefaves uk", "Everyday Finds", "Goltali",
    "Londonget Gift", "Ventra finds", "Waregami", "Genius finds",
    "Lilyrhyme", "Digg It", "Othor shopping",
]

_TAG = re.compile(r"\[[^\]]*\]")


def falados(texto: str) -> int:
    """Caracteres que viram som — tag do v3 nao e um deles."""
    return len(_TAG.sub("", texto).strip())


def main() -> None:
    print()
    print(f"  ritmo do Rafael: {TAXA} caracteres por segundo")
    print()
    print(f"  {'anúncio':<16}{'vídeo':>8}{'cabem':>8}{'tenho':>8}   {'veredito'}")
    print("  " + "-" * 56)

    for nome in ORDEM:
        dados = dados_do_anuncio(nome)
        if not dados:
            print(f"  {nome:<16}   sem ficha")
            continue

        dur = sondar(Path(dados["origem"])).duracao
        cabem = int((dur - MARGEM) * TAXA)
        tenho = falados(NARRACAO.get(nome, ""))
        sobra = cabem - tenho

        if abs(sobra) <= cabem * TOLERANCIA:
            veredito = "ok"
        elif sobra < 0:
            veredito = f"cortar {-sobra}"
        else:
            veredito = f"cabe mais {sobra}"

        print(f"  {nome:<16}{dur:>7.1f}s{cabem:>8}{tenho:>8}   {veredito}")

    print()


if __name__ == "__main__":
    main()
