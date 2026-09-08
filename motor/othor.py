"""
SupremoCut - o anuncio que nao tem locucao.

O "Othor shopping" e o unico dos doze sem narracao: o Whisper roda nele e nao
acha UMA fala. O que existe e musica de fundo e legenda QUEIMADA em russo,
palavra por palavra, com realce ciano. Ou seja: o texto na tela nao acompanha a
mensagem — ele E a mensagem.

Por isso ele nao passa pelo dublar.py. Aqui a entrega e outra: cobrir o texto
russo com tarja e escrever por cima em portugues, mantendo a musica original.

Duas coberturas, e as duas importam:

  1. A FAIXA DE LEGENDA (73% a 84% da altura). Tarjas encostadas uma na outra,
     sem intervalo — se sobrar um quadro entre duas, o russo pisca por baixo.
  2. A MARCA D'AGUA "@othorbd.com" (65%). E o dominio de quem vendia o produto
     la fora. Deixar passar seria anunciar o concorrente no criativo do cliente.

Rodar:  python othor.py
"""

from __future__ import annotations

from pathlib import Path

from comum import RAIZ, ok, passo, rodar, salvar_json, sondar

ORIGEM = Path(
    r"C:\Users\willi\Downloads\Anúncios-20260828T200642Z-1-001\Anúncios\Othor shopping.mp4"
)
PROJETO = "othor-shopping"

# ---------------------------------------------------------------------------
# A copy, encostada carta a carta no tempo do russo
#
# (inicio, fim, texto). Os tempos saem da leitura quadro a quadro da faixa de
# legenda original, amostrada a cada 0,8s. Cada carta termina exatamente onde a
# proxima comeca — e por isso que nao ha buraco por onde o russo apareca.
# ---------------------------------------------------------------------------
CARTAS: list[tuple[float, float, str]] = [
    (0.00, 1.50, "Antes, era palito de metal."),
    (1.50, 2.40, "E doía."),
    (2.40, 3.20, "Nos anos 80 veio o cotonete."),
    (3.20, 5.20, "Mas ele empurra a cera pra dentro."),
    (5.20, 7.20, "Em 2026, todo mundo já trocou."),
    (7.20, 8.80, "Olha a ponta: macia"),
    (8.80, 10.40, "e grudenta."),
    (10.40, 11.20, "A cera gruda nela"),
    (11.20, 12.00, "sem machucar o canal."),
    (12.00, 13.60, "Higiênico. Adulto e criança."),
    (13.60, 15.00, "Sujou? Lava e usa de novo."),
    (15.00, 16.32, "Link na bio."),
]

# Onde o texto russo vive, em fracao do quadro. Medido nos quadros extraidos:
# a legenda de duas linhas vai de 0,715 a 0,83; a margem cobre o contorno.
FAIXA = {"x": 0.02, "y": 0.705, "largura": 0.96, "altura": 0.135}

# A marca d'agua, um pouco acima.
MARCA = {"x": 0.16, "y": 0.632, "largura": 0.68, "altura": 0.058}

# Preto puro sobre video colorido denuncia a tarja. Um cinza bem escuro com um
# fio de borda some no material e ainda separa o texto do fundo.
CAIXA_TEXTO = {
    "cor": "#0B0B0D",
    "cor_borda": "#FFFFFF",
    "borda": 2,
    "raio": 10,
    "cor_texto": "#FFFFFF",
    "tamanho_texto": 52,
    "peso": 800,
    "alinhamento": "centro",
    "contorno": 0,
    "caixa_alta": False,
}

# A da marca d'agua nao tem texto: e so tapar. Sem borda, pra nao chamar
# atencao pra um retangulo no meio do nada.
CAIXA_TAPA = {
    **CAIXA_TEXTO,
    "borda": 0,
    "raio": 6,
    "tamanho_texto": 1,
}


def main() -> None:
    import ondas
    import tratar

    if not ORIGEM.exists():
        raise SystemExit(f"nao achei o video: {ORIGEM}")

    pasta_proj = RAIZ / "projetos" / PROJETO
    publica = RAIZ / "estudio" / "public" / PROJETO
    pasta_proj.mkdir(parents=True, exist_ok=True)
    publica.mkdir(parents=True, exist_ok=True)

    cfg = tratar.carregar_config()
    cfg["ampliar"] = {"largura": 1080, "altura": 1920, "filtro": "lanczos"}

    passo(f"Montando '{PROJETO}' (sem locucao — so tarja)")
    tratar.preparar_video(ORIGEM, publica / "camera.mp4", "camera", cfg)
    tratar.preparar_preview(ORIGEM, publica / "camera-preview.mp4", "camera", cfg)

    # O audio ORIGINAL fica: e a musica do anuncio, e nao ha voz nenhuma pra
    # substituir. So passa pelo tratamento pra nivelar o volume com os outros
    # onze — uma sequencia de anuncios em que um pula de volume denuncia a
    # montagem tanto quanto uma tarja mal posta.
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(ORIGEM),
        "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-ar", "48000", "-ac", "2",
        str(publica / "audio-fonte.wav"),
    ])
    tratar.audio_preview(publica / "audio-fonte.wav", publica / "audio-fonte-preview.m4a")
    ondas.gerar(publica / "audio-fonte.wav", publica / "picos.json")

    info = sondar(ORIGEM)
    fps = int(round(info.fps)) or 30
    dur = round(sondar(publica / "audio-fonte.wav").duracao, 3)

    overlays = [
        # a tapa da marca d'agua entra primeiro, pra ficar por baixo do resto
        {
            "id": "tapa_marca",
            "inicio": 0.0,
            "duracao": dur,
            "tipo": "tarja",
            "texto": "",
            "posicao": {"x": MARCA["x"], "y": MARCA["y"]},
            "tamanho": {"largura": MARCA["largura"], "altura": MARCA["altura"]},
            "caixa": CAIXA_TAPA,
        }
    ]

    for i, (ini, fim, texto) in enumerate(CARTAS, 1):
        overlays.append({
            "id": f"t{i:02d}",
            "inicio": round(ini, 3),
            "duracao": round(min(fim, dur) - ini, 3),
            "tipo": "tarja",
            "texto": texto,
            "posicao": {"x": FAIXA["x"], "y": FAIXA["y"]},
            "tamanho": {"largura": FAIXA["largura"], "altura": FAIXA["altura"]},
            "caixa": dict(CAIXA_TEXTO),
        })

    roteiro = {
        "versao": 1,
        "projeto": PROJETO,
        "fps": fps,
        "largura": 1080,
        "altura": 1920,
        "fontes": {
            "camera": {
                "arquivo": "camera.mp4",
                "arquivo_preview": "camera-preview.mp4",
                "offset": 0.0,
                "duracao": round(info.duracao, 3),
                "largura": 1080,
                "altura": 1920,
            },
            "tela": None,
        },
        "audio": {
            "arquivo": "audio-fonte.wav",
            "arquivo_preview": "audio-fonte-preview.m4a",
            "picos": "picos.json",
            "offset": 0.0,
        },
        "cenas": [
            {
                "id": "c001",
                "fonte_inicio": 0.0,
                "duracao": dur,
                "layout": "camera",
                "entrada": {"tipo": "corte"},
                "foco": None,
                "velocidade": 1,
                "volume": 1,
                "nota": "musica original — sem locucao",
            }
        ],
        "legendas": {"estilo": "nenhum", "ligada_em": [], "base_tempo": "fonte", "palavras": []},
        "overlays": overlays,
        "musica": None,
        "marcadores": [
            {"t": round(ini, 2), "texto": texto[:40]} for ini, _, texto in CARTAS
        ],
    }

    salvar_json(pasta_proj / "roteiro.json", roteiro)
    ok(f"projeto '{PROJETO}' pronto — {len(CARTAS)} tarjas de texto + 1 tapando a marca")
    print("      Confira no editor se a tarja cobre TODO o texto russo antes de renderizar.")


if __name__ == "__main__":
    main()
