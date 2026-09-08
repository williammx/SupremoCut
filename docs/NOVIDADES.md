# O que entrou nesta rodada

Levantamento em quatro frentes paralelas — 29 repositórios open source no GitHub, 14 apps
comerciais, o ecossistema do nosso próprio stack, e o SupremoCut arquivo a arquivo —
consolidado num catálogo de decisão e executado. Os relatórios de origem estão em
[`pesquisa/`](pesquisa/); o catálogo com o que entra, o que fica em espera e o que foi
recusado (com o motivo) está em [`pesquisa/catalogo.md`](pesquisa/catalogo.md).

---

## Movimento

Antes, cada efeito precisava do código dele e quase nada se mexia. Agora existe um motor:
"mexer alguma coisa no tempo" virou um registro numa lista, e efeito novo é dado, não código.

**17 movimentos com nome, em quatro grupos.** No painel **Bloco**, seção *Movimento*:

- *Como entra*: Aparecer suave, Crescer, Deslizar da direita, Deslizar da esquerda, Subir de baixo, Cair com peso
- *Movimento durante*: Aproximar devagar, Afastar devagar, Panorâmica lateral, Balanço suave
- *Chamar atenção*: Soco, Pulsar, Tremida, Estouro de luz
- *Como sai*: Sumir no fim, Encolher e sumir, Aparecer e sumir

Clicar no que já está escolhido desliga. Quem quiser mexer no detalhe abre *ver os pontos do
movimento*; ninguém é obrigado a passar por ali pra ter movimento no vídeo.

**Cor e imagem por bloco.** Brilho, contraste, saturação, temperatura, desfoque e vinheta,
mais cinco modos de mistura com o fundo. Material de biblioteca de anúncio chega em cores
inconsistentes, e agora dá pra emparelhar.

---

## Automático — a aba nova

**Tirar os silêncios.** Arrasta a sensibilidade e o painel diz, antes de qualquer coisa
mudar, quantos segundos sairiam e em quantos blocos o vídeo ficaria. Três controles:
sensibilidade (o que conta como silêncio), respiro (o ar mantido nas pontas, sem o qual o
corte engole o começo da palavra) e pausa mínima (ignora as respiradas dentro da frase).

Em projeto dublado ele avisa em amarelo e recomenda não usar: a narração é um áudio solto,
não acompanha o corte, e o vídeo encurtaria por baixo dela.

**Editar pelo texto.** A transcrição inteira vira fichas clicáveis. Clique numa palavra e,
ao aplicar, o pedaço de vídeo em que ela é dita sai junto — edição sem tocar na linha do
tempo. Tem um botão que marca os vícios de linguagem de uma vez ("é", "tipo", "né", "então",
"sabe").

**Zoom nas palavras fortes.** Dá um tranco de aproximação nos blocos que começam numa palavra
em destaque. O dado pra isso já estava no disco desde a transcrição; ninguém tinha usado.

---

## Imagens e logos

Aba **Imagens**: envia do computador, ela entra onde a agulha está. Posição, tamanho, giro,
cantos arredondados, sombra — e os mesmos 17 movimentos dos blocos, porque "deslizar da
direita" tem que significar a mesma coisa nos dois lugares.

---

## Linha do tempo

- **Arrastar bloco pra reordenar.** Faltava o gesto mais básico. Uma marca cor-de-rosa mostra
  onde ele cai; o desfazer volta a viagem inteira, não passo a passo.
- **Zona segura** (botão na barra): desenha onde a interface do TikTok e do Reels cobre o
  vídeo. As guias acompanham o vídeo, não o palco.
- **Forma de onda** na pista de áudio, seguindo os clipes.

---

## Áudio no motor

Três comandos novos, todos rodando local:

```
supremo.py audio checar                    o que está pronto e o que falta
supremo.py audio volume  <arquivo>         normaliza em DOIS passes (EBU R128)
supremo.py audio separar <arquivo>         separa a VOZ da música e dos efeitos
supremo.py audio silencio <arquivo>        lista as pausas, com precisão de amostra
```

**Separar voz** é o que mais muda o trabalho de dublagem: hoje, dublar custa a trilha inteira
(ou deixa a voz em inglês vazando por baixo). Com a voz separada, a música e os efeitos
originais ficam e só a locução é trocada. Roda na GPU — 20 segundos de áudio em 22 segundos.

**Volume em dois passes** existe porque o passe único trabalha adivinhando e erra por 1 a 3
LU. Dois passes medem primeiro. A diferença é ouvir uma sequência de anúncios com o mesmo
volume, em vez de um pulando na cara do outro.

---

## O que foi verificado, e como

Duas revisões independentes rodaram sobre este trabalho. A adversarial **reprovou** a
primeira entrega: 5 defeitos críticos e 13 importantes, todos corrigidos e listados em
[`brownfield/revisao3.md`](brownfield/revisao3.md). Os que mais valia ter pego:

| Defeito | Por que era grave |
|---|---|
| `posicoes.tempo` num array | O painel de imagens entraria com tempo `NaN` e derrubaria o preview. |
| Upload gravando fora do `public` do Vite | O envio dizia "ok" e a imagem nunca aparecia. |
| Imagem sem `z-index` | Desenhada e imediatamente coberta pela cena. |
| Trilha de áudio sem `playbackRate` | Um bloco em 1,4x dessincronizava o vídeo inteiro dali pra frente. |
| Dividir, apagar e duplicar sem refazer a trilha | Metade nova saía muda; clipe do bloco apagado seguia tocando órfão. |
| Curva de mola com cosseno | `mola(0)` dava 1: a animação nascia no destino e depois afundava. |
| `editor/` fora do `tsconfig` | **A causa de tudo isso passar**: `tsc` passava verde sem olhar metade do código. |

Fechado com 33 verificações automáticas em `estudio/testes/cortes.test.mjs`, incluindo um
confronto do detector de silêncio do editor contra o do FFmpeg num arquivo real de 31
minutos — 91 pausas contra 104, 47,0s contra 52,9s de silêncio. O que se vê na tela é o que
se ouve no vídeo.

Rodar: `node testes/cortes.test.mjs` de dentro de `estudio/`.
