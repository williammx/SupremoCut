"""
SupremoCut - separa um video em planos e monta a folha de contato.

O QUE E UM PLANO AQUI

Um trecho continuo, sem corte de camera. O `ffmpeg` sabe achar isso: o filtro
`select=gt(scene,N)` compara cada quadro com o anterior e marca onde a imagem
muda de vez. Numa filmagem de drone, cada decolagem/pouso e cada retomada vira
um plano.

POR QUE ISSO IMPORTA NUM REELS DE 45 SEGUNDOS

Sao 260 segundos de drone pra escolher 45. Ver tudo na mao e meia hora; ver
uma folha de contato com o melhor quadro de cada plano e um minuto. E a folha
tambem responde a pergunta que o briefing faz — "pode pegar um take que ache
que tenha efeito pra capa" — sem precisar adivinhar.

O QUE CADA PLANO GANHA

  - duracao, que decide se ele aguenta um corte de 2s ou de 4s
  - nitidez (variancia do laplaciano), que separa o quadro parado do borrado
  - movimento medio, que diz se o plano e estatico ou se a camera viaja

Rodar:  python planos.py <arquivo ou pasta> [--limiar 0.30]
"""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

from comum import RAIZ, ok, passo, rodar, sondar

# Abaixo disto o "corte" e so a camera mexendo; acima, e troca de plano.
LIMIAR = 0.30
# Plano mais curto que isto nao serve nem pra um corte rapido.
MINIMO = 1.2

_PTS = re.compile(r"pts_time:([\d.]+)")


def cortes(arquivo: Path, limiar: float) -> list[float]:
    """Segundos em que a imagem troca de plano."""
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(arquivo),
         "-filter:v", f"select='gt(scene,{limiar})',showinfo",
         "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return [float(t) for t in _PTS.findall(p.stderr or "")]


def nitidez(arquivo: Path, instante: float) -> float:
    """
    Quao definido esta o quadro naquele segundo.

    Mede o desvio padrao depois de um realce de borda. Imagem borrada tem
    poucas bordas e desvio baixo; imagem nitida tem muitas e desvio alto. Nao
    e uma escala absoluta — serve pra comparar quadros do MESMO material.
    """
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-ss", str(instante), "-i", str(arquivo),
         "-frames:v", "1", "-vf", "format=gray,convolution='0 -1 0 -1 4 -1 0 -1 0',"
         "signalstats,metadata=print:key=lavfi.signalstats.YSTDEV",
         "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    m = re.search(r"YSTDEV=([\d.]+)", p.stderr or "")
    return float(m.group(1)) if m else 0.0


def analisar(arquivo: Path, limiar: float, saida: Path) -> list[dict]:
    dur = sondar(arquivo).duracao
    marcas = [0.0] + cortes(arquivo, limiar) + [dur]

    planos: list[dict] = []
    for i in range(len(marcas) - 1):
        ini, fim = marcas[i], marcas[i + 1]
        if fim - ini < MINIMO:
            continue
        meio = ini + (fim - ini) / 2
        planos.append({
            "n": len(planos) + 1,
            "inicio": round(ini, 2),
            "fim": round(fim, 2),
            "duracao": round(fim - ini, 2),
            "nitidez": round(nitidez(arquivo, meio), 1),
        })

    saida.mkdir(parents=True, exist_ok=True)
    for pl in planos:
        meio = pl["inicio"] + pl["duracao"] / 2
        nome = f"{arquivo.stem}-p{pl['n']:02d}.jpg"
        rodar([
            "ffmpeg", "-y", "-v", "error", "-ss", str(meio), "-i", str(arquivo),
            "-frames:v", "1", "-vf", "scale=480:-1", "-q:v", "3",
            str(saida / nome),
        ])
        pl["quadro"] = nome

    return planos


def main() -> None:
    ap = argparse.ArgumentParser(prog="planos")
    ap.add_argument("alvo")
    ap.add_argument("--limiar", type=float, default=LIMIAR)
    a = ap.parse_args()

    alvo = Path(a.alvo)
    arquivos = sorted(
        [f for f in alvo.iterdir() if f.suffix.lower() in (".mp4", ".mov")]
    ) if alvo.is_dir() else [alvo]

    saida = RAIZ / "trabalho" / "planos"
    passo(f"{len(arquivos)} arquivos, limiar {a.limiar}")

    total = 0
    for f in arquivos:
        planos = analisar(f, a.limiar, saida)
        total += len(planos)
        print()
        print(f"  {f.name}  ({sondar(f).duracao:.1f}s)")
        for pl in planos:
            print(
                f"     plano {pl['n']:>2}  {pl['inicio']:>6.1f}s a {pl['fim']:>6.1f}s"
                f"  ({pl['duracao']:>4.1f}s)   nitidez {pl['nitidez']:>5.1f}"
            )

    print()
    ok(f"{total} planos, quadros em {saida}")


if __name__ == "__main__":
    main()
