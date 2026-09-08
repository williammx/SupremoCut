"""
SupremoCut - a narracao continua, em portugues.

A DIFERENCA PRA VERSAO ANTERIOR

Antes: uma frase por janela do ingles. Cada frase comecava e terminava sozinha,
e entre uma e outra sobrava silencio. O anuncio soava picado.

Aqui: UM texto corrido por anuncio, escrito pra ser dito de uma vez. Nenhuma
frase existe isolada — cada uma puxa a proxima. As pausas sao as do portugues,
marcadas por virgula e travessao, e nao as do locutor em ingles.

QUEM DIZ ESTE TEXTO

O Rafael, voz do ElevenLabs escolhida pelo Campelo depois de recusar as
anteriores. Ele nao e sintetizado por este motor: o texto e gerado na conta do
Campelo, no modelo Eleven v3, e o mp3 volta pra ca pelo `narracao.py --audio`.
Por isso este arquivo guarda o texto COM as tags do v3 — e exatamente o que foi
colado no editor, nao uma versao limpa dele.

AS TAGS

`[curious]`, `[annoyed]`, `[excited]`, `[urgent]` mudam a entonacao e nao
custam tempo nenhum de audio. Tag que produz SOM — `[exhales sharply]`,
`[chuckles]` — custa, e por isso nao aparece aqui: num anuncio de vinte
segundos, um suspiro come meio segundo de argumento.

COMO ESCREVER MAIS UM

  - Alvo: ~13 caracteres falados por segundo (medido, ver `alvo_rafael.py`),
    e a fala termina uns 0,4s antes do video acabar.
  - O `alvo_rafael.py` conta pra voce e diz quanto cortar ou quanto ainda cabe.
  - Ponto final e pausa longa; virgula e travessao mantem o fluxo. Num texto
    corrido, ponto demais reconstroi justamente o picotado que se quer evitar.
  - Numero por extenso: "vinte e quatro" e lido melhor que "24", que as vezes
    sai como "dois quatro".
  - A ordem do argumento importa mais que a fidelidade: gancho, problema,
    produto, prova, oferta. E como anuncio brasileiro convence.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# A voz
# ---------------------------------------------------------------------------
#
# O motor nao sintetiza mais: a voz vem pronta, gravada na conta do Campelo.
# Estes ids ficam aqui como historico do caminho ate chegar no Rafael.
#
#   Amandinha  r2fkFV8WAqXq2AqBpgJT   brasileira, so em conta paga
#   Gabriel    k3f7zOv6LF88v78QHCNh   brasileira, masculina
#   Bia        0ozreaQ0xnggCu2x9oFC   usada na primeira leva continua
#   Sarah      EXAVITQu4vr4xnSDxMaL   premade americana, recusada
VOZ_PADRAO = "EXAVITQu4vr4xnSDxMaL"
VOZ_PADRAO_NOME = "Rafael - Severe & Moderate (gravado fora, Eleven v3)"


NARRACAO: dict[str, str] = {
    # ---------------------------------------------------------------- 21,8s
    # Origyn e Homefaves uk sao o mesmo filme: mesmo texto, mesmo audio.
    "Origyn": """
[annoyed] Se você ainda limpa o ouvido com cotonete, para agora. Ele não tira a
cera, ele empurra pra dentro — e ainda arranha o canal. [excited] Eu troquei por
esse limpador de gel e foi outra história: a ponta é macia e grudenta, e puxa
tudo que o cotonete só empurrava. Sai limpo, sem dor e sem sujeira nenhuma.
""",
    "Homefaves uk": """
[annoyed] Se você ainda limpa o ouvido com cotonete, para agora. Ele não tira a
cera, ele empurra pra dentro — e ainda arranha o canal. [excited] Eu troquei por
esse limpador de gel e foi outra história: a ponta é macia e grudenta, e puxa
tudo que o cotonete só empurrava. Sai limpo, sem dor e sem sujeira nenhuma.
""",
    # ---------------------------------------------------------------- 25,6s
    "Origyn 2": """
[curious] Se você tem ouvido, precisa testar isso — você não imagina o que sai.
[annoyed] Palitinho de metal dói, cotonete empurra a cera pra dentro, então
troca o quanto antes. [excited] Olha essa ponta em espiral: ela puxa a cera com
facilidade, e quando sujar é só lavar e usar de novo. Peça hoje com desconto e
frete grátis, o link tá aqui embaixo. [urgent] Tá acabando, não perde.
""",
    # ---------------------------------------------------------------- 30,6s
    "Everyday Finds": """
[curious] Se você tem ouvido, precisa testar isso — você não imagina o que sai
de lá de dentro. [annoyed] Palitinho de metal dói, cotonete empurra a cera pra
mais fundo, então troca logo. [excited] Olha essa ponta em espiral: macia, gruda
na cera e puxa tudo sem machucar o canal. Quando sujar, é só lavar e usar de
novo. Peça hoje com desconto e frete grátis — o link tá aqui embaixo.
[urgent] Corre, que o estoque é bem limitado.
""",
    # ---------------------------------------------------------------- 33,6s
    "Londonget Gift": """
[curious] Você não faz ideia da quantidade de cera que tem no seu ouvido agora.
[annoyed] O palito de metal incomoda e o cotonete limpa só a superfície,
empurrando o resto pra dentro. Por isso troca pelo limpador de gel: a ponta é
macia e grudenta, levanta a cera sem machucar o ouvido. [excited] É seguro e
higiênico, adulto e criança usam, e quando sujar é só lavar e usar de novo.
[urgent] Com o link aqui embaixo você garante desconto exclusivo e frete grátis.
""",
    # ---------------------------------------------------------------- 34,6s
    "Goltali": """
[curious] Você nem imagina a quantidade de cera que tem aí dentro até
experimentar isso. [annoyed] Palito de ouvido machuca o canal e o cotonete só
empurra a cera pra mais fundo, então troca agora pelo limpador de gel.
[excited] Olha essa ponta macia e grudenta: você dá duas voltinhas e toda a cera
fica presa nela, sem machucar o ouvido. Serve pra adulto e criança, e quando
sujar é só lavar e usar de novo. [urgent] Comprando antes da promoção acabar,
você leva desconto e frete grátis.
""",
    # ---------------------------------------------------------------- 38,3s
    "Waregami": """
[curious] Se você não testar isso, nunca vai saber quanta cera está acumulada
dentro do seu ouvido. [annoyed] O palito de metal machuca na hora de limpar, e o
cotonete empurra a cera pra mais fundo, então troca já pelo palito de gel.
[excited] Olha a ponta: macia e levemente grudenta. Você gira devagar duas vezes
e toda a sujeira fica presa ali, sem machucar o canal. É seguro pra adulto e
criança, e quando sujar é só lavar e reutilizar. [urgent] Peça antes da promoção
acabar e garanta seu desconto. Você vai se surpreender com o que sai já na
primeira vez.
""",
    # ---------------------------------------------------------------- 40,6s
    "Genius finds": """
[curious] Antigamente todo mundo limpava o ouvido com palito de metal — nada
higiênico, e ainda machucava. [annoyed] Depois veio o cotonete, mas o problema é
que ele empurra a cera pra mais fundo. [excited] Agora, em dois mil e vinte e
seis, todo mundo tá trocando por esse limpador de gel. Você nem imagina a cera
escondida aí dentro até experimentar. A ponta é macia e grudenta, sem risco de
machucar, e tira tudo: do farelinho até a cera dura na parede do canal. Vem
vinte e quatro na caixa, e quando sujar é só lavar e usar de novo. [urgent] Com
frete grátis — pega antes do preço subir.
""",
    # ---------------------------------------------------------------- 44,2s
    "Lilyrhyme": """
[curious] Parece bobagem, mas me ajudou demais. Antigamente a gente limpava o
ouvido com palito de metal — nada higiênico, e ainda machucava. [annoyed] Depois
veio o cotonete, mas ele empurra a cera pra mais fundo. [excited] Agora, em dois
mil e vinte e seis, todo mundo tá trocando por esse limpador de gel. Você nem
imagina a cera escondida aí dentro até experimentar. A ponta é macia e grudenta,
sem risco de machucar, e tira tudo: do farelinho até a cera dura grudada na
parede do canal. Vem vinte e quatro na caixa, e quando sujar é só lavar e usar
de novo. [urgent] Com frete grátis — pega o seu antes do preço subir. Depois me
conta o que saiu.
""",
    # ---------------------------------------------------------------- 45,8s
    "Ventra finds": """
[curious] Tirar cera com cotonete só empurra ela cada vez mais pra dentro.
[excited] Já esse palito de resina tem a ponta grudenta: a sujeira gruda nela
sozinha, e ele pega até as partículas minúsculas que você nem via. É
satisfatório demais de ver, e segue padrão de higiene, seguro tanto pra adulto
quanto pra criança. Se o seu ouvido tá incomodando, testa esse palito — ele tira
a sujeira com facilidade. Cada caixa vem com duas fileiras de doze, ou seja,
vinte e quatro palitos no total. Você destaca um, usa, lava na água, deixa secar
e usa de novo. Macio, confortável, e perfeito pra família toda. [urgent] Um
palito desses resolve o que o cotonete nunca resolveu.
""",
    # ---------------------------------------------------------------- 92,8s
    # O unico narrativo, e o unico que precisou encolher DEPOIS de gerado: na
    # primeira versao o Rafael leu 1290 caracteres em 110,9s — dezoito segundos
    # a mais que o video. A copy abaixo tem 1074 e coube.
    "Digg It": """
[curious] Seu ouvido é quente, escuro e úmido — exatamente onde fungo cresce. É
nojento, eu sei. Mas pensa no que você faz depois do banho: enfia o cotonete,
roda, e acha que tá tudo certo. [annoyed] E é aí que mora o perigo, porque
cotonete não agarra a cera. Não pega, não puxa. Toda vez que usa, você empurra a
cera velha mais pra dentro e prensa ela ali. Imagina isso depois de cada banho:
quente, escuro, úmido, cera prensada onde você não vê. [excited] Só de pensar,
larguei o cotonete e fui testar o Aure Clean. É um palito macio e grudento que
agarra a cera de verdade e puxa pra fora. Na primeira vez quase passei mal,
porque deu pra ver o que saiu: escura, velha, muito mais do que eu imaginava.
Mas foi satisfatório demais. É a diferença: o cotonete dá a sensação de limpo, o
Aure Clean mostra o que saiu. Ponta macia e grudenta, com trava, sem líquido e sem
sujeira. Você lava, reutiliza, e vê o resultado na ponta toda vez. Você vai ver
logo na primeira vez, e não vai querer voltar pro cotonete. [urgent] Garanta o
seu hoje com desconto — e se não gostar, devolvemos seu dinheiro. O link tá aqui
embaixo.
""",
    # ---------------------------------------------------------------- 16,3s
    # Este nao tinha locucao nenhuma: era musica com legenda queimada em russo.
    # Agora ganha narracao, e a musica original abaixa por baixo dela.
    "Othor shopping": """
[curious] Antes era palito de metal, e doía. [annoyed] Depois veio o cotonete,
que empurra a cera pra dentro. [excited] Agora todo mundo trocou por esse: ponta
macia e grudenta, a cera gruda sem machucar. Pra todos. [urgent] Link na bio.
""",
}


"""
Anúncios que não vieram do fluxo de dublagem.

O `Othor shopping` nunca teve ficha porque nunca teve locução: era música com
legenda queimada em russo. Agora ele ganha narração como os outros, então
precisa do mesmo par de informações que uma ficha traria — de onde vem o vídeo
e qual voz usar.

`manter_fundo` é o que o separa do resto: nos outros o áudio original é
descartado (a locução em inglês tem que sair). Aqui não há voz nenhuma pra
descartar — só a música do anúncio, que fica, abaixando sozinha por baixo da
narração.
"""
SEM_FICHA: dict[str, dict] = {
    "Othor shopping": {
        "origem": r"C:\Users\willi\Downloads\Anúncios-20260828T200642Z-1-001\Anúncios\Othor shopping.mp4",
        "voz": VOZ_PADRAO,
        "modelo": "eleven_multilingual_v2",
        "manter_fundo": True,
        "projeto": "othor-shopping",
    },
}


def limpar(texto: str) -> str:
    """Junta as linhas quebradas do arquivo num paragrafo unico."""
    return " ".join(texto.split())


# o motor consome ja limpo
NARRACAO = {k: limpar(v) for k, v in NARRACAO.items()}
