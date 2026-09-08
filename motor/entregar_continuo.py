"""
SupremoCut - monta e renderiza os anuncios com narracao continua.

Entrega numa pasta separada (`saida/continuo/`) de proposito: a versao anterior
continua em `saida/`, entao da pra ouvir as duas lado a lado antes de escolher.

O que este script faz por anuncio:
  1. amplia o video pra 1080x1920 e gera o proxy de preview
  2. troca o audio pela trilha da narracao continua
  3. escreve um projeto do editor (um bloco so, sem corte)
  4. renderiza
  5. nivela em -14 LUFS

Os projetos ficam com sufixo `-cont` pra nao sobrescrever os antigos: se voce
preferir a primeira versao, ela ainda esta la, intacta.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path

from comum import RAIZ, aviso, ok, passo, rodar, salvar_json, sondar

ESTUDIO = RAIZ / "estudio"

# ---------------------------------------------------------------------------
# A pasta de entrega
# ---------------------------------------------------------------------------
#
# Cada versao da narracao tem a SUA pasta, e isso nao e organizacao: e evitar
# perda. Ao gerar o Origyn com a voz nova, o arquivo caiu por cima do Origyn
# com a voz antiga dentro de `continuo/` — a pasta virou uma mistura de duas
# versoes e a anterior daquele anuncio se perdeu.
#
#   saida/            a primeira dublagem, amarrada nas janelas do ingles
#   saida/continuo/   narracao corrida, voz Bia
#   saida/aprovado/   narracao corrida, textos aprovados um a um, voz Sarah
#
# Trocar de versao e passar `--pasta <nome>`; o padrao e sempre a mais recente.
PASTA_PADRAO = "aprovado"
ATUAL = ESTUDIO / "src" / "roteiro-atual.json"
TRABALHO = RAIZ / "trabalho" / "narracao"

# ---------------------------------------------------------------------------
# Por que a pasta temporaria tem o nome do projeto no fim
# ---------------------------------------------------------------------------
#
# Ela ja foi uma so, `trabalho/public-render`, e isso funcionou enquanto os
# anuncios foram montados um de cada vez. Na noite em que resolvi acelerar e
# disparei varios em paralelo, dois processos escreveram na MESMA pasta: um
# apagou o que o outro tinha acabado de copiar, e o Everyday Finds saiu com a
# trilha do Goltali — 34,6s num video de 30,6s.
#
# O pior nao foi o erro, foi o silencio: nenhum comando falhou, nenhum log
# reclamou, e o arquivo errado ficou em `saida/aprovado` parecendo pronto.
#
# Com o nome do projeto no caminho, dois montadores nunca mais se cruzam. O
# `travar()` embaixo cuida do outro recurso compartilhado, o roteiro-atual.
def publico_tmp(projeto: str) -> Path:
    return RAIZ / "trabalho" / "public-render" / projeto

# ordem de entrega
ORDEM = [
    "Origyn", "Origyn 2", "Homefaves uk", "Everyday Finds", "Goltali",
    "Londonget Gift", "Ventra finds", "Waregami", "Genius finds",
    "Lilyrhyme", "Digg It", "Othor shopping",
]


def nome_projeto(nome: str) -> str:
    return nome.replace(" ", "-").lower() + "-cont"


def montar(nome: str) -> str | None:
    """Prepara midia e escreve o roteiro. Devolve o nome do projeto."""
    import ondas
    import tratar
    from narracao import dados_do_anuncio

    dados = dados_do_anuncio(nome)
    if not dados:
        aviso(f"não sei de onde vem: {nome}")
        return None

    origem = Path(dados["origem"])
    trilha = TRABALHO / nome / "trilha.wav"
    if not trilha.exists():
        aviso(f"sem trilha: {nome} — rode narracao.py antes")
        return None

    projeto = nome_projeto(nome)
    pasta_proj = RAIZ / "projetos" / projeto
    publica = ESTUDIO / "public" / projeto
    pasta_proj.mkdir(parents=True, exist_ok=True)
    publica.mkdir(parents=True, exist_ok=True)

    cfg = tratar.carregar_config()
    cfg["ampliar"] = {"largura": 1080, "altura": 1920, "filtro": "lanczos"}

    tratar.preparar_video(origem, publica / "camera.mp4", "camera", cfg)
    tratar.preparar_preview(origem, publica / "camera-preview.mp4", "camera", cfg)

    rodar([
        "ffmpeg", "-y", "-v", "error", "-i", str(trilha),
        "-ar", "48000", "-ac", "2", str(publica / "audio-fonte.wav"),
    ])
    tratar.audio_preview(publica / "audio-fonte.wav", publica / "audio-fonte-preview.m4a")
    ondas.gerar(publica / "audio-fonte.wav", publica / "picos.json")

    info = sondar(origem)
    fps = int(round(info.fps)) or 30
    dur = round(sondar(publica / "audio-fonte.wav").duracao, 3)

    roteiro = {
        "versao": 1,
        "projeto": projeto,
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
        # Um bloco só, sem corte. A narração é contínua: cortar o vídeo por
        # baixo dela só criaria a fragmentação que esta versão veio resolver.
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
                "nota": "narração contínua",
            }
        ],
        "legendas": {"estilo": "nenhum", "ligada_em": [], "base_tempo": "fonte", "palavras": []},
        "overlays": [],
        "musica": None,
        "marcadores": [],
    }

    # O Othor tem legenda queimada em russo: as tarjas do projeto original
    # continuam necessárias, então são herdadas em vez de refeitas.
    antigo = RAIZ / "projetos" / nome.replace(" ", "-").lower() / "roteiro.json"
    if antigo.exists():
        from comum import ler_json

        velho = ler_json(antigo)
        if velho.get("overlays"):
            roteiro["overlays"] = velho["overlays"]

    salvar_json(pasta_proj / "roteiro.json", roteiro)
    return projeto


def so_o_necessario(projeto: str) -> Path:
    """Pasta public enxuta — a cheia tem 3 GB e o bundle copia tudo."""
    base = publico_tmp(projeto)
    if base.exists():
        shutil.rmtree(base, ignore_errors=True)
    base.mkdir(parents=True, exist_ok=True)
    origem = ESTUDIO / "public" / projeto
    if origem.exists():
        shutil.copytree(origem, base / projeto)
    musica = ESTUDIO / "public" / "musica"
    if musica.exists():
        shutil.copytree(musica, base / "musica")
    return base


def trocar(novo: Path, destino: Path, tentativas: int = 8) -> bool:
    """
    Poe `novo` no lugar de `destino`, mesmo com o antigo aberto em algum lugar.

    Um MP4 recem-entregue costuma estar aberto: o Explorer fazendo miniatura,
    um player, o cartao de arquivo do chat. No Windows isso impede TROCAR o
    arquivo — a entrada no diretorio esta presa — e o erro chega como EPERM no
    ultimo passo do render.

    Duas saidas, nesta ordem:

      1. `os.replace`, que e atomico e e o certo quando ninguem segura nada.
         Insiste alguns segundos, porque miniatura e antivirus soltam sozinhos.

      2. Escrever POR DENTRO do arquivo que ja existe. Aqui a entrada do
         diretorio nem e tocada: o arquivo continua sendo o mesmo, so o
         conteudo muda. Quem o abriu pra LER continua com ele aberto e nao
         reclama. Foi o que destravou o Digg It depois de dois minutos de
         `os.replace` batendo na porta.

    O passo 2 nao e atomico: se faltar energia no meio, o arquivo fica pela
    metade. Por isso ele e o segundo, e nao o primeiro.
    """
    for _ in range(tentativas):
        try:
            os.replace(novo, destino)
            return True
        except PermissionError:
            time.sleep(2.5)

    try:
        with open(destino, "r+b") as saida, open(novo, "rb") as entrada:
            saida.truncate(0)
            shutil.copyfileobj(entrada, saida)
        novo.unlink(missing_ok=True)
        return True
    except OSError:
        return False


@contextmanager
def travar():
    """
    Deixa um montador por vez mexer no `roteiro-atual.json`.

    Esse arquivo e o unico ponto do render que NAO da pra separar por projeto:
    o `src/index.ts` importa ele por caminho fixo. Duas montagens ao mesmo
    tempo escrevem uma por cima da outra e o render pega o roteiro do vizinho.

    O cadeado e um arquivo criado com `x` — quem consegue criar, entra; quem
    nao consegue, espera. Funciona entre processos diferentes, que e o caso
    aqui (cada anuncio roda no seu proprio `python`).
    """
    cadeia = RAIZ / "trabalho" / "montando.lock"
    cadeia.parent.mkdir(parents=True, exist_ok=True)
    esperou = 0.0
    while True:
        try:
            fd = os.open(cadeia, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            # cadeado orfao: processo morreu sem soltar
            if cadeia.exists() and time.time() - cadeia.stat().st_mtime > 1800:
                cadeia.unlink(missing_ok=True)
                continue
            if esperou == 0:
                print("   [..] outro anúncio está montando — esperando a vez")
            time.sleep(3)
            esperou += 3
    try:
        yield
    finally:
        cadeia.unlink(missing_ok=True)


def renderizar(projeto: str, saida_nome: str, saida: Path) -> Path | None:
    roteiro = RAIZ / "projetos" / projeto / "roteiro.json"
    destino = saida / f"{saida_nome}.mp4"
    saida.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------------------
    # Renderiza num nome novo e so depois toma o lugar do antigo
    # ---------------------------------------------------------------------
    #
    # O Remotion monta o MP4 num arquivo `.remotion-in-progress` e no fim faz
    # um `rename` por cima do destino. No Windows isso falha com EPERM se
    # QUALQUER programa estiver com o arquivo aberto — o Explorer gerando
    # miniatura, um player com o video anterior na tela, o antivirus lendo.
    #
    # Foi o que aconteceu com o Digg It: o render inteiro rodou, os quadros
    # ficaram prontos, e a entrega morreu no ultimo passo. Pior: o
    # `masterizar` seguinte nivelou o arquivo VELHO e imprimiu "ok".
    #
    # Renderizando num nome que ninguem tem aberto, o rename do Remotion
    # sempre funciona. A troca pelo definitivo fica por conta de `trocar()`,
    # que insiste enquanto o arquivo estiver preso.
    bruto = destino.with_name(f"{destino.stem}.novo.mp4")
    bruto.unlink(missing_ok=True)

    t0 = time.time()
    with travar():
        shutil.copy2(roteiro, ATUAL)
        publico = so_o_necessario(projeto)
        p = subprocess.run(
            ["npx", "remotion", "render", "src/index.ts", "Vertical", str(bruto),
             f"--public-dir={publico}", "--timeout=120000", "--log=error"],
            cwd=str(ESTUDIO), shell=True, capture_output=True,
            text=True, encoding="utf-8", errors="replace",
        )
    if p.returncode == 0 and bruto.exists() and not trocar(bruto, destino):
        aviso(
            f"{saida_nome}: renderizou, mas não consegui substituir o arquivo antigo "
            f"— feche quem estiver com ele aberto. O novo ficou em {bruto.name}"
        )
        return None
    if p.returncode != 0 or not destino.exists():
        aviso(f"{projeto}: FALHOU")
        for l in (p.stderr or "").splitlines()[-5:]:
            print(f"      {l}")
        return None

    info = sondar(destino)

    # O video montado tem que ter a duracao da FONTE. Quando nao tem, o render
    # pegou o roteiro de outro anuncio — foi assim que o Everyday Finds saiu
    # com a trilha do Goltali. Melhor recusar do que entregar parecido.
    esperado = sondar(Path(RAIZ / "estudio" / "public" / projeto / "camera.mp4")).duracao
    if abs(info.duracao - esperado) > 0.15:
        aviso(
            f"{saida_nome}: saiu com {info.duracao:.1f}s mas a fonte tem "
            f"{esperado:.1f}s — o render pegou o roteiro errado. NÃO use este arquivo."
        )
        return None
    print(
        f"   [ok] {saida_nome:<18} {info.duracao:>5.1f}s  "
        f"{destino.stat().st_size / 1048576:>5.1f} MB  em {time.time() - t0:>4.0f}s"
    )
    return destino


def main() -> None:
    ap = argparse.ArgumentParser(prog="entregar_continuo")
    ap.add_argument("--so", default=None)
    ap.add_argument("--pular-montagem", action="store_true")
    ap.add_argument(
        "--pasta",
        default=PASTA_PADRAO,
        help=f"subpasta de saida/ (padrão: {PASTA_PADRAO})",
    )
    a = ap.parse_args()

    saida = RAIZ / "saida" / a.pasta
    lista = [a.so] if a.so else ORDEM
    guardado = ATUAL.read_bytes() if ATUAL.exists() else None

    passo(f"narração contínua — {len(lista)} anúncios para {saida}")
    feitos, falhos = [], []
    try:
        for nome in lista:
            projeto = nome_projeto(nome) if a.pular_montagem else montar(nome)
            if not projeto:
                falhos.append(nome)
                continue
            r = renderizar(projeto, nome.replace(" ", "-").lower() + "-pt", saida)
            (feitos if r else falhos).append(nome)
    finally:
        if guardado is not None:
            ATUAL.write_bytes(guardado)

    print()
    ok(f"{len(feitos)} de {len(lista)} em {saida}")
    if falhos:
        aviso("falharam: " + ", ".join(falhos))


if __name__ == "__main__":
    main()
