"""
SupremoCut - narracao continua.

O QUE MUDOU, E POR QUE

A primeira dublagem amarrava cada frase em portugues na janela da frase
correspondente em ingles. Parecia certo — respeita o tempo do original, cada
fala cai onde a outra caia — mas o resultado ficou picado: doze pedacinhos de
locucao separados por silencio, sem nenhuma frase levando naturalmente a
proxima. Soa como legenda lida em voz alta, nao como anuncio.

Aqui e o contrario. A narracao e UM texto corrido, escrito pra ser dito de
uma vez, e a unica amarra e a duracao do video. A locutora respira onde faz
sentido pro portugues, e nao onde o locutor em ingles respirava.

TRES COISAS QUE ISSO EXIGE

1. Uma sintese so por anuncio. Emendar pedacos gera junta audivel; e o modelo
   da ElevenLabs le melhor um paragrafo inteiro do que dez frases soltas,
   porque enxerga a entonacao da frase seguinte.

2. Alvo de ~92% da duracao, nao 100%. A locucao precisa de ar no comeco e no
   fim; encher os 100% deixa o anuncio sem respiro e a ultima palavra colada
   no corte.

3. Encaixe com folga maior. Como e um bloco longo, 5% de aceleracao passa
   despercebido — muito mais do que os 12% que uma frase curta aguentava.

Rodar:  python narracao.py                (todos)
        python narracao.py --so "Digg It"
        python narracao.py --conferir      (so mede, nao sintetiza)
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from comum import RAIZ, aviso, ok, passo, rodar, salvar_json, sondar
import voz as tts

FICHAS = RAIZ / "projetos" / "_dublagem"
TRABALHO = RAIZ / "trabalho" / "narracao"

# Segundos de imagem sem voz que um anuncio aguenta no fim antes de parecer
# que travou. Abaixo disto o audio gravado passa intocado; acima, o motor
# estica de leve pra fechar o vao. Ver `narrar_de_arquivo`.
FOLGA_MAXIMA = 4.0

# Quanto da duracao do video a fala deve ocupar. O resto e ar.
OCUPACAO = 0.92
# Caracteres por segundo que a voz entrega (medido no proprio material).
TAXA = 14.0
# Num bloco longo, isto passa despercebido. Numa frase curta, nao passaria.
ACELERACAO_MAXIMA = 1.06
# Onde a fala comeca. Nao em zero: um respiro inicial deixa o gancho visual
# aparecer antes da voz entrar.
ATRASO = 0.35


def alvo_caracteres(duracao: float) -> int:
    return int(duracao * OCUPACAO * TAXA)


def encaixar_bloco(
    entrada: Path, saida: Path, alvo_seg: float, alongar: bool = True
) -> dict:
    """
    Ajusta o bloco inteiro pra caber em `alvo_seg`.

    Diferente do encaixe por fala: aqui tambem ALONGA quando a narracao saiu
    curta demais. Numa fala isolada, esticar deixava a palavra arrastada; num
    bloco de trinta segundos, 4% mais lento e imperceptivel e evita que sobre
    silencio no fim do anuncio.

    QUANDO NAO ALONGAR

    Isso vale pra voz que o motor mesmo sintetizou: se saiu curta, e porque eu
    escrevi pouco, e esticar corrige o meu erro sem ninguem ouvir.

    Com audio gravado por fora e o contrario. O locutor entregou um ritmo, e
    esse ritmo E a escolha dele. Arrastar a fala 6% pra tapar um buraco no fim
    troca uma coisa que ninguem nota — dois segundos de imagem rodando depois
    da ultima palavra, que todo anuncio tem — por uma que se ouve na hora: a
    voz puxada, fora do compasso de quem falou.

    Entao `alongar=False` deixa passar. Encurtar continua valendo nos dois
    casos: fala que estoura o fim do video nao e opcao.
    """
    bruto = sondar(entrada).duracao
    if bruto <= 0:
        raise RuntimeError(f"audio vazio: {entrada}")

    aparado = entrada.with_name(f"{entrada.stem}_aparado.wav")
    tts.aparar_silencio(entrada, aparado)
    falado = sondar(aparado).duracao
    if falado <= 0.02:
        aparado, falado = entrada, bruto

    fator = falado / alvo_seg if alvo_seg > 0 else 1.0
    piso = 1 / ACELERACAO_MAXIMA if alongar else 1.0
    aplicado = min(max(fator, piso), ACELERACAO_MAXIMA)

    filtro = f"atempo={aplicado:.4f}" if abs(aplicado - 1) > 0.002 else "anull"
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(aparado),
        "-af", filtro,
        "-ar", "48000", "-ac", "1",
        str(saida),
    ])

    final = sondar(saida).duracao
    return {
        "falado": round(falado, 2),
        "alvo": round(alvo_seg, 2),
        "fator": round(aplicado, 3),
        "final": round(final, 2),
        "sobra": round(final - alvo_seg, 2),
    }


def montar_trilha(fala: Path, duracao_video: float, saida: Path, atraso: float = ATRASO) -> Path:
    """
    Poe a fala sobre uma base de silencio do tamanho do video.

    A base existe pra trilha ter exatamente a duracao do video, mesmo que a
    fala termine antes. Sem ela, o audio acabaria no meio e o player teria que
    adivinhar o resto.
    """
    ms = int(round(atraso * 1000))
    rodar([
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-t", f"{duracao_video}", "-i", "anullsrc=r=48000:cl=mono",
        "-i", str(fala),
        "-filter_complex",
        f"[1:a]adelay={ms}|{ms}[v];[0:a][v]amix=inputs=2:duration=first:normalize=0[m];"
        "[m]loudnorm=I=-14:TP=-1.5:LRA=11[saida]",
        "-map", "[saida]",
        "-ar", "48000", "-ac", "2",
        str(saida),
    ])
    return saida


def publicar_trilha(nome: str, trilha: Path) -> Path:
    """
    Copia a trilha recem-feita pro caminho que o entregador le.

    POR QUE ISTO EXISTE

    Cada versao guarda a sua trilha numa pasta propria — por voz, ou `recebido`
    pro audio que o Campelo grava. Isso e proposital: e o que impede uma versao
    de cair por cima da outra, como ja aconteceu.

    Mas o `entregar_continuo.py` precisa saber qual e a trilha ATUAL de um
    anuncio, e ele nao tem como adivinhar de qual pasta. Entao existe um
    caminho canonico, `trabalho/narracao/<anuncio>/trilha.wav`, que aponta
    sempre pra ultima trilha gerada. O arquivo com voz continua guardado; este
    e so a copia que diz "e esta aqui que vai pro video".

    Sem isto o render usava silenciosamente uma trilha velha que sobrou de
    antes das pastas por voz — e o video saia com a narracao errada sem
    nenhum erro aparecer.
    """
    destino = TRABALHO / nome / "trilha.wav"
    destino.parent.mkdir(parents=True, exist_ok=True)
    if trilha.resolve() != destino.resolve():
        shutil.copy2(trilha, destino)
    return destino


def narrar_de_arquivo(nome: str, audio: Path, margem_fim: float = 0.4) -> dict | None:
    """
    Usa um áudio JÁ GRAVADO no lugar de sintetizar.

    POR QUE ISTO EXISTE

    A escolha da voz é do Campelo, não do motor — e a conta de TTS disponível
    aqui não dá acesso às vozes brasileiras. Então o fluxo virou: eu escrevo o
    texto, ele gera o áudio na conta dele com a voz que quiser, manda o
    arquivo, e o motor faz o resto. Funciona igual com voz sintetizada, com
    locutor humano, ou com ele mesmo gravando no celular.

    A DIFERENÇA PRO CAMINHO DE TTS

    Quando o texto é meu, eu escrevo pro tempo — miro 92% do vídeo e sobra ar.
    Quando o áudio vem pronto, ele é o que é: a única pergunta é caber. Então
    o alvo aqui é o VÍDEO INTEIRO menos uma margem curta no fim, e não uma
    fração escolhida.

    `margem_fim` são os segundos de imagem que ficam depois da última palavra.
    Zero deixa a fala colada no corte; meio segundo dá o respiro que um
    anúncio precisa pra não parecer que acabou a energia.
    """
    ficha = dados_do_anuncio(nome)
    if not ficha:
        aviso(f"não sei de onde vem o vídeo de: {nome}")
        return None
    if not audio.exists():
        aviso(f"áudio não encontrado: {audio}")
        return None

    origem = Path(ficha["origem"])
    dur = sondar(origem).duracao
    alvo = max(1.0, dur - margem_fim)

    tmp = TRABALHO / "recebido" / nome
    tmp.mkdir(parents=True, exist_ok=True)

    passo(f"{nome} — áudio recebido")

    pronto = tmp / "narracao.wav"

    # Primeiro tenta no ritmo exato de quem gravou.
    r = encaixar_bloco(audio, pronto, alvo, alongar=False)

    # Se sobrar imagem demais rodando calada no fim, aí sim vale esticar.
    #
    # A regra de nao alongar existe pra proteger o ritmo do locutor de uma
    # correcao que ninguem pediu. Ela vale enquanto o preco de nao corrigir e
    # pequeno: dois segundos de plano final sem voz e como todo anuncio acaba.
    #
    # Oito segundos nao e mais isso — e um buraco, e quem assiste acha que o
    # video travou. Aí a conta inverte: 5% mais lento num bloco de um minuto e
    # e inaudivel, e o buraco some. Entao o limite nao e "nunca esticar", e
    # "nunca esticar POR POUCO".
    folga = dur - r["final"]
    if folga > FOLGA_MAXIMA:
        r = encaixar_bloco(audio, pronto, dur - FOLGA_MAXIMA, alongar=True)
        print(
            f"       sobravam {folga:.1f}s de imagem calada no fim — "
            f"estiquei {r['fator']:.3f}x pra fechar o buraco"
        )

    sobra_video = dur - r["final"]
    print(
        f"       recebido {r['falado']:.2f}s -> {r['final']:.2f}s (x{r['fator']:.3f}) "
        f"| vídeo {dur:.2f}s, sobram {sobra_video:.2f}s de imagem no fim"
    )

    if r["fator"] > 1.10:
        aviso(
            f"{nome}: precisei acelerar {r['fator']:.2f}x pra caber — acima de 1,10 "
            f"a fala começa a soar apressada. Vale regravar mais curto."
        )
    elif r["fator"] < 0.94:
        aviso(
            f"{nome}: o áudio ficou curto e precisei alongar {r['fator']:.2f}x. "
            f"Cabem mais ~{int((alvo - r['falado']) * 14)} caracteres de texto."
        )

    trilha = tmp / "trilha.wav"
    if ficha.get("manter_fundo"):
        import audio as mod_audio

        fundo = tmp / "fundo.wav"
        rodar([
            "ffmpeg", "-y", "-v", "error", "-i", str(origem), "-vn",
            "-ar", "48000", "-ac", "2", str(fundo),
        ])
        esticada = tmp / "narracao_pad.wav"
        rodar([
            "ffmpeg", "-y", "-v", "error", "-i", str(pronto),
            "-af", f"apad=whole_dur={dur}", "-ar", "48000", "-ac", "2", str(esticada),
        ])
        mod_audio.dublagem_com_fundo(fundo, esticada, trilha, volume_fundo=0.8, abaixar=0.35)
    else:
        # começa em zero: quem gravou já pôs a respiração que quis no arquivo
        montar_trilha(pronto, dur, trilha, atraso=0.0)

    publicar_trilha(nome, trilha)
    ok(f"trilha pronta — {trilha.name}")
    return {"nome": nome, "trilha": trilha, "origem": origem, "duracao": dur, **r}


def dados_do_anuncio(nome: str) -> dict | None:
    """
    De onde vem o vídeo e qual voz usar.

    A ficha de dublagem é a fonte normal. O `Othor shopping` não tem ficha —
    ele nunca teve locução pra dublar — então cai na tabela `SEM_FICHA`. Os
    dois caminhos devolvem a mesma coisa, e o resto do motor não precisa saber
    de qual vieram.
    """
    from comum import ler_json
    from copy_continua import SEM_FICHA, VOZ_PADRAO

    ficha_path = FICHAS / f"{nome}.json"
    if ficha_path.exists():
        d = ler_json(ficha_path)
    elif nome in SEM_FICHA:
        d = dict(SEM_FICHA[nome])
    else:
        return None

    # A voz da narracao continua manda sobre a que ficou gravada na ficha.
    # A ficha guarda a voz da PRIMEIRA dublagem, e quem escolhe a voz do
    # conjunto e o `copy_continua.py` — um lugar so, pros doze.
    d["voz"] = VOZ_PADRAO
    return d


def narrar(nome: str, texto: str, conferir: bool = False) -> dict | None:
    """Sintetiza a narracao inteira de um anuncio e monta a trilha."""
    ficha = dados_do_anuncio(nome)
    if not ficha:
        aviso(f"não sei de onde vem o vídeo de: {nome}")
        return None

    origem = Path(ficha["origem"])
    if not origem.exists():
        aviso(f"video sumiu: {origem}")
        return None

    dur = sondar(origem).duracao
    alvo = dur * OCUPACAO - ATRASO
    ideal = alvo_caracteres(dur)
    n = len(texto)
    densidade = n / alvo if alvo > 0 else 0

    marca = "ok"
    if densidade > 15.5:
        marca = "LONGO"
    elif densidade < 12.0:
        marca = "curto"

    print(
        f"  {nome:<18} video {dur:>5.1f}s  alvo {ideal:>4} car  "
        f"tem {n:>4}  {densidade:>4.1f} car/s  {marca}"
    )

    if conferir:
        return {"nome": nome, "duracao": dur, "caracteres": n, "densidade": densidade}

    # Uma pasta por VOZ. Sem isso, gerar o mesmo anúncio com outra voz gravava
    # por cima do áudio anterior — e a versão antiga só existia ali. Com a voz
    # no caminho, as duas convivem e dá pra voltar atrás.
    tmp = TRABALHO / ficha["voz"][:8] / nome
    tmp.mkdir(parents=True, exist_ok=True)
    cru = tmp / "narracao_cru.mp3"
    marcador = tmp / "narracao.txt"

    # Reaproveita o audio quando nada mudou — credito e caro e o plano e
    # limitado. A assinatura inclui a VOZ, e nao so o texto: trocamos a Bia
    # pela Amandinha com os textos iguais, e comparando so o texto o motor
    # devolveria alegremente o audio da voz antiga.
    assinatura = f"{ficha['voz']}\n{ficha.get('modelo', tts.MODELO_PADRAO)}\n{texto}"
    anterior = marcador.read_text(encoding="utf-8") if marcador.exists() else None

    if anterior != assinatura or not cru.exists() or cru.stat().st_size == 0:
        tts.falar(texto, ficha["voz"], cru, ficha.get("modelo", tts.MODELO_PADRAO))
        marcador.write_text(assinatura, encoding="utf-8")
    else:
        print("       (audio reaproveitado — texto e voz nao mudaram)")

    pronto = tmp / "narracao.wav"
    r = encaixar_bloco(cru, pronto, alvo)

    # O que importa de verdade nao e bater o alvo, e nao PASSAR DO VIDEO. O
    # alvo tem folga embutida; o video nao tem nenhuma — fala que termina
    # depois do ultimo quadro simplesmente some, e o anuncio acaba no meio de
    # uma frase.
    fim_da_fala = ATRASO + r["final"]
    estoura = fim_da_fala - dur

    print(
        f"       falado {r['falado']:.1f}s -> {r['final']:.1f}s "
        f"(x{r['fator']:.3f}) | fala acaba em {fim_da_fala:.1f}s de {dur:.1f}s"
    )
    if estoura > 0:
        # quantos caracteres sobram, pra correcao ser objetiva e nao chute
        cortar = int(estoura * TAXA / r["fator"]) + 6
        aviso(
            f"{nome}: a fala passa {estoura:.2f}s do fim do video mesmo no limite "
            f"de aceleracao. Corte ~{cortar} caracteres do texto."
        )
    elif estoura < -3.0:
        aviso(
            f"{nome}: sobram {-estoura:.1f}s de video sem fala no fim. "
            f"Cabem ~{int(-estoura * TAXA)} caracteres a mais."
        )

    trilha = tmp / "trilha.wav"
    if ficha.get("manter_fundo"):
        # a música original fica e abaixa sozinha por baixo da narração
        import audio as mod_audio

        fundo = tmp / "fundo.wav"
        rodar([
            "ffmpeg", "-y", "-v", "error",
            "-i", str(origem), "-vn",
            "-ar", "48000", "-ac", "2",
            str(fundo),
        ])
        atrasada = tmp / "narracao_atrasada.wav"
        ms = int(round(ATRASO * 1000))
        rodar([
            "ffmpeg", "-y", "-v", "error",
            "-i", str(pronto),
            "-af", f"adelay={ms}|{ms},apad=whole_dur={dur}",
            "-ar", "48000", "-ac", "2",
            str(atrasada),
        ])
        mod_audio.dublagem_com_fundo(fundo, atrasada, trilha, volume_fundo=0.8, abaixar=0.35)
    else:
        montar_trilha(pronto, dur, trilha)

    return {
        "nome": nome,
        "trilha": trilha,
        "origem": origem,
        "duracao": dur,
        "projeto": ficha.get("projeto"),
        **r,
    }


def main() -> None:
    from copy_continua import NARRACAO

    ap = argparse.ArgumentParser(prog="narracao")
    ap.add_argument("--so", default=None)
    ap.add_argument("--conferir", action="store_true")
    ap.add_argument(
        "--audio",
        default=None,
        help="usa um áudio já gravado em vez de sintetizar (exige --so)",
    )
    a = ap.parse_args()

    if a.audio:
        if not a.so:
            raise SystemExit("--audio precisa de --so pra saber de qual anúncio é")
        passo("áudio recebido")
        r = narrar_de_arquivo(a.so, Path(a.audio))
        print()
        ok("pronto" if r else "falhou")
        return

    alvos = [a.so] if a.so else list(NARRACAO.keys())
    passo(f"narracao continua — {len(alvos)} anuncios")

    feitos = []
    for nome in alvos:
        texto = NARRACAO.get(nome)
        if not texto:
            aviso(f"sem texto pra {nome}")
            continue
        r = narrar(nome, texto.strip(), a.conferir)
        if r:
            feitos.append(r)

    print()
    ok(f"{len(feitos)} de {len(alvos)}")


if __name__ == "__main__":
    main()
