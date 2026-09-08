"""
SupremoCut - utilidades compartilhadas.

Cuida de: caminhos do projeto, chamadas ao FFmpeg, leitura de metadados
e ativacao das DLLs CUDA (pra o Whisper rodar na GPU no Windows).
"""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

# --------------------------------------------------------------------------
# Caminhos
# --------------------------------------------------------------------------

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "entrada"
PROJETOS = RAIZ / "projetos"
TRABALHO = RAIZ / "trabalho"
SAIDA = RAIZ / "saida"
CONFIG = RAIZ / "config"
ESTUDIO = RAIZ / "estudio"
PUBLIC = ESTUDIO / "public"


def pasta_projeto(nome: str) -> Path:
    return PROJETOS / nome


def pasta_bruto(nome: str) -> Path:
    return pasta_projeto(nome) / "bruto"


def pasta_publica(nome: str) -> Path:
    """Onde o Remotion enxerga as midias."""
    return PUBLIC / nome


def caminho_roteiro(nome: str) -> Path:
    return pasta_projeto(nome) / "roteiro.json"


# --------------------------------------------------------------------------
# CUDA (Windows): as DLLs vem via pip, precisam ser registradas na mao
# --------------------------------------------------------------------------

_CUDA_PRONTA = False


def ativar_cuda() -> int:
    """
    No Windows as DLLs de CUDA vem via pip e ninguem as registra sozinho.
    O ctranslate2 carrega cublas/cudnn por conta propria, entao nao basta
    o add_dll_directory: e preciso colocar no PATH e pre-carregar na mao.
    Devolve quantas DLLs foram carregadas.
    """
    global _CUDA_PRONTA
    if os.name != "nt" or _CUDA_PRONTA:
        return 0

    base = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
    dirs = [d for d in glob.glob(str(base / "*" / "bin")) if os.path.isdir(d)]
    if not dirs:
        return 0

    # ------------------------------------------------------------------
    # O torch precisa carregar ANTES daqui. Nao e preciosismo de ordem.
    #
    # O torch traz as proprias DLLs de CUDA, na versao com que foi compilado
    # (cu121). Os pacotes nvidia-* que o ctranslate2 usa estao numa versao
    # mais nova (CUDA 12.9 / cuDNN 9.24). Assim que estes entram no PATH, o
    # torch passa a achar os DLLs errados e morre com:
    #
    #   OSError [WinError 127] ... cudnn_cnn64_9.dll or one of its dependencies
    #
    # E o `import ctranslate2` importa torch quando ele esta instalado — ou
    # seja, instalar o Demucs (que traz torch) quebrava a transcricao inteira,
    # que e a peca mais usada do sistema.
    #
    # Carregando o torch primeiro, ele resolve e prende os DLLs dele; depois
    # disso mexer no PATH nao o afeta mais. Cada um fica com o seu.
    # ------------------------------------------------------------------
    try:
        import torch  # noqa: F401
    except Exception:
        # Sem torch instalado nao ha conflito nenhum — segue o baile.
        pass

    for d in dirs:
        try:
            os.add_dll_directory(d)
        except OSError:
            pass

    # o PATH e consultado pela busca padrao de DLL do Windows
    os.environ["PATH"] = os.pathsep.join(dirs) + os.pathsep + os.environ.get("PATH", "")
    os.environ.setdefault("CUDA_PATH", str(base))

    # pre-carrega na ordem certa de dependencia
    import ctypes

    ordem = [
        "cublasLt64_*.dll",
        "cublas64_*.dll",
        "cudnn_graph64_*.dll",
        "cudnn_engines_precompiled64_*.dll",
        "cudnn_engines_runtime_compiled64_*.dll",
        "cudnn_heuristic64_*.dll",
        "cudnn_ops64_*.dll",
        "cudnn_adv64_*.dll",
        "cudnn_cnn64_*.dll",
        "cudnn64_*.dll",
        "nvrtc64_*.dll",
    ]
    n = 0
    for padrao in ordem:
        for d in dirs:
            for dll in sorted(glob.glob(os.path.join(d, padrao))):
                try:
                    ctypes.WinDLL(dll)
                    n += 1
                except OSError:
                    pass

    _CUDA_PRONTA = True
    return n


def tem_gpu() -> bool:
    try:
        ativar_cuda()
        import ctranslate2

        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


# --------------------------------------------------------------------------
# FFmpeg
# --------------------------------------------------------------------------

def rodar(cmd: list[str], silencioso: bool = True) -> str:
    """Executa um comando e devolve stdout. Levanta erro legivel se falhar."""
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        cauda = (r.stderr or "")[-2500:]
        raise RuntimeError(f"Falhou: {' '.join(cmd[:3])}...\n{cauda}")
    if not silencioso and r.stderr:
        print(r.stderr[-1500:])
    return r.stdout


@dataclass
class Midia:
    caminho: str
    duracao: float
    largura: int
    altura: int
    fps: float
    tem_audio: bool
    tem_video: bool

    def dict(self) -> dict:
        return asdict(self)


def sondar(caminho: str | Path) -> Midia:
    """Le os metadados de um arquivo de midia."""
    caminho = str(caminho)
    saida = rodar(
        [
            "ffprobe", "-v", "error",
            "-print_format", "json",
            "-show_format", "-show_streams",
            caminho,
        ]
    )
    d = json.loads(saida)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in d["streams"] if s["codec_type"] == "audio"), None)

    fps = 30.0
    if v and v.get("r_frame_rate"):
        try:
            num, den = v["r_frame_rate"].split("/")
            if float(den) != 0:
                fps = float(num) / float(den)
        except Exception:
            pass

    dur = float(d.get("format", {}).get("duration", 0) or 0)

    return Midia(
        caminho=caminho,
        duracao=dur,
        largura=int(v["width"]) if v else 0,
        altura=int(v["height"]) if v else 0,
        fps=round(fps, 3),
        tem_audio=a is not None,
        tem_video=v is not None,
    )


def extrair_audio_wav(entrada: str | Path, saida: str | Path, taxa: int = 16000) -> Path:
    """Extrai audio mono num WAV (usado pra sync e transcricao)."""
    saida = Path(saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(entrada),
        "-vn", "-ac", "1", "-ar", str(taxa),
        "-c:a", "pcm_s16le",
        str(saida),
    ])
    return saida


# --------------------------------------------------------------------------
# JSON
# --------------------------------------------------------------------------

def ler_json(caminho: str | Path) -> dict:
    with open(caminho, "r", encoding="utf-8") as f:
        return json.load(f)


def salvar_json(caminho: str | Path, dados: dict) -> None:
    """
    Grava de forma atomica: escreve num temporario e so entao substitui.

    Antes usava open(...,"w") direto. Se o processo morresse no meio da escrita,
    ou se o servidor do editor gravasse o mesmo arquivo ao mesmo tempo, o
    roteiro ficava truncado - e roteiro truncado e trabalho perdido.
    """
    import os
    import tempfile

    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp = tempfile.mkstemp(
        dir=str(caminho.parent), prefix=f".{caminho.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, caminho)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def carregar_estilo(projeto: str | None = None) -> dict:
    """
    Le o estilo, ignorando as chaves de comentario (_leia_me, _dica).

    O ESTILO E DO PROJETO

    Com `projeto`, le `projetos/<nome>/estilo.json` e so cai no global se aquele
    projeto ainda nao tiver o seu. Sem `projeto`, le o global.

    Isto existia so no servidor do editor, e o motor continuava lendo o global
    sempre. O resultado foi o pior tipo de divergencia que este programa produz:
    o editor mostrava o Reels da Super San em Tusker Grotesk, e o MP4 entregue
    saia em Montserrat, com o titulo quebrando em duas linhas por cima do
    subtitulo. Ninguem viu erro nenhum -- o render terminou dizendo "pronto".
    """
    do_projeto = PROJETOS / projeto / "estilo.json" if projeto else None
    caminho = do_projeto if do_projeto and do_projeto.exists() else CONFIG / "estilo.json"
    bruto = ler_json(caminho)

    def limpar(o):
        if isinstance(o, dict):
            return {k: limpar(v) for k, v in o.items() if not k.startswith("_")}
        if isinstance(o, list):
            return [limpar(x) for x in o]
        return o

    return limpar(bruto)


# --------------------------------------------------------------------------
# Console
# --------------------------------------------------------------------------

def passo(texto: str) -> None:
    print(f"\n>> {texto}", flush=True)


def ok(texto: str) -> None:
    print(f"   [ok] {texto}", flush=True)


def aviso(texto: str) -> None:
    print(f"   [!]  {texto}", flush=True)
