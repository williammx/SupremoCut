"""
SupremoCut - conferir a entrega ANTES de mandar pro cliente.

POR QUE ISTO EXISTE

Montei varios anuncios em paralelo pra ir mais rapido e dois deles escreveram
na mesma pasta temporaria. O Everyday Finds saiu com a trilha do Goltali: 34,6
segundos de audio num video de 30,6. Nenhum comando falhou. Nenhum log
reclamou. O arquivo ficou em `saida/aprovado` com cara de pronto.

A licao nao e "nao rode em paralelo" — isso ja foi corrigido no montador. E
que a unica prova de que um video esta certo e MEDIR o video, e nao confiar em
que o processo terminou sem erro.

O QUE E CONFERIDO

  1. duracao — tem que bater com a do video de origem, no quadro
  2. audio    — a fala do MP4 tem que ter o mesmo tamanho da trilha que foi
                montada pra ele; se pegou a trilha do vizinho, aparece aqui
  3. volume   — todos em -14 LUFS, senao um grita e o outro sussurra
  4. sobra    — quantos segundos de imagem rodam sem voz no fim

Rodar:  python conferir_entrega.py
        python conferir_entrega.py --pasta continuo
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import audio as mod_audio
from comum import RAIZ, sondar
from narracao import TRABALHO, dados_do_anuncio

ORDEM = [
    ("Origyn", "origyn"),
    ("Origyn 2", "origyn-2"),
    ("Homefaves uk", "homefaves-uk"),
    ("Everyday Finds", "everyday-finds"),
    ("Goltali", "goltali"),
    ("Londonget Gift", "londonget-gift"),
    ("Ventra finds", "ventra-finds"),
    ("Waregami", "waregami"),
    ("Genius finds", "genius-finds"),
    ("Lilyrhyme", "lilyrhyme"),
    ("Digg It", "digg-it"),
    ("Othor shopping", "othor-shopping"),
]

TOLERANCIA_DUR = 0.15   # segundos
TOLERANCIA_FALA = 0.35  # segundos
_SIL = re.compile(r"silence_(start|end):\s*(-?[\d.]+)")


def fim_da_fala(arquivo: Path) -> float:
    """
    Segundo em que a ultima palavra termina.

    A UNICA pausa que interessa e a que vai ate o fim do arquivo. Uma versao
    anterior desta funcao procurava "o ultimo silencio com mais de meio
    segundo" e, quando o video terminava logo depois da fala, pulava esse
    silencio curto e devolvia uma PAUSA INTERNA la do meio — o Lilyrhyme
    aparecia com 11,5s de sobra quando tinha 0,4s.

    O jeito certo e olhar so a ultima marca: se for `silence_start`, o arquivo
    acaba em silencio e e ali que a fala parou. Se for `silence_end`, o audio
    vai falando ate o ultimo quadro.
    """
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(arquivo),
         # -60 dB e nao -45: a trilha passa por `loudnorm`, que levanta o piso
         # de ruido: no limiar mais alto nenhum silencio era detectado e toda
         # peca aparecia com sobra zero, inclusive as que tinham dois segundos.
         "-af", "silencedetect=noise=-60dB:d=0.25", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    dur = sondar(arquivo).duracao
    marcas = _SIL.findall(p.stderr or "")
    if marcas and marcas[-1][0] == "start":
        return float(marcas[-1][1])
    return dur


def envelope(arquivo: Path, por_segundo: int = 10) -> list[float]:
    """
    O desenho do volume ao longo do tempo, dez pontos por segundo.

    Le a onda de verdade em vez de pedir estatistica pro ffmpeg: uma tentativa
    anterior usou `astats` com `reset`, que conta QUADROS e nao segundos, e o
    resultado dependia da taxa de amostragem de cada arquivo — a comparacao
    reprovava ate video que estava certo.

    Aqui os dois lados sao trazidos pro mesmo terreno (8 kHz, mono, 16 bits) e
    a media absoluta e calculada em fatias de tamanho fixo. O que sobra e a
    silhueta da narracao: onde ela fala, onde respira, onde para.
    """
    taxa = 8000
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(arquivo),
         "-ac", "1", "-ar", str(taxa), "-f", "s16le", "-"],
        capture_output=True,
    )
    dados = array("h")
    dados.frombytes(p.stdout[: len(p.stdout) // 2 * 2])
    fatia = taxa // por_segundo
    return [
        sum(abs(v) for v in dados[i:i + fatia]) / fatia
        for i in range(0, len(dados) - fatia, fatia)
    ]


LIMITE = 0.75


def parecido(a: Path, b: Path, limite: float = LIMITE) -> bool:
    """
    As duas narracoes sobem e descem nos mesmos lugares?

    Nao compara volume — o nivelamento em -14 LUFS ja mudou o do MP4. Compara
    FORMATO, pela correlacao das duas silhuetas. Duas leituras diferentes tem
    pausas em lugares diferentes e nao passam nem perto de 0,75; a mesma peca,
    antes e depois de nivelar, fica acima de 0,95.
    """
    x, y = envelope(a), envelope(b)
    n = min(len(x), len(y))
    if n < 20:
        return True  # curto demais pra afirmar qualquer coisa
    x, y = x[:n], y[:n]
    mx, my = sum(x) / n, sum(y) / n
    num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
    den = (sum((x[i] - mx) ** 2 for i in range(n)) *
           sum((y[i] - my) ** 2 for i in range(n))) ** 0.5
    return den == 0 or num / den >= limite


def main() -> None:
    ap = argparse.ArgumentParser(prog="conferir_entrega")
    ap.add_argument("--pasta", default="aprovado")
    a = ap.parse_args()

    pasta = RAIZ / "saida" / a.pasta
    print()
    print(f"  conferindo {pasta}")
    print()
    print(f"  {'anúncio':<16}{'vídeo':>8}{'fonte':>8}{'fala':>8}{'sobra':>8}{'LUFS':>8}   diagnóstico")
    print("  " + "-" * 76)

    problemas: list[str] = []

    for nome, slug in ORDEM:
        mp4 = pasta / f"{slug}-pt.mp4"
        if not mp4.exists():
            print(f"  {nome:<16}{'—':>8}{'':>8}{'':>8}{'':>8}{'':>8}   NÃO EXISTE")
            problemas.append(f"{nome}: não foi entregue")
            continue

        dados = dados_do_anuncio(nome)
        fonte = sondar(Path(dados["origem"])).duracao if dados else 0.0
        info = sondar(mp4)
        trilha = RAIZ / "trabalho" / "narracao" / nome / "trilha.wav"

        medida = mod_audio.medir_loudness(mp4)
        lufs = float(medida["input_i"]) if medida else 0.0

        queixas = []
        if abs(info.duracao - fonte) > TOLERANCIA_DUR:
            queixas.append(f"duração {info.duracao:.1f}s ≠ fonte {fonte:.1f}s")

        # A sobra sai da FALA ENCAIXADA, nao do MP4 nem da trilha.
        #
        # Os dois passaram por `loudnorm`, que transforma silencio digital em
        # ruido de fundo baixinho — acima do limiar do `silencedetect`. Medido
        # ali, todo anuncio aparecia com sobra zero, inclusive os que tinham
        # dois segundos de imagem calada.
        #
        # `narracao.wav` e a fala depois de aparada e encaixada, sem a base de
        # silencio embaixo: a duracao dele E o tamanho da fala, sem detector
        # nenhum no meio.
        fala = TRABALHO / "recebido" / nome / "narracao.wav"
        if fala.exists():
            fim = sondar(fala).duracao
            sobra = fonte - fim
        else:
            fim, sobra = 0.0, 0.0

        if trilha.exists():
            if not parecido(mp4, trilha):
                queixas.append("o áudio NÃO é o desta peça")
        else:
            queixas.append("sem trilha pra comparar")

        if abs(lufs + 14.0) > 0.6:
            queixas.append(f"{lufs:.1f} LUFS")

        print(
            f"  {nome:<16}{info.duracao:>7.1f}s{fonte:>7.1f}s{fim:>7.1f}s"
            f"{sobra:>7.1f}s{lufs:>8.1f}   " + ("; ".join(queixas) if queixas else "ok")
        )
        if queixas:
            problemas.append(f"{nome}: " + "; ".join(queixas))

    print()
    if problemas:
        print(f"  {len(problemas)} com problema:")
        for p in problemas:
            print(f"    - {p}")
    else:
        print(f"  os {len(ORDEM)} conferidos e certos")
    print()


if __name__ == "__main__":
    main()
