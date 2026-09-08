"""
SupremoCut - O DIRETOR.

Pega a transcricao e a sincronia e escreve o roteiro.json: onde cortar,
qual layout usar em cada momento, quando a legenda entra e qual palavra
ganha destaque.

Tudo o que sai daqui e uma SUGESTAO editavel. O arquivo final e texto puro:
abra, mude o que quiser, renderize de novo.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from comum import CONFIG, ler_json, ok


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

def carregar_direcao() -> dict:
    bruto = ler_json(CONFIG / "direcao.json")

    def limpar(o):
        if isinstance(o, dict):
            return {k: limpar(v) for k, v in o.items() if not k.startswith("_")}
        if isinstance(o, list):
            return [limpar(x) for x in o]
        return o

    return limpar(bruto)


def _sem_acento(s: str) -> str:
    n = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in n if unicodedata.category(c) != "Mn")


# --------------------------------------------------------------------------
# 1. Onde cortar
# --------------------------------------------------------------------------

def trechos_com_fala(
    palavras: list[dict], duracao_total: float, cfg: dict
) -> list[tuple[float, float]]:
    """
    Junta as palavras em blocos contiguos, descartando as pausas longas.
    Devolve [(inicio, fim)] em tempo do ARQUIVO BRUTO.
    """
    c = cfg["corte_de_silencio"]
    if not c.get("ligado", True) or not palavras:
        return [(0.0, duracao_total)]

    pausa_max = c["pausa_maxima"]
    antes = c["folga_antes"]
    depois = c["folga_depois"]
    minimo = c["duracao_minima_do_trecho"]

    blocos: list[list[float]] = []
    atual = [max(0.0, palavras[0]["t"] - antes), palavras[0]["fim"]]

    for p in palavras[1:]:
        if p["t"] - atual[1] > pausa_max:
            blocos.append([atual[0], min(duracao_total, atual[1] + depois)])
            atual = [max(0.0, p["t"] - antes), p["fim"]]
        else:
            atual[1] = p["fim"]
    blocos.append([atual[0], min(duracao_total, atual[1] + depois)])

    # funde blocos que ficaram colados e joga fora os curtos demais
    limpos: list[list[float]] = []
    for b in blocos:
        if b[1] - b[0] < minimo:
            continue
        if limpos and b[0] - limpos[-1][1] < 0.05:
            limpos[-1][1] = b[1]
        else:
            limpos.append(b)

    return [(round(a, 3), round(b, 3)) for a, b in limpos]


def ler_minutagem(texto: str) -> float:
    """Aceita '9:04', '1:22:30', '544' ou '9:04.5' e devolve segundos."""
    partes = texto.strip().split(":")
    try:
        nums = [float(p) for p in partes]
    except ValueError as e:
        raise SystemExit(f"Minutagem invalida: '{texto}'") from e
    total = 0.0
    for n in nums:
        total = total * 60 + n
    return total


def ler_lista_de_cortes(texto: str) -> list[tuple[float, float]]:
    """
    Converte "4:41-5:53, 6:38-9:04" numa lista de trechos em segundos.
    Ordena, funde sobreposicoes e avisa o que foi absorvido.
    """
    brutos: list[tuple[float, float]] = []
    for pedaco in texto.replace(";", ",").split(","):
        pedaco = pedaco.strip()
        if not pedaco:
            continue
        sep = ">" if ">" in pedaco else "-"
        try:
            a, b = pedaco.split(sep)
        except ValueError as e:
            raise SystemExit(
                f"Nao entendi o corte '{pedaco}'. Use o formato  4:41-5:53"
            ) from e
        ini, fim = ler_minutagem(a), ler_minutagem(b)
        if fim <= ini:
            raise SystemExit(f"O corte '{pedaco}' termina antes de comecar.")
        brutos.append((ini, fim))

    brutos.sort()
    limpos: list[list[float]] = []
    for ini, fim in brutos:
        if limpos and ini <= limpos[-1][1]:
            if fim <= limpos[-1][1]:
                ok(
                    f"corte {int(ini // 60)}:{ini % 60:02.0f}-{int(fim // 60)}:{fim % 60:02.0f} "
                    f"ja estava dentro de outro, ignorado"
                )
            else:
                limpos[-1][1] = fim
        else:
            limpos.append([ini, fim])

    return [(round(a, 3), round(b, 3)) for a, b in limpos]


def mapear_tempo(t: float, trechos: list[tuple[float, float]]) -> float | None:
    """Converte tempo do arquivo bruto -> tempo do video final."""
    acumulado = 0.0
    for ini, fim in trechos:
        if t < ini:
            return round(acumulado, 3)
        if t <= fim:
            return round(acumulado + (t - ini), 3)
        acumulado += fim - ini
    return None


# --------------------------------------------------------------------------
# 2. Qual layout em cada momento
# --------------------------------------------------------------------------

def _frase_em(frases: list[dict], t: float) -> str:
    for f in frases:
        if f["t"] <= t <= f["fim"]:
            return f["texto"]
    return ""


def decidir_layouts(
    trechos: list[tuple[float, float]],
    frases: list[dict],
    cfg: dict,
    tem_tela: bool,
    tem_camera: bool,
    duracao_final: float,
) -> list[dict]:
    """Devolve a lista de cenas (ainda sem transicoes)."""
    if not tem_tela:
        return [
            {"fonte_inicio": ini, "duracao": round(fim - ini, 3), "layout": "camera"}
            for ini, fim in trechos
        ]
    if not tem_camera:
        return [
            {"fonte_inicio": ini, "duracao": round(fim - ini, 3), "layout": "tela"}
            for ini, fim in trechos
        ]

    g = cfg["gatilhos"]
    r = cfg["ritmo"]
    abre = cfg["abertura"]
    fecha = cfg["encerramento"]

    mostrar = [_sem_acento(x) for x in g["mostrar_tela"]]
    voltar = [_sem_acento(x) for x in g["voltar_pra_camera"]]

    padrao = r.get("layout_padrao_com_tela", "pip")
    alternativo = r.get("layout_alternativo", "tela")
    intervalo = r.get("trocar_layout_a_cada", 22.0)
    min_cena = r.get("duracao_minima_da_cena", 2.2)

    cenas: list[dict] = []
    tempo_final = 0.0
    layout_atual = abre.get("layout", "camera")
    ultima_troca = 0.0
    contador_alternancia = 0

    for ini, fim in trechos:
        dur = fim - ini
        # divide o trecho em pedacos de ate min_cena*2 pra poder trocar layout dentro dele
        cursor = ini
        while cursor < fim - 0.05:
            pedaco_fim = min(fim, cursor + max(min_cena, 4.0))
            # se o resto ficaria curto demais, engole ele
            if fim - pedaco_fim < min_cena:
                pedaco_fim = fim

            texto = _sem_acento(_frase_em(frases, cursor))
            novo = layout_atual

            na_abertura = tempo_final < abre.get("segundos_de_camera", 9.0)
            no_fim = tempo_final > duracao_final - fecha.get("segundos_de_camera", 6.0)

            if na_abertura:
                novo = abre.get("layout", "camera")
            elif no_fim:
                novo = fecha.get("layout", "camera")
            elif any(k in texto for k in voltar):
                novo = "camera"
            elif any(k in texto for k in mostrar):
                novo = padrao
            elif intervalo > 0 and tempo_final - ultima_troca > intervalo:
                contador_alternancia += 1
                if layout_atual == "camera":
                    novo = padrao
                elif layout_atual == padrao:
                    novo = alternativo if contador_alternancia % 2 == 0 else "camera"
                else:
                    novo = padrao

            if novo != layout_atual:
                ultima_troca = tempo_final
                layout_atual = novo

            d = round(pedaco_fim - cursor, 3)
            if cenas and cenas[-1]["layout"] == layout_atual and abs(
                cenas[-1]["fonte_inicio"] + cenas[-1]["duracao"] - cursor
            ) < 0.02:
                # continua a mesma cena: so estica
                cenas[-1]["duracao"] = round(cenas[-1]["duracao"] + d, 3)
            else:
                cenas.append(
                    {"fonte_inicio": round(cursor, 3), "duracao": d, "layout": layout_atual}
                )

            tempo_final += d
            cursor = pedaco_fim

    return cenas


# --------------------------------------------------------------------------
# 3. Legendas
# --------------------------------------------------------------------------

def montar_legendas(palavras: list[dict], cfg: dict, offset_audio: float = 0.0) -> dict:
    """
    Grava as palavras no relogio do ARQUIVO de audio, nao do video final.

    Antes elas eram convertidas para o tempo do video montado e ficavam
    congeladas: bastava aparar ou reordenar um bloco no editor para a legenda
    inteira descolar, e o erro crescia calado. Agora a posicao final e derivada
    das cenas a cada render (ver estudio/src/legendas.ts), entao a legenda
    acompanha qualquer edicao.

    `palavras` chega no relogio MESTRE (como todo o resto do pipeline) e sai no
    relogio do ARQUIVO, somando `offset_audio`. Isso porque quem le a legenda no
    render calcula `cena.fonte_inicio + offset` — a mesma conta do video e da
    forma de onda. Somar aqui e o unico lugar onde a conversao acontece.
    """
    l = cfg["legenda"]
    if not l.get("ligada", True):
        return {"estilo": "nenhum", "ligada_em": [], "palavras": [], "base_tempo": "fonte"}

    destaques = [_sem_acento(x) for x in cfg["gatilhos"]["destacar_palavra"]]
    saida = []

    for p in palavras:
        if p["fim"] <= p["t"]:
            continue
        limpo = p["texto"].strip()
        nu = _sem_acento(re.sub(r"[^\w\s]", "", limpo))
        enfase = nu in destaques or bool(re.match(r"^[\d.,%R$]+$", limpo))
        saida.append(
            {
                "t": round(p["t"] + offset_audio, 3),
                "fim": round(p["fim"] + offset_audio, 3),
                "texto": limpo,
                "enfase": enfase,
            }
        )

    return {
        "estilo": l.get("estilo", "destaque"),
        "ligada_em": [],
        "palavras": saida,
        "base_tempo": "fonte",
    }


# --------------------------------------------------------------------------
# 4. Montagem final
# --------------------------------------------------------------------------

def escrever_roteiro(
    projeto: str,
    fontes: dict,
    transcricao: dict,
    duracao_total: float,
    fps: int = 30,
    largura: int = 1920,
    altura: int = 1080,
    arquivo_audio: str = "audio.wav",
    trechos_manuais: list[tuple[float, float]] | None = None,
    offset_audio: float = 0.0,
) -> dict:
    cfg = carregar_direcao()
    palavras = transcricao.get("palavras", [])
    frases = transcricao.get("frases", [])

    if trechos_manuais:
        # voce mandou os trechos: usa exatamente esses, sem cortar silencio
        trechos = [
            (max(0.0, a), min(duracao_total, b))
            for a, b in trechos_manuais
            if a < duracao_total
        ]
        ok(f"usando {len(trechos)} trecho(s) que voce escolheu")
    else:
        trechos = trechos_com_fala(palavras, duracao_total, cfg)
    duracao_final = sum(f - i for i, f in trechos)

    cenas_cruas = decidir_layouts(
        trechos,
        frases,
        cfg,
        tem_tela=fontes.get("tela") is not None,
        tem_camera=fontes.get("camera") is not None,
        duracao_final=duracao_final,
    )

    # aplica transicoes
    t = cfg["transicoes"]
    # onde comeca cada trecho: emenda entre partes distantes do bruto
    inicios_de_bloco = {round(a, 2) for a, _ in trechos}
    cenas = []
    for i, c in enumerate(cenas_cruas):
        comeca_bloco = round(c["fonte_inicio"], 2) in inicios_de_bloco

        if i == 0:
            entrada = {"tipo": t.get("na_abertura", "fade"), "duracao": t.get("duracao", 0.55)}
        elif comeca_bloco and trechos_manuais:
            tipo = t.get("entre_blocos", "zoom_cruzado")
            entrada = (
                {"tipo": tipo}
                if tipo == "corte"
                else {"tipo": tipo, "duracao": t.get("duracao_entre_blocos", 0.5)}
            )
        elif c["layout"] != cenas_cruas[i - 1]["layout"]:
            tipo = t.get("entre_layouts", "morph")
            entrada = (
                {"tipo": tipo}
                if tipo == "corte"
                else {"tipo": tipo, "duracao": t.get("duracao", 0.55)}
            )
        else:
            entrada = {"tipo": t.get("depois_de_corte_de_silencio", "corte")}

        # Encaixa em quadros inteiros, igual o editor faz.
        # Sem isto, o primeiro `preparar` ja nascia com tempos fracionarios e
        # ~25% das emendas erravam um quadro de audio — o editor so corrigia o
        # que o usuario tocasse depois.
        def _q(v: float) -> float:
            return round(round(v * fps) / fps, 4)

        cena = {
            "id": f"c{i + 1:03d}",
            "fonte_inicio": _q(c["fonte_inicio"]),
            "duracao": _q(c["duracao"]),
            "layout": c["layout"],
            "entrada": entrada,
            "foco": None,
            "velocidade": 1,
            "nota": _frase_em(frases, c["fonte_inicio"])[:70],
        }
        if "pip" in c["layout"]:
            cena["pip"] = {
                "canto": "inferior_direito",
                "escala": 0.26,
                "formato": "arredondado",
            }
        cenas.append(cena)

    roteiro = {
        "versao": 1,
        "projeto": projeto,
        "fps": fps,
        "largura": largura,
        "altura": altura,
        "fontes": fontes,
        "audio": {"arquivo": arquivo_audio},
        "cenas": cenas,
        "legendas": montar_legendas(palavras, cfg, offset_audio),
        "overlays": [],
        "musica": None,
    }

    cortado = duracao_total - duracao_final
    ok(
        f"{len(cenas)} cenas | {duracao_final:.1f}s finais "
        f"({cortado:.1f}s de silencio removidos) | "
        f"{len(roteiro['legendas']['palavras'])} palavras legendadas"
    )
    return roteiro
