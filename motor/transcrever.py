"""
SupremoCut - Transcricao com tempo por palavra.

Usa faster-whisper na GPU (RTX 3070 Ti / float16). Devolve cada palavra com
inicio e fim exatos - e disso sai tanto a legenda dinamica quanto a deteccao
de silencio pro corte automatico.
"""

from __future__ import annotations

import json
from pathlib import Path

from comum import ativar_cuda, extrair_audio_wav, ok, passo, salvar_json, tem_gpu

MODELO_PADRAO = "large-v3"


def transcrever(
    entrada: str | Path,
    trabalho: Path,
    idioma: str = "pt",
    modelo: str = MODELO_PADRAO,
    forcar_cpu: bool = False,
) -> dict:
    """
    Devolve:
      {
        "idioma": "pt",
        "texto": "...",
        "palavras": [{"t":1.23,"fim":1.48,"texto":"olha","prob":0.98}, ...],
        "frases":   [{"t":1.23,"fim":4.10,"texto":"olha isso aqui"}, ...]
      }
    """
    ativar_cuda()
    from faster_whisper import WhisperModel

    trabalho.mkdir(parents=True, exist_ok=True)
    wav = extrair_audio_wav(entrada, trabalho / "transcricao.wav")

    usar_gpu = (not forcar_cpu) and tem_gpu()
    dispositivo = "cuda" if usar_gpu else "cpu"
    tipo = "float16" if usar_gpu else "int8"

    passo(f"Transcrevendo com {modelo} em {dispositivo} ({tipo})")

    def rodar_modelo(dev: str, ct: str):
        m = WhisperModel(modelo, device=dev, compute_type=ct)
        segs, inf = m.transcribe(
            str(wav),
            language=idioma,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 350},
            beam_size=5,
            condition_on_previous_text=False,
        )
        # materializa aqui dentro: os erros de CUDA so estouram ao iterar
        return list(segs), inf

    try:
        segmentos, info = rodar_modelo(dispositivo, tipo)
    except Exception as e:
        if dispositivo == "cpu":
            raise
        print(f"   [!]  GPU falhou ({e}). Caindo pra CPU.", flush=True)
        dispositivo, tipo = "cpu", "int8"
        segmentos, info = rodar_modelo(dispositivo, tipo)

    palavras: list[dict] = []
    frases: list[dict] = []
    partes: list[str] = []

    for seg in segmentos:
        texto_seg = (seg.text or "").strip()
        if texto_seg:
            frases.append(
                {"t": round(seg.start, 3), "fim": round(seg.end, 3), "texto": texto_seg}
            )
            partes.append(texto_seg)

        for w in seg.words or []:
            limpo = (w.word or "").strip()
            if not limpo:
                continue
            palavras.append(
                {
                    "t": round(w.start, 3),
                    "fim": round(w.end, 3),
                    "texto": limpo,
                    "prob": round(float(w.probability or 0), 3),
                }
            )

    resultado = {
        "idioma": getattr(info, "language", idioma),
        "modelo": modelo,
        "dispositivo": dispositivo,
        "texto": " ".join(partes).strip(),
        "palavras": palavras,
        "frases": frases,
    }

    salvar_json(trabalho / "transcricao.json", resultado)
    ok(f"{len(palavras)} palavras, {len(frases)} frases")
    return resultado


def carregar(trabalho: Path) -> dict | None:
    """Reaproveita uma transcricao ja feita, se existir."""
    p = Path(trabalho) / "transcricao.json"
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return None
