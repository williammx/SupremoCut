"""
SupremoCut - Sincronia automatica por audio.

Voce grava a camera e a tela em programas diferentes; um comeca antes do outro.
Este modulo descobre sozinho a diferenca exata, comparando o "desenho" do som
dos dois arquivos (envelope de energia) por correlacao cruzada.

Funciona mesmo com microfones diferentes, porque compara o RITMO do audio,
nao o timbre.
"""

from __future__ import annotations

import numpy as np
from pathlib import Path
from scipy import signal

from comum import Midia, extrair_audio_wav, ok, aviso, sondar

TAXA_ENVELOPE = 100  # amostras por segundo do envelope
JANELA_MAX_SEG = 480  # usa no maximo 8 min pra achar o encaixe
LAG_MAX_SEG = 180  # nao procura desalinhamento maior que 3 min


def _envelope(caminho_wav: Path, taxa_audio: int = 16000) -> np.ndarray:
    """Transforma o audio num envelope de energia a 100 Hz."""
    import soundfile as sf

    dados, taxa = sf.read(str(caminho_wav), dtype="float32")
    if dados.ndim > 1:
        dados = dados.mean(axis=1)

    # limita o trecho analisado
    limite = int(JANELA_MAX_SEG * taxa)
    if len(dados) > limite:
        dados = dados[:limite]

    passo = max(1, int(taxa / TAXA_ENVELOPE))
    n = len(dados) // passo
    if n == 0:
        return np.zeros(1, dtype=np.float32)

    blocos = dados[: n * passo].reshape(n, passo)
    env = np.sqrt((blocos**2).mean(axis=1))

    # comprime a dinamica: realca ataques (falas, cliques) e ignora volume geral
    env = np.log1p(env * 200.0)
    env = env - env.mean()
    desvio = env.std()
    if desvio > 1e-9:
        env = env / desvio
    return env.astype(np.float32)


def descobrir_atraso(wav_a: Path, wav_b: Path) -> tuple[float, float]:
    """
    Devolve (atraso_segundos, confianca).

    atraso > 0  =>  o evento que acontece em B no instante t
                    acontece em A no instante t + atraso.
    """
    a = _envelope(wav_a)
    b = _envelope(wav_b)

    if len(a) < 10 or len(b) < 10:
        return 0.0, 0.0

    corr = signal.correlate(a, b, mode="full", method="fft")
    lags = signal.correlation_lags(len(a), len(b), mode="full")

    # descarta desalinhamentos absurdos
    limite = int(LAG_MAX_SEG * TAXA_ENVELOPE)
    mascara = np.abs(lags) <= limite
    corr_j = corr[mascara]
    lags_j = lags[mascara]

    if len(corr_j) == 0:
        return 0.0, 0.0

    i = int(np.argmax(corr_j))
    pico = float(corr_j[i])
    atraso = float(lags_j[i]) / TAXA_ENVELOPE

    # confianca: quao destacado o pico esta do resto
    mediana = float(np.median(np.abs(corr_j)))
    confianca = 0.0 if mediana <= 1e-9 else min(1.0, (pico / mediana) / 12.0)

    return atraso, confianca


def sincronizar(arquivos: dict[str, Path], trabalho: Path) -> dict[str, dict]:
    """
    arquivos: {"camera": Path, "tela": Path}  (a chave e o papel da fonte)

    Devolve {papel: {"offset": float, "confianca": float, "midia": Midia}}
    onde  tempo_no_arquivo = tempo_no_video_final + offset.
    """
    trabalho.mkdir(parents=True, exist_ok=True)

    infos: dict[str, Midia] = {}
    wavs: dict[str, Path] = {}

    for papel, caminho in arquivos.items():
        infos[papel] = sondar(caminho)
        if not infos[papel].tem_audio:
            aviso(f"{papel}: sem trilha de audio, vai ser alinhado em zero")
            continue
        wavs[papel] = extrair_audio_wav(caminho, trabalho / f"sync_{papel}.wav")

    papeis = list(arquivos.keys())
    referencia = "camera" if "camera" in wavs else (papeis[0] if papeis else None)

    brutos: dict[str, float] = {p: 0.0 for p in papeis}
    confiancas: dict[str, float] = {p: 1.0 for p in papeis}

    if referencia and referencia in wavs:
        for papel in papeis:
            if papel == referencia or papel not in wavs:
                continue
            atraso, conf = descobrir_atraso(wavs[referencia], wavs[papel])
            # evento em `papel` no t acontece na referencia em t+atraso
            # => fonte_papel = master - atraso   (master medido na referencia)
            brutos[papel] = -atraso
            confiancas[papel] = conf
            quem = "antes" if atraso < 0 else "depois"
            ok(
                f"gravacao de '{papel}' comecou {abs(atraso):.3f}s {quem} da '{referencia}' "
                f"(confianca {conf * 100:.0f}%)"
            )

    # normaliza pra ninguem precisar de tempo negativo
    base = min(brutos.values()) if brutos else 0.0
    resultado = {}
    for papel in papeis:
        resultado[papel] = {
            "offset": round(brutos[papel] - base, 4),
            "confianca": round(confiancas[papel], 3),
            "midia": infos[papel],
        }
    return resultado


def duracao_util(sync: dict[str, dict]) -> float:
    """Quanto tempo os dois arquivos existem ao mesmo tempo."""
    disponiveis = [
        s["midia"].duracao - s["offset"]
        for s in sync.values()
        if s["midia"].duracao > 0
    ]
    return max(0.0, min(disponiveis)) if disponiveis else 0.0
