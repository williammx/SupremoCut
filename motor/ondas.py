"""
SupremoCut - forma de onda.

Sem ver o audio, cortar e chutar. Isto le a trilha final e gera os picos que
o editor desenha atras dos blocos, pra voce enxergar onde tem fala, onde tem
pausa e onde a frase termina.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from comum import ok

PICOS_POR_SEGUNDO = 50


def gerar(audio: Path, saida: Path, por_segundo: int = PICOS_POR_SEGUNDO) -> dict:
    """
    Devolve e grava { "por_segundo": 50, "duracao": 784.0, "picos": [0..255, ...] }

    Cada valor e o pico de volume daquela fatia, de 0 a 255. Inteiro pequeno
    de proposito: um podcast de 30 min vira um JSON de poucas centenas de KB.
    """
    import soundfile as sf

    dados, taxa = sf.read(str(audio), dtype="float32")
    if dados.ndim > 1:
        dados = dados.mean(axis=1)

    amostras_por_fatia = max(1, int(taxa / por_segundo))
    n = len(dados) // amostras_por_fatia
    if n == 0:
        resultado = {"por_segundo": por_segundo, "duracao": 0.0, "picos": []}
        saida.write_text(json.dumps(resultado), encoding="utf-8")
        return resultado

    blocos = np.abs(dados[: n * amostras_por_fatia].reshape(n, amostras_por_fatia))
    picos = blocos.max(axis=1)

    # raiz quadrada realca as partes baixas: numa fala normalizada a onda
    # crua fica quase toda no topo e nao ajuda a enxergar nada
    picos = np.sqrt(np.clip(picos, 0, 1))
    picos = (picos * 255).astype(np.uint8)

    resultado = {
        "por_segundo": por_segundo,
        "duracao": round(len(dados) / taxa, 3),
        "picos": picos.tolist(),
    }

    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(resultado), encoding="utf-8")
    ok(f"forma de onda -> {saida.name} ({len(picos)} picos)")
    return resultado
