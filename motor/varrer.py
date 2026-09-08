"""
SupremoCut - varredura de lote.

Passa o Whisper numa pasta inteira e diz, por arquivo: se tem narracao, em que
idioma, quantas palavras, e a transcricao. Serve pra saber o tamanho real do
trabalho ANTES de comecar a traduzir - metade de um lote de anuncios costuma
ser so imagem e musica.

Uso:  python motor/varrer.py "C:\\caminho\\da\\pasta"
      python motor/varrer.py "C:\\caminho" --modelo medium
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import TRABALHO, ativar_cuda, extrair_audio_wav, ok, passo, salvar_json, tem_gpu  # noqa: E402

EXTENSOES = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}


def varrer(pasta: Path, modelo: str = "large-v3") -> list[dict]:
    ativar_cuda()
    from faster_whisper import WhisperModel

    arquivos = sorted(p for p in pasta.iterdir() if p.suffix.lower() in EXTENSOES)
    if not arquivos:
        raise SystemExit(f"Nenhum video em {pasta}")

    usar_gpu = tem_gpu()
    passo(f"Varrendo {len(arquivos)} arquivos com {modelo} em {'cuda' if usar_gpu else 'cpu'}")

    m = WhisperModel(
        modelo,
        device="cuda" if usar_gpu else "cpu",
        compute_type="float16" if usar_gpu else "int8",
    )

    tmp = TRABALHO / "varredura"
    tmp.mkdir(parents=True, exist_ok=True)
    resultados = []

    for i, arq in enumerate(arquivos, 1):
        print(f"   [{i}/{len(arquivos)}] {arq.name}", flush=True)
        wav = extrair_audio_wav(arq, tmp / f"{arq.stem}.wav")

        # sem language= de proposito: queremos que ele DETECTE o idioma
        segmentos, info = m.transcribe(
            str(wav), vad_filter=True, beam_size=5, condition_on_previous_text=False
        )
        segs = [
            {"t": round(s.start, 2), "fim": round(s.end, 2), "texto": (s.text or "").strip()}
            for s in segmentos
            if (s.text or "").strip()
        ]
        texto = " ".join(s["texto"] for s in segs)

        resultados.append(
            {
                "arquivo": arq.name,
                "idioma": getattr(info, "language", "?"),
                "confianca_idioma": round(float(getattr(info, "language_probability", 0)), 2),
                "tem_narracao": len(texto.split()) >= 8,
                "palavras": len(texto.split()),
                "segmentos": segs,
                "texto": texto,
            }
        )
        wav.unlink(missing_ok=True)

    return resultados


def main() -> None:
    ap = argparse.ArgumentParser(prog="varrer")
    ap.add_argument("pasta")
    ap.add_argument("--modelo", default="large-v3")
    ap.add_argument("--saida", default=None)
    a = ap.parse_args()

    pasta = Path(a.pasta)
    resultados = varrer(pasta, a.modelo)

    destino = Path(a.saida) if a.saida else TRABALHO / "varredura.json"
    salvar_json(destino, {"pasta": str(pasta), "arquivos": resultados})

    print()
    print(f"{'arquivo':<24} | idioma | palavras | narracao")
    print("-" * 62)
    for r in resultados:
        marca = "SIM" if r["tem_narracao"] else "nao"
        print(
            f"{r['arquivo'][:24]:<24} | {r['idioma']:^6} | {r['palavras']:>8} | {marca}"
        )

    com = [r for r in resultados if r["tem_narracao"]]
    total = sum(r["palavras"] for r in com)
    idiomas = sorted({r["idioma"] for r in com})
    print()
    ok(
        f"{len(com)} de {len(resultados)} tem narracao | {total} palavras pra traduzir | "
        f"idiomas: {', '.join(idiomas) if idiomas else 'nenhum'}"
    )
    ok(f"detalhe em {destino}")


if __name__ == "__main__":
    main()
