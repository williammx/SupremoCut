# Composição Remotion — mapa arqueológico

Levantamento READ-ONLY de `estudio/src/` + `estudio/remotion.config.ts`.
Cada afirmação abaixo tem trecho citado como `arquivo:linha`. Onde não deu pra
confirmar, está escrito "não verificado nesta passagem".

Projeto vivo usado como evidência: `estudio/src/roteiro-atual.json`
(`projeto: "demanda-01"`, `fps: 24`, `1920x1080`, uma fonte só — `roteiro-atual.json:4-17`).

---

## fluxo-de-render

1. **Entrada.** `index.ts:1-4` chama `registerRoot(RemotionRoot)`. `Root.tsx:14-15`
   importa `roteiro-atual.json` e `estilo-atual.json` em tempo de bundle.
2. **Três composições.** `Root.tsx:25-73` registra `Principal` (dimensões do roteiro),
   `Vertical` (fixo `1080x1920`, `Root.tsx:53-54`) e `Quadrado` (fixo `1080x1080`,
   `Root.tsx:70-71`). Todas apontam para o mesmo `VideoPrincipal` e o mesmo roteiro.
   `duracaoEmFrames` (`Video.tsx:168-174`) soma `Math.max(1, Math.round(c.duracao * fps))`.
3. **Posição das cenas.** `Video.tsx:34-38`: um `cursor` acumula `dur =
   Math.max(1, Math.round(cena.duracao * fps))`. Mesma fórmula de `duracaoEmFrames` —
   linha do tempo e duração da composição batem exatamente.
4. **Colchão de sobreposição.** `Video.tsx:48-66`: se a entrada da PRÓXIMA cena for
   `fade` ou `zoom_cruzado` (`Video.tsx:50-51`), a cena atual vive
   `Math.ceil(entradaProx.duracao * fps)` quadros a mais; senão, `COLCHAO = 4`
   (`Video.tsx:60`); a última cena recebe `0` (`Video.tsx:66`).
5. **Sequence por cena.** `Video.tsx:80-93`: `from={inicio}`,
   `durationInFrames={durComSobra}`, `zIndex: i + 1` (`Video.tsx:91`) — quem entra
   fica sempre por cima — e `premountFor={Math.round(fps * 0.8)}` (`Video.tsx:89`).
6. **Geometria anterior.** `Video.tsx:77-78` guarda a geometria da cena anterior em
   `geoAnterior`, calculada com `roteiro.largura, roteiro.altura`.
7. **Cena.** `Cena.tsx:28` calcula `geoAlvo` com `width, height` do `useVideoConfig()`.
   `Cena.tsx:43-52` monta a mola, `Cena.tsx:54-57` a rampa linear, e o `switch`
   de `Cena.tsx:59-96` define `p` (progresso da geometria), `opacidadeGeral`,
   `deslocX/Y`, `escalaGeral` e `brilho`. `Cena.tsx:98` mistura:
   `geoAnterior ? misturarGeometria(geoAnterior, geoAlvo, p) : geoAlvo`.
8. **Duas camadas.** `Cena.tsx:106-133` monta `camera` e `tela`, passando
   `inicioNaFonte = cena.fonte_inicio + fonte.offset` (`Cena.tsx:111` e `:126`)
   e o `zIndex` decidido por `geo.camera_na_frente` (`Cena.tsx:116` e `:131`).
9. **Pixel.** `Camada.tsx:61-76` posiciona o retângulo em px
   (`left: r.x * width`, `Camada.tsx:63`), aplica `borderRadius: r.raio`
   (`:67`), `boxShadow` fixo (`:71`), borda (`:72`) e `clipPath` da diagonal (`:52-57`).
   Dentro, `Camada.tsx:78-84` aplica zoom/pan do foco, e `Camada.tsx:94-104` desenha
   `<Video>` do `@remotion/media` com
   `trimBefore={Math.max(0, Math.round(inicioNaFonte * fps))}` (`:99`),
   `playbackRate={velocidade}` (`:100`) e `objectFit: "cover"` (`:102`).
10. **Áudio.** `Video.tsx:114-129`: um `<Sequence durationInFrames={dur}
    layout="none">` DENTRO do Sequence da cena, com `<Audio>` buscando
    `trimBefore={Math.round((cena.fonte_inicio + audio.offset) * fps)}` (`:123-126`).
11. **Música.** `Video.tsx:136-147`: Sequence começando em
    `Math.round(musica.inicio * fps)` (`:138`), volume por quadro lido da curva
    pré-calculada (`:143`), `loop` (`:144`).
12. **Legenda e overlays.** `Video.tsx:150` e `:153-162`, ambos por cima
    (`zIndex: 60` em `Legenda.tsx:95`, `zIndex: 55` em `Overlay.tsx:40`).
13. **Encode.** `remotion.config.ts:10-11` (jpeg q95), `:14-16` (h264, crf 17,
    yuv420p), `:19-20` (concorrência 12, ANGLE), `:23` (aac).

---

## bugs-confirmados

### 1. Legendas descolam permanentemente depois de qualquer edição estrutural — **Crítico**

Os tempos das palavras são gravados no relógio do vídeo FINAL de UM momento
específico: `roteirizar.py:270-271` chama `mapear_tempo(p["t"], trechos)`
(`roteirizar.py:139-148`), que converte o tempo do bruto usando a lista de
trechos daquele processamento.

Nenhum caminho do editor recalcula `legendas.palavras`. Provado por leitura
completa: `Editor.tsx:228-251` (dividir), `:253-262` (apagar), `:282-296`
(duplicar/colar), `:316-328` (reordenar), `Timeline.tsx:246-252` (mover corte),
`Timeline.tsx:263-279` (aparar) — todos reescrevem só `cenas`. O único ponto que
toca em palavras é `PainelLegenda.tsx:219-223`, e ele muda apenas `texto` e `enfase`.

**Prova numérica no arquivo vivo.** `roteiro-atual.json:12470-12495` guarda os
trechos originais: `[281,353] [398,544] [565,783] [888,1071] [1161,1253] [1290,1363]`
→ soma **784,0 s**. A última palavra da legenda termina em `783.45`
(`roteiro-atual.json:12462-12465`) — coerente com esses 784 s.
Mas as cenas atuais somam `70.907 + 138.876 + 218 + 183 + 92 + 73` =
**775,783 s** (`roteiro-atual.json:28, 41, 53, 66, 79, 92`), porque a cena 1 foi
aparada em 1,093 s e a cena 2 teve o começo movido de `398` para `405.124`
(`roteiro-atual.json:40`).

Resultado: a partir do começo da cena 2 (quadro `70.907 s` na linha do tempo,
mas `79.124 s` no relógio das legendas) **a legenda adianta 8,217 s pelo resto
do vídeo**. `Legenda.tsx:52` usa `t = frame / fps` cru contra `p.t`, sem nenhuma
correção. Hoje isso está mascarado porque `legendas.estilo` está em `"nenhum"`
(`roteiro-atual.json:104`, `Legenda.tsx:59` retorna `null`) — no instante em que
alguém escolher "Destaque" no painel, o vídeo sai com 8 s de dessincronia.

O id `c002bigeb03hb6gd` (`roteiro-atual.json:39`) é resultado de três divisões
sucessivas pelo padrão de `Editor.tsx:242` (`${c.id}b${...slice(-3)}`): o editor
foi mesmo usado neste projeto.

### 2. A curva de ducking herda o mesmo erro e ainda ganha um deslocamento próprio — **Crítico**

`Video.tsx:22-31` constrói a curva a partir de `roteiro.legendas?.palavras` — as
mesmas palavras dessincronizadas do bug 1. A música abaixa nos instantes errados.

Além disso: `musica.ts:33-34` indexa a curva por quadro ABSOLUTO do vídeo final
(`p.t * fps`), mas `Video.tsx:143` a lê com o quadro RELATIVO ao Sequence que
começa em `Math.round(musica.inicio * fps)` (`Video.tsx:138`). Confirmado na
implementação: `remotion/dist/esm/index.mjs:8276-8284` (`useFrameForVolumeProp`)
usa `useCurrentFrame()` + `cumulatedNegativeFrom`, e `cumulatedNegativeFrom` é 0
para um `from` positivo (`index.mjs:8272-8275`).
Com `musica.inicio = 5`, o ducking inteiro atrasa 5 s e o `fade_saida`
(`musica.ts:61-62`) nunca é alcançado — a música termina em volume cheio no corte final.

### 3. `deslize` revela o fundo em vez da cena que sai — **Importante**

`Video.tsx:50-51` só coloca `fade` e `zoom_cruzado` na lista `atravessa`.
`deslize` recebe `COLCHAO = 4` quadros (`Video.tsx:60-66`), mas a mola do deslize
roda por `framesEntrada = Math.max(1, Math.round(duracaoEntrada * fps))`
(`Cena.tsx:33`) — com o padrão `duracao_padrao: 0.55` (`estilo-atual.json:27`) a
24 fps são **13 quadros**. Do quadro 5 ao 13 a cena anterior já morreu, e a área
que o `translate` de `Cena.tsx:140` desocupa mostra o `backgroundColor:
estilo.cores.fundo` do `AbsoluteFill` raiz (`Video.tsx:74`) — `#0A0A0C`
(`estilo-atual.json:4`). O deslize entra sobre preto, não sobre a cena que sai.

### 4. Um grupo de legenda "segura" o próximo por até 0,35 s — **Importante**

`Legenda.tsx:66` usa `grupos.find(g => t >= g.inicio - 0.12 && t <= g.fim + 0.35)`.
`find` devolve o PRIMEIRO que casar. `agrupar` (`Legenda.tsx:30-39`) quebra o
grupo quando `atual.length >= max` (`max_palavras: 4`, `estilo-atual.json:31`)
mesmo SEM pausa nenhuma — nesse caso o intervalo entre `g.fim` do grupo A e
`g.inicio` do grupo B é a folga natural entre duas palavras, bem menor que 0,35 s.
As duas janelas se sobrepõem e o grupo A vence. A segunda metade da frase entra
com atraso de quase 0,35 s enquanto a palavra já está sendo falada.

### 5. `velocidade != 1` não move a fonte da cena seguinte — **Importante**

Confirmado na implementação do `@remotion/media`
(`node_modules/@remotion/media/dist/esm/index.mjs:110` e `:117`):
`tempo_na_fonte = trimBefore/fps + (quadros_no_sequence/fps) * playbackRate`.
Logo, uma cena com `duracao = 10` e `velocidade = 1.4` (`Camada.tsx:100`,
`Video.tsx:127`) consome 14 s da fonte. A cena seguinte continua começando no
`fonte_inicio` original — o motor sempre escreve `"velocidade": 1`
(`roteirizar.py:358`), mas o editor expõe o controle de 0.5x a 2.5x
(`PainelBloco.tsx:289-297`) e nada compensa. Resultado: 4 s de material repetido.

Inconsistência interna no mesmo assunto: `Onda.tsx:95` **considera** a velocidade
(`dentroDoBloco * (cena.velocidade ?? 1)`), enquanto os limites de arraste da
timeline **não** consideram (`Timeline.tsx:218` e `:228` tratam `duracao` como se
fosse segundos de fonte). A onda desenha certo e a borda para no lugar errado.

### 6. `premountFor` não aquece a camada que só nasce durante o morph — **Menor**

`Video.tsx:89-90` premonta a cena com `opacity: 0`. Mas em
`remotion/dist/cjs/use-premounting.js:27-31` o quadro congelado durante o
premount é `from`, ou seja, o quadro 0 da cena. Nesse quadro, num `morph`,
`p = spring(0) = 0` (`Cena.tsx:65`), então a camada que estava `ESCONDIDO`
(`layouts.ts:18-27`, largura 0) cai no early-return de `Camada.tsx:43` e nem é
montada. O `<Video>` que vai aparecer no meio da transição não é pré-decodificado.

### 7. `zoom_cruzado` encolhe abaixo de 1.0 no fim — **Menor**

`Cena.tsx:85`: `interpolate(mola, [0, 1], [1.14, 1])` sem `extrapolateRight`,
portanto `"extend"`. A mola de `Cena.tsx:43-52` usa `damping: 18, stiffness: 120,
mass: 1` (`estilo-atual.json:25-26`) → ζ = 18/(2·√120) ≈ 0,82, subamortecida, e o
`spring` do Remotion **não** limita o overshoot quando `overshootClamping` não é
passado (`remotion/dist/esm/index.mjs:3786`). Com overshoot de ~1,1 %,
`escalaGeral ≈ 0,9985` → uma faixa de ~1,5 px por lado na composição 1080p.

### 8. Falha ao salvar não impede o render — **Menor**

`Barra.tsx:49` faz `if (sujo) await aoSalvar();` e segue. Mas `Editor.tsx:163-172`
captura a exceção e só chama `setErro` — nunca relança. Se a gravação falhar,
`api.renderizar` roda em cima do último `roteiro.json` bom, sem aviso no fluxo do
render.

---

## divergencia-preview-render

Esta é a promessa central do produto, então segue a lista completa do que muda
entre o que a pessoa aprova no Palco e o que sai no arquivo.

1. **Formato.** `Barra.tsx:18` e `:132-138` deixam escolher 16:9 / 9:16 / 1:1 para
   o render. O Palco SEMPRE desenha `roteiro.largura/2 × roteiro.altura/2`
   (`Palco.tsx:40-41`). **Não existe preview do vertical nem do quadrado.**
   No 9:16, `Camada.tsx:102` usa `objectFit: "cover"` — a fonte 16:9 é cortada
   com força e ninguém viu isso antes de renderizar.
2. **Margem, raio, borda e sombra do PiP dobram no preview.** São px absolutos:
   `margem: 56` e `raio: 28` (`estilo-atual.json:21` e `:19`) entram em
   `layouts.ts:58-59` (`margem / largura`) e `layouts.ts:79`, e o `boxShadow` de
   `Camada.tsx:71` é literal. A 960 px de largura a margem ocupa 5,83 % do quadro;
   a 1920 px ocupa 2,92 %. O quadradinho fica visivelmente mais afastado do canto
   e mais arredondado no preview do que no render.
3. **`geoAnterior` usa outra base que `geoAlvo`.** `Video.tsx:78` passa
   `roteiro.largura, roteiro.altura`; `Cena.tsx:28` passa `width, height` do
   `useVideoConfig()`. No preview 960×540 o morph de um PiP parte de
   `x = 1 - 0.26 - 56/1920` e chega em `1 - 0.26 - 56/960` — um deslize horizontal
   de ~28 px no fim de cada morph que **não existe** no render.
   No `Vertical`, é pior: o "de onde vem" é calculado em 16:9
   (`alt = (0.26·1920)/(1080·16/9) = 0.26`) e o "para onde vai" em 9:16
   (`alt = (0.26·1080)/(1920·16/9) ≈ 0.082`) — o morph começa numa caixa três
   vezes mais alta que a de destino.
4. **Arquivos de mídia diferentes.** `Camada.tsx:95-98` e `Video.tsx:116-122`
   trocam o `src` por `getRemotionEnvironment().isRendering`. Preview usa
   `*-preview.mp4` (altura 540, **fps forçado a 24**, CQ 30, `-profile:v baseline`
   — `tratar.py:122-150`, `config/tratamento.json:47-51`) e o render usa o proxy
   de qualidade (altura original até 1080, CQ 20 — `tratar.py:56-109`). Se o
   projeto for 30 fps, o preview só tem 24 quadros por segundo do material: o
   quadro exibido pode estar até 1/24 s longe do que o render vai usar.
5. **Áudio diferente.** Preview lê `audio-fonte-preview.m4a` (AAC 128k,
   `tratar.py:261-267`), render lê `audio-fonte.wav`. Nada no código compensa o
   atraso de priming do encoder AAC. Se isso é audível na prática: **não
   verificado nesta passagem**.
6. **Premount só existe no preview.** `use-premounting.js:20`:
   `premountingActive = !environment.isRendering && ...`. Todo o
   `premountFor`/`styleWhilePremounted` de `Video.tsx:89-90` é inerte no render.
   O `COLCHAO = 4` (`Video.tsx:60`), pensado contra o atraso do decodificador,
   também só tem efeito visual no preview.
7. **Rasterizador diferente.** `remotion.config.ts:20` força
   `setChromiumOpenGlRenderer("angle")` no render; o preview roda no navegador do
   usuário. Bordas arredondadas, `boxShadow` (`Camada.tsx:71`), o hack de máscara
   `-webkit-radial-gradient` (`Camada.tsx:75`) e o antialiasing do texto podem
   diferir.
8. **Passo JPEG.** `remotion.config.ts:10-11` renderiza cada quadro como JPEG q95
   antes de encodar; o preview não passa por isso.
9. **Fonte tipográfica.** `estilo-atual.json:11` pede `Montserrat, Inter, ...`.
   Uma busca por `Montserrat|loadFont|@remotion/google-fonts|@font-face` em
   `estudio/` (fora de `node_modules`) devolve **só essa linha** — nenhuma fonte é
   carregada pela composição. Preview e render dependem do que estiver instalado
   no sistema em cada processo. Se o Chromium do render enxerga as mesmas fontes
   do navegador: **não verificado nesta passagem**.
10. **Régua da timeline vs. grade de quadros.** `Editor.tsx:192-205` calcula
    `posicoes` e `duracaoTotal` em segundos crus; a composição posiciona tudo em
    `Math.round(duracao * fps)` (`Video.tsx:37`). No projeto vivo a diferença é
    de ~0,009 s, mas acumula meio quadro por cena (ver "matematica-suspeita").

---

## matematica-suspeita

- **`duracaoEmFrames` bate com a linha do tempo.** `Video.tsx:37` e
  `Video.tsx:170` usam a MESMA expressão `Math.max(1, Math.round(c.duracao * fps))`.
  Confirmado: não há descasamento entre a duração declarada e o layout real.
  O `durComSobra` (`Video.tsx:68`) só estica o Sequence, não move o `cursor`.
- **Segundo → quadro acumula meio quadro por cena.** O relógio das legendas
  (`Legenda.tsx:52`, `t = frame / fps`) é comparado com `p.t`, que veio de somas
  de segundos crus (`roteirizar.py:144-147`). A composição, porém, empilha
  `round(duracao·fps)`. Cada cena introduz até 0,5 quadro de erro entre os dois
  relógios, e o erro NÃO é corrigido em lugar nenhum. Com `pausa_maxima: 0.85`
  (`config/direcao.json:7`) e blocos de 4 s em projetos de duas fontes
  (`roteirizar.py:206`), uma hora de vídeo gera centenas de cenas — o limite
  superior do desvio é N/2 quadros.
- **Emenda de áudio dentro de fala contínua.** Cada cena re-busca a fonte com
  `Math.round(fonte_inicio · fps)` (`Video.tsx:123-126`) e dura
  `Math.round(duracao · fps)` (`Video.tsx:37`). Como
  `round(a+b) − round(a) − round(b) ∈ {−1, 0, 1}`, em boa parte das emendas
  **sobra ou falta 1 quadro de áudio** (41,7 ms a 24 fps). Em cortes de silêncio
  isso é invisível; em cenas contíguas na fonte — troca de layout a cada 4 s, ou
  qualquer divisão feita com `S` no editor (`Editor.tsx:239-245`) — o áudio
  duplica ou pula um pedaço no meio da palavra.
- **`trimBefore` de áudio e vídeo usam a mesma base?** Sim, quando a fonte de
  áudio é a mesma fonte de vídeo. `supremo.py:227` define
  `off_audio = sync[papel_audio]["offset"]` com `papel_audio = "camera"` quando há
  câmera (`supremo.py:217`), e é esse valor que vai para `roteiro.audio.offset`
  (`supremo.py:301-307`) e é somado em `Video.tsx:125`. A camada de vídeo soma
  `fCam.offset` (`Cena.tsx:111`) — o mesmo número. Com DUAS fontes, porém, a
  camada `tela` soma `fTela.offset` (`Cena.tsx:126`), que é arredondado
  separadamente em `Math.round(...)` — pode dar 1 quadro de escorregão entre a
  imagem da tela e o áudio.
- **Curva de ducking (`musica.ts`).** Comprimento `ceil(soma_de_segundos · fps)`
  (`musica.ts:27`, alimentado por `Video.tsx:24`), enquanto a composição tem
  `soma_de_round(segundos · fps)` quadros — os dois podem diferir por alguns
  quadros. `Video.tsx:143` protege com `Math.min(f, length - 1)`, então o excesso
  segura o último valor (que, pelo `fade_saida`, é 0). A rampa de
  `musica.ts:48-51` é linear e simétrica; `passo` é recalculado a cada iteração
  mas é constante. Se `abaixar > 1` (nada valida isso — `tipos.ts:117` só
  documenta 0..1, e `PainelAudio.tsx:92-99` limita a 1 na interface, não no
  arquivo), `passo` fica negativo e a suavização inverte de sentido.
- **Interpolação de geometria (`layouts.ts:164-176`).** É linear em todos os
  campos, inclusive `raio`, `opacidade` e `borda`. `sombra` e `camera_na_frente`
  trocam secamente em `p = 0.5` (`layouts.ts:173` e `:182`) — no morph a sombra
  e a ordem de empilhamento pulam no meio. Com o overshoot da mola (bug 7),
  `p` passa de 1 e os valores extrapolam: `largura` e `opacidade` podem ficar
  negativos ao morphar para `ESCONDIDO`, mas o early-return de `Camada.tsx:43`
  desmonta a camada antes disso virar CSS inválido.
- **`retanguloPip` mantém 16:9 corretamente.** `layouts.ts:63`:
  `alt = (escala · largura) / (altura · 16/9)`. Em 1080×1920 dá `0,0823`, que
  vezes 1920 px são 158 px de altura para 281 px de largura — exatamente 16:9.
  A fórmula está certa; o problema é a margem em px absolutos (item 2 acima).
  Exceção: `formato: "circulo"` usa `altura: larg · (largura/altura)`
  (`layouts.ts:78`), o que dá um quadrado — outro caminho, também correto.

---

## riscos

- **fps fracionário (23.976).** `supremo.py:266` faz `int(round(m_ref.fps))` — um
  material 23.976 vira `fps: 24` no roteiro e na composição. Todo `fonte_inicio`
  é depois convertido com `Math.round(t · 24)` (`Camada.tsx:99`), mas o arquivo
  real anda a 23.976. O desvio entre o tempo pedido e o tempo real cresce ~0,1 %
  do começo do arquivo: aos 30 minutos, cerca de **1,8 s**. Como `fonte_inicio`
  aqui chega a 1290 s (`roteiro-atual.json:91`), é um risco concreto.
- **Vídeo vertical.** `supremo.py:270-273` só troca para 1080×1920 se a fonte for
  mais alta que larga. Renderizar `Vertical` a partir de um roteiro 16:9 aciona o
  descasamento de `geoAnterior` (divergência 3) e o corte duro do
  `objectFit: "cover"` (`Camada.tsx:102`), sem nenhum preview.
- **Uma fonte só.** É o caso do projeto vivo (`roteiro-atual.json:16`,
  `"tela": null`). `Cena.tsx:120` devolve `null` para a camada de tela, então
  layouts `pip`, `split` e `split_diagonal` viram tela preta com a câmera no
  retângulo reduzido — `PainelBloco.tsx:99-104` avisa o usuário, mas os botões
  continuam clicáveis e o `roteiro` aceita o layout.
- **Cena muito curta.** `Video.tsx:37` garante o mínimo de 1 quadro, mas
  `Cena.tsx:33` garante `framesEntrada >= 1`: uma cena de 2 quadros com entrada de
  0,55 s nunca completa a transição. Pior, `Video.tsx:63` dá à cena ANTERIOR uma
  sobra de `ceil(0.55·fps)` quadros, que pode ser maior que a cena inteira que
  entra — as duas ficam vivas ao mesmo tempo o vídeo todo naquele trecho.
  `Overlay.tsx:23-28` monta `inputRange = [totalFrames - round(0.4·fps),
  totalFrames]`, que fica negativo para overlays com menos de 0,4 s: o texto já
  nasce sumindo.
- **Roteiro sem legendas.** `Video.tsx:150` só checa `roteiro.legendas` (objeto),
  e `Legenda.tsx:55` usa `legendas.palavras ?? []`; `Legenda.tsx:59` retorna
  `null` com zero grupos. Seguro. Mas a curva de música vira "sem voz nenhuma"
  (`musica.ts:31-36` deixa `temVoz` todo zero) e a trilha toca em volume cheio
  por cima da fala o vídeo inteiro.
- **`velocidade != 1`.** Além do bug 5: `Video.tsx:127` aplica `playbackRate` no
  `<Audio>` sem `preservePitch`, então a voz muda de tom. E `Timeline.tsx:228`
  calcula o limite de arraste ignorando a velocidade — dá pra arrastar a borda
  para além do fim real da fonte.
- **Roteiro reprocessado por cima de um editado.** `supremo.py:309-310` grava
  `roteiro.json` e sincroniza o estúdio. `/api/projetos-crus` (`servidor.mjs:147-169`)
  só oferece pastas SEM `roteiro.json`, o que hoje protege o fluxo do editor —
  mas `python motor/supremo.py preparar <nome>` pela linha de comando apaga
  qualquer edição sem perguntar.
- **Estilo é global, não por projeto.** `servidor.mjs:100-121` grava sempre em
  `config/estilo.json`, e `supremo.py:325` copia esse mesmo arquivo para o
  estúdio no momento do render. Mexer no tamanho da legenda de um projeto muda
  todos os outros.

---

## fora-de-escopo

Lido apenas como contexto, sem auditoria linha a linha: `estudio/editor/`
(`Editor.tsx`, `Timeline.tsx`, `Onda.tsx`, `Palco.tsx`, `Barra.tsx`,
`PainelBloco.tsx`, `PainelLegenda.tsx`, `PainelAudio.tsx`, `Processar.tsx`,
`api.ts`), `estudio/servidor.mjs`, `estudio/vite.config.mts`,
`motor/supremo.py`, `motor/roteirizar.py`, `motor/tratar.py`,
`motor/sincronizar.py`, `config/*.json`.

Não abertos nesta passagem: `motor/comum.py`, `motor/transcrever.py`,
`motor/ondas.py`, `estudio/editor/componentes/{controles,PainelTextos,Atalhos,
Diagnostico}.tsx`, `estudio/editor/estilos.css`, `estudio/editor/main.tsx`,
`estudio/tsconfig.json`.

Nada foi executado: não houve render, nem medição de tempo real de áudio/vídeo,
nem comparação de quadros entre preview e saída. Todas as conclusões acima vêm
de leitura de código e dos números presentes em `roteiro-atual.json`,
`estilo-atual.json`, `config/direcao.json` e `config/tratamento.json`.

Nenhum arquivo do projeto foi alterado. O único arquivo escrito foi este.
