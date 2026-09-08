"""
SupremoCut - monta o Reels da Super San a partir dos takes de drone.

O QUE ESTE ARQUIVO DECIDE

O briefing pede 30-45 segundos de drone intercalado com takes da base, ritmo de
corte acompanhando a trilha, e seis letterings. Duas dessas coisas nao tem como
existir hoje:

  - a TRILHA nao foi entregue, entao os cortes aqui tem duracao escolhida a mao
    (entre 2,5 e 4,5 segundos, que e o passo natural de um institucional). Quando
    o mp3 chegar, e so trocar as duracoes pelos intervalos entre batidas: a
    estrutura nao muda.
  - os TAKES DA BASE que existem no Drive sao video de WhatsApp entre 478 e 848
    pixels. Ampliar aquilo pra 1080x1920 ao lado de drone 1080p denuncia na
    tela. Entao este corte e so drone; a base entra depois, pelas fotos de
    6000x4000, ou pelo material original se a agencia tiver.

O RECORTE PRA VERTICAL

A fonte e 1920x1080. Um recorte 9:16 dela tem no maximo 608 pixels de largura,
que sobem pra 1080 no final — uma ampliacao de 1,78x. Nao ha como fugir disso
sem os originais em 4K, e vale dizer em voz alta: e o unico ponto do video onde
se perde qualidade.

O recorte e CENTRAL por padrao. Em plano aereo aberto o assunto costuma estar no
meio, mas alguns takes pedem outro enquadramento — por isso cada segmento tem um
`foco` proprio, de 0 (esquerda) a 1 (direita).

Rodar:  python super_san.py            (monta e renderiza)
        python super_san.py --so-montar (so prepara, nao renderiza)
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import time
from pathlib import Path

from comum import RAIZ, aviso, ok, passo, rodar, salvar_json, sondar

MATERIAL = RAIZ / "material" / "super-san" / "drone"
ESTUDIO = RAIZ / "estudio"
PROJETO = "super-san-reels"
LARGURA, ALTURA, FPS = 1080, 1920, 30

# ---------------------------------------------------------------------------
# O corte
# ---------------------------------------------------------------------------
#
# (arquivo, inicio no arquivo, duracao na tela, foco horizontal 0..1, nota)
#
# A ordem conta uma historia em quatro tempos: quem somos (o logo abrindo pra
# frota), a escala (a frota inteira de cima), a operacao (gente trabalhando), e
# o fecho (a base completa). E como um institucional convence sem locucao.
# O `foco` (0 = esquerda, 0,5 = centro, 1 = direita) foi escolhido OLHANDO cada
# plano com as tres faixas 9:16 desenhadas por cima. Nao e chute nem media: e
# onde o assunto esta em cada quadro.
#
# A versao com faixa e fundo desfocado foi descartada — o Campelo olhou e disse
# que lia como imagem amassada. Tela cheia e a convencao do Reels, e o preco
# (dois tercos da largura fora) se paga escolhendo o lado certo do recorte.
SEGMENTOS = [
    ("DJI_0163_SS (1).MP4", 0.5, 4.0, 0.00, "cheio", "logo no tanque, camera abrindo"),
    ("DJI_0163_SS (1).MP4", 5.0, 3.0, 0.30, "cheio", "tanque revelado inteiro"),
    ("DJI_0164_SS (1).MP4", 6.0, 2.5, 0.50, "cheio", "rasante pela frota"),
    ("drone-0162.mp4", 22.0, 3.0, 0.75, "cheio", "cabine com a marca"),

    ("DJI_0166_SS (2).MP4", 11.0, 3.5, 0.15, "cheio", "vertical, frota em L"),
    ("DJI_0164_SS (1).MP4", 20.0, 2.5, 0.40, "cheio", "frota de perfil"),
    ("drone-0162.mp4", 40.0, 3.0, 0.30, "cheio", "fileiras de caminhao"),
    ("DJI_0166_SS (2).MP4", 30.0, 2.5, 0.60, "cheio", "vertical, outro angulo"),

    ("DJI_0168_SS (1).MP4", 5.0, 3.0, 0.25, "cheio", "orbita na altura do caminhao"),
    ("drone-0161.mp4", 12.0, 3.5, 0.35, "cheio", "operador em cima do tanque"),
    ("DJI_0168_SS (1).MP4", 30.0, 3.0, 0.55, "cheio", "abre pra fachada"),

    ("DJI_0163_SS (1).MP4", 26.0, 4.5, 0.30, "cheio", "a base inteira"),
    ("DJI_0163_SS (1).MP4", 30.5, 3.8, 0.30, "cheio", "fecho, patio e galpao"),
]

# ---------------------------------------------------------------------------
# Os letterings
# ---------------------------------------------------------------------------
#
# Os textos sao os do caderno de posts, quebrados em duas linhas: o
# `lower_third` poe a primeira em 62px e a segunda em 32px, e uma frase inteira
# numa linha so estouraria a largura do celular.
#
# O tamanho da linha de cima e 62px e o `lower_third` nao tem largura maxima:
# frase comprida nao quebra, ela SAI DA TELA. Na primeira montagem "Presença em
# mais de" vazou pelos dois lados. Entao a regra e: no maximo uns 20 caracteres
# em cima, o resto desce pra linha de 32px.
LETTERINGS = [
    (0.8, 4.2, "Gestão de resíduos", "para grandes operações industriais"),
    (12.7, 4.0, "Mais de 200 veículos", "e equipamentos próprios"),
    (21.7, 4.0, "Mais de 10 estados", "de presença no país"),
    (27.2, 3.3, "Uma estrutura", "pensada para não parar"),
]
FECHO = (34.0, 6.0, "Estrutura que sustenta grandes operações")

# tirada dos proprios tanques da frota
TEAL = "#0FB5A6"


def quantizar(v: float) -> float:
    """Segundos que caem em quadro inteiro — a invariante do projeto."""
    return round(v * FPS) / FPS


# Onde a faixa de imagem comeca, dentro dos 1920 de altura. Abaixo dela sobram
# 730 pixels — que e exatamente onde o lettering mora.
FAIXA_TOPO = 380
FAIXA_ALTURA = 810


def recortar(
    origem: Path, inicio: float, duracao: float, foco: float, modo: str, saida: Path
) -> None:
    """
    Tira um pedaco do take e entrega ele em pe, 1080x1920.

    DOIS ENQUADRAMENTOS, E POR QUE OS DOIS PRECISAM EXISTIR

    `cheio` recorta uma fatia 9:16 da imagem e ela ocupa a tela toda. De uma
    fonte 1920x1080 essa fatia tem 608 pixels de largura: sobra um terco do
    quadro original. Funciona quando o assunto e vertical ou esta centrado —
    um caminhao de perfil, um operador em cima do tanque.

    `faixa` mantem tres quartos da largura (1440 dos 1920) numa banda de
    1080x810, com o proprio quadro desfocado e escurecido atras preenchendo o
    resto. Existe porque a primeira montagem provou o obvio depois que eu olhei:
    num plano aereo ABERTO, o recorte 9:16 corta justamente o que faz o plano
    valer — a frota que se estende pros lados vira closeup de lataria.

    A escolha e por plano, nao global. Errar aqui nao quebra nada, so empobrece,
    e por isso e a primeira coisa a revisar olhando o resultado.
    """
    # A largura do recorte sai de uma EXPRESSAO do proprio ffmpeg, nao de um
    # numero calculado aqui. Uma versao anterior media o arquivo com o ffprobe
    # e mandava "crop=1440:1080" fixo — e um dos takes recusou, porque o quadro
    # que chega no filtro nem sempre tem a dimensao que o cabecalho anuncia
    # (rotacao, recorte de exibicao, aspecto nao quadrado). Com `min(iw, ...)` o
    # filtro se ajusta ao que realmente recebeu.
    def fatia(proporcao: str) -> str:
        larg = f"min(iw\\,ih*{proporcao})"
        return f"crop={larg}:ih:(iw-{larg})*{foco:.2f}:0"

    if modo == "cheio":
        filtro = (
            f"{fatia('9/16')},"
            f"scale={LARGURA}:{ALTURA}:flags=lanczos,"
            f"fps={FPS},format=yuv420p"
        )
    else:
        filtro = (
            "[0:v]split=2[bg][fg];"
            f"[bg]scale={LARGURA}:{ALTURA}:force_original_aspect_ratio=increase,"
            f"crop={LARGURA}:{ALTURA},gblur=sigma=45,eq=brightness=-0.20[b];"
            f"[fg]{fatia('4/3')},"
            f"scale={LARGURA}:{FAIXA_ALTURA}:flags=lanczos[f];"
            f"[b][f]overlay=0:{FAIXA_TOPO},fps={FPS},format=yuv420p"
        )

    chave = "-filter_complex" if modo == "faixa" else "-vf"
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{inicio:.3f}", "-i", str(origem), "-t", f"{duracao:.3f}",
        chave, filtro,
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        str(saida),
    ])


def montar() -> tuple[str, float]:
    publica = ESTUDIO / "public" / PROJETO
    publica.mkdir(parents=True, exist_ok=True)
    tmp = RAIZ / "trabalho" / "super-san"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)

    passo(f"recortando {len(SEGMENTOS)} planos pra {LARGURA}x{ALTURA}")
    pedacos: list[Path] = []
    cenas: list[dict] = []
    relogio = 0.0

    for i, (arq, ini, dur, foco, modo, nota) in enumerate(SEGMENTOS, 1):
        origem = MATERIAL / arq
        if not origem.exists():
            aviso(f"não achei {arq}")
            continue
        fonte_dur = sondar(origem).duracao
        if ini + dur > fonte_dur:
            aviso(f"{arq}: {ini}+{dur}s passa do fim ({fonte_dur:.1f}s) — pulando")
            continue

        dur = quantizar(dur)
        pedaco = tmp / f"p{i:02d}.mp4"
        recortar(origem, ini, dur, foco, modo, pedaco)
        real = quantizar(sondar(pedaco).duracao)
        pedacos.append(pedaco)

        cenas.append({
            "id": f"c{i:03d}",
            "fonte_inicio": quantizar(relogio),
            "duracao": real,
            "layout": "camera",
            "entrada": {"tipo": "corte"},
            "foco": None,
            "velocidade": 1,
            "volume": 0,
            "nota": f"{arq} @ {ini:.1f}s — {nota}",
        })
        relogio += real
        print(f"   {i:>2}. {modo:<6}{nota:<32} {real:>4.1f}s   (acumulado {relogio:>5.1f}s)")

    if not pedacos:
        raise SystemExit("nenhum plano foi recortado")

    # emenda tudo num arquivo só: o roteiro do editor tem UMA fonte de câmera
    lista = tmp / "lista.txt"
    lista.write_text(
        "".join(f"file '{p.as_posix()}'\n" for p in pedacos), encoding="utf-8"
    )
    camera = publica / "camera.mp4"
    rodar([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
        "-i", str(lista), "-c", "copy", str(camera),
    ])

    total = quantizar(sondar(camera).duracao)
    ok(f"câmera montada — {total:.1f}s")

    # trilha vazia do tamanho do vídeo: o motor exige uma faixa, e o silêncio
    # deixa o lugar reservado pra música sem inventar som nenhum
    audio = publica / "audio-fonte.wav"
    rodar([
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
        "-i", f"anullsrc=r=48000:cl=stereo", "-t", f"{total:.3f}", str(audio),
    ])

    import ondas
    import tratar

    tratar.preparar_preview(camera, publica / "camera-preview.mp4", "camera",
                            tratar.carregar_config())
    tratar.audio_preview(audio, publica / "audio-fonte-preview.m4a")
    ondas.gerar(audio, publica / "picos.json")

    overlays = []
    for j, (ini, dur, texto, sub) in enumerate(LETTERINGS, 1):
        overlays.append({
            "id": f"l{j:02d}",
            "inicio": quantizar(ini),
            "duracao": quantizar(dur),
            "tipo": "lower_third",
            "texto": texto,
            "subtexto": sub,
            "posicao": {"x": 0.08, "y": 0.72},
        })
    ini, dur, texto = FECHO
    overlays.append({
        "id": "fecho",
        "inicio": quantizar(ini),
        "duracao": quantizar(dur),
        "tipo": "titulo",
        "texto": texto,
        "posicao": {"x": 0.5, "y": 0.5},
    })

    roteiro = {
        "versao": 1,
        # muda a cada processamento; o editor usa isso pra não servir do cache
        # o vídeo da montagem anterior
        "versao_midia": int(time.time()),
        "projeto": PROJETO,
        "fps": FPS,
        "largura": LARGURA,
        "altura": ALTURA,
        "fontes": {
            "camera": {
                "arquivo": "camera.mp4",
                "arquivo_preview": "camera-preview.mp4",
                "offset": 0.0,
                "duracao": total,
                "largura": LARGURA,
                "altura": ALTURA,
            },
            "tela": None,
        },
        "audio": {
            "arquivo": "audio-fonte.wav",
            "arquivo_preview": "audio-fonte-preview.m4a",
            "picos": "picos.json",
            "offset": 0.0,
        },
        "cenas": cenas,
        "legendas": {"estilo": "nenhum", "ligada_em": [], "base_tempo": "fonte", "palavras": []},
        "overlays": overlays,
        "musica": None,
        "marcadores": [],
    }

    pasta = RAIZ / "projetos" / PROJETO
    pasta.mkdir(parents=True, exist_ok=True)
    salvar_json(pasta / "roteiro.json", roteiro)

    estilo = {
        "nome": "Super San",
        "cores": {
            "fundo": "#0A0A0C",
            "destaque": TEAL,
            "texto": "#FFFFFF",
            "texto_sombra": "rgba(0,0,0,0.45)",
            "borda": "#FFFFFF",
        },
        "fonte": {
            "familia": "Inter, 'Segoe UI', Arial, sans-serif",
            "peso": 800,
            "tamanho_legenda": 62,
            # 78px em caixa alta quebrava o fecho em quatro linhas e enchia a
            # tela; 62 deixa ele em tres e sobra respiro em volta
            "tamanho_titulo": 62,
            "caixa_alta": True,
        },
        "pip": {"escala_padrao": 0.26, "raio": 28, "borda": 0, "margem": 56, "sombra": True},
        "animacao": {"mola_rigidez": 120, "mola_amortecimento": 18, "duracao_padrao": 0.55},
        "legenda": {"posicao_y": 0.8, "max_palavras": 4, "fundo": False, "contorno": 3},
    }
    salvar_json(pasta / "estilo.json", estilo)
    return PROJETO, total


def renderizar(total: float) -> Path | None:
    import entregar_continuo as ent

    pasta = RAIZ / "projetos" / PROJETO
    saida = RAIZ / "saida" / "super-san"
    saida.mkdir(parents=True, exist_ok=True)
    destino = saida / "reels-super-san.mp4"
    bruto = destino.with_name("reels-super-san.novo.mp4")
    bruto.unlink(missing_ok=True)

    estilo_atual = ESTUDIO / "src" / "estilo-atual.json"
    guardado = estilo_atual.read_bytes() if estilo_atual.exists() else None

    passo(f"renderizando {total:.1f}s em {LARGURA}x{ALTURA}")
    t0 = time.time()
    try:
        with ent.travar():
            shutil.copy2(pasta / "roteiro.json", ent.ATUAL)
            shutil.copy2(pasta / "estilo.json", estilo_atual)
            publico = ent.so_o_necessario(PROJETO)
            p = subprocess.run(
                ["npx", "remotion", "render", "src/index.ts", "Vertical", str(bruto),
                 f"--public-dir={publico}", "--timeout=120000", "--log=error"],
                cwd=str(ESTUDIO), shell=True, capture_output=True,
                text=True, encoding="utf-8", errors="replace",
            )
    finally:
        if guardado is not None:
            estilo_atual.write_bytes(guardado)

    if p.returncode != 0 or not bruto.exists():
        aviso("render FALHOU")
        for l in (p.stderr or "").splitlines()[-8:]:
            print(f"      {l}")
        return None

    if not ent.trocar(bruto, destino):
        aviso(f"renderizou mas não substituí o antigo — está em {bruto.name}")
        return bruto

    info = sondar(destino)
    ok(f"{destino.name}  {info.duracao:.1f}s  "
       f"{destino.stat().st_size / 1048576:.1f} MB  em {time.time() - t0:.0f}s")
    return destino


def main() -> None:
    ap = argparse.ArgumentParser(prog="super_san")
    ap.add_argument("--so-montar", action="store_true")
    a = ap.parse_args()

    _, total = montar()
    if not a.so_montar:
        renderizar(total)


if __name__ == "__main__":
    main()
