# Drift (CutWire Studios) — pesquisa a fundo e análise de lacunas

Relatório do Pesquisador da FORJA. Objetivo: estudar o editor de vídeo open source **Drift**
(CutWire Studios, Qt 6 + QML + FFmpeg 8, GPLv3) e comparar contra o **SupremoCut**
(Remotion 4 + React 19 + Express + motor Python) para saber o que copiar, o que ignorar, e o
que já perderíamos numa hipotética migração. Nenhum arquivo do projeto foi alterado além deste
relatório. Toda afirmação sobre o Drift cita a fonte; onde não consegui confirmar, digo
"não confirmado".

---

## Como esta pesquisa foi feita

Lido de verdade (não só o título), com link:

- **Repo principal**: [`CutWire-Studios/Drift`](https://github.com/CutWire-Studios/Drift) — README completo, listagem de pastas do repo raiz, [Issues](https://github.com/CutWire-Studios/Drift/issues), [Releases](https://github.com/CutWire-Studios/Drift/releases) (v0.1.0, v0.1.1, v0.2.0).
- **Os 5 docs do repo** (confirmei via [listagem de `docs/`](https://github.com/CutWire-Studios/Drift/tree/main/docs) que são exatamente estes 5 + uma pasta `screenshots/`, nenhum a mais):
  [`BUILDING.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/BUILDING.md),
  [`MCP.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/MCP.md),
  [`gpu-effects.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-effects.md),
  [`gpu-transitions.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-transitions.md),
  [`time-echo-architecture.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/time-echo-architecture.md).
- **Código-fonte** (cabeçalhos `.h`, que no Drift trazem comentários de projeto incomumente detalhados — não li os `.cpp`, ver limitações no fim): `src/core/{Clip,Project,Track,Time,Keyframe,Stabilize,ClipAnimation,Mask,Transition,Effect,SubtitleCue}.h`, `src/engine/{LoudnessMeter,ProjectBundle,FrameCompositor,Exporter,FaceSwapSource,EffectTemplateCatalog,ObjectDetector}.h`, `src/mcp/{McpServer,McpProtocol,McpCatalog}.h`, e as listagens de pastas de `src/core`, `src/engine`, `src/mcp`.
- **[`CutWire-Studios/Drift-Addons`](https://github.com/CutWire-Studios/Drift-Addons)** — README completo (o que são os addons, como são empacotados/assinados/servidos).
- **[`CutWire-Studios/Prism`](https://github.com/CutWire-Studios/Prism)** — README (parcial, ~8000 caracteres, até a seção "Project Structure"), o suficiente para saber que é outro produto.
- **[`docs.cutwire.org/drift`](https://docs.cutwire.org/drift)** — páginas lidas por inteiro via navegador (a busca por texto do fetch simples truncava tabelas HTML nesta origem, então usei o navegador para extrair o texto renderizado): Drift Docs (capa), Getting started, Projects, Media library, Timeline, Export, Addons, e de Clip tools: Text and titles, Effects, Templates, Transitions, Audio, Speed and motion, Cutouts and masks, Keyframes, Captions.
- **Lado SupremoCut**: `F:\SupremoCut\docs\pesquisa\catalogo.md` e `F:\SupremoCut\docs\brownfield\estado-atual.md` inteiros, para saber o que já existe e o que já foi recusado (e não repetir recusa sem argumento novo).

### O que NÃO consegui confirmar (declarado, não inventado)

- **`AGENTS.md` não existe no repositório**, apesar de `BUILDING.md` e `MCP.md` linkarem `[AGENTS.md](../AGENTS.md)` como "o guia completo do agente". Testei `https://github.com/CutWire-Studios/Drift/blob/main/AGENTS.md` diretamente: **404 — "The main branch of Drift does not contain the path AGENTS.md"**. É um link morto na documentação deles, não uma falha minha de acesso.
- Não li os arquivos `.cpp` (implementação) de `src/core`, `src/engine` nem `src/mcp` — só os `.h` (declarações + comentários de projeto, que neste repo são extensos e específicos, mas não são o algoritmo real). Qualquer afirmação sobre *comportamento exato em runtime* (não só a interface) carrega essa ressalva.
- Não li `docs.cutwire.org/drift/interface`, `/preview`, `/editing-clips`, `/clip-tools/stickers-and-shapes`, `/settings`, `/hotkeys` — fora do escopo de tempo desta pesquisa; nada abaixo depende deles.
- Não instalei nem rodei o Drift. Tudo aqui vem de ler código e documentação, não de operar o app.
- Contagem de estrelas/issues do GitHub oscilou entre consultas na mesma sessão (8→143→93 estrelas; 1→5→2 issues abertas) — claramente cache de borda do GitHub variando, não uma mudança real em minutos. Não confio em números exatos; uso "poucas dezenas a baixas centenas" e sigo em frente.
- `Drift-Addons`: li só o README, não o código de `recipes/`, `packer/`, `worker/`.
- Licença do Drift é **GPL-3.0** (copyleft). "Viável no nosso stack" abaixo significa *reimplementável de forma independente*, nunca "copiar o código deles" — isso exigiria licenciar a parte copiada como GPL, o que não parece ser a intenção do SupremoCut.

---

## 1. O que o Drift tem que o SupremoCut não tem

Ordenado por impacto para o nosso caso de uso real (fábrica de anúncio vertical dublado),
não por ordem alfabética. P = pequeno (horas–poucos dias, sem infra nova). M = médio (dias,
integra uma lib nova, sem mudar arquitetura). G = grande (1+ semana, pipeline ou modelo novo).

### 1.1 MCP — servidor de agente com primitivas de verificação (não só "canal de edição")

**O que é.** Em **Settings → Agent access**, o Drift sobe um servidor MCP local (`127.0.0.1`,
desligado por padrão, token rotativo por sessão) que expõe a timeline inteira como ferramentas
JSON-RPC para Claude Code/Cursor. Fonte: [`docs/MCP.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/MCP.md) e [`docs/BUILDING.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/BUILDING.md) (seção "Agent access (MCP)").

**Como o Drift faz.** Arquitetura em `src/mcp/` (15 arquivos: `McpServer`, `McpHttp`, `McpDispatcher`
(+ `McpDispatcherExtended`), `McpCatalog` (+ `McpCatalogExtendedOps.inl`), `McpProtocol`, `McpJson`,
`McpSession`, `McpStdio`). O fluxo documentado em `MCP.md`:

1. `catalog` — lista toolboxes e um resumo de quando usar cada operação (sem schema completo).
2. `toolbox({name})` — schema JSON completo das operações daquele toolbox.
3. `apply({ops:[...]})` — aplica uma lista de mutações em ordem, **um único passo de undo pro lote inteiro**.
4. `inspect({clips:true, detail:true})` — estado do projeto, UUIDs de clipe, `revision` (permite `since:<revision>` pra pular releitura se nada mudou).
5. `capture()` — **um JPEG da composição atual, sem rodar o export completo** — é assim que o agente verifica visualmente o que acabou de editar.

`McpServer.h` confirma a forma: `start()/stop()`, `token()`, `handleRpc(toolbox, body)` rodando
num `QThread` dedicado. `McpProtocol.h` mostra a separação entre "homepage tools" (`catalog`,
`toolbox`, `apply`, `inspect`, `capture`) e as ferramentas por toolbox. Os toolboxes reais, por
`MCP.md`: `media`, `timeline`, `canvas`, `playback`, `text`, `shapes`, `subtitles`, `effects`,
`project`, `keyframes`, `speed`, `segmentation`, `ai`, `audio`, `scene`, `ui` — 16 no total.

Dois toolboxes valem nota especial pelo que fazem, não só por existirem:

- **`audio.detect_beats`** — bloqueante (sem polling), devolve BPM, confiança, grade de batidas e
  onsets; depois `set_beat_layers({grid:true})` vira ímã pra colar clipes na batida, ou
  `split_on_beats`/`snap_clips_to_beats`/`bookmark_beats` operam direto sobre a grade. A análise é
  **transiente** — qualquer edição de áudio a invalida (`stale` no `inspect`).
- **`scene.detect_scenes`** — assíncrono, constrói um índice de planos (`describe_clip`,
  `list_scenes`, `find_scenes({label:"person"})`, `split_on_scenes`, `bookmark_scenes`). Ao
  contrário de beats, essa análise **não é transiente**: fica em cache pelo timestamp do arquivo
  fonte e sobrevive a undo/reload. `find_scenes` busca por rótulo em **todos os clipes já
  escaneados** da timeline — é o "ache todo plano com produto/pessoa" via IA de objeto.

Os `Traps` documentados (ex.: `set_transform` grava no playhead se a propriedade tem keyframe;
`set_mask`/`set_subtitle_cues` substituem o objeto inteiro, não fazem merge; `apply` não é
atômico) mostram que é um protocolo pensado por quem já apanhou bastante integrando agente com
editor de verdade — é know-how, não só a ideia de expor um servidor.

**Isso já foi avaliado.** `catalogo.md` recusou "Servidor MCP no editor" com o argumento "a IA já
edita pelo chat, que é o canal escolhido. Sem dor a resolver." Esse argumento continua válido
*para a pergunta de canal* — o SupremoCut não precisa de um servidor JSON-RPC só para a IA poder
editar arquivos, ela já faz isso direto. **O que este relatório encontra de novo não é o canal, é
as primitivas de verificação e análise** que o Drift construiu em cima do canal, e que hoje não
existem no SupremoCut:

| Primitiva do Drift | Equivalente hoje no SupremoCut | Esforço se quiséssemos |
|---|---|---|
| `capture()` — 1 frame composto, sem export completo | Existe uma peça parecida: o endpoint `still` de `servidor.mjs:309-370` já roda o Remotion CLI pra 1 PNG num quadro — mas é um botão de UI (`Barra.tsx:156-158`), não uma ferramenta com contrato descoberto pelo agente | P — documentar/expor esse endpoint já existente pro agente, sem servidor MCP novo |
| `inspect()` com `revision` (evita reler JSON inteiro à toa) | Não existe; o agente lê `roteiro.json` inteiro sempre | P — não crítico, `roteiro.json` de projeto real tem ~130 linhas hoje |
| `detect_beats` / `snap_clips_to_beats` | Não existe | Ver §1.3 abaixo |
| `find_scenes({label:...})` | Não existe (nem o corte de cena isolado — ver `catalogo.md` item 10, ainda não implementado) | Ver §1.6 abaixo |

Ou seja: não é "construir um MCP" — é considerar cada primitiva (capture sem render completo,
detecção de batida, achar plano por objeto) no seu próprio mérito, o que as seções seguintes
fazem. **Viável**: sim, por partes, sem precisar de um protocolo JSON-RPC novo — o servidor
Express (`servidor.mjs`) já é o canal, só falta expor essas capacidades específicas nele.

---

### 1.2 Efeitos e transições em GPU via pacote de arquivo (GLSL hot-load)

**O que é.** Todo efeito e toda transição do Drift é uma pastinha carregada em runtime, não
código compilado: `effects/<id>/{effect.json, main.frag, thumbnail.png}` e
`transitions/<id>/{transition.json, main.frag, preview_strip.png}`. Fontes:
[`gpu-effects.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-effects.md),
[`gpu-transitions.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-transitions.md).

**Como o Drift faz.**
- Ordem de busca: `$DRIFT_EFFECTS_DIR` → `<appDir>/effects` → `<AppDataLocation>/effects` →
  addon instalado — resolvido por id, "highest-priority-first", então um addon pode substituir um
  efeito embutido sem atualizar o app inteiro.
- `effect.json` declara parâmetros tipados (`float` com min/max/keyframable, `bool`, `color` como
  `vec3` — sem alfa —, `file` pra assets como o 3D face mesh), `pipeline.passes` com buffers
  intermediários, e `requires: "face"` pra receber 40+ uniforms de landmark facial (posições em
  UV, comprimentos normalizados pela largura, contornos fechados de olho/boca/sobrancelha).
- GLSL é `#version 330 core`, **sem `#include`** (cada `.frag` é auto-contido de propósito, pra
  poder virar addon sozinho) e com **modo de graça**: erro de compilação = passthrough, nunca
  tela preta.
- Transições recebem *duas* texturas (`u_fromTexture`/`u_toTexture`) + `u_progress`, e têm uma
  **regra de determinismo testada** (`EngineTest::transitionRenderingIsDeterministic`): a saída
  tem que ser função pura de `(fromTexture, toTexture, progress, params)` — nunca de `u_time` ou
  `u_frameIndex` — porque o exportador renderiza fora de ordem e o usuário pode arrastar a agulha
  pra qualquer ponto. Efeitos "glitch" quantizam o progresso (`floor(progress*24)`) em vez de ler
  o relógio.
- Catálogo real (via [`docs.cutwire.org/drift/clip-tools/effects`](https://docs.cutwire.org/drift/clip-tools/effects) e [`.../transitions`](https://docs.cutwire.org/drift/clip-tools/transitions)): ~40 efeitos em 6 categorias (Glitch & Distortion, Retro/Analog, Dreamy & Stylish, Impact, Funny Face, Artistic, Keying) e ~23 transições em 5 categorias (Basic, Stylized & Cinematic, Grid & Geometric, Glitch & Digital, Particle & Liquid — nomes como *Voronoi Shatter*, *Liquid Smudge*, *Honeycomb Hexagon*).

**Dá pra fazer no nosso stack?** Sim, mas é o item mais caro tecnicamente da lista. Remotion
renderiza qualquer árvore React por trás de um frame server (Chromium headless), então **o
problema de "preview e export baterem" que o Drift resolveu na unha (§3.2) o Remotion já resolve
de graça** — qualquer camada WebGL dirigida por `useCurrentFrame()` é automaticamente determinística
entre preview e render. O que falta não é arquitetura, é conteúdo: uma camada `<canvas>`/WebGL
(via `three.js`/`ogl`/shaders customizados) dentro da árvore de composição, um punhado de shaders,
e um formato de "pacote" (JSON + `.frag`, quase copiável 1:1 na estrutura, reescrito em WebGL/GLSL
ES). **Esforço: G para o sistema completo (hot-load, catálogo, ~40 efeitos); M para um
subconjunto curado (5–10 efeitos fixos direto no código React, sem hot-load nem addon).**

---

### 1.3 Templates de "look" — pacotes de efeito em múltiplas camadas sincronizados por música

**O que é.** "Templates" no Drift não são um preset de 1 efeito — são pacotes que empilham vários
efeitos, em múltiplas camadas (fundo/frente/clone), com pulsos de parâmetro sincronizados a
onset/batida/compasso. Fonte de catálogo: [`docs.cutwire.org/drift/clip-tools/templates`](https://docs.cutwire.org/drift/clip-tools/templates)
(23 templates bundled: *Beat Drop*, *Glitch Cut*, *Kaleido Chaos*, *Slowmo Drop* etc., alguns
exigindo recorte de sujeito prévio). Estrutura confirmada em código,
[`src/engine/EffectTemplateCatalog.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/EffectTemplateCatalog.h):

```cpp
struct EffectTemplateEntry {
    QString sync; // "onset" | "beat" | "bar" | "clip"
    bool requiresSegmentation = false;
    QList<EffectTemplateLayer> layers;   // templates de 1 clipe (v1)
    QList<EffectTemplateTrack> tracks;   // templates multi-faixa (v2): role "background"|"foreground"|"clone"
    EffectTemplateCloneSpec clones;      // N clones com lista de opacidade/escala cada
    EffectTemplateSpeedPulse speedPulse; // pulso de velocidade (rest/peak/decayMs)
};
```

Ou seja: um "look" é uma receita declarativa — quais efeitos, em qual camada, pulsando em qual
evento musical, com quantos clones e em que opacidade/escala. `requiresSegmentation` é o que
gera o aviso "Needs cutout" na UI (liga o template ao recorte de sujeito do §1.5).

**Dá pra fazer no nosso stack?** Sim, e razoavelmente natural em React: um "template" vira um
objeto JSON/TS que descreve camadas + parâmetros + evento de sincronia, consumido por um
componente que já sabe aplicar os keyframes/efeitos existentes (o SupremoCut já tem o padrão de
"receita declarativa" em `config/direcao.json`). A peça que falta de verdade é a análise de
áudio (ver §1.4 abaixo) — sem ela, "sync: beat" não tem o que consumir. **Esforço: M** (a
estrutura de dados e a composição React são o trabalho principal; a detecção de batida é
compartilhada com o item seguinte).

---

### 1.4 Detecção de batida (beat detection) para cortes e animação no tempo da música

**O que é.** `audio.detect_beats` devolve BPM, confiança, `beatsPerBar`, `firstDownbeat`, a lista
de tempos de batida e de onsets. Fonte: [`docs/MCP.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/MCP.md).
`bpm: 0` é tratado como "sem tempo confiável" (não erro) — nesse caso os `onsets` continuam
válidos e viram a unidade de trabalho (`unit:"onset"`). A partir daí: cortar no compasso
(`split_on_beats`), colar clipes na batida mais próxima (`snap_clips_to_beats`, ímã de 150ms),
ou simplesmente gravar a grade como marcadores (`bookmark_beats`).

**Por que importa aqui.** `catalogo.md` (Onda 6) já identificou o gancho dos 3 primeiros segundos
como o fator nº1 de performance segundo Meta/TikTok, mas hoje o SupremoCut não tem nenhuma
ferramenta pra alinhar corte/zoom/legenda à música de fundo — é tudo manual. Isso conversa direto
com templates de "look" (§1.3) e com "zoom automático na palavra enfatizada" (já um item aceito
no catálogo, onda 2 item 9), só que no eixo da música em vez da fala.

**Dá pra fazer no nosso stack?** Sim, com biblioteca padrão de Python (`librosa.beat.beat_track`
ou `essentia`), rodando no motor já existente (mesma família de `motor/ondas.py`, que já
calcula picos de forma de onda a 50/s). O resultado é um JSON de tempos de batida que o editor
React consome pra desenhar ímã/guias na timeline, igual ao ímã de corte que já existe
(`Timeline.tsx:136-153`). **Esforço: P–M** (a lib de detecção de batida é chamada de 1 linha;
o trabalho é o ímã na timeline + a UI pra ligar/desligar, reaproveitando o padrão que já existe
para o ímã de corte).

---

### 1.5 Recorte de sujeito por IA (SAM2, clique-a-clique)

**O que é.** Isolar uma pessoa/objeto do fundo sem tela verde. Fluxo documentado em
[`docs.cutwire.org/drift/clip-tools/cutouts-and-masks`](https://docs.cutwire.org/drift/clip-tools/cutouts-and-masks):
escolhe um quadro nítido do sujeito, clique-esquerdo inclui, clique-direito exclui, escolhe saída
(dois clipes separados, ou esconder tudo exceto o sujeito), roda. Modelo: **SAM2** (~190 MB),
addon "Subject Cutout" em [`Drift-Addons`](https://github.com/CutWire-Studios/Drift-Addons)
("SAM 2 model for isolating a subject from the background"). Precisa também de um "AI engine"
(ONNX Runtime, CPU/CUDA/WebGPU — escolha do usuário, addon separado).

**Como conecta no core.** `src/core/Mask.h` tem `MaskShape::Matte` — "a per-frame raster mask
backed by a grayscale video" — é nisso que o resultado do SAM2 vira: um vídeo em tons de cinza
funcionando como mapa de cobertura, indexado por `mattePath` + `matteSrcOffsetUs`. Ou seja, o
recorte de sujeito não é um sistema à parte — ele **produz uma matte que entra no mesmo objeto
`Mask` das máscaras geométricas** (ver §1.7).

**Dá pra fazer no nosso stack?** Sim — SAM2 (Meta, Apache-2.0) roda em Python com CUDA, a mesma
GPU já usada por faster-whisper e Demucs. O trabalho pesado não é o modelo, é a UI de clique
inclui/exclui sobre o preview do Remotion Player, mais a propagação do clique num quadro pra
máscara em todos os quadros do clipe (SAM2 video predictor faz isso, mas processar clipe longo
demora — o próprio Drift avisa "longer clips take longer"). **Esforço: G** — modelo grande,
integração com preview interativo, e um novo tipo de asset (matte em vídeo) que a composição
Remotion precisa saber consumir como alpha.

---

### 1.6 Detecção de cena com rótulo de objeto (achar plano por conteúdo)

**O que é.** Além de cortar em troca de plano, o Drift constrói um índice pesquisável do material
fonte: `scene.describe_clip()` dá contagem de planos e rótulos por tempo de tela;
`scene.find_scenes({label:"person"})` **busca em todos os clipes já escaneados da timeline**,
ordenado por relevância. Fonte: [`docs/MCP.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/MCP.md).
O modelo por trás é **YOLOX** rodando via ONNX Runtime — escolhido especificamente por licença
Apache-2.0 (o comentário do código é explícito: modelos Ultralytics YOLO são AGPL-3.0, YOLOX
não). Fonte: [`src/engine/ObjectDetector.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/ObjectDetector.h).
Ao contrário da detecção de batida, essa análise **não é transiente** — fica em cache pelo
timestamp do arquivo fonte e sobrevive a undo/reload; só re-escaneia se o corte mudar o trecho
analisado.

**Por que importa aqui.** `catalogo.md` (Onda 2, item 10) já pediu detecção de corte de plano via
PySceneDetect `AdaptiveDetector` — **isso permanece a recomendação certa e não muda**. O que o
Drift acrescenta é uma camada em cima: depois de cortar por plano, rotular o que tem em cada
plano (produto, pessoa, texto na tela) pra busca — útil pra montagem de variantes (Onda 6) e pra
achar rapidamente "todo plano em que o produto aparece" num anúncio de 12 variantes.

**Dá pra fazer no nosso stack?** Sim, em duas camadas independentes: (1) PySceneDetect pro corte
de plano — já recomendado, ainda não feito; (2) um detector de objeto local (YOLOX ONNX ou
equivalente, mesma ressalva de licença que o Drift já resolveu) rodando sobre os quadros-chave de
cada plano, gravando rótulos num JSON que o editor usa pra filtrar/buscar. **Esforço: P para o
corte de plano (item já no catálogo); M para adicionar rótulo de objeto por cima.**

---

### 1.7 Máscaras geométricas (retângulo, elipse, estrela, coração, barras, freeform)

**O que é.** Painel "Cutouts" por clipe: forma (`None, Rectangle, Ellipse, Star, Heart, Bars,
Freeform`), posição/tamanho/rotação, **feather** (suaviza a borda) e **invert** (fica com o
avesso da forma). Fonte: [`docs.cutwire.org/drift/clip-tools/cutouts-and-masks`](https://docs.cutwire.org/drift/clip-tools/cutouts-and-masks).
Struct real, [`src/core/Mask.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Mask.h):

```cpp
enum class MaskShape { None, Rectangle, Ellipse, Star, Heart, Bars, Freeform, Matte };
struct Mask {
    MaskShape shape = MaskShape::None;
    double x=0.5, y=0.5, w=0.6, h=0.6, rotation=0.0, feather=0.0;
    bool invert = false;
    QVector<QPointF> points; // normalizado, só pra Freeform
    QString mattePath; TimeUs matteSrcOffsetUs = 0; // só pra Matte (recorte de sujeito, §1.5)
};
```

**Isso é diferente do que já foi recusado.** `catalogo.md` recusou "Máscara em 3 passos do
Kdenlive" por ser "complexo demais para o público" (rotoscopia manual profissional em 3 etapas).
O que o Drift mostra aqui **não é isso** — são 7 formas fixas + freeform, com dois sliders
(pena, inversão), zero passos de composição manual. É estruturalmente parecido com o que o
SupremoCut já tem para `split_diagonal` (`clipPath` poligonal em `Camada.tsx:52-57`) e para o
PiP (`retanguloPip` em `layouts.ts:44-94`) — mesma família de geometria proporcional 0..1 que já
existe no projeto, só que exposta como uma máscara independente do layout câmera/tela.

**Dá pra fazer no nosso stack?** Sim, com CSS `clip-path`/`mask` (formas básicas, retângulo,
elipse, estrela, coração são todas expressáveis em `clip-path: polygon()`/`ellipse()`) e SVG pra
freeform — o mesmo mecanismo que `Camada.tsx` já usa. Feather pede um blur na máscara (`filter:
blur()` sobre uma máscara SVG, ou um segundo passo). **Esforço: P–M** — é composição de recursos
que já existem no projeto (geometria proporcional, clipPath), não uma capacidade nova.

---

### 1.8 Chroma key (nota: já avaliado, sem argumento novo)

O Drift trata chroma key como **um efeito GPU comum** — "Chroma Key" na categoria "Keying" do
catálogo de efeitos, com cor-chave e tolerância ajustáveis (fonte:
[`docs.cutwire.org/drift/clip-tools/effects`](https://docs.cutwire.org/drift/clip-tools/effects) e
[`.../cutouts-and-masks`](https://docs.cutwire.org/drift/clip-tools/cutouts-and-masks): "For
green/blue screen, apply the Chroma Key effect from Effects"). Não é um sistema à parte — é só
mais um `.frag` no catálogo do §1.2. **`catalogo.md` já recusou isso** ("Quase nunca aparece no
material real deste fluxo. Volta se aparecer.") e não tenho argumento novo pra reabrir — o
material real (criativo estrangeiro + dublagem) continua sem tela verde. Mantenho a recusa.

---

### 1.9 Estabilização de vídeo (duas passagens, bake ou keyframes esparsos)

**O que é.** Não está em nenhuma página de documentação que li, mas está no modelo de dados:
[`src/core/Stabilize.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Stabilize.h)
e os campos `stabilize*` em [`Clip.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Clip.h).
Dois modos:

- **`Bake`** — roda um job de duas passagens estilo `vid.stab`/`libvidstab` (o comentário cita um
  arquivo `.trf`, formato nativo desses filtros FFmpeg), grava um vídeo estabilizado novo.
- **`Keyframes`** — em vez de recodificar, ajusta o *plano de compensação de câmera* como
  keyframes esparsos de `transformX/Y` (`piecewiseLinearBreakpoints`, ajuste linear por partes
  dentro de uma tolerância em pixels) — mais barato, não gera arquivo novo.

Ambos guardam uma "pose de repouso" (`stabilizeRestX/Y/W/H/Rot`) antes de aplicar, pra permitir
desfazer sem acumular deslocamento.

**Por que importa aqui.** O próprio pedido de trabalho descreve o material real como "criativo
estrangeiro" que passa por dublagem — mas o catálogo (Onda 2, item 10) já registra que "anúncio
vertical é filmado na mão", ou seja, há footage tremido no fluxo real (provavelmente
depoimento/UGC). Hoje o SupremoCut não tem nenhuma resposta pra isso.

**Dá pra fazer no nosso stack?** Sim — FFmpeg já traz `vidstabdetect`/`vidstabtransform`
(`libvidstab`), é a mesma dupla-passagem que o Drift usa, chamável do motor Python igual ao
padrão já existente de proxy/tratamento em duas etapas (`motor/tratar.py`, que já faz NVENC com
fallback pra libx264). O modo "bake" (gerar proxy estabilizado) é direto; o modo "keyframes
esparsos" exigiria portar o ajuste linear por partes pro nosso `KeyframeTrack`-equivalente (hoje
o SupremoCut não tem keyframes genéricos, só `Foco` estático por bloco — ver §2). **Esforço: M**
para o modo bake (é um preprocessamento FFmpeg a mais, mesmo padrão do que já existe).

---

### 1.10 Time Echo / motion trail

**O que é.** Efeito de rastro de movimento: mistura os N quadros anteriores do mesmo clipe com
peso decrescente. Fonte completa: [`docs/time-echo-architecture.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/time-echo-architecture.md).

**Como o Drift faz — e por que o documento existe.** O desafio declarado no próprio doc é
"Preview e export chamam `FrameCompositor::compositeAt()`. Time echo não pode introduzir um
segundo pipeline de composição nem um buffer de histórico só-do-preview." A solução (v1): dentro
de `FrameCompositor::imageForClip()`, quando `time_echo` está na pilha de efeitos do clipe, o
compositor decodifica `frames` (1–10, padrão 4) amostras anteriores em
`clipTimeUs - n*frameDurationUs(fps)` (tempo inteiro em microssegundos, então determinístico),
mistura com `decay^age` (padrão 0.55) via `CompositorFrameHistory::applyTimeEcho()` — **as
amostras históricas são decodificadas sem o próprio `time_echo`**, pra não recursar o rastro.
Extensões futuras que o doc já lista como não resolvidas: eco em nível de projeto (through
múltiplos clipes empilhados) e espaçamento sub-quadro ciente da velocidade do clipe.

**Dá pra fazer no nosso stack?** Sim — no Remotion isso é reamostrar o mesmo `<OffthreadVideo>`
(ou `<Video>`) em N deslocamentos de tempo, cada cópia com opacidade `decay^age` e
`mix-blend-mode` apropriado, empilhados atrás do quadro atual. Como cada cópia é só um componente
React a mais lendo um `frame` diferente, o determinismo vem de graça (mesma observação do §3.5).
**Esforço: M** — mais trabalho de ajuste fino de blend/decay do que de arquitetura.

---

### 1.11 Rastreamento facial (Funny Face) e face swap

**O que é.** Efeitos que seguem o rosto (`Alien Head`, `Big Eyes`, `Face Fisheye`, `Face Swirl`,
`Fat/Slim Face`, `Wide Mouth` — categoria "Funny Face" em
[`docs.cutwire.org/drift/clip-tools/effects`](https://docs.cutwire.org/drift/clip-tools/effects)),
mais um recurso que **não aparece em nenhuma página de usuário que consegui ler**, mas existe em
código: [`src/engine/FaceSwapSource.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/FaceSwapSource.h) —
troca o rosto detectado por uma foto de origem (limite de 1024px, o rosto maior da foto é usado
se houver vários, sem seletor de qual — "cropar a foto é mais claro que outro índice"). Como não
achei esse recurso documentado em `docs.cutwire.org` nem no README, **não confirmo que já esteja
exposto na UI estável** — pode ser recurso em construção. Ambos dependem do addon "Funny Face
Effects" (modelo de landmark facial, ~5 MB) + AI engine.

**Dá pra fazer no nosso stack?** Tecnicamente sim (MediaPipe/insightface em Python, mesma GPU),
mas é o item de menor aderência ao caso de uso real (dublagem de anúncio, não conteúdo de humor
com efeito facial). **Esforço: G, prioridade baixa** — não atende nenhum dos 3 critérios do
catálogo (não economiza tempo numa demanda real do fluxo declarado).

---

### 1.12 Editor de keyframe com curva Bezier de verdade

**O que é.** `catalogo.md` (Onda 1) pediu keyframes + easing nomeado + copiar/colar. O Drift já
tem bem mais que isso: [`src/core/Keyframe.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Keyframe.h)
implementa curvas Bezier cúbicas de verdade, com handles de entrada/saída relativos à chave
(`inDx/inDy/outDx/outDy`), um flag `corner` (handles quebrados vs. colineares) e `hold` (degrau,
que não é expressável como Bezier e por isso fica como flag à parte). Interpolação linear é só o
caso onde os handles são zero — "um `Keyframe` padrão é exatamente o comportamento Linear antigo".
A UI expõe isso como o **`KeyframeGraph`** (gráfico de curvas), confirmado em
[`docs.cutwire.org/drift/clip-tools/keyframes`](https://docs.cutwire.org/drift/clip-tools/keyframes):
"With keyframed properties selected, the timeline KeyframeGraph shows curves so you can refine
timing and easing visually."

**Dá pra fazer no nosso stack?** Sim, e o Remotion já expõe `Easing` (biblioteca do próprio
Remotion, citada em `catalogo.md` como gap atual — "as transições atuais são lineares"). Uma
curva Bezier editável à mão (arrastar handle) é mais trabalho de UI (um mini-editor de curva no
painel) do que de matemática — a interpolação cúbica em si é a mesma fórmula em qualquer stack.
**Esforço: M** — o "keyframes com easing nomeado" do catálogo (P) já cobre 80% do valor; o editor
de curva arrastável é o incremento G→M que sobra.

---

### 1.13 Pacote de projeto com mídia (.drift bundle) — gap menor do que parece

**O que é.** `Project properties… → Save with media…` empacota timeline + toda a mídia
referenciada num único arquivo `.drift`. Formato documentado em código,
[`src/engine/ProjectBundle.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/ProjectBundle.h):
contêiner binário próprio (`"DRIFTPRJ"` + versão + manifesto JSON comprimido em zstd + blobs
concatenados + hashes SHA-256 em um trailer), gravado via `QSaveFile` (cancelar ou faltar disco
não corrompe o arquivo anterior). Mídia fonte pode ser **referenciada ou embutida**; artefatos
derivados (matte, face track) são **sempre embutidos** porque vivem num cache volátil que o
usuário não faz backup. Confirmado também em [`docs.cutwire.org/drift/projects`](https://docs.cutwire.org/drift/projects)
("Save with media… creates a portable .drift that includes the media your project needs").

**Por que o gap é menor do que parece.** O Drift precisa disso porque um projeto Drift referencia
arquivos soltos em qualquer lugar do disco do usuário. O SupremoCut **já não tem esse problema**:
cada projeto é uma pasta (`projetos/<nome>/{bruto, trabalho, roteiro.json}`) com a mídia já
dentro — ver árvore executiva de `estado-atual.md`. O que falta, se algo falta, é só um "zip
desta pasta" pra mandar/arquivar — não um formato de contêiner novo. **Esforço: P** (compactar a
pasta do projeto num `.zip`), e só vale a pena se houver demanda real de handoff pra outra máquina.

---

### 1.14 Sistema de addons sob demanda — não se aplica ao nosso modelo de distribuição

**O que é.** Fontes, stickers, modelos de fala (Whisper) e runtimes de aceleração (ONNX Runtime
CPU/CUDA/WebGPU) **não vêm no binário** — são pacotes `.driftpkg` (zstd + assinatura Ed25519)
baixados sob demanda de um Cloudflare Worker próprio na frente de um bucket R2. Fonte:
[`Drift-Addons` README](https://github.com/CutWire-Studios/Drift-Addons) e seção "Addons" do
[`README`](https://github.com/CutWire-Studios/Drift)/[`BUILDING.md`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/BUILDING.md).
Resolução por prioridade (`$DRIFT_*_DIR` > addon instalado > bundle do app > pasta de dados do
usuário) permite que um addon corrija um efeito sem exigir release novo do app inteiro.

**Por que não se aplica aqui.** Esse sistema resolve um problema de **distribuição pública
multiplataforma** (instaladores assinados pra usuários desconhecidos, em Linux/Windows/macOS, com
verificação criptográfica porque qualquer um pode baixar). O SupremoCut roda local, de um único
time, e cada peça pesada (modelo do faster-whisper, do Demucs) **já baixa sob demanda sozinha**
via o mecanismo próprio de cada biblioteca (Hugging Face Hub / torch hub) — o mesmo benefício
("não empacotar peso morto") já existe, só que sem precisar construir um CDN assinado próprio.
**Esforço se quiséssemos replicar: G, e sem necessidade real** — não é um gap, é uma solução pra
um problema que não temos.

---

### 1.15 Medidor de loudness (LUFS) — mede, não corrige

**O que é.** [`src/engine/LoudnessMeter.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/LoudnessMeter.h):
"Integrated loudness (ITU-R BS.1770 / EBU R128, simplified) plus a 4×-interpolated true-peak
estimate", reaproveitando o mesmo leitor de PCM em chunks que o `MediaWaveform` usa. Devolve
`integratedLufs` e `truePeakDb` — **um número pra mostrar ao usuário**, não encontrei nenhuma
menção (nem em código, nem em `docs.cutwire.org/drift/clip-tools/audio`) de correção automática
de ganho pra bater um alvo de loudness. Esta é a contraparte exata do item que o SupremoCut já
tem — ver §2.

**Dá pra fazer no nosso stack?** Já fazemos mais que isso (ver §2) — não é um gap a preencher,
é uma confirmação de vantagem nossa.

---

### 1.16 Leque de codecs/containers de exportação

**O que é.** [`docs.cutwire.org/drift/export`](https://docs.cutwire.org/drift/export) e
[`src/engine/Exporter.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/Exporter.h):
vídeo em H.264/H.265/AV1/VP8/VP9/ProRes/DNxHR/FFV1/MPEG-4/MPEG-2/Theora, taxa constante (CRF) ou
por bitrate, áudio em AAC/Opus/MP3/AC3/FLAC, container MP4/Matroska/WebM escolhido conforme o par
codec, catálogo "estilo HandBrake" (`Exporter::videoCodecs()` reporta o que está disponível na
build, incluindo sondagem de hardware). Só o tamanho muda por download (chips 1080p/720p/480p
"que não fazem upscale") — **a proporção do quadro nunca muda no export**, ela é fixada uma vez
na criação do projeto (`getting-started`: "Choose your video layout… Pick a platform template").

**Por que isso não é prioridade.** O SupremoCut entrega pra um destino conhecido (anúncio vertical
9:16, H.264+AAC em MP4) — a generalidade de codec/container do Drift resolve um problema de
"editor genérico pra qualquer entrega" que não é o nosso. **Esforço se quiséssemos: P** (é só
expor mais flags do FFmpeg que já roda), **mas baixa prioridade** — nenhum dos 3 critérios do
catálogo pede isso.

---

### 1.17 Itens menores confirmados (sem aprofundar, pra registro)

| Item | Fonte | Nota |
|---|---|---|
| Biblioteca de formas vetoriais (setas, balões de fala, estrela, coração, raio…) | [`media-library`](https://docs.cutwire.org/drift/media-library) | Já é recomendação aceita no catálogo (Onda 4, item 17 — selos de oferta); o Drift confirma que a categoria "Bubbles"/"Fun" é útil o bastante pra existir como biblioteca própria. |
| Catálogo de efeitos de voz/áudio (EQ, compressor, limitador, *noise gate*, de-esser, "voice leveler", 6 vozes trocadas — Alien, Chipmunk, Dark Lord, Deep Voice, Robot, Wobble) | [`clip-tools/audio`](https://docs.cutwire.org/drift/clip-tools/audio) | Mais amplo que o que o SupremoCut tem hoje; nenhum desses tem prioridade clara no fluxo de dublagem, mas o "voice leveler" (compressor de voz automático) é parecido em espírito com o ducking que já está no catálogo (Onda 3, item 11). |
| 7 modos de mesclagem (`Normal, Multiply, Screen, Overlay, Add, Darken, Lighten`) | [`src/core/Clip.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Clip.h) `enum class BlendMode` | Bate quase exatamente com a recomendação já aceita no catálogo (Onda 4, item 19 — "10 realmente úteis" dos 20 do Kdenlive); o Drift escolheu 7, o que é mais um dado a favor do número já escolhido do que uma lacuna nova. |
| Animação de corpo inteiro do clipe (fade/slide/zoom/pop/spin/bounce) tipo CapCut | [`src/core/ClipAnimation.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/ClipAnimation.h) `enum class ClipAnimKind` | É o mesmo "presets de animação nomeados" já aceito (Onda 1, item 2) — o Drift tem 10 tipos (`Fade, SlideUp/Down/Left/Right, ZoomIn/Out, Pop, SpinCW/CCW, Bounce`), um número concreto de referência caso falte um alvo pra "quantos presets". |

---

## 2. O que o SupremoCut tem que o Drift não tem

Igualmente honesto — é o que se perderia numa migração pro Drift ou pra qualquer editor genérico
do mesmo molde.

| Item do SupremoCut | Onde vive (nosso código) | Confirmação de ausência no Drift |
|---|---|---|
| **Dublagem por síntese de voz (ElevenLabs) que vira projeto editável** | `motor/voz.py` + `motor/dublar.py` (`estado-atual.md` §3) | Nenhuma menção a TTS/dublagem em README, docs ou `Drift-Addons` — o Drift edita vídeo, não gera nem troca a fala. |
| **Separação voz/música (Demucs, GPU, local)** | Catálogo Onda 3 item 14 — planejado, ainda não confirmado como implementado no motor lido | O Drift tem "Separate audio" (`Ctrl+Shift+S`), que só **extrai a faixa de áudio embutida pra uma trilha própria** (`docs/timeline`) — não separa vocais de instrumental dentro de um áudio já misturado. São coisas diferentes; o Drift não tem a segunda. |
| **Timestamp real por palavra (faster-whisper) → edição por texto** | `motor/transcrever.py`; `Palavra.t/fim` em `tipos.ts:79-86`; apagar palavra corta vídeo (catálogo Onda 2, item 7) | **Confirmado no próprio código-fonte do Drift** que isso é impossível do jeito deles hoje: o comentário de [`src/core/SubtitleCue.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/SubtitleCue.h) diz literalmente *"true word timestamps aren't available from our ONNX Whisper export"* — o destaque de palavra no estilo Karaoke é **interpolação proporcional** dentro da janela da legenda, não tempo medido. Isso barra estruturalmente qualquer "edição por texto" (apagar palavra = cortar vídeo no tempo exato) no Drift, porque a base de dados não existe. |
| **Corte automático de silêncio** | Catálogo Onda 2, item 5 — planejado | Nenhuma menção a detecção/corte de silêncio em nenhuma página lida (`getting-started`, `timeline`, `audio`, `speed-and-motion`) nem no MCP (`audio` toolbox só tem forma de onda, batida e volume por clipe). |
| **Ducking automático (música abaixa sob a fala)** | Catálogo Onda 3, item 11 — planejado | Áudio do Drift é mixagem manual + efeitos por clipe (`clip-tools/audio`); não há automação de volume condicionada à presença de fala em outra faixa. |
| **Correção de loudness (não só medição)** | `motor/audio.py:85-124` (`cadeia_loudness`, `normalizar`, `loudnorm` de 2 passagens, alvo -14 LUFS), `motor/masterizar.py`, `motor/dublar.py:166` | Confirmado no próprio header: [`LoudnessMeter.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/LoudnessMeter.h) só **mede** (`integratedLufs`, `truePeakDb`) — não achei nenhum filtro de correção de ganho a um alvo em `docs/clip-tools/audio` nem no MCP. |
| **Render simultâneo em 3 formatos (16:9, 9:16, 1:1) do mesmo roteiro** | `estudio/src/Root.tsx:25-73` (3 `<Composition>`), geometria proporcional 0..1 em `tipos.ts`/`layouts.ts` | O Drift fixa a proporção **na criação do projeto** (`getting-started`: escolher "layout" uma vez) e a exportação só permite reduzir o tamanho na mesma proporção (`export`: "Pick a size — the picture shape stays the same"). Não há reflow entre formatos a partir de um único projeto. |
| **Multicam por correlação automática de áudio (câmera + tela, offset por fonte)** | `motor/sincronizar.py` inteiro (`_envelope`, `descobrir_atraso`, janela ±180s, FFT) | O Drift não tem noção de "múltiplas fontes do mesmo evento sincronizadas por áudio" — é uma timeline única onde o usuário alinha manualmente. Nenhuma menção a sincronia automática multi-câmera em nenhuma página. |
| **Zonas seguras 9:16 (guia de UI TikTok/Reels)** | `Palco.tsx:53-59`, `Barra.tsx` (catálogo já registrou isso como implementado, `estado-atual.md` §6.11) | Não encontrado em nenhuma página do Drift; o layout é escolhido por "platform template" na criação, mas não vi guia visual de zona segura na composição. |
| **Fluxo dedicado "cobrir texto queimado na tela"** (tarja) | `Overlay.tsx:38-45`, tipo `Caixa` em `tipos.ts:141-156` | O Drift tem máscaras e texto genéricos, mas nenhum fluxo/preset pensado especificamente pra cobrir texto de um criativo estrangeiro antes de dublar. |
| **UI e vocabulário em português, pensados pra leigo** | Todo o `estudio/editor/` | Drift é em inglês (só a UI, não `src/mcp/`, fica em inglês por decisão de projeto — ver `BUILDING.md`: "MCP tool names... stay English on purpose"); tradução de UI existe (Qt Linguist, `i18n/`) mas é tradução literal de um editor genérico, não vocabulário desenhado pro fluxo de anúncio. |

**Achado lateral relevante**: o **Prism**, o outro produto da CutWire Studios (mixer de mídia ao
vivo pra eventos, Qt 6 + FFmpeg + OpenGL — ver [`README`](https://github.com/CutWire-Studios/Prism)),
**também** expõe um servidor MCP local ("Agent Access… so Cursor, Claude Code, or other agents
can drive the mixer"). Ou seja, "editor com braço de agente de IA" não é um acidente do Drift —
é uma aposta da empresa inteira, repetida nos dois produtos. Isso não muda a análise de
viabilidade de nenhum item acima, mas é contexto que reforça a leitura de que primitivas
agent-facing (capture, inspect com revisão, catálogo de ferramentas) são um padrão deliberado
deles, não um extra.

---

## 3. Arquitetura do Drift

### 3.1 Modelo de dados da timeline

Hierarquia real (`src/core/`, todos os `.h` citados foram lidos por inteiro):

```
Project                                  (Project.h)
 ├─ tracks: QList<Track>                 (Track.h)
 │   └─ Track { type, clips, transitions, muted, hidden, locked, showWaveform, heightScale }
 │       ├─ clips: QList<Clip>           (Clip.h)
 │       │   { id, assetId, linkId, type, timelineStart/Duration (TimeUs, µs),
 │       │     srcIn/srcOut, blendMode, speed | speedCurve, reverse, flipH/V,
 │       │     mask: Mask, faceTrackPath, stabilize* , fadeIn/OutUs + fadeCurve,
 │       │     animIn/animOut: ClipAnimation,
 │       │     opacity/transformX/Y/W/H/rotation/volume: KeyframeTrack<double>,
 │       │     effects/audioEffects: QList<Effect> }
 │       └─ transitions: QList<Transition>  (Transition.h)
 │           { fromClipId, toClipId, kindId, parameters, durationUs }
 ├─ assets: QHash<QString, MediaAsset> (+ binFolders)
 ├─ bookmarks: QList<Bookmark>
 ├─ workAreaIn/OutUs (In/Out de export)
 └─ background: {kind: Color|Blur, color, blurStrength}
```

Pontos que valem nota:

- **Tempo é `int64_t` em microssegundos** (`using TimeUs = int64_t;`, [`Time.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Time.h)) —
  um único relógio para o projeto inteiro, sem a distinção MESTRE/FONTE/FINAL que o SupremoCut
  precisa manter (`estado-atual.md` §2.1-2.2) porque tem múltiplas fontes de câmera com offsets
  próprios. O Drift não sincroniza múltiplas fontes automaticamente (ver §2), então não paga esse
  custo — mas também não *resolve* o problema, só não o tem.
- **`Clip` é uma união de fato**: o mesmo struct serve pra vídeo, áudio, imagem, texto, legenda e
  forma (`enum class ClipType`), com campos que só fazem sentido pra alguns tipos (`textContent`/
  `textStyle` só para Text/Subtitle, `subtitleCues` só para Subtitle, `shapeStyle` só para Shape).
  É o oposto do `tipos.ts` do SupremoCut, que tem tipos `Overlay`/`Cena`/`ClipeAudio` separados.
- **Keyframes vivem no próprio `Clip`** como `KeyframeTrack<double>` tipado por propriedade
  (`opacity`, `transformX`...), com curva Bezier completa (`Keyframe.h`, ver §1.12) — o
  SupremoCut hoje não tem um `KeyframeTrack` genérico; tem campos estáticos por bloco (`Foco`,
  `pip`) sem variação temporal dentro do bloco.
- **`Effect` é per-clip e keyframable por parâmetro** ([`Effect.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/core/Effect.h)):
  `paramKeyframes: QMap<QString, KeyframeTrack<double>>` — um parâmetro individual pode ter sua
  própria animação, e `rescaleEffectKeyframes()` reescala todas as chaves proporcionalmente
  quando o clipe muda de duração ("copiar de um clipe de 2s pra um de 6s e continuar fazendo
  sentido" — o mesmo problema que motivou "copiar/colar animação" no catálogo, Onda 1 item 4, só
  que resolvido por reescala automática em vez de recolagem manual).
- **`Transition` não guarda o efeito visual** — só referencia um `kindId` (ex.: `"plasma_burn"`)
  que aponta pro pacote GPU (§1.2); o dado do `core/` é só "quais dois clipes, qual pacote, que
  duração, quais parâmetros". A serialização (`kindId`) é o contrato estável entre versões —
  os 9 ids herdados do enum antigo (`crossfade`, `wipe_left`...) "must keep those exact names,
  since older project files already reference them".

### 3.2 O compositor único (preview e export compartilham — como, exatamente)

A frase do README ("Preview and export share one compositor, so what you see is what you get")
tem uma implementação concreta e testável, não é só marketing:

```cpp
// src/engine/FrameCompositor.h
class FrameCompositor {
public:
    QImage compositeAt(drift::TimeUs timelineUs) const;
    QImage compositeAt(drift::TimeUs timelineUs, const RenderOptions &options) const;
    GpuFrameTexture compositeToTextureAt(drift::TimeUs timelineUs, const RenderOptions &options) const;
    bool buildSceneAt(drift::TimeUs timelineUs, const RenderOptions &options, GpuScene *sceneOut) const;
private:
    bool prepare(...) const; // resolve tamanho de canvas, aquece decodificadores, monta a cena
    const drift::Project *m_project = nullptr;
};
```

`compositeAt(T)` é **puro em função de T e do `Project`** — dado o mesmo projeto e o mesmo tempo,
a saída é a mesma, seja chamado pelo player de preview ou pelo exportador. O comentário do
[`Exporter.h`](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/src/engine/Exporter.h)
confirma o motivo de existir: *"WYSIWYG exporter: encodes frames straight from FrameCompositor
and audio from AudioMixer, so the exported file matches the preview exactly (single
compositor)."* A única diferença entre os dois caminhos é `RenderOptions.previewScale` (o preview
roda em resolução reduzida, nunca upscaled — `kMinPreviewScale = 0.02`) e `readAheadUs` (só
setado em reprodução realtime, não em preview parado nem em export).

Threading (README/`BUILDING.md`, tabela "Architecture (summary)"):

| Thread | Responsabilidade |
|---|---|
| Main (GUI) | QML, models, pilha de undo, UI do playhead |
| Decode workers | `ClipReaderPool` — uma thread por caminho de mídia ativo |
| Compositor | `CompositorService` — monta quadros fora da GUI thread |
| Áudio (pull) | `QAudioSink` → `PlaybackClock` (**áudio manda o relógio**, não o vídeo) |

Fluxo de dados (vídeo): `Media file → ClipReader → EffectProcessor → FrameCompositor (transforms,
blending, text, masks) → PreviewItem (QSGTexture) | Exporter`. Fluxo (áudio):
`Media file → ClipReader → AudioMixer (volume, fades, audio effects) → QAudioSink | Exporter`.

O caso especial documentado é o **Time Echo** (§1.10): ele quebraria a pureza de
`compositeAt(T)` se histórico viesse de um buffer de preview separado — por isso a solução foi
recalcular as amostras antigas por decodificação determinística (`T - n*frameDuration`), não por
cache de quadros já mostrados.

### 3.3 Sistema de efeitos (arquitetura, além do formato de arquivo já coberto em §1.2)

Camada de código: `EffectPackageLoader` (le `effect.json`+`.frag` do disco) → `GpuPackageParse`
(parse do pipeline declarado) → `GpuEffectExecutor` (roda passes, gerencia buffers intermediários,
faz fallback pra passthrough em erro de shader) → `GpuCompositor`/`GlRuntime` (contexto OpenGL
compartilhado). `EffectCatalog`/`EffectTemplateCatalog` são os índices em memória (id → metadata)
que a UI browsa; `EffectProcessor` é quem, por clipe, resolve a lista de `Effect` (do `core/`) em
chamadas reais ao executor. A mesma separação **dado declarativo (`core::Effect`) vs. motor
(`engine::EffectProcessor`/`GpuEffectExecutor`)** se repete em `Transition`/transições e em
`EffectTemplateCatalog`/templates — é o padrão arquitetural mais consistente do projeto: o
`core/` nunca sabe *como* renderizar, só *o quê* e *com quais parâmetros*.

### 3.4 Protocolo MCP

Camadas (`src/mcp/`, 15 arquivos — só li os `.h` de `McpServer`, `McpProtocol`, `McpCatalog`):

```
McpServer          — dono do ciclo de vida: start()/stop(), token rotativo, QThread próprio
  └─ McpHttp        — servidor HTTP (bind 127.0.0.1) — não lido em detalhe (.cpp)
  └─ McpDispatcher   — roteia {toolbox, tool, args} pra a função C++ real
       (+ McpDispatcherExtended.cpp, McpCatalogExtendedOps.inl — o catálogo é grande
       o bastante pra ser fatiado em mais de um arquivo)
McpProtocol         — envelope JSON-RPC: handleJsonRpc(body, toolbox, handler),
                      toolsForEndpoint(toolbox) — trata notificação (sem id) devolvendo null
McpCatalog          — a fonte única de verdade: toolboxNames(), catalogPayload(),
                      toolboxPayload(name), homepageTools(), isReadOnlyOp(name),
                      undoExemptOps(), selectionBasedOps(), e — achado interessante —
                      agentGuideText() e homepageHtml(): o texto do guia do agente
                      (que deveria estar em AGENTS.md, ver limitações no topo) e a
                      página HTML de ajuda são **gerados a partir do mesmo catálogo**
                      que gera os schemas JSON, não escritos à mão em paralelo.
McpStdio            — o caminho `--mcp-stdio` (attach direto, sem servidor+token)
McpSession          — estado de sessão (token, conexão)
```

`McpServer::handleRpc(toolbox, body)` é o único ponto de entrada real; internamente despacha
pra `dispatchTool(name, args)`. A separação `catalog`/`toolbox` (descoberta) vs. `apply` (execução
em lote, 1 passo de undo) vs. `inspect`/`capture` (leitura, funcionam em qualquer endpoint) é
uma decisão deliberada de protocolo: **descoberta é cara e cacheável (o agente pede uma vez),
execução é barata e deve ser agrupável, leitura tem que funcionar de qualquer lugar**. As regras
de "traps" documentadas em `MCP.md` (listadas no §1.1) mostram que esse desenho já foi testado
contra um agente de verdade tentando usá-lo errado — `set_transform` gravando no playhead sem
querer, `set_mask` apagando chaves que o chamador não mandou de propósito, etc.

### 3.5 Nota de arquitetura comparada (análise, não leitura)

Um ponto que vale registrar explicitamente porque muda a estimativa de esforço de quase toda a
seção 1: o **Drift precisou construir manualmente** o `FrameCompositor` como uma função pura de
`(Project, TimeUs) → quadro`, com todo o cuidado de threading do §3.2, porque Qt+FFmpeg não dão
isso de graça — um preview ao vivo e um export em lote são, por padrão, dois caminhos de código
diferentes em qualquer app C++/Qt convencional. **O Remotion já resolve esse problema pela
arquitetura**: toda composição é uma árvore React pura em função de `frame` (via
`useCurrentFrame()`), e tanto o `@remotion/player` (preview) quanto `renderMedia` (export) só
fazem essa árvore ser avaliada — em Chromium headless, quadro a quadro — pelos dois caminhos.
Ou seja, boa parte do que o Drift documenta como conquista arquitetural difícil (§3.2, e o
cuidado extra do Time Echo em §1.10/§3.2) **o SupremoCut já tem de graça só por ter escolhido
Remotion**. O trabalho que resta, pras seções 1.2/1.9/1.10 acima, é escrever o *conteúdo*
(shaders, filtros, presets) — não resolver de novo o problema de sincronia preview/export que
motivou boa parte do design do lado deles.

---

## Fontes (lista consolidada)

- Repo: <https://github.com/CutWire-Studios/Drift> · [Issues](https://github.com/CutWire-Studios/Drift/issues) · [Releases](https://github.com/CutWire-Studios/Drift/releases) · [docs/](https://github.com/CutWire-Studios/Drift/tree/main/docs)
- Docs: [BUILDING.md](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/BUILDING.md) · [MCP.md](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/MCP.md) · [gpu-effects.md](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-effects.md) · [gpu-transitions.md](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/gpu-transitions.md) · [time-echo-architecture.md](https://raw.githubusercontent.com/CutWire-Studios/Drift/main/docs/time-echo-architecture.md)
- Código: `src/core/{Clip,Project,Track,Time,Keyframe,Stabilize,ClipAnimation,Mask,Transition,Effect,SubtitleCue}.h`, `src/engine/{LoudnessMeter,ProjectBundle,FrameCompositor,Exporter,FaceSwapSource,EffectTemplateCatalog,ObjectDetector}.h`, `src/mcp/{McpServer,McpProtocol,McpCatalog}.h` — todos em `raw.githubusercontent.com/CutWire-Studios/Drift/main/<caminho>`
- [CutWire-Studios/Drift-Addons](https://github.com/CutWire-Studios/Drift-Addons)
- [CutWire-Studios/Prism](https://github.com/CutWire-Studios/Prism)
- [docs.cutwire.org/drift](https://docs.cutwire.org/drift) e subpáginas: [getting-started](https://docs.cutwire.org/drift/getting-started) · [projects](https://docs.cutwire.org/drift/projects) · [media-library](https://docs.cutwire.org/drift/media-library) · [timeline](https://docs.cutwire.org/drift/timeline) · [export](https://docs.cutwire.org/drift/export) · [addons](https://docs.cutwire.org/drift/addons) · [clip-tools/text-and-titles](https://docs.cutwire.org/drift/clip-tools/text-and-titles) · [clip-tools/effects](https://docs.cutwire.org/drift/clip-tools/effects) · [clip-tools/templates](https://docs.cutwire.org/drift/clip-tools/templates) · [clip-tools/transitions](https://docs.cutwire.org/drift/clip-tools/transitions) · [clip-tools/audio](https://docs.cutwire.org/drift/clip-tools/audio) · [clip-tools/speed-and-motion](https://docs.cutwire.org/drift/clip-tools/speed-and-motion) · [clip-tools/cutouts-and-masks](https://docs.cutwire.org/drift/clip-tools/cutouts-and-masks) · [clip-tools/keyframes](https://docs.cutwire.org/drift/clip-tools/keyframes) · [clip-tools/captions](https://docs.cutwire.org/drift/clip-tools/captions)
- Lado SupremoCut: `F:\SupremoCut\docs\pesquisa\catalogo.md`, `F:\SupremoCut\docs\brownfield\estado-atual.md`, mais grep direto em `F:\SupremoCut\motor\audio.py`, `masterizar.py`, `dublar.py`, `othor.py`, `supremo.py`, `tratar.py` e em `F:\SupremoCut\estudio\src` (para confirmar loudnorm de 2 passagens e ausência de "multicam" como termo).
