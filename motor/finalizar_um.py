"""
SupremoCut - nivela um MP4 avulso e poe ele no lugar do antigo.

POR QUE ISTO EXISTE

O Digg It renderizou certo duas vezes e as duas vezes nao conseguiu tomar o
lugar do arquivo anterior: no Windows, um MP4 que algum programa abriu — o
Explorer fazendo miniatura, um player, o cartao de arquivo aqui no chat — nao
pode ser substituido, e o erro chega como EPERM no ultimo passo do render.

Refazer o render inteiro por causa disso e desperdicio: sao tres minutos de
maquina pra repetir um trabalho que ja estava pronto no disco. Este script
pega o arquivo pronto, nivela, e insiste na troca por ate dois minutos.

Rodar:  python finalizar_um.py digg-it
"""

from __future__ import annotations

import os
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import audio as mod_audio
from comum import RAIZ, aviso, ok, passo, rodar, sondar

ALVO_LUFS = -14.0
PICO_DB = -1.5


def trocar(novo: Path, destino: Path, segundos: float = 120) -> bool:
    limite = time.time() + segundos
    while True:
        try:
            os.replace(novo, destino)
            return True
        except PermissionError:
            if time.time() > limite:
                return False
            time.sleep(3)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("uso: python finalizar_um.py <slug>")
    slug = sys.argv[1]

    pasta = RAIZ / "saida" / "aprovado"
    novo = pasta / f"{slug}-pt.novo.mp4"
    destino = pasta / f"{slug}-pt.mp4"

    if not novo.exists():
        raise SystemExit(f"não achei {novo}")

    passo(f"{slug}: nivelando o arquivo novo em {ALVO_LUFS} LUFS")
    medida = mod_audio.medir_loudness(novo)
    antes = float(medida["input_i"]) if medida else None

    nivelado = pasta / f"{slug}-pt.nivelado.mp4"
    rodar([
        "ffmpeg", "-y", "-v", "error", "-i", str(novo),
        "-c:v", "copy",
        "-af", mod_audio.cadeia_loudness(medida, ALVO_LUFS, PICO_DB),
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(nivelado),
    ])
    if not nivelado.exists() or nivelado.stat().st_size == 0:
        raise SystemExit("a nivelação não produziu arquivo")

    depois = mod_audio.medir_loudness(nivelado)
    d = float(depois["input_i"]) if depois else None
    print(f"   {antes:.1f} -> {d:.1f} LUFS   {sondar(nivelado).duracao:.1f}s")

    if trocar(nivelado, destino):
        novo.unlink(missing_ok=True)
        ok(f"{destino.name} atualizado")
    else:
        shutil.move(str(nivelado), str(novo))
        aviso(
            f"o arquivo antigo continua aberto em algum programa. "
            f"O novo, já nivelado, está em {novo.name} — feche o player e rode de novo."
        )


if __name__ == "__main__":
    main()
