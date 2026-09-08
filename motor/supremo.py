"""
SupremoCut - o comando principal.

  python motor/supremo.py checar
  python motor/supremo.py novo aula-01
  python motor/supremo.py preparar aula-01
  python motor/supremo.py estudio aula-01
  python motor/supremo.py render aula-01 --formato Principal

Fluxo: voce joga os brutos em projetos/<nome>/bruto/, roda "preparar",
abre o "estudio" pra conferir, mexe no roteiro.json se quiser, e "render".
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comum import (  # noqa: E402
    ENTRADA, ESTUDIO, PROJETOS, SAIDA, aviso, carregar_estilo, caminho_roteiro,
    ler_json, ok, pasta_bruto, pasta_projeto, pasta_publica, passo,
    salvar_json, sondar, tem_gpu,
)
import audio as mod_audio  # noqa: E402
import ondas  # noqa: E402
import roteirizar  # noqa: E402
import sincronizar  # noqa: E402
import tratar  # noqa: E402
import transcrever as mod_transcrever  # noqa: E402

EXTENSOES = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".mts"}

PISTAS_CAMERA = ("camera", "cam", "webcam", "face", "rosto", "eu")
PISTAS_TELA = ("tela", "screen", "scr", "desktop", "captura", "monitor", "obs")


# --------------------------------------------------------------------------

def descobrir_fontes(nome: str) -> dict[str, Path]:
    """Olha projetos/<nome>/bruto/ e adivinha quem e camera e quem e tela."""
    pasta = pasta_bruto(nome)
    arquivos = sorted(p for p in pasta.glob("*") if p.suffix.lower() in EXTENSOES)

    if not arquivos:
        raise SystemExit(
            f"Nenhum video em {pasta}\n"
            f"Coloque os arquivos brutos la (ex.: camera.mp4 e tela.mp4) e rode de novo."
        )

    fontes: dict[str, Path] = {}
    sobra: list[Path] = []

    for a in arquivos:
        n = a.stem.lower()
        if any(p in n for p in PISTAS_CAMERA) and "camera" not in fontes:
            fontes["camera"] = a
        elif any(p in n for p in PISTAS_TELA) and "tela" not in fontes:
            fontes["tela"] = a
        else:
            sobra.append(a)

    # sem pista no nome: decide pelo formato (tela costuma ser maior/mais larga)
    for a in sobra:
        if "camera" not in fontes:
            fontes["camera"] = a
        elif "tela" not in fontes:
            fontes["tela"] = a
        else:
            aviso(f"ignorando arquivo extra: {a.name}")

    for papel, caminho in fontes.items():
        ok(f"{papel}: {caminho.name}")
    return fontes


# --------------------------------------------------------------------------

def cmd_editar(
    nome: str | None, modelo: str, idioma: str, formato: str, cortes: str | None = None
) -> None:
    """
    O caminho preguicoso: pega o que estiver em entrada\\, cria o projeto,
    prepara e renderiza. Um comando so, do bruto ao video pronto.
    """
    from datetime import datetime

    arquivos = sorted(p for p in ENTRADA.glob("*") if p.suffix.lower() in EXTENSOES)
    if not arquivos:
        raise SystemExit(
            f"A pasta de entrada esta vazia.\n"
            f"Arraste seus videos para:  {ENTRADA}\n"
            f"Depois rode de novo."
        )

    nome = nome or f"video-{datetime.now():%Y-%m-%d-%H%M}"
    destino = pasta_bruto(nome)
    destino.mkdir(parents=True, exist_ok=True)

    passo(f"Movendo {len(arquivos)} arquivo(s) para o projeto '{nome}'")
    for a in arquivos:
        alvo = destino / a.name
        shutil.move(str(a), str(alvo))
        ok(f"{a.name}")

    cmd_preparar(nome, modelo, idioma, pular_transcricao=False, cortes=cortes)
    cmd_render(nome, formato, None)

    print(f"\n=== VIDEO PRONTO ===")
    print(f"  {SAIDA / f'{nome}-{formato.lower()}.mp4'}")


def cmd_audio(
    acao: str,
    arquivo: str | None,
    saida: str | None,
    lufs: float,
    limiar: float,
) -> None:
    """Ferramentas de audio que rodam soltas, fora do fluxo de um projeto."""
    if acao == "checar":
        mod_audio.checar()
        return

    if not arquivo:
        print("Falta o arquivo. Ex.: supremo.py audio volume entrada\\anuncio.mp4")
        return

    entrada = Path(arquivo)
    if not entrada.exists():
        print(f"Nao achei o arquivo: {entrada}")
        return

    if acao == "volume":
        destino = Path(saida) if saida else entrada.with_name(f"{entrada.stem}-volume.wav")
        mod_audio.normalizar(entrada, destino, alvo_lufs=lufs)
        return

    if acao == "separar":
        destino = Path(saida) if saida else entrada.parent / "separado"
        partes = mod_audio.separar_voz(entrada, destino)
        if partes:
            print(f"  voz   -> {partes['voz']}")
            print(f"  fundo -> {partes['fundo']}")
        return

    if acao == "silencio":
        faixas = mod_audio.detectar_silencio(entrada, limiar_db=limiar)
        if not faixas:
            print("Nenhum silencio encontrado com esse limiar.")
            return
        total = sum(b - a for a, b in faixas)
        print(f"\n  {len(faixas)} trechos de silencio, {total:.1f}s no total:\n")
        for a, b in faixas:
            print(f"    {a:8.2f}s -> {b:8.2f}s   ({b - a:.2f}s)")
        print()


def cmd_checar() -> None:
    passo("Checando o ambiente")
    for prog in ("ffmpeg", "ffprobe", "node", "npm"):
        caminho = shutil.which(prog)
        print(f"   {'[ok]' if caminho else '[--]'} {prog}: {caminho or 'NAO ENCONTRADO'}")

    print(f"   {'[ok]' if tem_gpu() else '[--]'} GPU CUDA para o Whisper")
    print(f"   {'[ok]' if (ESTUDIO / 'node_modules').exists() else '[--]'} estudio Remotion instalado")
    ok("pronto")


def cmd_novo(nome: str) -> None:
    p = pasta_projeto(nome)
    (p / "bruto").mkdir(parents=True, exist_ok=True)
    pasta_publica(nome).mkdir(parents=True, exist_ok=True)
    passo(f"Projeto '{nome}' criado")
    print(f"   Coloque os videos brutos em: {p / 'bruto'}")
    print(f"   Depois rode:  python motor/supremo.py preparar {nome}")


def cmd_preparar(
    nome: str,
    modelo: str,
    idioma: str,
    pular_transcricao: bool,
    cortes: str | None = None,
) -> None:
    projeto = pasta_projeto(nome)
    if not projeto.exists():
        cmd_novo(nome)
    trabalho = projeto / "trabalho"
    publica = pasta_publica(nome)
    publica.mkdir(parents=True, exist_ok=True)
    trabalho.mkdir(parents=True, exist_ok=True)

    # 0. proteger o que ja foi editado ---------------------------------------
    # O preparar reescreve o roteiro do zero. Se voce ja passou horas ajustando
    # cortes no editor, isso apagava tudo sem aviso. Agora guarda uma copia
    # datada antes de qualquer coisa.
    ja_existe = caminho_roteiro(nome)
    if ja_existe.exists():
        from datetime import datetime

        copia = ja_existe.with_name(
            f"roteiro-{datetime.now():%Y%m%d-%H%M%S}.backup.json"
        )
        shutil.copy2(ja_existe, copia)
        aviso(
            f"Ja existia um roteiro para '{nome}' e ele sera REESCRITO do zero.\n"
            f"        Suas edicoes manuais foram guardadas em: {copia.name}"
        )

    # 1. fontes ------------------------------------------------------------
    passo("1/6  Encontrando o material bruto")
    fontes = descobrir_fontes(nome)

    # 2. sincronia ---------------------------------------------------------
    passo("2/6  Sincronizando pelo audio")
    if len(fontes) > 1:
        sync = sincronizar.sincronizar(fontes, trabalho)
    else:
        papel = next(iter(fontes))
        sync = {papel: {"offset": 0.0, "confianca": 1.0, "midia": sondar(fontes[papel])}}
        ok("fonte unica, nada pra sincronizar")

    duracao_util = sincronizar.duracao_util(sync)
    ok(f"material util em comum: {duracao_util:.1f}s")

    baixa_confianca = [p for p, s in sync.items() if s["confianca"] < 0.35 and s["offset"] != 0]
    if baixa_confianca:
        aviso(
            f"sincronia de {', '.join(baixa_confianca)} ficou incerta. "
            f"Confira no estudio; se estiver torto, ajuste o 'offset' no roteiro.json."
        )

    # 3. video -------------------------------------------------------------
    passo("3/6  Tratando os videos (cor + proxy rapido)")
    cfg_trat = tratar.carregar_config()
    fontes_roteiro: dict[str, dict | None] = {"camera": None, "tela": None}

    for papel, caminho in fontes.items():
        destino = publica / f"{papel}.mp4"
        # se o proxy ja existe e e mais novo que o bruto, nao re-encoda
        pronto = (
            destino.exists()
            and destino.stat().st_size > 0
            and destino.stat().st_mtime >= caminho.stat().st_mtime
        )
        if pronto:
            ok(f"{papel}: proxy ja existe, reaproveitando")
        else:
            tratar.preparar_video(caminho, destino, papel, cfg_trat)

        # arquivo leve, so pro editor nao engasgar
        preview = publica / f"{papel}-preview.mp4"
        preview_pronto = (
            preview.exists()
            and preview.stat().st_size > 0
            and preview.stat().st_mtime >= caminho.stat().st_mtime
        )
        if preview_pronto:
            ok(f"{papel}: preview ja existe, reaproveitando")
        else:
            tratar.preparar_preview(caminho, preview, papel, cfg_trat)

        m = sync[papel]["midia"]
        fontes_roteiro[papel] = {
            "arquivo": destino.name,
            "arquivo_preview": preview.name,
            "offset": sync[papel]["offset"],
            "duracao": round(m.duracao, 3),
            "largura": m.largura,
            "altura": m.altura,
        }

    # 4. transcricao -------------------------------------------------------
    passo("4/6  Transcrevendo")
    papel_audio = "camera" if "camera" in fontes else next(iter(fontes))
    transcricao = mod_transcrever.carregar(trabalho) if pular_transcricao else None
    if transcricao is None:
        transcricao = mod_transcrever.transcrever(
            fontes[papel_audio], trabalho, idioma=idioma, modelo=modelo
        )
    else:
        ok("reaproveitando transcricao anterior")

    # Os tempos do Whisper vem no relogio do ARQUIVO BRUTO. Daqui em diante
    # cada consumidor quer um relogio diferente, e misturar os dois foi fonte
    # de bug antes:
    #
    #   Aqui dentro, TUDO fica no relogio MESTRE — palavras e frases. E o
    #   relogio em que `fonte_inicio` das cenas e escrito, e o diretor compara
    #   as frases com o cursor da timeline pra decidir layout.
    #
    #   A conversao pro relogio do ARQUIVO acontece so na hora de gravar as
    #   legendas (ver roteirizar.montar_legendas), porque quem le a legenda no
    #   render soma `fonte_inicio + offset`. Converter cedo demais aqui fazia o
    #   offset ser contado DUAS vezes e deslocava todos os cortes.
    off_audio = sync[papel_audio]["offset"]
    janela_ini, janela_fim = off_audio, off_audio + duracao_util

    def para_mestre(lista):
        saida = []
        for item in lista:
            if item["fim"] <= janela_ini or item["t"] >= janela_fim:
                continue
            novo = dict(item)
            novo["t"] = round(max(janela_ini, item["t"]) - off_audio, 3)
            novo["fim"] = round(min(janela_fim, item["fim"]) - off_audio, 3)
            if novo["fim"] > novo["t"]:
                saida.append(novo)
        return saida

    transcricao = dict(transcricao)
    transcricao["palavras"] = para_mestre(transcricao.get("palavras", []))
    transcricao["frases"] = para_mestre(transcricao.get("frases", []))

    # 5. roteiro -----------------------------------------------------------
    passo("5/6  Escrevendo o roteiro (cortes, layouts, legendas)")
    trechos_manuais = None
    if cortes:
        # aceita tanto a lista inline quanto o caminho de um arquivo .txt
        possivel = Path(cortes)
        texto = (
            possivel.read_text(encoding="utf-8")
            if possivel.suffix.lower() == ".txt" and possivel.exists()
            else cortes
        )
        # ignora linhas de comentario, pra o arquivo poder ter anotacoes
        texto = "\n".join(
            l for l in texto.splitlines() if l.strip() and not l.strip().startswith("#")
        )
        trechos_manuais = roteirizar.ler_lista_de_cortes(texto.replace("\n", ","))
        if not trechos_manuais:
            raise SystemExit(
                f"Voce pediu cortes manuais mas nada foi entendido em: {cortes!r}\n"
                f"Formato esperado:  4:41-5:53, 6:38-9:04"
            )
    m_ref = sync[papel_audio]["midia"]
    fps = int(round(m_ref.fps)) or 30
    largura = 1920
    altura = 1080
    principal = fontes_roteiro.get("tela") or fontes_roteiro.get("camera")
    if principal and principal["largura"] > 0:
        if principal["altura"] > principal["largura"]:
            largura, altura = 1080, 1920

    roteiro = roteirizar.escrever_roteiro(
        projeto=nome,
        fontes=fontes_roteiro,
        transcricao=transcricao,
        duracao_total=duracao_util,
        fps=fps,
        largura=largura,
        altura=altura,
        arquivo_audio="audio.wav",
        trechos_manuais=trechos_manuais,
        offset_audio=off_audio,
    )

    # 6. audio -------------------------------------------------------------
    passo("6/6  Limpando o audio da fonte")
    fonte_audio = publica / "audio-fonte.wav"
    pronto_audio = (
        fonte_audio.exists()
        and fonte_audio.stat().st_size > 0
        and fonte_audio.stat().st_mtime >= fontes[papel_audio].stat().st_mtime
    )
    if pronto_audio:
        ok("audio da fonte ja existe, reaproveitando")
    else:
        tratar.tratar_audio_completo(fontes[papel_audio], fonte_audio, cfg_trat)
        tratar.audio_preview(fonte_audio, publica / "audio-fonte-preview.m4a")
        ondas.gerar(fonte_audio, publica / "picos.json")

    roteiro["audio"] = {
        "arquivo": fonte_audio.name,
        "arquivo_preview": "audio-fonte-preview.m4a",
        "picos": "picos.json",
        # o audio vive no relogio do arquivo bruto; o offset traduz do mestre
        "offset": off_audio,
    }

    salvar_json(caminho_roteiro(nome), roteiro)
    _sincronizar_estudio(nome, roteiro)

    total = sum(c["duracao"] for c in roteiro["cenas"])
    print(f"\n=== PRONTO ===")
    print(f"  Roteiro:  {caminho_roteiro(nome)}")
    print(f"  Duracao:  {total / 60:.1f} min | {len(roteiro['cenas'])} cenas")
    print(f"\n  Ver e ajustar:  python motor/supremo.py estudio {nome}")
    print(f"  Renderizar:     python motor/supremo.py render {nome}")


def _sincronizar_estudio(nome: str, roteiro: dict | None = None) -> None:
    """Coloca o roteiro e o estilo atuais dentro do estudio."""
    if roteiro is None:
        roteiro = ler_json(caminho_roteiro(nome))
    salvar_json(ESTUDIO / "src" / "roteiro-atual.json", roteiro)
    # o estilo DESTE projeto -- ver `carregar_estilo` sobre por que o nome importa
    salvar_json(ESTUDIO / "src" / "estilo-atual.json", carregar_estilo(nome))


def _remotion(*args: str) -> int:
    """
    Chama a CLI do Remotion direto pelo Node.

    Nao usa `npx`: no Windows o npx e um .cmd, e quando o processo leva um
    sinal o cmd trava perguntando "Deseja finalizar o arquivo em lotes (S/N)?".
    Chamando o .js direto, o render nunca fica pendurado num prompt.
    """
    cli = ESTUDIO / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    if not cli.exists():
        raise SystemExit(
            f"Remotion nao encontrado em {cli}\n"
            f"Rode:  cd {ESTUDIO} && npm install"
        )
    node = shutil.which("node") or "node"
    return subprocess.run([node, str(cli), *args], cwd=str(ESTUDIO)).returncode


def cmd_editor(nome: str | None) -> None:
    """
    Abre o editor visual: sobe o servidor de dados e a interface.
    Ctrl+C fecha os dois.
    """
    if nome:
        _sincronizar_estudio(nome)

    node = shutil.which("node") or "node"
    npx = shutil.which("npx") or "npx"

    if not (ESTUDIO / "node_modules").exists():
        raise SystemExit(f"Falta instalar. Rode:  cd {ESTUDIO} && npm install")

    passo("Abrindo o editor do SupremoCut")
    print("   A janela abre sozinha no navegador. Ctrl+C aqui fecha tudo.\n")

    servidor = subprocess.Popen([node, "servidor.mjs"], cwd=str(ESTUDIO))
    try:
        subprocess.run(
            [npx, "vite", "--config", "vite.config.mts"],
            cwd=str(ESTUDIO),
            shell=(os.name == "nt"),
        )
    except KeyboardInterrupt:
        pass
    finally:
        servidor.terminate()
        try:
            servidor.wait(timeout=5)
        except subprocess.TimeoutExpired:
            servidor.kill()
        ok("editor fechado")


def cmd_estudio(nome: str) -> None:
    _sincronizar_estudio(nome)
    passo("Abrindo o Remotion Studio (Ctrl+C pra fechar)")
    _remotion("studio")


def cmd_render(nome: str, formato: str, saida: str | None) -> None:
    _sincronizar_estudio(nome)
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = Path(saida) if saida else SAIDA / f"{nome}-{formato.lower()}.mp4"

    passo(f"Renderizando '{nome}' no formato {formato}")
    if _remotion("render", formato, str(destino.resolve())) != 0:
        raise SystemExit("O render falhou. Veja o erro acima.")
    ok(f"pronto: {destino}")


# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(prog="supremo", description="SupremoCut")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("editar", help="pega tudo de entrada\\ e faz o video inteiro")
    p.add_argument("nome", nargs="?", default=None)
    p.add_argument("--modelo", default=mod_transcrever.MODELO_PADRAO)
    p.add_argument("--idioma", default="pt")
    p.add_argument("--formato", default="Principal", choices=["Principal", "Vertical", "Quadrado"])
    p.add_argument(
        "--cortes",
        default=None,
        help='trechos exatos, ex.: "4:41-5:53, 6:38-9:04". Desliga o corte automatico.',
    )

    sub.add_parser("checar", help="verifica se o ambiente esta ok")

    p = sub.add_parser("audio", help="volume, separar voz da musica, achar silencio")
    p.add_argument(
        "acao",
        choices=["checar", "volume", "separar", "silencio"],
        help="checar = o que esta instalado; volume = normaliza; "
             "separar = tira a voz de cima da musica; silencio = lista as pausas",
    )
    p.add_argument("arquivo", nargs="?", default=None, help="caminho do audio ou video")
    p.add_argument("--saida", default=None)
    p.add_argument("--lufs", type=float, default=-14.0)
    p.add_argument("--limiar", type=float, default=-34.0, help="dB abaixo do qual e silencio")

    p = sub.add_parser("novo", help="cria um projeto")
    p.add_argument("nome")

    p = sub.add_parser("preparar", help="sincroniza, limpa, transcreve e escreve o roteiro")
    p.add_argument("nome")
    p.add_argument("--modelo", default=mod_transcrever.MODELO_PADRAO)
    p.add_argument("--idioma", default="pt")
    p.add_argument("--reusar-transcricao", action="store_true")
    p.add_argument(
        "--cortes",
        default=None,
        help='trechos exatos, ex.: "4:41-5:53, 6:38-9:04". Desliga o corte automatico.',
    )

    p = sub.add_parser("editor", help="abre o EDITOR VISUAL (timeline, layouts, legenda)")
    p.add_argument("nome", nargs="?", default=None)

    p = sub.add_parser("estudio", help="abre o Remotion Studio (preview tecnico)")
    p.add_argument("nome")

    p = sub.add_parser("render", help="renderiza o video final")
    p.add_argument("nome")
    p.add_argument("--formato", default="Principal", choices=["Principal", "Vertical", "Quadrado"])
    p.add_argument("--saida", default=None)

    a = ap.parse_args()

    if a.cmd == "editar":
        cmd_editar(a.nome, a.modelo, a.idioma, a.formato, a.cortes)
    elif a.cmd == "checar":
        cmd_checar()
    elif a.cmd == "novo":
        cmd_novo(a.nome)
    elif a.cmd == "preparar":
        cmd_preparar(a.nome, a.modelo, a.idioma, a.reusar_transcricao, a.cortes)
    elif a.cmd == "editor":
        cmd_editor(a.nome)
    elif a.cmd == "estudio":
        cmd_estudio(a.nome)
    elif a.cmd == "render":
        cmd_render(a.nome, a.formato, a.saida)
    elif a.cmd == "audio":
        cmd_audio(a.acao, a.arquivo, a.saida, a.lufs, a.limiar)


if __name__ == "__main__":
    main()
