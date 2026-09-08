# Revisão 3 — revisão adversarial da rodada de animação, cortes automáticos, imagens e trilha de áudio

Revisor sem participação na implementação. Todo comentário de código foi tratado como
alegação não verificada. Onde não consegui confirmar, está escrito "não confirmado".

**Escopo verificado:** `git diff` completo de `estudio/` e `motor/`, leitura integral dos
arquivos novos (`animacao.ts`, `cortes.ts`, `Figura.tsx`, `picos.ts`, `PainelMovimento.tsx`,
`PainelAuto.tsx`, `PainelImagens.tsx`, `trilha.ts`, `audio.py`, `cortes.test.mjs`) e dos
alterados. Duas verificações executadas de verdade:

- `tsc` sobre `editor/` (que o `tsconfig.json` não cobre) — encontrou um erro real;
- avaliação numérica em Node da curva `mola` e dos presets de `animacao.ts`.

**Veredito: Reprovado.** Contagem: **5 Críticos, 13 Importantes, 17 Menores**.

---

## Críticos

### C1 — `estudio/editor/Editor.tsx:831` — `tempoAtual={posicoes.tempo}` é `undefined`; adicionar imagem grava `NaN` e mata o preview

`posicoes` é `number[]` (declarado em `Editor.tsx:276-284`). `posicoes.tempo` não existe.

Confirmado pelo compilador (o `editor/` não está no `tsconfig`, ver I12):

```
editor/Editor.tsx(831,38): error TS2339: Property 'tempo' does not exist on type 'number[]'.
```

Consequência em cadeia:

- `PainelImagens.tsx:67` → `Number(Math.max(0, undefined).toFixed(3))` = `NaN`
- `PainelImagens.tsx:68` → `Math.min(4, Math.max(1, total - undefined))` = `NaN`
- `Video.tsx:266` → `<Sequence from={Math.round(NaN * fps)}>` — o Remotion rejeita `from`
  não numérico e derruba a composição inteira.

**Repro:** aba Imagens → escolher qualquer imagem → o vídeo some/estoura. E o `NaN` já foi
gravado no roteiro (autosave em 3 s, `Editor.tsx:731-737`), então reabrir o projeto continua
quebrado.

**Correção sugerida:** `tempoAtual={frame / roteiro.fps}`.

---

### C2 — `estudio/servidor.mjs:223` — a pasta de imagens aponta um nível acima do `public` real; upload grava onde ninguém lê

```js
const pastaImagens = (nome) => path.join(RAIZ, "public", nome, "imagens");
```

`RAIZ = path.resolve(AQUI, "..")` (`servidor.mjs:19`), com `AQUI = F:\SupremoCut\estudio` →
`RAIZ = F:\SupremoCut`. Mas o `public` que serve mídia é `estudio/public`:
`vite.config.mts:13-14` tem `root: "editor"` e `publicDir: "../public"`, ou seja
`estudio/public`, e o Remotion roda com cwd `estudio/`.

Prova no disco: `F:\SupremoCut\public\demanda-01\imagens\` existe e está **vazia** — criada
pelo `fs.mkdir` da rota GET (`servidor.mjs:229`). Os projetos de verdade estão em
`F:\SupremoCut\estudio\public\` (`origyn`, `homefaves-uk`, `everyday-finds`, …), e é lá que
`testes/cortes.test.mjs:294` também procura (`path.join(RAIZ, "public")` com `RAIZ = estudio`).

Consequência: o POST devolve `200 {arquivo}`, o roteiro passa a citar um arquivo que não
existe no caminho servido, `<img src="/<projeto>/imagens/x.png">` (`PainelImagens.tsx:161`)
dá 404 e `staticFile()` (`Figura.tsx:51`) não acha nada no render. A galeria "Já neste
projeto" fica sempre vazia. O recurso de imagens não funciona de ponta a ponta.

**Correção sugerida:** `path.join(AQUI, "public", nome, "imagens")`.

---

### C3 — `estudio/src/componentes/Figura.tsx:27` — a imagem não tem z-index e fica embaixo de todas as cenas

Cada cena é um `Sequence` com `style={{ zIndex: i + 1 }}` (`Video.tsx:120`) contendo um
`AbsoluteFill` **opaco** (`Cena.tsx:166-167`, `backgroundColor: estilo.cores.fundo`). Pela
ordem de pintura do CSS, descendentes posicionados com z-index positivo pintam DEPOIS dos
com `z-index: auto`. Todo o resto do projeto compensa isso explicitamente:

- `Overlay.tsx:59` → `zIndex: 58` (tarja)
- `Overlay.tsx:106, 141, 189, 212` → `zIndex: 55`
- `Legenda.tsx:107` → `zIndex: 60`

`Figura.tsx:27` devolve `<AbsoluteFill style={{ pointerEvents: "none" }}>` — sem z-index — e
o `Sequence` que a envolve (`Video.tsx:264-269`) também não tem. Logo a imagem pinta antes
das cenas e é coberta por elas. O comentário em `Video.tsx:258-262` diz que a imagem fica
"ABAIXO dos overlays de texto de propósito"; a ordem no DOM só decide isso entre elementos
do mesmo nível de z-index, e aqui ela acaba abaixo do vídeo também.

Mesmo com C1 e C2 corrigidos, a imagem continuaria invisível.

**Correção sugerida:** `zIndex: 57` no `AbsoluteFill` da `Figura` (abaixo dos 58 da tarja,
que é o que o comentário quer).

---

### C4 — `estudio/src/Video.tsx:207-216` — a trilha de áudio perdeu o `playbackRate`; qualquer bloco com velocidade ≠ 1 dessincroniza

O caminho antigo (som soldado à cena) tinha `playbackRate={cena.velocidade ?? 1}`
(`Video.tsx:179`). O caminho novo da trilha **não tem**. E não é esquecimento recuperável:
`ClipeAudio` (`tipos.ts:354-369`) não tem campo de velocidade, e nem `trilhaDasCenas`
(`trilha.ts:19-33`) nem `seguirCenas` (`trilha.ts:60-70`) gravam essa informação — ela é
descartada na conversão.

O agravante é que `comTrilha(roteiro)` roda ao abrir **todo** projeto (`Editor.tsx:91`), então
o caminho antigo deixa de existir na prática. `velocidade` é ajustável pelo usuário em
`PainelBloco.tsx:365-370` e o vídeo continua respeitando (`Camada.tsx:105`).

**Repro:** bloco de 10 s com `velocidade: 1.4` → a imagem consome 14 s de fonte, o áudio toca
10 s a 1x. A partir daí imagem e som ficam permanentemente descolados no resto do vídeo.

**Correção sugerida:** acrescentar `velocidade` a `ClipeAudio`, propagá-la em
`trilhaDasCenas`/`seguirCenas` e passar `playbackRate` no `<Audio>` da trilha.

---

### C5 — Dividir, apagar, duplicar e os cortes automáticos não chamam `seguirCenas()` — a trilha de áudio some ou duplica em silêncio

Cinco caminhos mudam `cenas` sem recalcular `trilha_audio`:

| local | função |
|---|---|
| `estudio/editor/Editor.tsx:445` | `dividirNoCursor` |
| `estudio/editor/Editor.tsx:454` | `apagarCena` |
| `estudio/editor/Editor.tsx:488` | `inserirCopia` (usada por colar e duplicar) |
| `estudio/editor/componentes/PainelAuto.tsx:101` | `cortarSilencio` |
| `estudio/editor/componentes/PainelAuto.tsx:148-152` | `aplicarTexto` |

`mudarCena` (`Editor.tsx:186`), `mudarCenas` (`:208`), `moverCena` (`:525`) e `reordenarCena`
(`:549`) fazem certo. Estes cinco não.

**Repro do pior caso (dividir):**
1. Abrir um projeto — `comTrilha` cria 1 clipe por cena, `a_c001` com `duracao: 21.767`.
2. `S` para dividir o bloco em 5 s → cenas `c001` (5 s) e `c001bxxx` (16,7 s).
   A trilha continua intacta: 1 clipe de 21,767 s.
3. Arrastar a borda de qualquer bloco → `mudarCena` → `seguirCenas` roda agora.
   `a_c001` é reencontrado e reduzido para `duracao: 5`. O segundo pedaço **não tem clipe**.
4. Resultado: o áudio depois dos 5 s desapareceu do vídeo, sem nenhum aviso.

**Repro de `cortarSilencio`:** aplicar o corte encurta as cenas e a trilha fica com as
durações e posições antigas — imagem e som ficam totalmente descolados, e `manterApenas` ainda
cria pedaços `${id}_c1`, `_c2` que nunca ganham clipe e apaga cenas cujos clipes viram órfãos
com `vinculado_a` apontando para id morto.

Ironia: `cortes.ts:181-186` documenta exatamente esta intenção — *"os clipes de áudio
vinculados apontam pra esse id, e `seguirCenas()` só reencontra o dono se ele continuar
existindo"* — e ninguém chama `seguirCenas()` nesses caminhos.

**Correção sugerida:** trocar todo `mudarRoteiro({ ...roteiro, cenas })` por
`mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) })`, e em `manterApenas` decidir
explicitamente o que fazer com o clipe de uma cena que virou N pedaços (dividir o clipe junto
é o único comportamento que preserva o som).

---

## Importantes

### I1 — `estudio/editor/componentes/Timeline.tsx:753-763` — arrastar clipe de áudio não tem limiar de pixels; um clique quebra `vinculado_a`

O bloco de vídeo ganhou `LIMIAR_ARRASTE = 6` (`:92`, checado em `:260`). O clipe de áudio
não ganhou nada: `mousedown` arma `{tipo:"clipe"}` e o primeiro `mousemove` já chama
`aoMudarClipe(id, { inicio })` (`:301`), que por sua vez cai em `mudarClipe` com
`soltarVinculo = true` por padrão (`Editor.tsx:215, 221`).

Ou seja: 1 px de tremor ao **selecionar** um clipe solta o vínculo com a cena e desloca o
áudio (~0,07 s na escala padrão de 14 px/s). O usuário não é avisado; o único sinal é a borda
do clipe deixar de ser tracejada (`estilos.css:621`).

**Correção sugerida:** aplicar o mesmo `LIMIAR_ARRASTE` ao arraste de clipe e de borda de clipe.

### I2 — `estudio/editor/componentes/PainelAudio.tsx:73, 79, 87, 97, 107` — mudar volume ou fade solta o vínculo

Nenhuma dessas chamadas passa `soltar = false`, e o default de `mudarClipe` é `true`
(`Editor.tsx:215`). Mexer no **volume** ou no **fade** não tem relação com posição, mas
desliga o clipe do corte de vídeo para sempre. O próprio painel tem um botão dedicado
"soltar" logo acima (`:56`), o que mostra que soltar deveria ser um gesto explícito ali.

**Correção sugerida:** passar `false` em `volume`, `fade_entrada` e `fade_saida`; manter
`true` só em `inicio`/`duracao`.

### I3 — `estudio/editor/componentes/Timeline.tsx:316` — o limite de aparo do clipe de áudio usa a duração do arquivo de VÍDEO

`limiteFonte = fonte.duracao - fonte.offset` (`:280-281`) vem de
`roteiro.fontes.camera ?? roteiro.fontes.tela` — o relógio e o arquivo do **vídeo**. Já
`arraste.fonte0` é `ClipeAudio.fonte_inicio`, que `Video.tsx:213-216` lê somando
`roteiro.audio.offset`, isto é, outro arquivo e outro relógio. O limite correto teria de vir
da duração do arquivo de áudio, que `Roteiro["audio"]` (`tipos.ts:381-394`) nem guarda.

Efeito: em projeto onde áudio e vídeo têm durações diferentes, a ponta direita do clipe é
travada cedo demais ou solta demais.

### I4 — `estudio/editor/componentes/Timeline.tsx:305-314` — aparar a esquerda de um clipe pode dessincronizar o próprio clipe

`inicio` é preso em `Math.max(0, inicio0 + d)` (`:311`), mas `fonte_inicio` e `duracao`
continuam usando `d` cru (`:312-313`). Se `inicio0 < fonte0` — situação normal depois de
arrastar um clipe para a esquerda — puxar a borda esquerda até o zero da timeline trava
`inicio` e deixa a fonte andar: o áudio escorrega dentro do clipe.

**Correção sugerida:** recortar `d` também por `-inicio0` antes de aplicar.

### I5 — Tempos de `ClipeAudio` e de `Imagem` nunca caem em quadro inteiro

Locais que gravam com `toFixed(3)` / sem snap nenhum:

- `Timeline.tsx:301, 311, 312, 313, 318` (clipe e borda de clipe)
- `PainelAudio.tsx:73, 79` (`Entra em`, `Dura`)
- `PainelImagens.tsx:67, 68, 223, 229` (`inicio`, `duracao`)
- `Editor.tsx:214-227` (`mudarClipe` não passa por `emQuadros`, ao contrário de `mudarCena`)

No render, `Video.tsx:195, 201, 213` arredondam `duracao`, `inicio` e `trimBefore` de forma
**independente**. Dois clipes vizinhos podem então sobrepor ou deixar 1 quadro de buraco de
áudio. É exatamente o invariante do projeto: *todo tempo gravado deve cair em quadro inteiro*.
`Editor.tsx:159-170` já tem o `emQuadros` pronto para cenas; clipes e imagens ficaram de fora.

### I6 — `estudio/src/animacao.ts:39-42` — a curva `mola` está matematicamente errada: `mola(0) = 1`

```js
const mola = (p) => {
  if (p >= 1) return 1;
  return 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * ((2 * Math.PI) / 3));
};
```

É o `easeOutElastic` com **`cos` no lugar de `sin`** e o sinal trocado. Medido em Node:

| p | `mola(p)` | correto |
|---|---|---|
| 0.000 | **1.0000** | 0.0000 |
| 0.010 | 0.8060 | 0.0874 |
| 0.050 | 0.3876 | 0.6464 |
| 0.100 | 0.5670 | 1.2500 |
| 0.200 | 1.2165 | 1.1250 |

Em `valorEm` (`:85`, `a.valor + (b.valor - a.valor) * curva(bruto)`), `curva(0) = 1` significa
saltar para o **destino** no instante da chave de partida. Traçado do preset "Crescer"
(zoom 0.82 → 1, 30 fps):

```
quadro 0 → 0.820   (só porque a guarda de :69 devolve a primeira chave)
quadro 1 → 0.899
quadro 2 → 0.897   ← afunda
quadro 3 → 0.952
quadro 6 → 1.033
```

Um solavanco para trás em vez de crescimento. Afeta `crescer`, `deslizar_dir`,
`deslizar_esq`, `subir`, `cair` e `soco`. Numa chave do **meio** da lista, onde a guarda de
`:69` não existe, o valor teleporta direto para o destino.

**Correção sugerida:** `1 + Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3))`.

### I7 — `estudio/src/cortes.ts:223-224` — `congelar` e animações manuais não são deslocados quando o começo do bloco anda

`congelar` é medido do COMEÇO DO BLOCO. Em `manterApenas`, quando a janela mantida começa
depois do início da cena (`a > s0`, `:200-201`), o pedaço `n === 0` passa a começar em `a`,
mas o código só faz `Math.min(cena.congelar, duracao)` — não desloca. O valor correto seria
`cena.congelar - (a - s0) / vel`, sumindo se ficar negativo.

O mesmo vale para `animacoes` feitas à mão: o `{ ...cena }` de `:207` as copia intactas e o
regenerar de `:218` só acontece quando existe `preset_animacao`. Um bloco com chaves editadas
na mão que foi encurtado/deslocado fica com o movimento no instante errado.

O teste `testes/cortes.test.mjs:214-226` só usa janela começando em 0 e não pega o caso.

### I8 — `estudio/editor/componentes/Onda.tsx:78` — a forma de onda perdeu o fator de velocidade

Antes:

```js
const naFonte = cena.fonte_inicio + offsetAudio + dentroDoBloco * (cena.velocidade ?? 1);
```

Agora:

```js
const naFonte = clipe.fonte_inicio + offsetAudio + (t - clipe.inicio);
```

Sem fator. Em bloco acelerado, a onda desenhada não corresponde ao som — e é a mesma onda que
o corte automático de silêncio consome (`PainelAuto.tsx:57, 73`), então "o que você vê" e "o
que vai ouvir" divergem justamente onde o teste de `cortes.test.mjs` diz querer garantir que
não divirjam. Consequência direta de C4: `ClipeAudio` não carrega velocidade.

### I9 — `estudio/src/Video.tsx:75-93` — as transições dos novos presets de entrada revelam o fundo

`atravessa` só considera `cena.entrada` (`fade`, `zoom_cruzado`, `deslize`). Os presets do
grupo `entrada` de `animacao.ts` (`aparecer`, `crescer`, `deslizar_dir`, `deslizar_esq`,
`subir`, `cair`) baixam a opacidade ou deslocam a cena inteira, mas a cena anterior já morreu
— só sobram os 4 quadros de `COLCHAO` (`:87`). Aparece `estilo.cores.fundo` em vez do quadro
anterior.

**Repro:** aplicar "Aparecer suave" no bloco 2 e observar os primeiros ~0,6 s: pisca preto.

### I10 — `estudio/editor/componentes/PainelAuto.tsx:181` — `zoomNaEnfase` sobrescreve animações feitas à mão e o aviso mente

```js
if (!perto || c.preset_animacao) return c;
```

A guarda é `preset_animacao`, não `animacoes?.length`. Mas `PainelMovimento.tsx:129 e 155`
zeram `preset_animacao` assim que o usuário edita uma chave. Logo um bloco com movimento
editado à mão é sobrescrito por `aplicarPreset("soco", …)` (`:186`). E o alerta de `:191-193`
— *"ou eles já têm movimento"* — é falso nesse caso: eles tinham, e foi apagado.

Desfazível por Ctrl+Z, mas silencioso.

### I11 — `estudio/editor/componentes/PainelLegenda.tsx:106, 111` — "Aplicar às N palavras" apaga toda ênfase manual

```js
palavras: legendas.palavras.map((p) => ({ ...p, enfase: chaves.some(...) }))
```

Reescreve `enfase` de **todas** as palavras a partir só da lista de palavras-chave. Quem
marcou palavras à mão perde tudo num clique, sem confirmação e sem que o rótulo do botão diga
que vai desmarcar. Piora com I10: `zoomNaEnfase` depende justamente de `enfase`.

### I12 — `estudio/tsconfig.json:16` — `editor/` inteiro fora da verificação de tipos

```json
"include": ["src", "remotion.config.ts"]
```

`tsc --noEmit -p .` passa limpo porque nem olha o editor. Rodando o mesmo compilador só sobre
`editor/main.tsx` com as mesmas flags, C1 aparece imediatamente e é o **único** erro do
diretório — ou seja, o custo de incluir `editor` no tsconfig hoje é uma linha de correção, e o
benefício é ter pego o pior defeito desta rodada antes de gravar `NaN` no roteiro do usuário.

### I13 — `estudio/editor/componentes/Onda.tsx:96-111` — rolar a timeline não redesenha a onda (pré-existente, não corrigido)

`aoRolar` só chama `forcar((n) => n + 1)`, que re-renderiza. `desenhar` é um `useCallback`
cujas dependências (`:94`) não mudaram na rolagem — `recuo` é `useCallback([])`
(`Timeline.tsx:182-187`), `rolagem` é ref, `clipes` é a mesma referência. Logo
`useEffect(() => { desenhar(); }, [desenhar])` (`:96-98`) **não roda de novo**. O canvas é
reposicionado (`:119`) mas o conteúdo fica velho.

Não confirmei visualmente; a leitura do código é inequívoca. A estrutura é anterior a esta
rodada, mas a rodada mexeu no arquivo e não corrigiu.

---

## Menores

1. `estudio/servidor.mjs:262-268` — aceita qualquer base64; `Buffer.from(..., "base64")`
   ignora lixo em silêncio; não confere se o mime do data URL bate com a extensão; sem limite
   de tamanho do lado do servidor (só o `express.json({ limit: "200mb" })` de `:25` — o corte
   de 25 MB de `PainelImagens.tsx:21` é do cliente e não vale nada). Ferramenta local, risco
   real baixo. **A travessia de caminho está fechada:** `nomeValido` (`:37-44`) é lista branca
   e o nome do arquivo é `path.basename` + `[^A-Za-z0-9_-]` + extensão em lista branca.
2. `estudio/servidor.mjs:281-289` — o laço anti-sobrescrita para em `n = 200` e grava
   `…-199.ext` **sem** checar se existe: sobrescreve depois de 198 colisões.
3. `estudio/servidor.mjs:228-229` — o GET faz `mkdir` a cada chamada; junto com C2 foi o que
   deixou a pasta lixo `F:\SupremoCut\public\demanda-01\imagens` no repositório.
4. `estudio/src/animacao.ts:48` — `degrau: () => 0`: no instante exato da chave seguinte
   `valorEm` ainda devolve `a.valor` (troca 1 quadro atrasada).
5. `estudio/src/animacao.ts:67` — `[...chaves].sort()` roda a cada quadro por propriedade.
6. `estudio/src/animacao.ts:132` — o caminho rápido devolve a constante compartilhada
   `ESTADO_NEUTRO`; qualquer mutação acidental do chamador contamina todos os blocos.
7. `estudio/src/tipos.ts:362` — o comentário de `ClipeAudio.fonte_inicio` diz "dentro do
   arquivo de áudio", mas `trilha.ts:24 e 68` gravam o relógio do **vídeo** e `Video.tsx:215`
   soma `audio.offset` em cima. Comentário e código discordam. E num clipe com `arquivo`
   próprio (dublagem) somar `roteiro.audio.offset` está objetivamente errado — é o offset de
   outro arquivo.
8. `estudio/editor/componentes/Onda.tsx:78` — mesmo problema do item 7: para um clipe com
   `arquivo` próprio, a onda desenhada é a do áudio principal.
9. `estudio/editor/componentes/Timeline.tsx:422` — `modo` está no array de dependências do
   efeito de arraste e não é usado dentro dele.
10. `estudio/editor/componentes/Timeline.tsx:232` — o efeito da roda usa `recuo` sem declará-lo
    nas deps (funciona porque é estável, mas é frágil).
11. `estudio/editor/Editor.tsx:2` — `Player` importado e nunca usado (o Player mora no `Palco`).
12. `estudio/editor/componentes/PainelAuto.tsx:407` — reexporta `normalizar` "pra Timeline
    poder desenhar a mesma linha de corte"; a `Timeline` não importa nada disso. Código morto.
13. `estudio/editor/componentes/PainelAuto.tsx:59, 128` — `removidas` guarda **índices** de
    `roteiro.legendas.palavras`. Se as palavras mudarem por outro caminho (o botão de I11, um
    corte), os índices apontam para outras palavras. Vale só dentro da vida do componente,
    mas é uma armadilha.
14. `estudio/package.json:6` — `"test"` continua `echo "Error: no test specified" && exit 1`;
    `testes/cortes.test.mjs` não está ligado a nada e depende de `esbuild`, que não está
    declarado (vem transitivo do Vite).
15. `estudio/testes/cortes.test.mjs` — **nenhum** teste cobre `animacao.ts`. Uma asserção de
    uma linha (`valorEm([{t:0,valor:0},{t:1,valor:1,curva:"mola"}], 0.0001, 0) < 0.2`) teria
    pego I6.
16. `motor/audio.py:44-46 vs :62` — o docstring diz "do primeiro `{` até o último `}`", o
    código usa `rfind("{")` (o **último** `{`). Funciona porque o JSON do `loudnorm` é plano.
17. `motor/audio.py:98-102` — indexa `medida['input_i']` direto depois de ter usado
    `.get(k, "")` na checagem de `inf` (`:75-78`): chave faltando vira `KeyError` em vez de
    cair no passe único. Também: `motor/audio.py:298` é uma f-string sem placeholder, e
    `motor/tratar.py` `_encaixar` pode devolver largura ímpar via `min(corte_w, w)` quando `w`
    é ímpar.
18. `estudio/editor/estilos.css:597 e 653` — `.clipe` declarado duas vezes.
19. `estudio/src/roteiro-atual.json` — artefato gerado e versionado; o diff desta rodada troca
    12 418 linhas por 81 só porque o último projeto aberto mudou. Deveria estar no `.gitignore`.

**O que verifiquei e está certo** (para não gastar o tempo de quem for corrigir):
`PainelAuto.tsx:80` e `:131` fazem a conversão áudio→vídeo corretamente (`- offset`), e
`:177` faz vídeo→áudio (`+ offset`), coerentes com `legendas.ts:38`. `Editor.tsx:298-313`,
`:353-373` e `:394-410` usam `+ offset` e dividem por `velocidade` corretamente. A álgebra de
faixas de `cortes.ts` (`normalizar`, `complemento`) está correta e coberta por testes. O
`emQuadros` de `cortes.ts:169` (sem `toFixed`) está certo — e o de `Editor.tsx:165-166` (com
`toFixed(4)`) não perde quadro, só acumula ~3·10⁻⁵ s por bloco em `posicoes`, o que não chega
a meio quadro nem em 100 blocos. O roll edit (`Timeline.tsx:323-357`) preserva a duração total
(pode divergir 1 quadro só em empate exato de meio quadro no `Math.round`). O arraste de
reordenar **não** atrapalha os arrastes de borda: os `puxador` chamam `stopPropagation`
(`:630, 674`) antes do handler do bloco, e o `LIMIAR_ARRASTE` preserva o clique seco. O
`Palco` (`Palco.tsx:17-32`) continua memoizado e nada nesta rodada quebra a memoização — o
`Player` não é remontado a cada quadro. A ordem de declaração em `Editor.tsx` foi corrigida
(`marcar` depois de `posicoes`/`tempoNaFonte`), sem TDZ novo.

---

## Tabela

| arquivo:linha | gravidade | defeito | correção sugerida |
|---|---|---|---|
| `estudio/editor/Editor.tsx:831` | Crítico | `tempoAtual={posicoes.tempo}` é `undefined`; imagem entra com `inicio`/`duracao` = `NaN` e o `Sequence` derruba o preview | `tempoAtual={frame / roteiro.fps}` |
| `estudio/servidor.mjs:223` | Crítico | `pastaImagens` usa `RAIZ = F:\SupremoCut`; o public servido é `estudio/public`. Upload grava fora do alcance do Vite e do render | `path.join(AQUI, "public", nome, "imagens")` |
| `estudio/src/componentes/Figura.tsx:27` | Crítico | Sem z-index, a imagem pinta abaixo das cenas (que têm `zIndex: i+1` e fundo opaco) e nunca aparece | `zIndex: 57` no `AbsoluteFill` |
| `estudio/src/Video.tsx:207-216` | Crítico | O `<Audio>` da trilha não tem `playbackRate`; `ClipeAudio` não carrega velocidade. Bloco com `velocidade ≠ 1` dessincroniza o vídeo inteiro | Campo `velocidade` em `ClipeAudio`, propagado em `trilha.ts`, e `playbackRate` no `<Audio>` |
| `estudio/editor/Editor.tsx:445, 454, 488` + `PainelAuto.tsx:101, 148` | Crítico | Dividir, apagar, duplicar e os cortes automáticos mudam `cenas` sem `seguirCenas()`: o áudio some, duplica ou fica órfão | `mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) })` nos cinco; dividir o clipe junto em `manterApenas` |
| `estudio/editor/componentes/Timeline.tsx:753-763` | Importante | Arraste de clipe sem limiar de pixels: 1 px ao selecionar solta `vinculado_a` e desloca o áudio | Aplicar `LIMIAR_ARRASTE` a `clipe` e `clipe-borda` |
| `estudio/editor/componentes/PainelAudio.tsx:87, 97, 107` | Importante | Mudar volume ou fade solta o vínculo (default `soltarVinculo = true`) | Passar `false` nesses três |
| `estudio/editor/componentes/Timeline.tsx:316` | Importante | Limite de aparo do clipe de áudio vem da duração/offset do arquivo de **vídeo** | Usar a duração do arquivo de áudio (falta o campo em `Roteiro["audio"]`) |
| `estudio/editor/componentes/Timeline.tsx:305-314` | Importante | `inicio` é preso em 0 mas `fonte_inicio`/`duracao` continuam andando: o áudio escorrega dentro do clipe | Recortar `d` também por `-inicio0` |
| `Timeline.tsx:301,311-313,318`; `PainelAudio.tsx:73,79`; `PainelImagens.tsx:67,68,223,229`; `Editor.tsx:214-227` | Importante | Tempos de clipe e de imagem gravados com `toFixed(3)`, fora de quadro inteiro; `Video.tsx` arredonda `inicio`, `duracao` e `trimBefore` separadamente → buraco/sobreposição de 1 quadro | Passar tudo por um `emQuadros` como o de `Editor.tsx:159-170` |
| `estudio/src/animacao.ts:39-42` | Importante | `mola` usa `cos` em vez de `sin`: `mola(0) = 1`, salta pro destino e afunda. Afeta 6 presets | `1 + 2**(-10p) * sin((10p - 0.75) * 2π/3)` |
| `estudio/src/cortes.ts:223-224` | Importante | `congelar` (e animações manuais) não são deslocados quando o começo do bloco anda | `cena.congelar - (a - s0)/vel`, descartando se negativo; deslocar `animacoes` sem preset |
| `estudio/editor/componentes/Onda.tsx:78` | Importante | A onda perdeu o fator `velocidade`: desenho não bate com o som em bloco acelerado | Restaurar o fator (depende do campo novo em `ClipeAudio`) |
| `estudio/src/Video.tsx:75-93` | Importante | `atravessa` ignora os presets de entrada de `animacao.ts`; a cena anterior morre e aparece o fundo | Considerar `preset_animacao` do grupo `entrada` ao calcular `sobra` |
| `estudio/editor/componentes/PainelAuto.tsx:181` | Importante | `zoomNaEnfase` sobrescreve animações feitas à mão; o aviso de `:191` diz o contrário | Guardar por `c.animacoes?.length`, não por `preset_animacao` |
| `estudio/editor/componentes/PainelLegenda.tsx:106` | Importante | "Aplicar às N palavras" desmarca toda ênfase manual sem avisar | Só adicionar ênfase, ou pedir confirmação dizendo quantas serão desmarcadas |
| `estudio/tsconfig.json:16` | Importante | `include` deixa `editor/` sem verificação de tipos — foi o que deixou o Crítico C1 passar | `"include": ["src", "editor", "remotion.config.ts"]` |
| `estudio/editor/componentes/Onda.tsx:96-111` | Importante | Rolar a timeline não redesenha a onda: `desenhar` é memoizado com deps inalteradas | Chamar `desenhar()` dentro do `aoRolar`, ou usar `rAF` |
| `estudio/servidor.mjs:262-268` | Menor | Sem checagem de mime, sem limite de tamanho no servidor, base64 inválido vira arquivo lixo | Validar o mime do data URL contra a extensão e cortar em ~25 MB |
| `estudio/servidor.mjs:281-289` | Menor | O laço de nome único grava `-199` sem checar existência | `for` até achar livre, ou sufixo aleatório |
| `estudio/servidor.mjs:228-229` | Menor | O GET cria a pasta a cada chamada (junto com C2, gerou pasta lixo no repositório) | Não criar; devolver `[]` se não existir |
| `estudio/src/animacao.ts:48` | Menor | `degrau` troca 1 quadro depois da chave | `curva(bruto) = bruto >= 1 ? 1 : 0` |
| `estudio/src/animacao.ts:67` | Menor | `sort()` a cada quadro por propriedade | Ordenar uma vez em `indexar` |
| `estudio/src/animacao.ts:132` | Menor | Devolve a constante compartilhada `ESTADO_NEUTRO` | `Object.freeze` ou devolver cópia |
| `estudio/src/tipos.ts:362` | Menor | Comentário diz relógio de áudio; `trilha.ts:24,68` grava relógio de vídeo | Corrigir o comentário e tratar o caso `arquivo` próprio |
| `estudio/editor/componentes/Timeline.tsx:422` | Menor | `modo` nas deps do efeito sem ser usado dentro | Remover |
| `estudio/editor/Editor.tsx:2` | Menor | `Player` importado e não usado | Remover |
| `estudio/editor/componentes/PainelAuto.tsx:407` | Menor | Reexporta `normalizar` para ninguém | Remover |
| `estudio/editor/componentes/PainelAuto.tsx:59,128` | Menor | `removidas` guarda índices de um array que pode mudar | Guardar chave estável (`t` + texto) |
| `estudio/package.json:6` | Menor | `npm test` ainda falha de propósito; `esbuild` não declarado | `"test": "node testes/cortes.test.mjs"` + `esbuild` em devDependencies |
| `estudio/testes/cortes.test.mjs` | Menor | Nenhuma cobertura de `animacao.ts` | Testes de `valorEm`/curvas — pegariam I6 |
| `motor/audio.py:44-46` | Menor | Docstring diz "primeiro `{`", o código usa `rfind` | Corrigir o texto |
| `motor/audio.py:98-102` | Menor | Indexa `medida['input_i']` direto; chave faltando vira `KeyError` | Usar `.get` com fallback para o passe único |
| `motor/audio.py:298` | Menor | f-string sem placeholder | Remover o `f` |
| `motor/tratar.py` `_encaixar` | Menor | `min(corte_w, w)` pode devolver largura ímpar | Forçar par: `w - (w % 2)` |
| `estudio/editor/estilos.css:597, 653` | Menor | `.clipe` declarado duas vezes | Fundir |
| `estudio/src/roteiro-atual.json` | Menor | Artefato gerado versionado; 12 418 linhas de ruído no diff | `.gitignore` |

---

## Veredito

**Reprovado** — a rodada entrega cinco defeitos críticos que se manifestam no uso normal:
o painel de Imagens grava `NaN` e derruba o preview, o upload de imagem salva num diretório
que ninguém serve, a imagem não teria z-index para aparecer mesmo se salvasse, a trilha de
áudio nova perdeu o `playbackRate` da velocidade, e dividir/apagar/cortar silêncio deixa o som
para trás em silêncio — exatamente a classe de perda de dado que o modelo de trilha existia
para evitar.
