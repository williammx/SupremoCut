"""
SupremoCut - lista o que tem numa pasta publica do Google Drive, sem baixar.

POR QUE NAO BAIXAR TUDO

O "Banco de Imagens" da Super San e um acervo da agencia inteira: subpastas de
campanhas de meses diferentes, fotos em PNG de 35 MB, material que nao tem nada
a ver com este Reels. Baixar a pasta toda pra depois escolher quatro clipes
seria puxar dezenas de gigabytes pra usar meio minuto de imagem.

Entao primeiro se olha o indice, depois se escolhe, depois se baixa.

Rodar:  python listar_drive.py <url ou id da pasta>
"""

from __future__ import annotations

import sys

import gdown

VIDEO = (".mp4", ".mov", ".avi", ".mkv", ".m4v", ".mts", ".insv")
FOTO = (".jpg", ".jpeg", ".png", ".heic", ".dng", ".raw", ".tif", ".tiff")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("uso: python listar_drive.py <url da pasta>")
    url = sys.argv[1]

    itens = gdown.download_folder(url, skip_download=True, quiet=True, use_cookies=False)
    if not itens:
        raise SystemExit("não consegui listar — a pasta pode não ser pública")

    videos, fotos, outros = [], [], []
    for it in itens:
        caminho = it.path if hasattr(it, "path") else str(it)
        alvo = (
            videos if caminho.lower().endswith(VIDEO)
            else fotos if caminho.lower().endswith(FOTO)
            else outros
        )
        alvo.append((caminho, getattr(it, "id", "")))

    print()
    print(f"  {len(videos)} vídeos, {len(fotos)} fotos, {len(outros)} outros")
    print()
    print("  VÍDEOS")
    for caminho, ident in sorted(videos):
        print(f"    {caminho}")
        print(f"      {ident}")
    if outros:
        print()
        print("  OUTROS")
        for caminho, _ in sorted(outros)[:20]:
            print(f"    {caminho}")
    print()


if __name__ == "__main__":
    main()
