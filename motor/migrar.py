"""
SupremoCut - migracao de roteiros antigos.

Converte as palavras da legenda do relogio do VIDEO FINAL de volta para o
relogio da FONTE. Roteiros gravados antes da correcao tinham os tempos
congelados no montado daquele instante, e descolavam a cada edicao.

Usa o `_trechos_mantidos` que ficava gravado no roteiro (campo que ninguem
lia) como mapa de conversao. Sem ele, nao ha como saber de onde cada palavra
veio, e o roteiro e marcado como nao-migravel em vez de ser adivinhado.

Uso:  python motor/migrar.py            (todos os projetos)
      python motor/migrar.py demanda-01 (um projeto)
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import PROJETOS, aviso, ler_json, ok, passo, salvar_json  # noqa: E402


def _para_fonte(t: float, trechos: list) -> float | None:
    """Tempo do video final -> tempo da fonte, seguindo os trechos mantidos."""
    acumulado = 0.0
    for ini, fim in trechos:
        dur = fim - ini
        if t <= acumulado + dur:
            return round(ini + (t - acumulado), 3)
        acumulado += dur
    return None


def migrar(nome: str) -> str:
    caminho = PROJETOS / nome / "roteiro.json"
    if not caminho.exists():
        return "sem roteiro"

    r = ler_json(caminho)
    legendas = r.get("legendas") or {}

    if legendas.get("base_tempo") == "fonte":
        return "ja migrado"

    palavras = legendas.get("palavras") or []
    if not palavras:
        legendas["base_tempo"] = "fonte"
        r["legendas"] = legendas
        r.pop("_trechos_mantidos", None)
        salvar_json(caminho, r)
        return "sem palavras, so marcado"

    trechos = r.get("_trechos_mantidos")
    if not trechos:
        return "NAO MIGRAVEL: falta _trechos_mantidos"

    backup = caminho.with_suffix(".json.antes-da-migracao")
    shutil.copy2(caminho, backup)

    convertidas = []
    perdidas = 0
    for p in palavras:
        t = _para_fonte(p["t"], trechos)
        fim = _para_fonte(p["fim"], trechos)
        if t is None or fim is None or fim <= t:
            perdidas += 1
            continue
        convertidas.append({**p, "t": t, "fim": fim})

    legendas["palavras"] = convertidas
    legendas["base_tempo"] = "fonte"
    r["legendas"] = legendas
    r.pop("_trechos_mantidos", None)
    salvar_json(caminho, r)

    extra = f", {perdidas} fora dos trechos descartadas" if perdidas else ""
    return f"{len(convertidas)} palavras convertidas{extra} (backup em {backup.name})"


def main() -> None:
    alvos = sys.argv[1:] or [p.name for p in PROJETOS.iterdir() if p.is_dir()]
    passo(f"Migrando {len(alvos)} projeto(s)")
    for nome in sorted(alvos):
        try:
            resultado = migrar(nome)
            if resultado.startswith("NAO MIGRAVEL"):
                aviso(f"{nome}: {resultado}")
            else:
                ok(f"{nome}: {resultado}")
        except Exception as e:
            aviso(f"{nome}: falhou - {e}")


if __name__ == "__main__":
    main()
