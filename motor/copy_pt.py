"""
SupremoCut - a copy em portugues dos anuncios.

NAO E TRADUCAO. E o texto que um anuncio brasileiro diria, escrito pra caber
no tempo da fala original. A diferenca importa: traduzido ao pe da letra, o
portugues estoura a janela e a voz sai correndo, denunciando a dublagem. Escrito
como anuncio, ele CABE e ainda soa melhor que o original.

A DENSIDADE CERTA: ~14 CARACTERES POR SEGUNDO

A primeira versao chutou 11 a 13, e o chute custou caro. O `medir_ritmo.py`
comparou o tempo de VOZ do original com o do portugues e mostrou o estrago: no
Lilyrhyme, 41 segundos de ingles falado viraram 30 em portugues — um quarto do
anuncio virando silencio que o original nao tinha. A narracao parecia atrasada
em relacao a imagem.

Medindo o audio que a voz da Bia realmente entrega, ela fala a uns 14
caracteres por segundo. Esse e o alvo. O teto e 15,5, porque o encaixe acelera
ate 1,12x — acima disso a frase sai apressada e a dublagem se denuncia.

Confira antes de sintetizar:  python alvo_copy.py

Rodar:  python copy_pt.py            (escreve a copy nas fichas)
        python copy_pt.py --conferir (so mostra a densidade, sem gravar)
"""

from __future__ import annotations

import argparse
from pathlib import Path

from comum import RAIZ, ler_json, ok, aviso, salvar_json, passo

FICHAS = RAIZ / "projetos" / "_dublagem"

# ---------------------------------------------------------------------------
# A copy, na ordem das falas de cada ficha
# ---------------------------------------------------------------------------

COPY: dict[str, list[str]] = {
    # -----------------------------------------------------------------------
    # Origyn e Homefaves uk sao o mesmo roteiro e as mesmas janelas.
    "Origyn": [
        "Larga o cotonete. Sério.",
        "Ele só empurra a cera pra dentro — e machuca o ouvido.",
        "Esse limpador de gel resolve o problema.",
        "É macio, é simples de usar, e ele puxa",
        "tudo que você não alcança.",
        "Sem sujeira, sem dor. Ouvido limpo de verdade.",
        "Cuida da higiene? Precisa desse.",
    ],
    "Homefaves uk": [
        "Larga o cotonete. Sério.",
        "Ele só empurra a cera pra dentro — e machuca o ouvido.",
        "Esse limpador de gel resolve o problema.",
        "É macio, é simples de usar, e ele puxa",
        "tudo que você não alcança.",
        "Sem sujeira, sem dor. Ouvido limpo de verdade.",
        "Cuida da higiene? Precisa desse.",
    ],
    # -----------------------------------------------------------------------
    # Origyn 2 e Everyday Finds tambem sao irmaos, com um fecho diferente.
    "Origyn 2": [
        "Tem ouvido? Precisa testar isso.",
        "Não imagina o que sai.",
        "Palitinho dói. Cotonete empurra a cera pra dentro.",
        "Troca o quanto antes.",
        # 1,48s: "espiral" nao cabia
        "Olha essa ponta.",
        "Ela puxa a cera com facilidade. Sujou? Lava e usa de novo.",
        "Peça hoje com desconto e frete grátis.",
        "Link embaixo.",
        "Tá acabando.",
        "Não perde.",
    ],
    "Everyday Finds": [
        "Tem ouvido? Precisa testar isso.",
        "Não imagina o que sai.",
        "Palitinho dói. Cotonete empurra a cera pra dentro.",
        "Troca o quanto antes.",
        "Olha essa ponta.",
        "Ela puxa a cera com facilidade. Sujou? É só lavar e usar de novo.",
        "Peça hoje com desconto e frete grátis.",
        "Link embaixo.",
        "Tá acabando. Não perde.",
    ],
    # -----------------------------------------------------------------------
    "Goltali": [
        "Você nem imagina a quantidade de cera que tem aí dentro.",
        "Palito de ouvido machuca. E o cotonete, então?",
        "Ele só empurra a cera pra dentro. Troque agora pelo de gel.",
        # PONTUACAO CUSTA TEMPO. "Olha a ponta: macia, grudenta." tem 30
        # caracteres — deveria caber nos 2,28s — e estourou 0,61s. Os dois
        # sinais no meio viraram duas pausas da locutora. Sem eles, 32
        # caracteres cabem folgados. Vale pra toda janela apertada: primeiro
        # tire a virgula, depois corte palavra.
        "Olha essa ponta macia e grudenta",
        "Dá duas voltas e a cera toda gruda ali. Sem machucar o ouvido.",
        # 1,3s — cabe uma expressao curta, e so
        "Pra todo mundo.",
        "Sujou? Lava na água e usa de novo.",
        "E o melhor: comprando antes da promoção acabar, você leva desconto exclusivo e frete grátis.",
    ],
    # -----------------------------------------------------------------------
    "Londonget Gift": [
        "Você não faz ideia da quantidade de cera que tem no seu ouvido.",
        "O palito de ouvido incomoda, e o cotonete limpa só a superfície.",
        "Troca pelo limpador de gel.",
        "Olha só: a ponta é macia e grudenta. Ela puxa a cera sem machucar o ouvido.",
        # sem o ponto no meio (ver a nota do Goltali) cabe a frase inteira
        "Seguro e higiênico pra adulto e criança",
        "Sujou? Lava na água e usa de novo.",
        "E o melhor: com o link aqui embaixo, você ainda garante desconto exclusivo e frete grátis.",
    ],
    # -----------------------------------------------------------------------
    "Ventra finds": [
        "Cotonete só empurra a cera pra dentro.",
        "Esse palito tem ponta grudenta. A sujeira gruda nela.",
        "Pega até o que é minúsculo. Satisfatório demais. E é seguro pra adulto e criança.",
        # 0,52s de janela: cabe uma palavra, e olhe la
        "Coça?",
        "Testa esse palito. Tira a sujeira fácil.",
        "Cada caixa tem 2 fileiras de 12 palitos.",
        "São 24 palitos no total. Destaca um e usa. Simples, e dá pra reaproveitar.",
        "Lava na água, deixa secar, e pronto. Macio, confortável, perfeito pra família toda.",
    ],
    # -----------------------------------------------------------------------
    "Waregami": [
        "Se você não testar isso, nunca vai saber quanta cera tem aí dentro.",
        "Palito machuca na hora de limpar. E o cotonete empurra a cera pra dentro.",
        "Troca já pelo palito de gel.",
        "Olha a ponta: macia e grudenta.",
        "Gira devagar duas vezes e a sujeira gruda toda ali. Sem machucar.",
        "Adulto e criança usam.",
        "Sujou? Lava na água e usa de novo, sempre.",
        "E o melhor: peça antes da promoção acabar e garanta seu desconto.",
        "Valeu por assistir. Um bom dia!",
    ],
    # -----------------------------------------------------------------------
    # Genius finds e Lilyrhyme sao o MESMO roteiro em janelas diferentes.
    # A copy muda junto: o que cabe em 3,64s nao cabe em 2,52s.
    "Genius finds": [
        "Antes, era palito de metal mesmo.",
        "Nada higiênico, e machucava o ouvido.",
        "Aí todo mundo foi pro cotonete,",
        "mas ele empurra a cera pra mais fundo.",
        # O original diz "Now in 2026". Em portugues o ano vira "dois mil e
        # vinte e seis" — seis silabas a mais que "twenty twenty-six", e nao
        # cabia nos 2,52s. O Lilyrhyme mantem o ano porque la a janela e 3,64s.
        "Hoje, todo mundo já está trocando",
        "por esse de gel.",
        "Você nem imagina a cera",
        "escondida aí dentro até você testar.",
        "A ponta é macia e grudenta,",
        "então não tem risco nenhum.",
        "A aderência tira tudo mesmo:",
        "do farelinho até a cera dura",
        "grudada na parede.",
        "Vem 24 unidades na caixa,",
        "dá pro dia a dia todo.",
        "Sujou? É só lavar na água",
        "e reutiliza.",
        "Com frete grátis.",
        "Link embaixo.",
        "Pega antes do preço subir.",
    ],
    # -----------------------------------------------------------------------
    "Lilyrhyme": [
        "Parece bobagem, mas essa coisinha me ajudou demais.",
        "Antes, era palito de metal mesmo.",
        "Nada higiênico. E machucava.",
        "Aí todo mundo foi pro cotonete.",
        "Mas ele empurra a cera pra mais fundo.",
        # sem as virgulas: mesmas 43 letras, 0,3s a menos de pausa
        "Agora em 2026 todo mundo troca pelo de gel.",
        "Você nem imagina a cera que está escondida aí até testar.",
        "A ponta é macia e grudenta, sem risco de machucar o ouvido.",
        "A aderência tira tudo.",
        "Do farelinho até a cera dura grudada na parede.",
        "Vem 24 na caixa, o suficiente pro dia a dia.",
        "Sujou? Lava na água e usa de novo.",
        "Frete grátis.",
        "Link aí.",
        "Pega antes que suba.",
    ],
    # -----------------------------------------------------------------------
    # O unico com narrativa em vez de lista de beneficios. A copy acompanha:
    # frases curtas, primeira pessoa, e o desconforto como gancho.
    "Digg It": [
        # travessao no lugar do ponto: a locutora respira menos
        "Seu ouvido é quente, escuro e úmido — exatamente onde o fungo cresce.",
        "É nojento, eu sei. Mas pensa no que você faz pós-banho.",
        "Enfia no ouvido.",
        "E gira.",
        "Sai quase limpo. Aí você acha que tá tudo bem.",
        "E é aí que mora o perigo.",
        "Porque cotonete não agarra a cera.",
        "Não pega.",
        "Não puxa.",
        "Toda vez que usa, você empurra a cera velha mais fundo e prensa ela lá.",
        "Imagina isso depois de cada banho.",
        "Quente, escuro, úmido.",
        "Cera velha prensada onde você não vê.",
        "Só de pensar, larguei o cotonete.",
        "Fui testar o Dig It.",
        "É um palito macio e grudento. Ele agarra a cera e puxa pra fora.",
        "Na primeira vez passei mal, porque deu pra ver o que saiu.",
        "Escura, velha. Muito mais do que eu achava.",
        "Mas foi satisfatório demais.",
        "Pela primeira vez, sem chute.",
        "Dava pra ver na ponta.",
        "É a diferença.",
        "Cotonete só parece.",
        "O Dig It mostra o que saiu.",
        "Se você usa cotonete e chama isso de limpo,",
        "vale repensar.",
        "Porque quente, escuro e úmido não é lugar pra cera velha.",
        "Dig It tira. Não empurra.",
        "Ponta grudenta.",
        "Com trava.",
        "Nada de líquido.",
        "Lava, reutiliza, e vê na ponta toda vez.",
        # O original diz "£9.99". Preco em libra nao serve pro Brasil, e
        # inventar um em real seria mentir no anuncio. Fica generico ate o
        # cliente informar o valor.
        "Garanta o seu hoje com desconto. E se não gostar, devolvemos seu dinheiro. Sem perguntas.",
        "Link.",
    ],
}


def densidade(texto: str, janela: float) -> float:
    """Caracteres por segundo. Acima de 15 a voz sai apressada."""
    return len(texto) / janela if janela > 0 else 999.0


def aplicar(conferir: bool = False) -> None:
    total_apertadas = 0

    for nome, linhas in COPY.items():
        caminho = FICHAS / f"{nome}.json"
        if not caminho.exists():
            aviso(f"nao achei a ficha: {caminho.name}")
            continue

        ficha = ler_json(caminho)
        falas = ficha.get("falas", [])

        if len(falas) != len(linhas):
            aviso(
                f"{nome}: a ficha tem {len(falas)} falas e a copy tem "
                f"{len(linhas)}. Pulando pra nao desalinhar."
            )
            continue

        apertadas = []
        for i, (fala, pt) in enumerate(zip(falas, linhas)):
            fala["pt"] = pt
            d = densidade(pt, fala.get("janela", 0))
            if d > 15.0:
                apertadas.append((i, round(d, 1), pt))

        if not conferir:
            salvar_json(caminho, ficha)

        marca = "ok" if not apertadas else f"{len(apertadas)} apertada(s)"
        print(f"  {nome:<18} {len(linhas):>2} falas   {marca}")
        for i, d, pt in apertadas:
            print(f"       [{i}] {d} car/s  {pt[:52]}")
        total_apertadas += len(apertadas)

    print()
    if conferir:
        ok("conferencia so — nada foi gravado")
    else:
        ok(f"copy gravada em {len(COPY)} fichas")
    if total_apertadas:
        aviso(
            f"{total_apertadas} fala(s) acima de 15 car/s. O encaixe do voz.py "
            "acelera ate 1,12x; acima disso ele avisa que precisa encurtar."
        )


def main() -> None:
    ap = argparse.ArgumentParser(prog="copy_pt")
    ap.add_argument("--conferir", action="store_true", help="so mede, nao grava")
    a = ap.parse_args()
    passo("copy em portugues")
    aplicar(a.conferir)


if __name__ == "__main__":
    main()
