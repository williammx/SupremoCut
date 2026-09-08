"""
SupremoCut - renderiza a demanda inteira de uma vez.

Doze anuncios, um por vez, cada um em 1080x1920. Rodar um a um pela interface
funciona, mas sao doze idas e vindas e a chance de esquecer um no meio.

O `roteiro-atual.json` e o que o Remotion le do disco na hora de renderizar —
por isso cada projeto e copiado pra la antes de comecar, e restaurado no fim.
Sem isso o video sai com o nome de um projeto e o conteudo de outro.

Rodar:  python render_lote.py
        python render_lote.py --so origyn,digg-it
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import time
from pathlib import Path

from comum import RAIZ, aviso, ok, passo, sondar

ESTUDIO = RAIZ / "estudio"
SAIDA = RAIZ / "saida"
ATUAL = ESTUDIO / "src" / "roteiro-atual.json"

# Na ordem em que o cliente vai receber
DEMANDA = [
    "origyn",
    "origyn-2",
    "homefaves-uk",
    "everyday-finds",
    "goltali",
    "londonget-gift",
    "ventra-finds",
    "waregami",
    "genius-finds",
    "lilyrhyme",
    "digg-it",
    "othor-shopping",
]


PUBLICO = ESTUDIO / "public"
# pasta enxuta, montada por render (ver `so_o_necessario`)
PUBLICO_TMP = RAIZ / "trabalho" / "public-render"


def so_o_necessario(projeto: str) -> Path:
    """
    Monta uma pasta public com SO o que este anuncio usa.

    O Remotion copia a pasta public inteira pro bundle antes de renderizar. A
    daqui tem 3 GB — e 2,4 deles sao de um projeto antigo de 31 minutos que nao
    tem nada a ver com esta demanda. Ou seja: cada um dos doze renders copiava
    2,4 GB de arquivo morto, e a extracao de quadro estourava o tempo limite
    esperando disco.

    Com a pasta enxuta sao uns 50 MB por render. O caminho que o roteiro cita
    (`<projeto>/camera.mp4`) continua valendo, porque a estrutura de dentro e a
    mesma — muda so o que fica de fora.
    """
    if PUBLICO_TMP.exists():
        shutil.rmtree(PUBLICO_TMP, ignore_errors=True)
    PUBLICO_TMP.mkdir(parents=True, exist_ok=True)

    origem = PUBLICO / projeto
    if origem.exists():
        shutil.copytree(origem, PUBLICO_TMP / projeto)

    # a musica e citada por `musica/<arquivo>`, fora da pasta do projeto
    musica = PUBLICO / "musica"
    if musica.exists():
        shutil.copytree(musica, PUBLICO_TMP / "musica")

    return PUBLICO_TMP


def renderizar(projeto: str) -> Path | None:
    roteiro = RAIZ / "projetos" / projeto / "roteiro.json"
    if not roteiro.exists():
        aviso(f"{projeto}: sem roteiro.json")
        return None

    destino = SAIDA / f"{projeto}-pt.mp4"
    SAIDA.mkdir(parents=True, exist_ok=True)

    # o Remotion le ESTE arquivo, nao o do projeto
    shutil.copy2(roteiro, ATUAL)
    publico = so_o_necessario(projeto)

    t0 = time.time()
    p = subprocess.run(
        ["npx", "remotion", "render", "src/index.ts", "Vertical", str(destino),
         f"--public-dir={publico}",
         # o material chega em 360x640 e sobe pra 1080x1920; a decodificacao
         # aguenta, mas o limite padrao de 30s nao perdoa um disco ocupado
         "--timeout=120000",
         "--log=error"],
        cwd=str(ESTUDIO),
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if p.returncode != 0 or not destino.exists():
        aviso(f"{projeto}: FALHOU")
        for linha in (p.stderr or "").splitlines()[-6:]:
            print(f"      {linha}")
        return None

    info = sondar(destino)
    mb = destino.stat().st_size / 1048576
    print(
        f"   [ok] {projeto:<16} {info.duracao:>6.1f}s  {mb:>5.1f} MB  "
        f"em {time.time() - t0:>5.0f}s"
    )
    return destino


def main() -> None:
    ap = argparse.ArgumentParser(prog="render_lote")
    ap.add_argument("--so", default=None, help="lista separada por virgula")
    a = ap.parse_args()

    lista = [s.strip() for s in a.so.split(",")] if a.so else DEMANDA

    # guarda o roteiro que estava aberto, pra devolver no fim
    guardado = ATUAL.read_bytes() if ATUAL.exists() else None

    passo(f"renderizando {len(lista)} anuncios em 1080x1920")
    feitos, falhos = [], []
    try:
        for nome in lista:
            r = renderizar(nome)
            (feitos if r else falhos).append(nome)
    finally:
        if guardado is not None:
            ATUAL.write_bytes(guardado)

    print()
    ok(f"{len(feitos)} de {len(lista)} prontos em {SAIDA}")
    if falhos:
        aviso("falharam: " + ", ".join(falhos))


if __name__ == "__main__":
    main()
