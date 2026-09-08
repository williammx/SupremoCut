"""
SupremoCut - Tratamento do material bruto.

Faz duas coisas:
  1) prepara os videos: cor, um proxy de qualidade pro render e um proxy leve
     pro editor nao engasgar
  2) limpa o audio da fonte INTEIRA, sem cortar nada

Nada aqui e pre-cortado, e isso e proposital. Quem decide os cortes e o
roteiro, lido em tempo de render — cada bloco busca seu pedaco dentro da fonte,
video e audio com a mesma conta. Assim uma edicao no editor move os dois
juntos, em vez de deixar o audio congelado no montado de ontem.
"""

from __future__ import annotations

from pathlib import Path

from comum import CONFIG, ler_json, ok, passo, rodar, sondar


def _cadeia_audio(cfg: dict) -> str:
    a = cfg["audio"]
    preset = a.get("preset", "voz_limpa")
    modelo = a["presets"].get(preset, a["presets"]["voz_limpa"])
    return modelo.format(
        corte_grave_hz=a.get("corte_grave_hz", 75),
        reducao_ruido_db=a.get("reducao_ruido_db", 12),
        alvo_loudness_lufs=a.get("alvo_loudness_lufs", -14),
        pico_maximo_db=a.get("pico_maximo_db", -1.5),
    )


def _encaixar(w: int, h: int, alvo_w: int, alvo_h: int, filtro: str = "lanczos") -> str:
    """
    Monta a cadeia FFmpeg que leva w x h ate alvo_w x alvo_h SEM distorcer.

    Se a proporcao ja bate, e so esticar. Se nao bate, corta o excedente pelo
    CENTRO antes de esticar - o alternativo seria espremer a imagem ou colocar
    barra preta, e os dois denunciam a montagem num anuncio.
    """
    if w <= 0 or h <= 0:
        return f"scale={alvo_w}:{alvo_h}:flags={filtro}"

    prop_atual = w / h
    prop_alvo = alvo_w / alvo_h

    if abs(prop_atual - prop_alvo) < 0.002:
        return f"scale={alvo_w}:{alvo_h}:flags={filtro}"

    if prop_atual > prop_alvo:
        # largo demais: corta nas laterais
        corte_w = int(round(h * prop_alvo / 2)) * 2
        recorte = f"crop={min(corte_w, w)}:{h}"
    else:
        # alto demais: corta em cima e embaixo
        corte_h = int(round(w / prop_alvo / 2)) * 2
        recorte = f"crop={w}:{min(corte_h, h)}"

    return f"{recorte},scale={alvo_w}:{alvo_h}:flags={filtro}"


def _cadeia_cor(cfg: dict, papel: str) -> str:
    bloco = cfg["cor"].get(papel)
    if not bloco:
        return "null"
    preset = bloco.get("preset", "cru")
    return bloco["presets"].get(preset, "null")


def carregar_config() -> dict:
    bruto = ler_json(CONFIG / "tratamento.json")

    def limpar(o):
        if isinstance(o, dict):
            return {k: limpar(v) for k, v in o.items() if not k.startswith("_")}
        if isinstance(o, list):
            return [limpar(x) for x in o]
        return o

    return limpar(bruto)


# --------------------------------------------------------------------------
# Video
# --------------------------------------------------------------------------

def preparar_video(entrada: Path, saida: Path, papel: str, cfg: dict) -> Path:
    """Aplica cor e gera um proxy com keyframes densos (render muito mais rapido)."""
    saida.parent.mkdir(parents=True, exist_ok=True)
    info = sondar(entrada)
    px = cfg["proxy"]

    fps = info.fps or 30
    intervalo_kf = max(1, int(round(fps * px.get("keyframe_por_segundo", 1))))

    filtros = [_cadeia_cor(cfg, papel)]

    amp = cfg.get("ampliar", {})
    alvo_w, alvo_h = amp.get("largura"), amp.get("altura")

    if alvo_w and alvo_h:
        # Ampliacao com proporcao forcada: corta o excedente pelo centro antes
        # de esticar. Dois dos anuncios nao sao 9:16 exatos (360x626, 356x636)
        # e sem isto sairiam esticados ou com barra preta.
        filtros.insert(0, _encaixar(info.largura, info.altura, alvo_w, alvo_h,
                                    amp.get("filtro", "lanczos")))
    else:
        alt_max = px.get("escala_maxima_altura", 1080)
        if info.altura > alt_max:
            filtros.insert(0, f"scale=-2:{alt_max}:flags=lanczos")

    cadeia = ",".join([f for f in filtros if f and f != "null"]) or "null"

    if px.get("usar_gpu", True):
        codec = [
            "-c:v", "h264_nvenc",
            "-preset", "p5",
            "-rc", "vbr",
            "-cq", str(px.get("qualidade", 20)),
            "-b:v", "0",
        ]
    else:
        codec = ["-c:v", "libx264", "-preset", "medium", "-crf", str(px.get("qualidade", 20))]

    cmd = [
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(entrada),
        "-vf", cadeia,
        *codec,
        "-g", str(intervalo_kf),
        "-keyint_min", str(intervalo_kf),
        "-sc_threshold", "0",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(saida),
    ]

    try:
        rodar(cmd)
    except RuntimeError:
        # se a NVENC engasgar (driver, sessao ocupada), cai pra CPU
        cmd_cpu = [c for c in cmd]
        i = cmd_cpu.index("-c:v")
        cmd_cpu[i : i + 10] = [
            "-c:v", "libx264", "-preset", "veryfast",
            "-crf", str(px.get("qualidade", 20)),
        ]
        rodar(cmd_cpu)

    ok(f"{papel}: video preparado -> {saida.name}")
    return saida


def preparar_preview(entrada: Path, saida: Path, papel: str, cfg: dict) -> Path:
    """
    Gera o arquivo LEVE que o editor usa no preview.

    O proxy de qualidade e otimo pro render e pessimo pro navegador: um arquivo
    de 1,7 GB faz o player engasgar e voltar. Aqui a ideia e o oposto - imagem
    pequena, bitrate baixo e keyframe a cada meio segundo, pra buscar instantaneo.
    """
    saida.parent.mkdir(parents=True, exist_ok=True)
    px = cfg.get("preview", {})
    altura = px.get("altura", 540)
    fps_alvo = px.get("fps", 24)
    intervalo_kf = max(1, int(round(fps_alvo * px.get("keyframe_por_segundo", 0.5))))

    filtros = [f"scale=-2:{altura}:flags=fast_bilinear", _cadeia_cor(cfg, papel)]
    cadeia = ",".join([f for f in filtros if f and f != "null"])

    if px.get("usar_gpu", True):
        codec = ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "vbr",
                 "-cq", str(px.get("qualidade", 30)), "-b:v", "0"]
    else:
        codec = ["-c:v", "libx264", "-preset", "ultrafast",
                 "-crf", str(px.get("qualidade", 30))]

    cmd = [
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(entrada),
        "-vf", cadeia,
        "-r", str(fps_alvo),
        *codec,
        "-g", str(intervalo_kf),
        "-keyint_min", str(intervalo_kf),
        "-sc_threshold", "0",
        "-pix_fmt", "yuv420p",
        "-profile:v", "baseline",
        "-movflags", "+faststart",
        "-an",
        str(saida),
    ]

    try:
        rodar(cmd)
    except RuntimeError:
        cmd_cpu = list(cmd)
        i = cmd_cpu.index("-c:v")
        cmd_cpu[i : i + 10] = ["-c:v", "libx264", "-preset", "ultrafast",
                               "-crf", str(px.get("qualidade", 30))]
        rodar(cmd_cpu)

    mb = saida.stat().st_size / (1024 * 1024)
    ok(f"{papel}: preview leve -> {saida.name} ({mb:.0f} MB)")
    return saida


# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------

def tratar_audio_completo(entrada: Path, saida: Path, cfg: dict) -> Path:
    """
    Limpa o audio da fonte INTEIRA, sem cortar nada.

    Antes eu cortava e colava aqui, gerando um audio unico ja montado. O
    problema: aquilo congelava os cortes daquele momento. Se voce mexesse na
    timeline depois, o video acompanhava (porque cada bloco busca dentro do
    bruto) e o audio nao, porque ja estava pronto.

    Agora o audio fica inteiro e cada bloco busca o pedaco dele, igualzinho ao
    video. Um corte no editor move os dois juntos, sempre.
    """
    saida.parent.mkdir(parents=True, exist_ok=True)
    cadeia = _cadeia_audio(cfg)

    rodar([
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(entrada),
        "-vn", "-af", cadeia,
        "-ar", "48000", "-ac", "2",
        str(saida),
    ])

    mb = saida.stat().st_size / (1024 * 1024)
    ok(f"audio da fonte tratado -> {saida.name} ({mb:.0f} MB)")
    return saida


def audio_preview(entrada: Path, saida: Path) -> Path:
    """
    Versao comprimida do audio, so pro editor.

    O WAV do render passa de 140 MB numa hora de video. O navegador nao
    acompanha um arquivo desses tocando, atrasa, e o player rebobina pra
    corrigir - o que faz a ultima palavra se repetir. Em AAC isso cai
    pra uns 12 MB e o problema some.
    """
    saida.parent.mkdir(parents=True, exist_ok=True)
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(entrada),
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        str(saida),
    ])
    mb = saida.stat().st_size / (1024 * 1024)
    ok(f"audio de preview -> {saida.name} ({mb:.0f} MB)")
    return saida
