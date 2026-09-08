# Pesquisa de stack — o que o ecossistema Remotion/FFmpeg/Python já resolve pronto

> Levantamento para não reinventar roda no SupremoCut. Cada item cita a documentação real lida,
> o que ele resolve especificamente no NOSSO projeto (com arquivo/linha quando dá) e o esforço de
> adoção. Onde não achei confirmação direta na doc oficial, está marcado "não confirmado".
>
> **Ponto de partida importante**: o projeto já usa bem uma fatia grande do que existe — Freeze,
> spring/interpolate, calculateMetadata, @remotion/media com a escolha correta de não usar
> OffthreadVideo, premountFor, NVENC no proxy, faster-whisper com VAD e CUDA, loudnorm, afftdn,
> acompressor, sincronia por correlação cruzada, ducking por palavra. Achados desse tipo estão
> anotados como "já resolvido — não mexer", porque o objetivo aqui é achar o que FALTA, não propor
> reescrever o que já funciona.
>
> Descoberta lateral que vale registrar: `@remotion/transitions`, `@remotion/captions` e
> `@remotion/zod-types` (+ `zod`) estão instalados em `estudio/package.json` mas **nenhum import
> deles aparece em `estudio/src` nem `estudio/editor`** (confirmado por grep). São dependências
> mortas hoje — o texto abaixo explica o que cada um faria SE fosse ligado, e por que o projeto já
> resolveu o mesmo problema por conta própria em quase todos os casos.

---

## 1. Pacotes @remotion/* — o que ainda não usamos

### 1.1 `@remotion/transitions` — instalado, não usado

Doc: https://www.remotion.dev/docs/transitions/ · https://www.remotion.dev/docs/transitions/transitionseries · https://www.remotion.dev/docs/transitions/presentations/fade

`<TransitionSeries>` anima entre DUAS CENAS INTEIRAS: `<TransitionSeries.Sequence>` para cada cena e `<TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:30})}/>` entre elas. Durante a transição os dois vídeos ficam sobrepostos e a timeline total encolhe pela duração da transição.

```tsx
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={40}><Letter color="#0b84f3">A</Letter></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 30 })} />
  <TransitionSeries.Sequence durationInFrames={60}><Letter color="pink">B</Letter></TransitionSeries.Sequence>
</TransitionSeries>
```

**Por que não adotar aqui**: `Cena` (`estudio/src/componentes/Cena.tsx`) não troca uma cena inteira pela outra — ela faz **morph de geometria** (`misturarGeometria(geoAnterior, geoAlvo, p)`), ou seja, o retângulo da PiP desliza/escala de uma posição pra outra dentro da MESMA composição. `TransitionSeries` não modela isso: ele cross-fada dois componentes React distintos, não interpola props de layout entre eles. A arquitetura atual (spring + `misturarGeometria` em `estudio/src/layouts.ts`) é o desenho certo pro caso "PiP muda de canto/tamanho", e não dá pra trocar por `TransitionSeries` sem perder o morph. As presentations (`fade()`, `slide()`, `wipe()`) só serviriam se algum dia vocês tiverem cenas que trocam de fonte de vídeo por completo (ex.: um B-roll entrando por cima) — nesse caso pontual, dá pra usar só o `<TransitionSeries.Overlay>` (não encolhe a timeline) sem reescrever o resto.

**Esforço**: G se fosse migrar o sistema de transição inteiro (não vale a pena); P se for só usar `Overlay` num caso pontual de B-roll.

### 1.2 `@remotion/captions` — instalado, não usado

Doc: https://www.remotion.dev/docs/captions/create-tiktok-style-captions · https://www.remotion.dev/docs/captions/caption

`createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})` agrupa tokens com timestamp em "páginas" de legenda, retornando `{pages: [{text, startMs, durationMs, tokens:[{text, fromMs, toMs, pageBreakAfter}]}]}`. Desde a v4.0.514 aceita `breakOnSilenceAfterMilliseconds` para forçar quebra de página em pausas longas (compara só os timestamps das legendas, não analisa o áudio).

**Por que não adotar aqui**: `agrupar()` em `estudio/src/componentes/Legenda.tsx` (linha 19) já faz exatamente isso — junta por `max_palavras`, pausa >0.6s ou pontuação — e devolve pro SEU tipo `Palavra`/`Grupo`, que os 7 presets (`hormozi`, `karaoke`, `neon`...) consomem diretamente. Trocar por `@remotion/captions` significaria converter `Palavra` → `Caption` (`text` com espaço embutido antes de cada palavra, formato sensível a whitespace) e depois `TikTokPage` → sua estrutura de novo, sem ganhar nenhum preset visual (esses são seus, não da lib). O único recurso novo de fato é `breakOnSilenceAfterMilliseconds`, que dá pra portar como um `if` a mais dentro do `agrupar()` atual sem trazer a dependência.

**Esforço**: G para adotar a lib inteira (não compensa); P para copiar só a ideia do `breakOnSilenceAfterMilliseconds` pro `agrupar()` existente.

### 1.3 `@remotion/zod-types` — instalado, não usado

Doc: https://www.remotion.dev/docs/zod-types

Fornece tipos Zod (`zColor()`, `zTextarea()`, `zMatrix()` etc.) que, quando usados no `schema` de uma `<Composition>`, fazem o **Remotion Studio** desenhar os controles certos (color picker, textarea) no painel de props em vez de campos de texto genéricos.

**Por que não adotar agora**: vocês já têm um editor próprio (`estudio/editor/*`) muito mais rico que o painel de props do Studio — com waveform, timeline de arraste, presets de legenda com preview de texto. O Studio (`supremo.py estudio`) é usado como preview técnico, não como editor de props. `zod-types` só valeria a pena se vocês quisessem abrir mão do editor custom pontualmente para prototipar um estilo novo direto no Studio.

**Esforço**: P, mas baixo retorno dado o editor custom já existente.

### 1.4 `@remotion/layout-utils` — `fitText()` / `measureText()`

Doc: https://www.remotion.dev/docs/layout-utils/fit-text · https://www.remotion.dev/docs/layout-utils/measure-text · https://www.remotion.dev/docs/layout-utils/best-practices

`fitText({text, withinWidth, fontFamily, fontWeight, textTransform})` devolve `{fontSize}` — o tamanho de fonte que faz o texto caber numa largura, medido de verdade no browser (`measureText()` por baixo). Precisa que a fonte já esteja carregada (`validateFontIsLoaded`, default `true` a partir da v5.0/v4.0.136) — se usar `@remotion/google-fonts`, esperar `waitUntilDone()` antes.

**O que resolve aqui, especificamente**: o tipo `Caixa` (`estudio/src/tipos.ts`, linha 141) é a tarja usada pra tapar texto queimado no vídeo original e escrever por cima "na língua certa" — e o próprio `motor/voz.py` documenta o problema que isso cria: *"Português fala mais longo que inglês"*. Hoje `Caixa.tamanho_texto` é um número fixo (`TARJA_PADRAO.tamanho_texto = 46`), então uma tradução mais longa que o original ESTOURA a caixa que devia cobri-lo — exatamente o cenário que `motor/dublar.py` produz em lote. `fitText()` resolve isso encolhendo a fonte pra caber na `Caixa.tamanho.largura` antes de renderizar, sem intervenção manual.

```tsx
import { fitText } from "@remotion/layout-utils";

const { fontSize } = Math.min(
  caixa.tamanho_texto,
  fitText({
    text: overlay.texto,
    withinWidth: (overlay.tamanho?.largura ?? 1) * width - 2 * padding,
    fontFamily: estilo.fonte.familia,
    fontWeight: caixa.peso,
    textTransform: caixa.caixa_alta ? "uppercase" : "none",
  }).fontSize,
);
```

**Esforço**: P — um cálculo a mais dentro de `estudio/src/componentes/Overlay.tsx`, sem nova dependência de pipeline.

### 1.5 `@remotion/paths` — `evolvePath()` e afins

Doc: https://www.remotion.dev/docs/paths · https://www.remotion.dev/docs/paths/evolve-path

Pacote sem dependências (`svg-path-properties`, `svg-path-reverse`, `svgpath`, `d3-interpolate-path` reescritos em API funcional/TS). `evolvePath(progress, path)` anima um `<path>` SVG do invisível ao completo: devolve `{strokeDasharray, strokeDashoffset}` pra aplicar no elemento.

```tsx
import { evolvePath } from "@remotion/paths";
const path = "M 0 0 L 100 0";
const evolution = evolvePath(0.5, path); // { strokeDasharray: '100 100', strokeDashoffset: 50 }
<path d={path} strokeDasharray={evolution.strokeDasharray} strokeDashoffset={evolution.strokeDashoffset} />
```

**O que resolve aqui**: seta/sublinhado animado sob as `palavras_chave` do sistema de legenda (o "grátis, desconto, hoje" de `PainelLegenda.tsx`), ou uma seta "arraste pra cima"/CTA que se desenha sozinha nos overlays tipo `marca`/`titulo`. Hoje esse tipo de destaque só existe via cor/escala da palavra (`Legenda.tsx`); um traço se desenhando por baixo é um recurso a mais que anúncios do gênero Hormozi usam bastante.

**Esforço**: P/M — SVG simples + `evolvePath` acionado por `interpolate(frame,...)`.

### 1.6 `@remotion/shapes`

Doc: https://www.remotion.dev/docs/shapes/

Componentes prontos de forma SVG — a documentação cita `Circle`, `Triangle`, `Rect` e `Star` (não confirmei a lista completa além desses quatro). Resolveria formas geométricas de fundo/decoração sem escrever `<svg>` na mão.

**Nesse projeto**: uso baixo — a estética atual é câmera+tela+legenda, não motion graphics com formas soltas. Só relevante se decidirem colocar elementos gráficos decorativos atrás do texto de overlay.

**Esforço**: P, prioridade baixa.

### 1.7 `@remotion/animation-utils`

Doc: https://www.remotion.dev/docs/animation-utils/ · https://www.remotion.dev/docs/animation-utils/make-transform

`makeTransform([rotate(45), translate(50,50)])` monta a string CSS `transform` a partir de funções tipadas (`rotate`, `translate`, `scale`, `skew`, `matrix3d`, cada uma com variantes X/Y/Z/3d), em vez de template string na mão.

```tsx
import { makeTransform, rotate, translate } from "@remotion/animation-utils";
const transform = makeTransform([rotate(45), translate(50, 50)]);
// => "rotate(45deg) translate(50px, 50px)"
```

**Nesse projeto**: `Camada.tsx` já monta `transform: \`scale(${zoom}) translate(${panX}%, ${panY}%)\`` na mão, e `Cena.tsx` faz o mesmo com `translate/scale`. Trocar por `makeTransform` é só clareza de código (evita erro de vírgula/unidade), não resolve nenhuma dor funcional nova.

**Esforço**: P, é refactor de legibilidade — baixa prioridade.

### 1.8 `@remotion/noise`

Doc: https://www.remotion.dev/docs/noise/noise-2d (`noise3D`/`noise4D` são funções irmãs do mesmo pacote, mesmo padrão de API)

`noise2D(seed, x, y)` devolve um valor determinístico entre -1 e 1 (usa a lib `simplex-noise` por baixo) — mesmo seed + mesmo x/y = mesmo resultado sempre, o que importa pra um render ser reproduzível frame a frame (diferente de `Math.random()`, que quebraria a consistência entre frames renderizados fora de ordem).

**O que resolve aqui**: grão de filme sutil sobre o vídeo (dá um acabamento menos "digital cru" a anúncio vertical), ou variação orgânica no brilho do "flash" de `Cena.tsx` (hoje o flash é um `interpolate` puramente determinístico e mecânico — um toque de `noise2D` no brilho quebraria a linearidade sem ficar aleatório entre frames).

**Esforço**: P.

### 1.9 `@remotion/media-utils` — `visualizeAudio()` / `getAudioData()`

Doc: https://www.remotion.dev/docs/visualize-audio · https://www.remotion.dev/docs/get-audio-data · https://www.remotion.dev/docs/audio/visualization

`useAudioData(staticFile('audio.mp3'))` carrega os dados; `visualizeAudio({audioData, frame, fps, numberOfSamples: 16})` devolve um `number[]` (0 a 1) com a energia por faixa de frequência do frame atual — usado pra desenhar barras de espectro.

```tsx
const audioData = useAudioData(staticFile("music.mp3"));
const visualization = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16 });
// [0.22, 0.1, 0.01, ...] — mapear cada valor pra altura de uma barra
```

Atenção: `numberOfSamples` precisa ser potência de 2, e o valor default de `optimizeFor` muda de `"accuracy"` para `"speed"` na v5.0 (hoje é `"accuracy"`).

**O que resolve aqui**: um espectro/equalizador reagindo à música de fundo (`roteiro.musica`) ou à própria voz — recurso visual comum em anúncio vertical pra preencher momentos sem legenda. É DIFERENTE do `ondas.py`/`Onda.tsx` que já existe: aquilo é a forma de onda ESTÁTICA da timeline do EDITOR (pré-calculada em Python, desenhada em canvas pra navegação); isto aqui seria um visual DENTRO do vídeo final, calculado por frame a partir do áudio decodificado no browser/Chromium do render.

**Esforço**: M — precisa decidir o visual e testar custo de decodificação em render longo.

### 1.10 `@remotion/animated-emoji`

Doc: https://www.remotion.dev/docs/animated-emoji/ · https://www.remotion.dev/docs/animated-emoji/animated-emoji

Componente `<AnimatedEmoji emoji="blush" />` que toca um vídeo (webm/mp4, resoluções 512/1024/2048px via prop `scale`) dos emojis animados do Google Fonts. **Não vem com os assets** — é preciso copiar os vídeos da pasta `public` do repo `remotion-dev/animated-emoji` para o `public` do projeto.

**O que resolve aqui**: reação/emoji animado como elemento de CTA ("😍", "🔥", "👇") sobre o vídeo — um recurso batido em anúncio de UGC/vertical que hoje o projeto não tem nenhum jeito nativo de fazer (teria que ser vídeo solto importado). Baixo custo de implementação, alto reconhecimento visual do formato.

**Esforço**: P — copiar assets + `<AnimatedEmoji>` num `Overlay` novo do tipo `emoji`.

### 1.11 `@remotion/lottie`, `@remotion/rive`, `@remotion/gif`

Doc: https://www.remotion.dev/docs/lottie · https://www.remotion.dev/docs/third-party

`@remotion/lottie` toca animações do After Effects exportadas via Lottie (precisa também de `lottie-web`); `@remotion/rive` toca animações Rive; `@remotion/gif` toca GIF como componente Remotion. Os três resolvem o mesmo tipo de dor: **motion assets prontos** (ícone de "arraste pra cima", logo animado, sticker) sem precisar recriar a animação em spring/interpolate na mão.

**Nesse projeto**: relevância real só se algum dia vocês importarem uma vinheta/logo animado feito fora (After Effects/Rive) em vez de tudo nascer como componente React. Hoje isso não existe no fluxo — registrar como opção pronta pro dia em que precisar, não como lacuna urgente.

**Esforço**: P cada um, mas sem uma dor concreta hoje.

### 1.12 `@remotion/three` / `@remotion/skia`

Doc: https://www.remotion.dev/docs/three · https://www.remotion.dev/docs/skia

`@remotion/three` expõe `<ThreeCanvas>` pra usar `useCurrentFrame()` dentro de uma cena React Three Fiber (3D). `@remotion/skia` integra React Native Skia (canvas de alta performance, efeitos tipo blur/shader). Ambos ativamente mantidos (versões 4.0.47x/4.0.50x confirmadas no npm).

**Nesse projeto**: nicho — a peça é câmera + tela + legenda + tarja, 2D o tempo todo. Só valeria a pena para um mockup 3D de produto ou efeito de canvas avançado (ex.: distorção de vidro). Não é prioridade.

**Esforço**: G se algum dia entrar 3D no formato do anúncio.

### 1.13 `@remotion/tailwind`

Doc: https://www.remotion.dev/docs/tailwind/tailwind · https://www.remotion.dev/docs/tailwind/enable-tailwind

`enableTailwind()` é um override de webpack (chamado no `remotion.config.ts`) que liga Tailwind CSS dentro do bundle do Remotion.

**Nesse projeto**: toda a estilização de `Legenda.tsx`/`Camada.tsx`/`Cena.tsx` é objeto de style inline com contas em px relativas a 1080p (`escala = height/1080`) — um padrão que Tailwind não facilita (as classes de Tailwind são valores fixos, não expressões calculadas por frame). Migrar geraria mais atrito que ganho aqui.

**Esforço**: G migrar, benefício baixo — não recomendado agora.

### 1.14 `@remotion/renderer` — APIs de render programático

Doc: https://www.remotion.dev/docs/renderer · https://www.remotion.dev/docs/renderer/render-media · https://www.remotion.dev/docs/renderer/select-composition · https://www.remotion.dev/docs/renderer/render-still

Hoje `motor/supremo.py` chama a **CLI** (`node .../remotion-cli.js render ...`) via `subprocess`, não a API programática. `renderMedia()`/`selectComposition()`/`renderStill()` do `@remotion/renderer` fariam a mesma coisa dentro de um processo Node só seu, com acesso direto a callbacks de progresso (`onProgress`) e ao objeto de composição já resolvido — hoje o progresso do render só chega como texto no stdout do processo filho.

**Vale a pena?** Só se vocês quiserem uma barra de progresso de render mais rica no editor (`cmd_render` hoje só imprime um `passo(...)` e espera o processo terminar) ou orquestrar renders em fila a partir de Node em vez de Python+CLI. Não é uma lacuna urgente — a CLI já expõe `--concurrency`, `--hardware-acceleration`, `--media-cache-size-in-bytes` como flags, que é o que os itens de performance abaixo precisam.

**Esforço**: G (trocar Python-orquestra-CLI por um processo Node dedicado) — só compensa se progresso de render granular virar prioridade de produto.

### 1.15 `@remotion/install-whisper-cpp` — não relevante aqui

Doc: https://www.remotion.dev/docs/install-whisper-cpp/convert-to-captions

Instala/baixa binários do whisper.cpp e converte a saída em `Caption[]` via `toCaptions()`. **Não se aplica**: vocês já rodam `faster-whisper` `large-v3` na RTX 3070 Ti com CUDA/float16 (`motor/transcrever.py`), que é mais rápido e mais preciso em GPU do que whisper.cpp (que é otimizado pra rodar sem GPU dedicada, em CPU/Metal). Trocar seria downgrade.

### 1.16 `@remotion/lambda` — não relevante aqui

Doc: https://www.remotion.dev/docs/lambda · https://www.remotion.dev/docs/hardware-acceleration ("Estas opções não são suportadas no Remotion Lambda... porque esses serviços de nuvem não suportam aceleração de hardware")

Distribui o render em Lambdas da AWS, cada uma renderizando um pedaço do vídeo. **Não se aplica**: todo o desenho do SupremoCut é rodar 100% local, aproveitando a GPU da própria máquina (CUDA no Whisper, NVENC no FFmpeg) — e a própria doc do Remotion confirma que Lambda **não tem aceleração de hardware**, ou seja, migrar pra nuvem jogaria fora justamente a vantagem que vocês têm (RTX 3070 Ti local) em troca de CPU genérica de Lambda. Métrica de custo também piora: hoje o custo marginal de cada render é zero (hardware já pago).

### 1.17 `@remotion/studio` — já em uso via `@remotion/cli`

Doc: https://www.remotion.dev/docs/cli/ · https://www.remotion.dev/docs/studio

`motor/supremo.py estudio <nome>` já chama `remotion studio` (comando exposto pelo binário do `@remotion/cli`, que embute o `@remotion/studio`). Não é uma lacuna — só registrando que "abrir o Studio" e "usar `@remotion/studio`" são a mesma coisa que vocês já fazem hoje; não precisa instalar nada a mais.

---

## 2. Núcleo do Remotion — recursos talvez subusados

| Recurso | Já usado? | Onde no código | Observação |
|---|---|---|---|
| `spring()` / `interpolate()` | Sim, extensivamente | `Cena.tsx`, `Legenda.tsx` | Idiomático — configs de `damping/stiffness/mass` vêm de `estilo.animacao`, correto. |
| `Freeze` | Sim | `Video.tsx` linha 135 | Usado exatamente pro caso documentado (congela imagem, áudio segue). |
| `Sequence` + `premountFor`/`styleWhilePremounted` | Sim | `Video.tsx` linha 108-119 | Padrão de pré-montagem pra evitar flash no corte — isso é literalmente a técnica recomendada pela doc de [Premounting](https://www.remotion.dev/docs/player/premounting). |
| `calculateMetadata()` | **Sim** | `Root.tsx` linha 33 | Já calcula `durationInFrames/fps/width/height` a partir do `roteiro`. Nada a fazer aqui. |
| `staticFile()` + `getRemotionEnvironment().isRendering` | Sim | `Camada.tsx`, `Video.tsx` | Branch preview-leve vs. arquivo-de-qualidade já é exatamente o padrão certo. |
| `Easing` (https://www.remotion.dev/docs/easing) | **Não, num ponto específico** | `Cena.tsx` linha 54 | O `const linear = interpolate(frame, [0, framesEntrada], [0, 1], {extrapolateLeft:"clamp", extrapolateRight:"clamp"})` usado nos casos `fade` e `zoom_cruzado` não recebe nenhuma `easing` — é interpolação linear pura. Passar `easing: Easing.inOut(Easing.ease)` (ou um `Easing.bezier(...)`) deixaria o fade menos mecânico sem tocar em mais nada. **Esforço P.** |
| `<Series>` (https://www.remotion.dev/docs/series) | Não | — | `Video.tsx` monta a timeline na mão com um `cursor` acumulado (linha 56-95) porque precisa de `durComSobra` variável por transição (o "colchão" de 4 frames ou a duração da transição) e `premountFor` por cena — coisas que `<Series.Sequence>` não expõe com esse nível de controle. **Não migrar**: o cálculo manual atual é o desenho certo pra esse requisito específico. |
| `<Loop>` (https://www.remotion.dev/docs/loop) | Não | — | Só faria sentido combinado com `@remotion/noise` pra um fundo com grão em loop, ou pra repetir um sticker/emoji de CTA. Não é dor hoje. |
| `prefetch()` (https://www.remotion.dev/docs/prefetch) | Não | `Palco.tsx` | O Player usa `premountFor` (via `Sequence`) que só olha a PRÓXIMA cena. Ao clicar longe na timeline (`aoIrPara` em `Timeline.tsx`), o Player pode ter que decodificar um vídeo ainda não montado — é o cenário que `prefetch()` existe pra resolver (`prefetch(staticFile(...))` retorna uma Promise que resolve quando o asset já baixou/decodificou). **Esforço M**: chamar `prefetch` pros arquivos da cena mais próxima do clique antes de navegar. |
| `useBufferState()` (https://www.remotion.dev/docs/use-buffer-state) | Não | — | Daria um spinner/estado de buffering explícito no Player durante o carregamento acima. Baixa prioridade sozinho, natural de acrescentar junto com o item anterior. |
| `delayRender()`/`continueRender()` | Não, e está certo não usar | — | Existe pra esperar fetch de dados assíncrono ANTES do primeiro frame. O SupremoCut não busca nada em tempo de render — o roteiro/estilo já chegam prontos via `defaultProps`. Não é uma lacuna, é a arquitetura certa evitando a necessidade dessa API. |
| `offthreadVideoThreads` (Config) | Não se aplica | — | Esse flag só afeta `<OffthreadVideo>` do núcleo. O projeto usa `<Video>` de `@remotion/media` **deliberadamente** (comentário em `Camada.tsx` linha 91-98 explica por quê), então esse knob específico não existe pro seu caso — o equivalente de performance pra `@remotion/media` é o cache descrito abaixo. |
| Cache de mídia decodificada (https://www.remotion.dev/docs/media/cache) | Não configurado (usa default) | `remotion.config.ts` | `@remotion/media` cacheia vídeo/áudio decodificado; default é até 50% da RAM disponível (mínimo 500MB, máximo 20GB), **por render, compartilhado entre todas as `<Video>`/`<Audio>`**. Com `Config.setConcurrency(12)` já configurado, vale testar se travar esse teto (`Config.setMediaCacheSizeInBytes(N)` — nome exato da opção no config file **não confirmado**; a API confirmada é o parâmetro `mediaCacheSizeInBytes` de `renderMedia()`/`selectComposition()` e a flag `--media-cache-size-in-bytes` da CLI) evita disputa de RAM entre os 12 processos simultâneos. **Esforço P** — é testar um flag. |
| `hardwareAcceleration` (render final) | **Não** | `remotion.config.ts` | Ver item 1 da lista de maior retorno abaixo — é o achado mais importante desta seção. |

### Hardware acceleration no render final — o achado principal do núcleo

Doc: https://www.remotion.dev/docs/hardware-acceleration · https://www.remotion.dev/docs/cli/render#--hardware-acceleration

Hoje `remotion.config.ts` usa `Config.setCodec("h264")` + `Config.setCrf(17)` — isso é **encode via CPU (libx264)**. O NVENC só entra no pipeline de vocês na etapa de PROXY (`motor/tratar.py`, `h264_nvenc` com preset `p5`/`p1`), nunca no render final do Remotion.

Desde a v4.0.236 (H.264/H.265) e, no Windows, desde a **v4.0.484** especificamente para NVENC (vocês estão na v4.0.517 — dá certo), existe:

```ts
// remotion.config.ts
Config.setHardwareAcceleration("if-possible");
```

ou via CLI: `npx remotion render MyComp --codec h264 --hardware-acceleration if-possible --video-bitrate=8M`

**Duas pegadinhas documentadas que precisam entrar no teste**:
1. `crf` **não é compatível** com encoders acelerados — a doc manda usar `--video-bitrate` no lugar (ex.: `8M` reproduz tamanho de arquivo parecido ao software encoding em Full HD; pro vertical 1080×1920 o pixel count é o mesmo, então `8M` é um bom ponto de partida pra testar).
2. Confirmar que está realmente acelerando: rodar com log verboso e procurar `Encoder: h264_nvenc, hardware accelerated: true`.

**Esforço**: M (não é só trocar uma linha — exige re-testar qualidade em CRF-equivalente via bitrate, e comparar tempo de render antes/depois), mas o ganho de velocidade em CADA render final é o tipo de coisa que se paga rápido num fluxo de "editar → exportar → repetir" de anúncio.

---

## 3. Bibliotecas JS/React de terceiros

O editor próprio (`estudio/editor/*`) já é surpreendentemente maduro — antes de sugerir qualquer lib, vale registrar o que ele **já resolve sozinho** pra não sugerir downgrade:

- **Waveform**: `estudio/editor/componentes/Onda.tsx` desenha em `<canvas>` só a região visível (não a timeline inteira), remapeando cada pixel pro clipe de áudio correto e pro tempo dentro da FONTE — isso é mais específico do que `wavesurfer.js` resolveria, porque o wavesurfer não conhece o modelo de "vários clipes remapeados pra uma fonte com offset". **`wavesurfer.js` não compensa aqui** — trocaria uma solução já correta por uma genérica que exigiria os mesmos cálculos por cima mesmo assim.
- **Virtualização de lista grande**: `PainelLegenda.tsx` (linha 265-269) já evita renderizar as N milhares de palavras transcritas de uma vez — filtra pra só as que estão a `-4s/+8s` da agulha e corta em 24 (`.slice(0, 24)`). Isso é mais simples e mais correto pro caso de uso do que colocar `react-window`/`react-virtualized` ali (esses resolveriam "lista enorme, todas visíveis, roladas" — não é o padrão de interação aqui, que é "só o que está perto da agulha"). **Não precisa de lib de virtualização.**
- **Timeline de corte com arraste/ímã**: `Timeline.tsx` já implementa os dois modos de arraste (mover corte vs. aparar), snapping na agulha e nas emendas, e zoom com Ctrl+roda — tudo com semântica exata do modelo `fonte_inicio/duracao`. Uma lib genérica tipo `@xzdarcy/react-timeline-editor` não conhece esse modelo (ela pensa em "tracks" e "actions" genéricos) — adotar seria reescrever a lógica de arraste dentro dos hooks da lib, não economizar trabalho.

Onde HÁ uma lacuna real:

### 3.1 `react-colorful` — o gap real: alpha/rgba no controle de cor

Doc: https://github.com/omgovich/react-colorful (README lido) · pacote `react-colorful` no npm

**Achado concreto**: o componente `Cor` em `estudio/editor/componentes/controles.tsx` (linha 60-70) é:
```tsx
<input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} />
<input type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />
```
`<input type="color">` só aceita `#RRGGBB` — descarta alpha. Só que `Caixa.cor` (tipo em `estudio/src/tipos.ts` linha 143) documenta explicitamente: *"Aceita rgba pra deixar semitransparente"*, e é usado no controle de cor da tarja (`PainelTextos.tsx` linha 195-198 usa o mesmo componente `Cor` pra `cor_borda`). Ou seja: hoje, se alguém clicar no seletor nativo pra ajustar a cor da tarja, ele **não consegue preservar/editar a transparência** — só dá pra escrever `rgba(...)` manualmente na caixa de texto ao lado, sem preview visual do resultado, e o próximo clique no swatch nativo reverte pra opaco.

`react-colorful` (3,1 KB, zero dependências) exporta `HexAlphaColorPicker` (formato `"#ffffff88"`) e `RgbaStringColorPicker` (formato `"rgba(255, 255, 255, 1)"`), além de `HexColorInput` com prop `alpha` para o campo de texto:
```tsx
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
<HexAlphaColorPicker color={valor} onChange={aoMudar} />
<HexColorInput color={valor} onChange={aoMudar} alpha prefixed />
```

**Esforço**: P — troca só o componente `Cor`, sem tocar no resto do editor.

### 3.2 O "editor de curvas" já existe pronto — de graça, sem instalar nada

Doc: https://www.remotion.dev/timing-editor

O próprio Remotion publica um **Timing Editor** visual (spring/easing/interpolate) hospedado no site oficial. Antes de considerar embutir um `bezier-easing-editor` (React+SVG, existe e funciona — https://github.com/gre/bezier-easing-editor) dentro do editor pra ajustar `mola_rigidez`/`mola_amortecimento` de `config/estilo.json` visualmente, vale usar essa ferramenta pronta pra achar os valores e só então colar o número — evita adotar E manter uma dependência a mais no bundle do editor. Só valeria embutir uma lib de curva de verdade se o objetivo virasse "deixar o cliente final ajustar a animação", o que não parece ser o caso (quem edita `estilo.json` é vocês).

**Esforço**: P (é só usar a ferramenta) para o caso atual; G se decidirem embutir um editor de curva dentro do produto.

### 3.3 Fontes variáveis — `@remotion/fonts`

Doc: https://www.remotion.dev/docs/fonts-api/ · https://www.remotion.dev/docs/fonts

Fontes variáveis (`.woff2` com múltiplos eixos) carregam pelo mesmo `@remotion/fonts` que qualquer fonte local — os eixos (peso, largura) se controlam depois via CSS `font-variation-settings` no `style`. **Relevância aqui**: `Estilo.fonte.peso` (`estudio/src/tipos.ts`) hoje é um número fixo mapeado pra um `font-weight` de fonte estática; se a fonte de marca for trocada por uma variável, dá pra animar o peso da palavra ativa continuamente (300→900 durante o "pop") em vez de pular entre cortes de peso fixos que a fonte tem. É refinamento visual, não uma dor documentada hoje.

**Esforço**: M (depende de ter/comprar uma fonte variável da marca).

### 3.4 Não recomendados para este projeto

- **`wavesurfer.js`**: ver acima — o canvas próprio já resolve melhor o caso específico de vocês.
- **`react-window`/`react-virtualized`**: ver acima — o filtro por proximidade da agulha já resolve.
- **LUT/color grading em canvas ou CSS** (ex.: aplicar arquivos `.cube` via WebGL): hoje toda a correção de cor (`config/tratamento.json`, presets `natural_plus`/`quente`/`frio_cine`) já acontece no FFmpeg, gravada no arquivo final — fazer color grading em CSS/canvas no lado do Remotion duplicaria a responsabilidade e criaria dois lugares pra manter "a cor certa". Não vale.

---

## 4. FFmpeg / Python — filtros e técnicas ainda não usadas

Contexto do que **já está em produção** (`config/tratamento.json`, `motor/tratar.py`, `motor/dublar.py`): `highpass`, `afftdn` (nr/nf/tn), `adeclick`, `agate`, `equalizer`, `acompressor`, `alimiter`, `loudnorm` (I/TP/LRA, inclusive um segundo passo em `dublar.py` linha 151), `eq` (contrast/brightness/saturation/gamma), `unsharp`, `colorbalance`, `curves`, `scale`+`crop` (lanczos/fast_bilinear), `atempo`, `adelay`, `amix`, `anullsrc`, `h264_nvenc` com fallback automático pra `libx264` se a NVENC falhar.

### 4.1 `silenceremove` / `silencedetect` — provavelmente não precisa

Doc consultada via múltiplas fontes que citam a doc oficial do FFmpeg (`ffmpeg-filters.html#silenceremove`, seção 8.108).

Sintaxe real: `silenceremove=start_periods=1:start_duration=1:start_threshold=-60dB:stop_periods=1:stop_duration=1:stop_threshold=-60dB` (para remover silêncio no MEIO do áudio, `stop_periods` negativo faz o filtro reiniciar a detecção). `silencedetect=noise=-30dB:duration=0.5` só reporta (via log) onde há silêncio, sem cortar.

**Por que provavelmente não precisa aqui**: `roteirizar.trechos_com_fala()` (`motor/roteirizar.py` linha 47) já faz corte de silêncio, só que a partir dos **gaps entre palavras do Whisper** — que é uma fonte de verdade melhor que detecção de energia de áudio pura (`silenceremove` cortaria por threshold de dB, que erra em cenas com ruído de fundo alto mas sem fala, ou corta no meio de uma respiração/pausa retórica que o Whisper sabe que faz parte da frase). Não recomendo trocar. **Onde poderia complementar**: detectar silêncio no material BRUTO antes mesmo de transcrever, pra pular blocos longos de silêncio absoluto e economizar tempo de transcrição em gravações com muito "morto" no início/fim — um uso pontual de `silencedetect` só pra log, não pra corte.

**Esforço**: P se for só esse uso pontual de otimização; não recomendado como substituto do corte atual.

### 4.2 `arnndn` — denoise por rede neural (RNN)

Doc: FFmpeg filter reference (`af_arnndn`) + modelos em https://github.com/richardpl/arnndn-models

Sintaxe: `arnndn=m='caminho/para/modelo.rnnn'` (alias `model=`), com `mix` (0 a 1, opcional) controlando a mistura entre sinal processado e original — mais próximo de 1 é redução mais agressiva. Precisa de um arquivo `.rnnn` externo (o `std.rnnn`, herdado do RNNoise original do Xiph, é o mais comum).

**O que resolve aqui que `afftdn` não resolve**: `afftdn` (já usado no preset `voz_limpa`) é redução espectral clássica — boa pra ruído estacionário (ventilador, chiado de linha), mas historicamente deixa mais artefato em ruído não estacionário (eco de sala, teclado ao fundo, barulho de rua variável). `arnndn` é um modelo treinado especificamente pra voz e costuma limpar esse tipo de ruído variável com menos robotização da voz. Como `config/tratamento.json` já é um sistema de presets nomeados de string de filtro, dá pra literalmente acrescentar um preset `"neural"` na lista sem tocar em `tratar.py`:

```json
"neural": "highpass=f={corte_grave_hz},arnndn=m='modelos/std.rnnn',adeclick,equalizer=f=220:t=q:w=1.2:g=-2.5,acompressor=threshold=-18dB:ratio=3:attack=8:release=180:makeup=2,alimiter=limit=0.96,loudnorm=I={alvo_loudness_lufs}:TP={pico_maximo_db}:LRA=11"
```

(baixar `std.rnnn` é uma ação manual de vocês — arquivo de modelo de terceiro, não algo pra automatizar sem revisão).

**Esforço**: P — um preset novo de string, reaproveitando a arquitetura que já existe.

### 4.3 `loudnorm` em dois passos linear — mais precisão, não mais um preset

Doc consultada citando a sintaxe oficial do `loudnorm`.

Hoje `loudnorm=I={alvo}:TP={pico}:LRA=11` roda em UM passo só (modo dinâmico do próprio filtro, que estima e aplica na mesma passada). Dois passos é: (1) medir com `-af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -` e capturar `input_i/input_tp/input_lra/input_thresh/target_offset` do JSON no stderr; (2) aplicar de novo passando essas medidas com `linear=true`:
```
loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-27.61:measured_TP=-4.47:measured_LRA=18.06:measured_thresh=-39.20:offset=0.58:linear=true
```
`linear=true` desliga a parte de compressão dinâmica do filtro e aplica só um ganho constante — preserva mais a dinâmica original do que o modo de passo único.

**Vale a pena?** Only marginal aqui: o texto que passa por `loudnorm` já passou por `acompressor`+`alimiter` antes na cadeia (`voz_limpa`), que já comprime a dinâmica de propósito (é voz de anúncio, dinâmica comprimida é o efeito desejado, não um problema a evitar). Dois passos importaria mais se o objetivo fosse preservar dinâmica de música ou masterização — não é o caso do preset de voz.

**Esforço**: M (precisa rodar FFmpeg duas vezes e fazer parsing do JSON) para um ganho provavelmente inaudível no caso de uso atual — prioridade baixa.

### 4.4 `sidechaincompress` — ducking automático (complemento, não substituto)

Doc: FFmpeg filter reference (`af_sidechaincompress`), confirmada via exemplos que citam a sintaxe oficial.

```
ffmpeg -i musica.mp3 -i voz.wav -filter_complex \
"[1:a]asplit[sc][mix];[0:a][sc]sidechaincompress=threshold=0.02:ratio=8:attack=50:release=400[ducked];[ducked][mix]amix=inputs=2:duration=first" saida.wav
```
O sidechain usa o volume de UM stream (voz) pra controlar o ganho de OUTRO (música) — quando a voz fica alta, a música abaixa sozinha, e sobe de volta com o `release`.

**Por que já está resolvido melhor aqui**: `musica.ts` (`curvaDeVolume`) já calcula uma curva de volume **por palavra transcrita**, não por energia de áudio — ou seja, o ducking de vocês é exato no tempo (sabe onde a fala COMEÇA e TERMINA de verdade, palavra a palavra) em vez de reagir a threshold de amplitude, que teria falso positivo com ruído de respiração ou falso negativo em trecho de fala baixa. `sidechaincompress` seria uma REGRESSÃO de precisão para o caso "vídeo com transcrição". Onde ele ganharia: música de fundo reagindo a áudio que NÃO tem transcrição — ex.: risada, aplauso, efeito sonoro do jogo/tela gravada — que hoje não abaixa a música porque não vira palavra. Se isso virar uma reclamação real, `sidechaincompress` complementaria (não substituiria) a curva atual.

**Esforço**: M, só se a lacuna de "som sem transcrição não abaixa a música" aparecer na prática.

### 4.5 `dynaudnorm` — não recomendado para voz de anúncio

Doc: FFmpeg filter reference + fontes que citam parâmetros oficiais (`framelen`/`f`, `gausssize`/`g`, `maxgain`/`m`, default `f=500`, `g=31`).

`dynaudnorm=f=150:g=15:m=5` normaliza volume em janelas curtas, adaptando ganho quadro a quadro. **Por que não**: em voz falada, `gausssize` baixo (necessário pra reagir rápido) tem efeito "respiração" de volume documentado (pump/breathing) — e vocês já têm `loudnorm` (padrão EBU R128, alvo fixo e estável) fazendo o trabalho de normalização de forma mais previsível pra locução. Trocar seria pior pro caso de uso.

### 4.6 `colorchannelmixer` — grading criativo pontual

Doc: FFmpeg filter reference, sintaxe de 16 parâmetros confirmada (`rr:rg:rb:ra:gr:gg:gb:ga:br:bg:bb:ba:ar:ag:ab:aa`).

```
colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131   # sepia
colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3                     # preto e branco
```
**Onde encaixaria**: `config/tratamento.json` já tem uma seção `cor` com presets nomeados (`natural_plus`, `quente`, `frio_cine`, `cru`) exatamente no formato "string de filtro" — um preset `"pb"` ou `"vintage"` usando `colorchannelmixer` cairia no mesmo padrão sem exigir código novo, só mais uma entrada no JSON. Baixa prioridade (é estético, não resolve dor), mas o esforço é quase zero dado que a arquitetura de presets já existe.

**Esforço**: P.

### 4.7 `unsharp` — já usado; `vidstabdetect`/`vidstabtransform` — estabilização

Doc: `vid.stab` + exemplos que citam a sintaxe (dois passos, como o `loudnorm`).

```
# passo 1 — detectar
ffmpeg -i bruto.mp4 -vf vidstabdetect=shakiness=10:accuracy=15 -f null -
# passo 2 — aplicar
ffmpeg -i bruto.mp4 -vf "vidstabtransform=smoothing=30:input=transforms.trf,unsharp=5:5:0.8" -c:a copy estabilizado.mp4
```
`shakiness` (1-10) mede o quanto a câmera treme; `smoothing` define quantos frames (×2+1) entram no filtro passa-baixa da trajetória; `zoom`/`optzoom` compensam a borda preta que aparece ao estabilizar.

**O que resolve aqui**: câmera de webcam segurada na mão ou notebook tremendo na mesa — cenário real pra criador solo gravando anúncio. Hoje `motor/tratar.py` não tem nenhum tratamento de estabilização; se o material bruto vier tremido, o `zoom`/`foco` já configurado na cena SOMARIA tremedeira à tremedeira. Precisaria rodar ANTES da correção de cor no pipeline de `preparar_video()`, como uma etapa condicional (o processo é lento e nem toda gravação de webcam tremula, então vale ser opt-in por config, não automático).

**Esforço**: M — nova etapa de dois passos no pipeline de vídeo, precisa de heurística ou flag manual pra saber quando vale a pena rodar (custa tempo de CPU real, `vid.stab` não acelera em GPU).

### 4.8 `minterpolate` — frame interpolation via FFmpeg (alternativa mais fraca ao RIFE)

Doc: FFmpeg filter reference, sintaxe confirmada.

```
ffmpeg -i input.mp4 -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" output.mp4
```
`mi_mode=mci` (motion compensated interpolation) com `mc_mode=aobmc` é o modo de melhor qualidade da família, mas ainda assim baseado em block-matching clássico (não rede neural) — mais rápido que RIFE, qualidade inferior em movimento complexo (a doc do próprio `minterpolate` é conhecida por artefatos em bordas com muito movimento). **Recomendação**: usar RIFE (seção 5) para o caso de slow-motion de destaque; `minterpolate` só se a etapa precisar ser MUITO mais rápida que uma rede neural e a qualidade em movimento simples (fala parada, tela estática) for aceitável.

**Esforço**: P (é um filtro só), mas RIFE entrega mais qualidade pro mesmo objetivo — ver seção 5.

### 4.9 `scdet` — detecção de corte de cena

Doc: FFmpeg filter reference, parâmetros `threshold`/`t` (0-100, default 10, faixa útil 8-14) e `sc_pass`/`s` confirmados.

```
ffmpeg -i input.mp4 -vf "scdet=t=10,metadata=mode=print:key=lavfi.scd.score" -f null /dev/null
```
Marca metadata `lavfi.scd.score`/`lavfi.scd.mafd` por frame — detecta troca abrupta de conteúdo visual (corte de câmera, troca de slide na tela gravada).

**O que resolve aqui, potencialmente**: hoje `motor/roteirizar.py` decide troca de layout por PALAVRA-CHAVE no texto falado (`gatilhos.mostrar_tela`/`voltar_pra_camera`) e por tempo fixo (`trocar_layout_a_cada`) — não olha o conteúdo visual. Em gravação de tela, `scdet` poderia detectar quando o usuário troca de janela/aba SOZINHO (sem precisar que a pessoa fale "agora vou mostrar"), virando um terceiro sinal pro "diretor" além de texto e tempo. É uma ideia de melhoria de produto real, não uma dor crítica hoje — o sistema de gatilhos por palavra já funciona.

**Esforço**: G — exigiria rodar `scdet` sobre o bruto, ler os metadados de volta (via `ffprobe`/`showinfo` redirecionado a um log, não trivial de extrair como o loudnorm JSON) e ensinar `decidir_layouts()` a consumir um terceiro sinal.

### 4.10 `zscale` — não relevante aqui

Doc: FFmpeg filter reference. `zscale` existe pra conversão de espaço de cor/HDR→SDR com tone mapping (`zscale=transfer=linear,tonemap=clip,zscale=transfer=bt709`), coisa que o `scale` comum não faz.

**Por que não se aplica**: todo o material de entrada é webcam/gravação de tela padrão SDR (yuv420p, o próprio `tratar.py` já força `-pix_fmt yuv420p`). Não há footage HDR no fluxo. `zscale` só entraria em cena se algum dia uma câmera gravasse em HDR/HLG — não é o caso hoje.

### 4.11 NVENC — ajuste fino no que já existe

Doc: opções do encoder `h264_nvenc` (preset `p1`-`p7`, `tune`, `multipass`, `rc-lookahead`) confirmadas via múltiplas fontes que citam a documentação/ajuda do próprio FFmpeg.

`tratar.py` já usa corretamente a escala `p1` (mais rápido, preview) / `p5` (proxy) — isso bate com a doc (`p1`=mais rápido/pior qualidade → `p7`=mais lento/melhor qualidade). O que falta são duas flags que não custam velocidade perceptível e podem melhorar qualidade do proxy:
```
-tune hq          # tuning "high quality" (vs. ll/ull de baixa latência, que não interessa aqui — não é streaming ao vivo)
-multipass fullres  # (ou "2pass" conforme a versão) — segunda passada interna pra melhor alocação de bits, sem precisar rodar o FFmpeg duas vezes
```
**Esforço**: P — duas flags a mais na lista `codec` de `preparar_video()`/`preparar_preview()` em `tratar.py`, testar se o tempo de proxy continua aceitável.

### 4.12 Demucs — separação voz/música (roda muito bem em GPU local)

Doc: https://github.com/facebookresearch/demucs (README) + benchmark citado por fontes de terceiros que rodaram em RTX série 30.

```
pip install -U demucs
demucs --two-stems vocals -n htdemucs -d cuda -o ./saida entrada.wav
```
`-n htdemucs_ft` é a versão fine-tuned (melhor separação, ~4x mais lento); `-d cuda` roda na GPU. Benchmark citado: um arquivo de 6min24s levou **15,6s na GPU (RTX 3060 Ti) contra 187,8s na CPU** — ou seja, roda praticamente em tempo real numa GPU da classe da 3070 Ti.

**O que resolve aqui**: hoje `motor/tratar.py` limpa o áudio da fonte inteira com filtros genéricos (`afftdn`, `agate`) que atacam RUÍDO, não MÚSICA/efeitos misturados na trilha. Se o material bruto tiver música tocando ao fundo (comum em gravação de tela de jogo, ou webcam com trilha ambiente), rodar Demucs ANTES da transcrição — mandando só o stem de voz pro Whisper — tende a melhorar a qualidade da transcrição e elimina a música de fundo sem precisar de um `highpass`/`lowpass` que também prejudica a voz. Também abriria a porta pra reaproveitar o stem de música separado como `roteiro.musica` automaticamente, em vez de depender de um arquivo de música à parte.

**Esforço**: M — nova dependência Python + nova etapa de pipeline antes de `extrair_audio_wav`, com cuidado de VRAM se rodar em sequência com o carregamento do Whisper (ver seção 5).

---

## 5. Modelos locais de IA — o que é realista numa RTX 3070 Ti de 8GB

| Modelo | O que faz | Realista em 8GB? | Fonte |
|---|---|---|---|
| **Demucs** (`htdemucs`) | Separação voz/música/bateria/baixo | **Sim, folgado** — processa em segundos, well dentro de 8GB | https://github.com/facebookresearch/demucs |
| **Silero VAD** | Detecção de fala vs. silêncio | **Sim, trivialmente** — já roda embutido dentro do `faster-whisper` de vocês | ver abaixo |
| **RIFE** (interpolação de frame) | Slow-motion suave / upscale de fps | **Sim** — modelos recentes (ex. 4.4) cabem em 8GB até 4K; RTX 3070 Ti faz interpolação de 720p em tempo real | https://github.com/hzwer/ECCV2022-RIFE, issue #217 |
| **Real-ESRGAN** | Upscale de resolução | Sim, mas não simultâneo com um Whisper `large-v3` carregado — é melhor rodar como etapa separada, não em paralelo | combinações citadas via Video2X/REAL Video Enhancer |
| **rembg** (u2net) | Remoção de fundo (imagem/frame a frame) | **Sim** — modelo leve, `rembg[gpu]` via onnxruntime-gpu | https://github.com/danielgatis/rembg |
| **WhisperX** (alinhamento) | Timestamps por palavra via wav2vec2 (±50ms vs. ±500ms do Whisper puro) | **Com ressalva** — ver abaixo | https://github.com/m-bain/whisperX |
| **pyannote-audio** (diarização) | "Quem falou quando" | **Com ressalva de versão** — ver abaixo | https://github.com/pyannote/pyannote-audio |

### 5.1 Silero VAD — já usado, indiretamente

Doc: https://github.com/snakers4/silero-vad (README) · https://pytorch.org/hub/snakers4_silero-vad_vad/

`get_speech_timestamps(wav, model, return_seconds=True)` devolve `[{'start': 4.0, 'end': 4.4}, ...]`. **Já está dentro do pipeline**: `faster-whisper` com `vad_filter=True` (usado em `motor/transcrever.py` linha 53 e `motor/varrer.py` linha 54) usa exatamente o Silero VAD por baixo dos panos pra pular trechos sem fala antes de transcrever. Rodar Silero separado só faria sentido pra um uso que NÃO precisa de transcrição — por exemplo, detectar batida de silêncio pra cortar automaticamente ANTES de decidir se vale a pena rodar o Whisper (economia de tempo em vídeo bruto muito longo com blocos mortos grandes no início/fim).

**Esforço**: P se for esse uso pontual de pré-filtro; não é uma lacuna hoje no fluxo principal.

### 5.2 WhisperX — ganho real, mas com risco de VRAM que precisa de cuidado

Doc: https://github.com/m-bain/whisperX (README) + comparativos técnicos citados.

WhisperX roda `faster-whisper` por baixo e ACRESCENTA alinhamento forçado via `wav2vec2` — a precisão de timestamp por palavra sobe de ±500ms (Whisper puro) para **±50ms**. Isso bate direto numa dor documentada em `Legenda.tsx`/`legendas.ts`: a legenda "hormozi"/karaokê depende de `p.t`/`p.fim` estarem no frame certo pra o salto/cor bater com a boca — 50ms de erro é imperceptível, 500ms é visível.

**A ressalva importante**: fontes técnicas citam que WhisperX com `large-v3-turbo` quer **10GB+ de VRAM** — e vocês já carregam `large-v3` completo (não o turbo) em float16 na mesma placa de 8GB. Isso significa que rodar o alinhamento wav2vec2 **simultaneamente** ao modelo Whisper carregado pode não caber. O caminho seguro é sequencial, não simultâneo: transcrever com `faster-whisper` como hoje, **descarregar o modelo Whisper da VRAM** (`del model; torch.cuda.empty_cache()`), e só então carregar o modelo de alinhamento wav2vec2 pra rodar em cima do texto já transcrito. Isso é compatível com a arquitetura atual porque `transcrever.py` já separa "transcrever" de "salvar resultado" — o alinhamento entraria como um passo extra depois, lendo o JSON já salvo.

**Esforço**: M-G — não é só `pip install whisperx`, é reestruturar a ordem de carregamento de modelo pra caber em 8GB.

### 5.3 pyannote-audio — diarização, sensível à versão por causa de VRAM

Doc: https://github.com/pyannote/pyannote-audio · https://huggingface.co/pyannote/speaker-diarization-3.1 (model card) · issue de VRAM: https://github.com/pyannote/pyannote-audio/issues/1963

```python
from pyannote.audio import Pipeline
pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)
pipeline.to(torch.device("cuda"))
diarization = pipeline("audio.wav")
```
Fontes citam 6-8GB como "adequado" para a versão 3.x em janelas de 15s — **mas há um issue documentado do próprio projeto reportando que a versão 4.0.3 usa 6x mais VRAM que a 3.3.2 (9,54GB de pico vs. 2,59GB)**. Numa placa de 8GB isso é a diferença entre caber e não caber. Se algum dia isso entrar no projeto (hoje o SupremoCut assume um narrador só — não há necessidade de diarização no fluxo atual, que é criador solo gravando anúncio), a recomendação é **fixar a versão 3.3.x explicitamente**, nunca instalar "a mais recente" sem checar esse número.

**Relevância no SupremoCut hoje**: baixa — o produto é vídeo de um criador só (câmera + tela). Diarização importaria se algum dia o formato virar entrevista/podcast com 2+ pessoas.

**Esforço**: G, e sem uma dor atual que justifique — registrar como "se o formato mudar para múltiplos falantes".

### 5.4 RIFE — preenche uma lacuna real: slow-motion de qualidade

Doc: https://github.com/hzwer/ECCV2022-RIFE (README) + confirmação de desempenho em RTX 3070 Ti citada na issue #217 do próprio repositório, e capacidade de rodar modelo 4.4 em 8GB citada em fontes de terceiros.

**O gap concreto**: `Cena.velocidade` (`estudio/src/tipos.ts` linha 65) já aceita valores diferentes de 1 ("1.4 = acelera 40%"), e `Camada.tsx` aplica isso via `playbackRate` do `<Video>`. Só que `playbackRate < 1` (câmera lenta) NUM VÍDEO GRAVADO A 30/60fps normal fica com aparência de câmera lenta "arrastada"/choppy, porque não existem frames novos — só os mesmos frames tocando mais devagar. RIFE gera frames intermediários de verdade (fluxo óptico via rede neural), então um trecho marcado como destaque (ex.: o clique que fecha a venda numa gravação de tela) pode ganhar um slow-motion suave de verdade, rodado como pré-processamento offline sobre aquele trecho específico antes do proxy do FFmpeg.

**Esforço**: G — pipeline novo (recortar o trecho, rodar RIFE, reinserir no material antes do render), não algo pra rodar em todo vídeo por padrão.

### 5.5 Real-ESRGAN — só se o material bruto vier em baixa resolução

**Relevância aqui**: `motor/dublar.py` (`criar_projeto`, linha 196) já documenta um caso real — material que "chega em 360x640" sendo ampliado pra 1080x1920 via `lanczos` só pra dar nitidez ao TEXTO desenhado por cima (a doc do próprio código admite: *"não recupera detalhe, mas faz a tarja e o texto serem desenhados em 1080"*). Real-ESRGAN faria o upscale de verdade recuperando detalhe (não é só interpolação), o que ajudaria a IMAGEM em si (não só o texto sobreposto) a não parecer esticada quando o bruto vem de fonte ruim (ex.: vídeo de concorrente reaproveitado em formato de reação/comentário). Não roda em tempo real — é etapa offline por vídeo.

**Esforço**: G — nova etapa de pipeline, custo de tempo por vídeo (não é instantâneo mesmo em GPU).

### 5.6 rembg — abre um layout novo que hoje não existe

Doc: https://github.com/danielgatis/rembg (README)

```
pip install rembg[gpu]
rembg i -m u2netp entrada.png saida.png   # imagem única
```
Pra vídeo, seria frame a frame (o rembg em si é pensado pra imagem; vídeo exige extrair frames, processar, remontar — não é um comando de vídeo pronto). **O que abriria de novo**: o tipo `Layout` (`estudio/src/tipos.ts` linha 21-28) só tem variações de PiP RETANGULAR (`pip`, `pip_grande`, `pip_invertido`, `split`, `split_diagonal`). Um layout "recorte" — a pessoa falando SEM fundo/sem retângulo, flutuando sobre a tela gravada ou sobre um B-roll — é um estilo de anúncio vertical muito comum (estilo "reação" do TikTok) que o sistema de layouts atual não modela. Seria um `Layout` novo mais uma camada de máscara alpha no `Camada.tsx`.

**Esforço**: G — novo tipo de `Layout`, nova etapa de pré-processamento (extrair todos os frames, rodar rembg, remontar vídeo com canal alpha, provavelmente `.webm`/`.mov` com transparência já que `.mp4`/h264 não tem canal alfa), e suporte a alpha no componente `Camada`.

---

## As 10 adoções de maior retorno

1. **Aceleração de hardware (NVENC) no render final** — `Config.setHardwareAcceleration("if-possible")` em `remotion.config.ts` + trocar `setCrf(17)` por `--video-bitrate=8M` (mutuamente exclusivos); confirmado suportado no Windows desde v4.0.484, vocês estão na v4.0.517. https://www.remotion.dev/docs/hardware-acceleration
2. **`fitText()` (`@remotion/layout-utils`) na tarja de tradução** — resolve de forma automática o problema que o próprio `voz.py` já documenta (PT-BR mais longo que o idioma original estourando a `Caixa`). https://www.remotion.dev/docs/layout-utils/fit-text
3. **`Easing` nas transições lineares hand-rolled** — `Cena.tsx` linha 54 usa `interpolate` sem easing nos casos `fade`/`zoom_cruzado`; um `Easing.inOut(Easing.ease)` custa uma linha. https://www.remotion.dev/docs/easing
4. **`react-colorful` (`HexAlphaColorPicker`) no controle `Cor`** — conserta um gap real: hoje não dá pra editar a transparência da tarja pela UI, mesmo o tipo `Caixa.cor` documentando suporte a rgba. https://github.com/omgovich/react-colorful
5. **Preset `arnndn` em `config/tratamento.json`** — denoise por rede neural como alternativa ao `afftdn` pra ruído não estacionário, encaixa no sistema de presets que já existe sem mudar código. FFmpeg `af_arnndn`.
6. **Ajuste fino de NVENC no proxy/preview já existentes** — acrescentar `-tune hq -multipass fullres` em `tratar.py`, mesmo padrão de preset `p1`/`p5` que já está certo, ganho de qualidade sem custo de arquitetura.
7. **Demucs antes da transcrição** — separa voz de música/ruído de fundo do material bruto, roda em segundos numa GPU dessa classe, melhora a entrada do Whisper sem prejudicar a voz como um filtro genérico faria. https://github.com/facebookresearch/demucs
8. **`evolvePath()` (`@remotion/paths`) para setas/sublinhados de CTA** — reforça visualmente as `palavras_chave` já destacadas na legenda, baixo custo de implementação. https://www.remotion.dev/docs/paths/evolve-path
9. **WhisperX (alinhamento wav2vec2), com ordem de carregamento sequencial** — sobe a precisão do timestamp de ±500ms pra ±50ms, o que importa pro salto/cor da legenda bater exato com a fala; requer descarregar o Whisper da VRAM antes de carregar o alinhador para caber em 8GB. https://github.com/m-bain/whisperX
10. **RIFE para slow-motion nos trechos com `velocidade < 1`** — hoje isso só reamostra frames existentes (fica choppy); RIFE gera frame intermediário de verdade e a 3070 Ti já roda RIFE em tempo real a 720p. https://github.com/hzwer/ECCV2022-RIFE
