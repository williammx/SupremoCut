"""
Prova de dublagem: sintetiza a copy em portugues, encaixa nos tempos do
original e devolve o video dublado pronto pra assistir.

Nao e o pipeline final - e a menor coisa capaz de responder "a voz serve?"
antes de investir em construir o resto.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import RAIZ, ok, passo, rodar, sondar  # noqa: E402
import voz  # noqa: E402

FONTE = Path(r"C:\Users\willi\Downloads\Anúncios-20260828T200642Z-1-001\Anúncios\Homefaves uk.mp4")

# (inicio, fim, texto em portugues) — tempos do original
FALAS = [
    (0.00, 2.10, "Larga o cotonete. Sério."),
    (2.10, 6.18, "Ele só empurra a cera pra dentro — e machuca o ouvido."),
    (6.18, 9.36, "Esse limpador de gel resolve isso."),
    (9.36, 12.54, "Macio, simples de usar, e puxa"),
    (12.54, 14.48, "tudo que você não alcança."),
    (14.48, 18.26, "Sem sujeira, sem dor. Ouvido limpo de verdade."),
    (18.26, 20.88, "Cuida da sua higiene? Você precisa desse."),
]

VOZES = {
    "gabriel": "k3f7zOv6LF88v78QHCNh",   # masculina, feita pra Shorts/Reels
    "bia": "0ozreaQ0xnggCu2x9oFC",        # feminina, expressiva
}


def montar(nome_voz: str, voz_id: str) -> Path:
    tmp = RAIZ / "trabalho" / "dublagem" / nome_voz
    tmp.mkdir(parents=True, exist_ok=True)
    passo(f"Voz: {nome_voz}")

    pecas = []
    avisos = []

    for i, (ini, fim, texto) in enumerate(FALAS, 1):
        alvo = fim - ini
        cru = tmp / f"{i:02d}_cru.mp3"
        ajustado = tmp / f"{i:02d}.wav"

        voz.falar(texto, voz_id, cru)
        r = voz.encaixar(cru, ajustado, alvo)

        marca = "!" if r["precisa_encurtar"] else " "
        print(
            f"   {marca} {i}. alvo {r['alvo']:>5.2f}s | gerado {r['gerado']:>5.2f}s | "
            f"x{r['acelerado']:.2f} -> {r['final']:>5.2f}s"
        )
        if r["precisa_encurtar"]:
            avisos.append(f"fala {i} sobra {r['sobra']}s: {texto[:40]}...")

        pecas.append((ini, ajustado, r["final"]))

    # monta a trilha: silencio + cada fala no seu instante
    dur_total = sondar(FONTE).duracao
    entradas, filtros, rotulos = [], [], []
    entradas += ["-f", "lavfi", "-t", f"{dur_total}", "-i", "anullsrc=r=48000:cl=mono"]
    for _, arq, _ in pecas:
        entradas += ["-i", str(arq)]

    for j, (ini, _, _) in enumerate(pecas, start=1):
        filtros.append(f"[{j}:a]adelay={int(ini*1000)}|{int(ini*1000)}[d{j}]")
        rotulos.append(f"[d{j}]")

    mistura = f"[0:a]{''.join(rotulos)}amix=inputs={len(pecas)+1}:normalize=0[voz]"
    trilha = tmp / "trilha.wav"
    rodar([
        "ffmpeg", "-y", "-v", "error", *entradas,
        "-filter_complex", ";".join(filtros + [mistura]),
        "-map", "[voz]", "-ar", "48000", "-ac", "2", str(trilha),
    ])

    # video ampliado pra 1080x1920, audio original FORA, dublagem no lugar
    saida = RAIZ / "saida" / f"dublado-{nome_voz}.mp4"
    saida.parent.mkdir(parents=True, exist_ok=True)
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(FONTE), "-i", str(trilha),
        "-map", "0:v:0", "-map", "1:a:0",
        "-vf", "scale=1080:1920:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest",
        str(saida),
    ])

    ok(f"{saida.name} pronto")
    for a in avisos:
        print(f"      [!] {a}")
    return saida


if __name__ == "__main__":
    for nome, vid in VOZES.items():
        montar(nome, vid)
