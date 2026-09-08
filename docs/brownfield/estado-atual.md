# SupremoCut — Estado Atual (mapa do Arqueólogo)

Passagem READ-ONLY, focada em dar ao planejamento de features um mapa preciso do que já
existe, para não inventar e não duplicar. Toda afirmação abaixo cita `arquivo:linha`. Onde
uma afirmação de um doc antigo (`docs/brownfield/motor.md`, `composicao.md`, `editor.md`,
`revisao.md`, `revisao2.md`) não bateu com o código lido HOJE, prevalece o código, e a
divergência é anotada — o projeto evoluiu bastante desde essas passagens (várias correções já
confirmadas: `ENTRADA` não existe mais como bug, `preparar` já faz backup, `Freeze` já usa
quadro relativo, `spawn` já tem `on("error")` nos três pontos, marcadores já vivem no relógio
certo). Nada foi executado; nenhum arquivo do projeto foi alterado.

**Escopo lido por inteiro:** os 12 arquivos de `motor/*.py`; os 13 arquivos `.ts`/`.tsx` de
`estudio/src/` (+ os 2 JSON de dados `roteiro-atual.json`/`estilo-atual.json`); os 17 arquivos
de `estudio/editor/` (16 `.tsx`/`.ts`/`.html` + `estilos.css`); `estudio/servidor.mjs`;
`estudio/vite.config.mts`; `estudio/remotion.config.ts`; `estudio/package.json`;
`config/estilo.json`, `config/direcao.json`, `config/tratamento.json`; os 5 docs de
`docs/brownfield/`; `docs/pesquisa/editores.md`; `LEIA-ME.md`; `.gitignore`. Também inspecionados
por `Glob`: `projetos/*/roteiro.json` (6 projetos reais: `teste`, `demanda-01`, `everyday-finds`,
`homefaves-uk`, `origyn-2`, `origyn`), `projetos/_dublagem/*.json` (8 fichas de dublagem),
`assets/musica/` (vazia, só `.gitkeep`), presença de `.env` (existe, ignorado pelo git).

**Correção de caminho em relação ao pedido:** `servidor.mjs` **não** mora em
`estudio/editor/servidor.mjs` — mora em `F:\SupremoCut\estudio\servidor.mjs`, um nível acima.
`estudio/editor/` é só o front-end Vite (`root: "editor"` em `vite.config.mts:13`); o servidor
Express é irmão de `src/` e `editor/`. Trato "editor" como área lógica (UI + servidor de dados),
citando o caminho real de cada arquivo.

---

## 1. Árvore executiva

```
F:\SupremoCut\
├── motor\            pipeline Python (CLI supremo.py + módulos)              2604 linhas
├── estudio\
│   ├── src\          composição Remotion — o que RENDERIZA                   1933 linhas
│   ├── editor\        UI React do editor visual (Vite)                       4664 linhas
│   └── servidor.mjs   API Express que liga UI ↔ disco ↔ motor Python          462 linhas
├── config\           estilo.json, direcao.json, tratamento.json (JSON puro)  176 linhas
├── projetos\         um por vídeo: bruto\, trabalho\, roteiro.json
├── assets\musica\    trilhas de fundo (hoje vazia)
├── saida\            vídeos renderizados
└── docs\brownfield\  as 5 passagens anteriores do Arqueólogo (lidas nesta)
```

---

## 2. Modelo de dados — `estudio/src/tipos.ts`

Este arquivo (325 linhas) é o contrato inteiro. Trecho de topo, `tipos.ts:1-6`: *"Este arquivo
define o 'contrato': tudo que o motor Python gera e que você pode editar na mão dentro de
`projetos/<nome>/roteiro.json`"*.

### 2.1 Convenção de relógios usada neste relatório

Três relógios de tempo coexistem no `roteiro.json`. Nomes tirados do próprio código
(`supremo.py:247`: *"tudo fica no relogio MESTRE"*):

| Relógio | O que é | Zero fica em | Quem vive aqui |
|---|---|---|---|
| **MESTRE** | Eixo sintético comum às fontes, produzido pela sincronia automática. Não é o tempo nativo de nenhum arquivo. | O início da fonte que começou primeiro (`sincronizar.py:132`: `base = min(brutos.values())`) | `Cena.fonte_inicio`, `ClipeAudio.fonte_inicio` |
| **FONTE / arquivo** (de áudio) | Tempo nativo dentro do arquivo de áudio escolhido como `papel_audio` (a câmera, quando existe). `tempo_no_arquivo = tempo_mestre + offset` | O início físico daquele arquivo específico | `Palavra.t`/`.fim`, `marcadores[].t` |
| **FINAL** | Posição no vídeo montado/renderizado, soma das `duracao` das cenas anteriores | O quadro 0 do vídeo final | `posicoes[i]` (editor), `Sequence.from` (Remotion), `Musica.inicio`, `Overlay.inicio`, `ClipeAudio.inicio`, `Legendas.ligada_em` |

Fórmula-ponte, documentada em `sincronizar.py:96` (docstring de `sincronizar()`) e usada em
`Cena.tsx:111` e `:125`: **`tempo_no_arquivo_da_fonte_X = tempo_MESTRE + fontes[X].offset`**.
Cada fonte (câmera, tela) tem o **seu próprio** `offset` — não existe um único offset global.
Quando o projeto tem câmera, `papel_audio = "camera"` (`supremo.py:234`), então
`roteiro.audio.offset === roteiro.fontes.camera.offset` (os dois vêm de `sync["camera"]["offset"]`,
`supremo.py:223-230` e `:255`) — mas `roteiro.fontes.tela.offset` é **um número diferente**.

### 2.2 O ponto mais importante deste relatório: `tipos.ts` mistura MESTRE e FONTE sob o mesmo rótulo

`tipos.ts:81-84` (comentário do campo `Palavra.t`):
```
* Tempo no relógio da FONTE (o arquivo bruto), em segundos — a mesma base de
* `fonte_inicio` das cenas. A posição no vídeo final é derivada dos cortes a
* cada render...
```
`tipos.ts:274-278` (comentário do campo `marcadores`):
```
* Momentos marcados, no relógio da FONTE — mesma base das palavras e das
* cenas. Guardar em tempo final faria a bandeirinha escorregar...
```
Os dois comentários dizem que `Palavra.t`/`marcadores[].t` compartilham "a mesma base" de
`Cena.fonte_inicio`. **Isso só é verdade quando `roteiro.audio.offset === 0`.** O próprio código
precisa somar o offset para reconciliar os dois:

- `estudio/src/legendas.ts:38` — `const de = cena.fonte_inicio + offsetAudio;` (dentro de
  `palavrasNaLinhaDoTempo`, que converte `Palavra.t` para o relógio FINAL).
- `estudio/editor/Editor.tsx:296-311` (`tempoNaFonte`) — soma `roteiro.audio?.offset` a
  `c.fonte_inicio` para achar o instante no MESMO relógio de `Palavra.t`.
- `estudio/editor/Editor.tsx:323-335` (`marcar`) — grava `t = tempoNaFonte`, ou seja, já com o
  offset somado — **não** é o mesmo número que `fonte_inicio` da cena onde a agulha está.
- `estudio/editor/Editor.tsx:351-371` (`marcadoresNaLinha`) — para desenhar o marcador na
  timeline, refaz `const de = c.fonte_inicio + off;` e procura em qual bloco `m.t` cai.

Em projetos de uma fonte só (`fontes.tela: null`, caso de `origyn`, `homefaves-uk` etc.) ou
com `audio.offset: 0` (caso de `demanda-01` e do `roteiro-atual.json` hoje sincronizado —
ver §2.4), o erro é zero e passa despercebido — exatamente o padrão que já causou a deriva de
legenda documentada em `docs/brownfield/composicao.md:62-93`. Qualquer feature nova que leia
`fonte_inicio` de uma cena e tente comparar direto com `Palavra.t` ou `marcadores[].t` (sem somar
`roteiro.audio.offset`) **vai** produzir o mesmo bug em um projeto de 2 fontes com offset != 0.

`legendas.ligada_em` é o único campo cujo comentário já está correto:
`tipos.ts:118-119`: *"Faixas de tempo (**no vídeo final**) onde a legenda aparece."* — mas isso
cria uma fragilidade funcional diferente, ver §6.2.

### 2.3 Tabela completa de tipos (campo a campo)

| Tipo | Campo | `tipos.ts` | Significado | Relógio |
|---|---|---|---|---|
| `Retangulo` | `x,y,largura,altura,raio,opacidade,sombra,borda` | 9-18 | Geometria de uma camada (câmera ou tela), proporcional 0..1 (px só em `raio`/`borda`) | n/a (espaço) |
| `Layout` | união de 7 strings | 21-28 | Arranjo câmera/tela na tela: `camera`,`tela`,`pip`,`pip_grande`,`pip_invertido`,`split`,`split_diagonal` | n/a |
| `Entrada` | união discriminada por `tipo` | 31-37 | Transição de entrada da cena: `corte`,`fade`,`morph`,`deslize`,`zoom_cruzado`,`flash` (todas exceto `corte` têm `duracao`; `deslize` tem `direcao`) | duração = intervalo, não instante |
| `Foco` | `x,y,zoom,suavidade` | 40-45 | Zoom/pan dentro da camada de tela | n/a (espaço) |
| `Cena` | `id` | 49 | Id da cena, `c%03d` do motor (`roteirizar.py:380`) ou gerado pelo editor (`c{id}b{ts}` ao dividir, `c{ts}{rand}` ao duplicar) | — |
| `Cena` | `fonte_inicio` | 50-51 | Início do bloco | **MESTRE** (comentário do arquivo diz "arquivo BRUTO" — impreciso, ver §2.2 e §6.1) |
| `Cena` | `duracao` | 52-53 | Duração no vídeo final | intervalo FINAL; consome `duracao*velocidade` de material da fonte |
| `Cena` | `layout` | 54 | Ver `Layout` acima | — |
| `Cena` | `entrada` | 55 | Ver `Entrada` acima | — |
| `Cena` | `pip?` | 56-61 | Canto/escala/formato do quadradinho quando o layout usa PiP | espaço |
| `Cena` | `foco?` | 62-63 | Zoom/pan da camada de tela | espaço |
| `Cena` | `velocidade?` | 64-65 | 1 = normal; motor sempre escreve 1 (`roteirizar.py:386`) | fator, não tempo |
| `Cena` | `volume?` | 66-67 | Volume do áudio deste bloco, 0..2 na UI (`PainelBloco.tsx:293`), sem teto no tipo | — |
| `Cena` | `congelar?` | 68-73 | Segundo **dentro do próprio bloco** (0 = primeiro quadro dele) onde a imagem congela; áudio segue normal | relativo ao **início do bloco no FINAL**, não é MESTRE nem FONTE — um 4º micro-relógio, local à cena |
| `Cena` | `nota?` | 74-75 | Anotação livre; motor usa o começo da frase falada (`roteirizar.py:387`) | — |
| `Palavra` | `t,fim` | 79-86 | Início/fim da palavra | **FONTE** (arquivo de áudio) — ver §2.2 |
| `Palavra` | `texto,enfase` | 87-89 | Texto e se ganha cor de destaque | — |
| `EstiloLegenda` | união de 7 + `nenhum` | 99-114 | Preset visual: `destaque`,`bloco`,`karaoke`,`hormozi`,`caixa`,`neon`,`pop` | — |
| `Legendas` | `estilo` | 117 | Ver acima | — |
| `Legendas` | `ligada_em` | 118-119 | Janelas `[ini,fim]` onde a legenda aparece; vazio = vídeo todo | **FINAL** |
| `Legendas` | `palavras` | 120 | Array de `Palavra` | FONTE |
| `Legendas` | `palavras_chave?` | 121-125 | Lista de palavras que ganham destaque onde aparecerem | — |
| `Legendas` | `base_tempo?` | 126-131 | `"fonte"` (correto/atual) ou `"final"` (formato antigo, convertido por `migrar.py` ao abrir) | meta-relógio |
| `Caixa` | 10 campos de estilo | 141-156 | Aparência da tarja de cobertura (cor, borda, raio, texto, contorno, caixa alta) | — |
| `Overlay` | `id,inicio,duracao,tipo,texto,subtexto?,posicao?,tamanho?,caixa?` | 159-172 | Texto/tarja por cima do vídeo; `tipo`: `titulo`,`lower_third`,`destaque`,`marca`,`tarja` | `inicio`/`duracao` em **FINAL** |
| `Fonte` | `arquivo,arquivo_preview?,offset,duracao,largura,altura` | 187-197 | Um vídeo bruto (câmera ou tela) já processado | `offset`: MESTRE→arquivo desta fonte |
| `Musica` | `arquivo,volume,abaixar,fade_entrada,fade_saida,inicio` | 200-212 | Trilha de fundo com ducking automático | `inicio` **FINAL**; fades relativos ao início da própria música |
| `ClipeAudio` | `id,inicio,duracao,fonte_inicio,arquivo?,volume,fade_entrada,fade_saida,vinculado_a,nota?` | 224-239 | Um pedaço de áudio independente do vídeo (trilha nova) | `inicio` **FINAL**; `fonte_inicio` **MESTRE** (mesma convenção de `Cena.fonte_inicio`) |
| `Roteiro` | `versao,projeto,fps,largura,altura` | 242-246 | Cabeçalho do projeto | — |
| `Roteiro` | `fontes.camera?/tela?` | 247-250 | As duas fontes possíveis | — |
| `Roteiro` | `audio.{arquivo,arquivo_preview?,picos?,offset?}` | 251-264 | Áudio da fonte inteira, não pré-cortado | `offset`: MESTRE→arquivo de áudio |
| `Roteiro` | `cenas` | 265 | Array de `Cena` | — |
| `Roteiro` | `trilha_audio?` | 266-270 | Ausente = modo antigo (som soldado à cena) | — |
| `Roteiro` | `legendas,overlays,musica?` | 271-273 | — | — |
| `Roteiro` | `marcadores?` | 274-279 | Bandeirinhas do usuário | **FONTE** (mesmo relógio de `Palavra.t`, ver §2.2) |
| `Estilo` | `cores,fonte,pip,animacao,legenda` | 283-318 | Visual da marca — vive em `config/estilo.json`, **global ao repositório** (não por projeto, ver §6.6) | — |
| `PropsVideo` | `roteiro,estilo,pasta` | 320-325 | Props da composição Remotion | — |

### 2.4 Estado real no repositório (evidência viva)

`estudio/src/roteiro-atual.json` (133 linhas — muito menor que os ~12.500 linhas de
`demanda-01` citados nos docs antigos: o projeto sincronizado no estúdio HOJE é **`origyn`**,
fonte única, 30 fps, 1080×1920, `audio.offset: 0`, sem `tela`, sem música, com `trilha_audio`
(1 clipe) — `roteiro-atual.json:3-16,120-132`). É saída do pipeline de dublagem (`dublar.py`,
ver §3.9): `legendas.estilo: "nenhum"` com `palavras` preenchidas mas legenda desligada
(`roteiro-atual.json:39-43`), e `marcadores` um por fala (`:90-119`). Como `audio.offset: 0`
aqui, a imprecisão do §2.2 está mascarada neste projeto específico — mas `projetos/teste/roteiro.json`
tem duas fontes com offsets diferentes (histórico dos docs antigos), então o caso de 2 fontes
com offset != 0 é real no repositório.

---

## 3. Inventário do que está implementado

| Capacidade | Onde vive | Observação |
|---|---|---|
| **Timeline com zoom, régua, encaixe automático** | `estudio/editor/componentes/Timeline.tsx:102` (escala), `:177-189` (`encaixarTudo`), `:193-218` (zoom Ctrl+roda), `:396-403` (régua com passos "redondos") | Escala 0.4x–200x; `PASSOS` pré-definidos (`Timeline.tsx:46`) |
| **Dois modos de aparar**: mover-corte (roll edit) vs. aparar (ripple) | `Timeline.tsx:107-133` (`modo`, persistido em `localStorage:"supremocut:modo"`), lógica em `:287-347` | "corte" preserva duração total (ver invariante §6, item preservado); "apara" desloca o resto |
| **Ímã (snap) na agulha e nas emendas** | `Timeline.tsx:136-153` (estado + `localStorage:"supremocut:ima"`), aplicado em `:251-263,301-310,337-344`; `Alt` solta temporariamente | Feedback visual: classe `.grudado` (`estilos.css:566-574`) |
| **Dividir bloco no cursor** | `Editor.tsx:420-445` (`dividirNoCursor`) | Atalho `S`/`T` (`Editor.tsx:634-638`); já aplica `emQuadros` nos dois pedaços |
| **Apagar / mover / copiar / colar / duplicar bloco** | `Editor.tsx:447-522` (`apagarCena`,`inserirCopia`,`copiar`,`colar`,`duplicar`,`moverCena`) | Atalhos `Delete`,`Ctrl+C/V/D` (`Editor.tsx:592-643`) |
| **"Aplicar entrada a todos" / "Tudo corte seco"** | `Editor.tsx:459-473` (`entradaEmTodos`); botões em `PainelBloco.tsx:208-223` | Primeiro bloco sempre fica `corte` (`Editor.tsx:467-469`) |
| **Undo/Redo com agrupamento de gestos** | `Editor.tsx:24-26` (`JANELA_AGRUPAMENTO=450ms`, `LIMITE_HISTORICO=120`), `:101-135` (`registrar/desfazer/refazer/encerrarGesto`) | `sujo` comparado por **referência de objeto**, não índice (comentário `Editor.tsx:34-42` explica o bug que isso corrigiu) |
| **Autosave (3s) + Ctrl+S** | `Editor.tsx:701-707` (autosave), `:574-578` (Ctrl+S), `:232-254` (`salvar`, com trava `salvandoAgora` e checagem de projeto) |  |
| **Trilha de áudio independente do vídeo** | Tipo `ClipeAudio` (`tipos.ts:224-239`); conversão automática de roteiro antigo em `estudio/src/trilha.ts:15-41` (`trilhaDasCenas`,`comTrilha`); reacoplamento em `:49-71` (`seguirCenas`); UI em `Timeline.tsx:647-735` (pista verde) e `PainelAudio.tsx:46-109` | Vínculo `vinculado_a`: clipe acompanha a cena até o usuário arrastar (solta sozinho, `Timeline.tsx:265,275-283` / `Editor.tsx:212-225`) |
| **Forma de onda desenhada por cima dos cortes atuais** | `estudio/editor/componentes/Onda.tsx` inteiro; motor gera os picos em `motor/ondas.py:21-58` (`PICOS_POR_SEGUNDO=50`) | Onda recalcula por CLIPE da trilha (`Onda.tsx:73-107`), não pelas cenas — já desacoplada do vídeo |
| **Música de fundo com ducking automático** | `estudio/src/musica.ts` inteiro (`curvaDeVolume`); UI `PainelAudio.tsx:123-227`; composição `Video.tsx:231-246` | Curva nasce no relógio da PRÓPRIA música (comentário `musica.ts:27-35`), não do vídeo — index relativo ao `Sequence` |
| **Legenda dinâmica, 7 presets visuais** | `estudio/src/componentes/Legenda.tsx` inteiro (`hormozi,caixa,neon,pop,destaque,karaoke,bloco`); UI `PainelLegenda.tsx:35-65` | Palavras agrupadas por pausa/pontuação/tamanho (`Legenda.tsx:19-44`) |
| **Legenda sempre no corte atual (derivada, não gravada)** | `estudio/src/legendas.ts:24-56` (`palavrasNaLinhaDoTempo`) | Chamada em `Video.tsx:38-46` (render) e `Editor.tsx:526-533` (export .srt) — mesma função nos dois lugares |
| **Correção de texto da legenda perto da agulha** | `PainelLegenda.tsx:260-323` | Mostra só palavras num raio de `-4s/+8s` de `tempoAtual` (linha 268); tempo exibido é relativo, de propósito (comentário `:298-299`) para não confundir relógios |
| **Palavras-chave com destaque automático** | `PainelLegenda.tsx:69-113` | Normaliza acento e pontuação antes de comparar (`:94-102`) |
| **Faixas onde a legenda liga/desliga** | `PainelLegenda.tsx:197-257`; leitura em `Legenda.tsx:65-67` | Ver fragilidade §6.2 (não acompanha edição) |
| **Marcadores (bandeirinhas)** | `Editor.tsx:323-371` (`marcar,apagarMarcador,marcadoresNaLinha`); UI `Timeline.tsx:490-510`; atalho `M` (`Editor.tsx:649-652`) | Guardados em relógio FONTE, reprojetados no FINAL a cada render da timeline — **já corrigido** vs. achado antigo de `revisao2.md` (REG-5) |
| **PiP: canto, escala, formato (arredondado/círculo/reto)** | Painel `PainelBloco.tsx:112-178`; geometria `estudio/src/layouts.ts:44-94` (`retanguloPip`) | Margem/raio/borda escalam por `altura/1080` (`layouts.ts:66-69,89,92`) — preview e render batem |
| **6 layouts de composição + morph animado entre eles** | `layouts.ts:99-171` (`geometriaDaCena`); mistura `misturarRetangulo/misturarGeometria` (`:174-194`); UI `PainelBloco.tsx:15-23,98-110` | `split_diagonal` usa `clipPath` poligonal (`Camada.tsx:52-57`), não geometria própria |
| **6 transições de entrada** (`corte,morph,fade,deslize,zoom_cruzado,flash`) | Lógica em `estudio/src/componentes/Cena.tsx:59-96` (`switch(entrada.tipo)`); UI `PainelBloco.tsx:25-32,180-238` | `deslize`/`fade`/`zoom_cruzado` mantêm a cena anterior viva por baixo (`Video.tsx:74-92`, variável `atravessa`) |
| **Zoom/foco (Ken Burns estático por bloco)** | Tipo `Foco` (`tipos.ts:40-45`); aplicado em `Camada.tsx:47-50`; UI `PainelBloco.tsx:241-286` | Estático por bloco — sem variação no tempo (é o item 6 do gap-doc, §7) |
| **Congelar quadro (freeze) com áudio correndo** | `Video.tsx:128-143` (`<Freeze frame={Math.round(cena.congelar*fps)}>`, quadro **relativo** ao Sequence); UI `PainelBloco.tsx:312-346` | Correção já aplicada: comentário `Video.tsx:129-134` documenta explicitamente o bug antigo de somar o início do bloco (era a REG-1 de `revisao2.md`) |
| **Velocidade do bloco (0.5x–2.5x)** | Campo `Cena.velocidade`; UI `PainelBloco.tsx:349-357`; aplicado em `Camada.tsx:105` (vídeo) e `Video.tsx:178` (áudio) | Motor nunca gera velocidade != 1 (`roteirizar.py:386`) — é só ajuste manual no editor |
| **Volume por bloco + mudo** | `PainelBloco.tsx:288-310`; `Video.tsx:179` | Sem teto no roteiro (UI permite até 2x, `PainelBloco.tsx:293`) |
| **Overlays: título, lower-third, destaque, marca, tarja de cobertura** | `estudio/src/componentes/Overlay.tsx` inteiro; UI `PainelTextos.tsx` inteiro | Tarja tem tamanho/posição próprios (pensada para cobrir texto queimado, `Overlay.tsx:38-45`) |
| **3 formatos de render a partir do MESMO roteiro** (16:9, 9:16, 1:1) | `estudio/src/Root.tsx:25-73` (3 `<Composition>`); fila em `servidor.mjs:378-453`; UI `Barra.tsx:22,160-179` | Geometria proporcional (0..1) faz o reflow sozinho entre formatos |
| **Zona segura 9:16 (guia de UI do TikTok/Reels)** | `estudio/editor/componentes/Palco.tsx:53-59`; CSS `estilos.css:100-140`; toggle `Barra.tsx:120-126` | **Já implementado** — ver nota de divergência com pesquisa em §6.11 |
| **Exportar .srt** | `estudio/src/srt.ts` inteiro (`gerarSrt`); endpoint `servidor.mjs:292-306`; botão `Barra.tsx:153-155` | Usa as mesmas palavras derivadas do corte atual (`Editor.tsx:526-533`) |
| **Exportar quadro atual em PNG** | Endpoint `servidor.mjs:309-370` (`still` do Remotion CLI via `process.execPath`); botão `Barra.tsx:156-158`, `Editor.tsx:546-556` | Sincroniza `roteiro-atual.json`/`estilo-atual.json` a partir do DISCO antes de rodar (`servidor.mjs:332-337`) — não do estado em memória do editor |
| **Processar material bruto sem sair do editor** | `estudio/editor/componentes/Processar.tsx` inteiro; endpoint `servidor.mjs:248-285` (`spawn` de `motor/supremo.py preparar`) | Ver fragilidade §6.4 (troca de projeto sem checar `sujo`) |
| **Medidor de reprodução (diagnóstico de performance)** | `estudio/editor/componentes/Diagnostico.tsx` inteiro; atalho `D` (`Editor.tsx:644-648`) | Mede fps real, retrocessos do Player, buffer de áudio, memória JS |
| **Atalhos de teclado (lista completa)** | Handler `Editor.tsx:560-679`; modal de ajuda `Atalhos.tsx` | Espaço, ←/→ (quadro/segundo), Home/End, S/T, Delete, Ctrl+C/V/D/Z/Y/S, `?`, `D`, `M` |
| **Sincronia automática de 2 fontes por correlação de áudio** | `motor/sincronizar.py` inteiro (`_envelope`,`descobrir_atraso`,`sincronizar`,`duracao_util`) | Envelope de energia 100Hz, FFT, janela de ±180s, confiança pelo destaque do pico |
| **Transcrição com tempo por palavra (Whisper GPU)** | `motor/transcrever.py` inteiro | `faster-whisper large-v3`, cai para CPU int8 se a GPU falhar (`:61-68`) |
| **Direção automática de cortes/layout/legenda** | `motor/roteirizar.py` inteiro | Corte de silêncio (`trechos_com_fala`), gatilhos de palavra por layout (`decidir_layouts`), legendas (`montar_legendas`) — tudo configurável em `config/direcao.json` |
| **Tratamento de vídeo (cor + 2 proxies) e áudio (limpeza + preview)** | `motor/tratar.py` inteiro | GPU NVENC com fallback automático para libx264 (`:140-150,196-203`) |
| **CLI única com subcomandos** | `motor/supremo.py:431-472` (`editar,checar,novo,preparar,editor,estudio,render`) | `editor` abre a UI visual (`cmd_editor:377-409`, sobe `servidor.mjs`+Vite); `estudio` abre o Remotion Studio técnico (`cmd_estudio:412-415`) — são coisas DIFERENTES |
| **Backup automático antes de reprocessar** | `supremo.py:152-167` — copia `roteiro.json` para `roteiro-<data>.backup.json` antes de sobrescrever | Corrige o bug crítico C2 documentado em `motor.md:114-124` |
| **Migração de roteiros antigos (relógio final→fonte)** | `motor/migrar.py` inteiro | Usa `_trechos_mantidos` do backup; roteiro sem esse campo é marcado "NAO MIGRAVEL" em vez de adivinhado (`:57-59`) |
| **Varredura de lote (idioma/narração antes de traduzir)** | `motor/varrer.py` inteiro | Standalone, não integrado ao servidor nem ao `supremo.py` — ver §6.9 |
| **Dublagem por síntese de voz (ElevenLabs) → vira projeto editável** | `motor/voz.py` (API TTS) + `motor/dublar.py` (`preparar`,`falar`,`criar_projeto`) | Só roda via CLI (`python motor/dublar.py ...`), não integrado ao servidor nem ao editor — ver §6.9. Já usado de verdade: 8 fichas em `projetos/_dublagem/`, 4 projetos gerados (`origyn`,`origyn-2`,`homefaves-uk`,`everyday-finds`) |
| **Servidor de dados Express com escrita atômica e fila por arquivo** | `servidor.mjs:67-97` (`gravarJson`, tmp único por escrita + fila por caminho) | `.catch(()=>{})` explícito antes do `.finally()` evita `unhandledRejection` derrubar o processo (comentário `:85-90`) |
| **Validação de nome de projeto contra travessia de caminho** | `servidor.mjs:37-53` (`nomeValido`,`barrouNome`), aplicada nas 4 rotas com `:nome` | Lista branca `/^[A-Za-z0-9_.-]+$/`, bloqueia `.`/`..`/vazio |
| **Fila de render sequencial (até 3 formatos)** | `servidor.mjs:378-453` (`rodarUm` recursivo) | Para a fila no primeiro formato que falhar (`:441-445`) |

---

## 4. Pontos de extensão

### 4.1 Novo painel do editor (uma aba nova ao lado de Bloco/Legenda/Textos/Áudio)

1. Acrescente o nome ao union `Aba` — `estudio/editor/Editor.tsx:20`:
   ```ts
   type Aba = "bloco" | "legenda" | "textos" | "audio";
   ```
2. Acrescente o botão da aba — `Editor.tsx:759-776` (array de `[id, rótulo]` mapeado).
3. Crie `estudio/editor/componentes/PainelXxx.tsx` seguindo o padrão de
   `PainelAudio.tsx`/`PainelTextos.tsx`: recebe `roteiro`/`estilo` e um mutador
   (`aoMudar`/`aoMudarRoteiro`), nunca muta o objeto — sempre `{...roteiro, campo: novo}` — e
   exporta memoizado:
   ```tsx
   const PainelXxxInterno: React.FC<Props> = (...) => { ... };
   export const PainelXxx = React.memo(PainelXxxInterno);
   PainelXxx.displayName = "PainelXxx";
   ```
   (padrão exato de `PainelBloco.tsx:41-48,376-377`).
4. Ligue no switch de renderização — `Editor.tsx:778-815` (`{aba === "bloco" && <PainelBloco .../>}`).
5. Controles prontos para reusar: `Deslizante`, `Numero`, `Texto`, `Cor`, `Interruptor`,
   `Opcoes`, `Grupo` — todos em `estudio/editor/componentes/controles.tsx`.

### 4.2 Novo efeito visual / transição na composição Remotion

- **Nova transição de entrada**: acrescente a variante em `estudio/src/tipos.ts:31-37`
  (união `Entrada`), trate o novo `case` dentro do `switch(entrada.tipo)` em
  `estudio/src/componentes/Cena.tsx:59-96` (defina `p`, `opacidadeGeral`, `deslocX/Y`,
  `escalaGeral` ou `brilho` — os únicos "canais" de animação que a cena expõe hoje), acrescente
  em `TRANSICOES` no painel (`estudio/editor/componentes/PainelBloco.tsx:25-32`) e, se a
  transição precisar manter a cena anterior viva por baixo (como `fade`/`zoom_cruzado`/`deslize`),
  inclua-a no array `atravessa` de `estudio/src/Video.tsx:74-77`.
- **Novo layout de câmera/tela**: acrescente ao união `Layout` em `tipos.ts:21-28`, um novo
  `case` em `geometriaDaCena` (`estudio/src/layouts.ts:99-171`) devolvendo
  `{camera, tela, camera_na_frente}`, e a entrada em `LAYOUTS`
  (`PainelBloco.tsx:15-23`).
- **Novo tipo de overlay**: acrescente ao união `Overlay["tipo"]` em `tipos.ts:163`, um novo
  bloco de JSX em `estudio/src/componentes/Overlay.tsx` (o arquivo já é uma cadeia de
  `if (overlay.tipo === "...")`, do topo: `tarja` linha 46, `titulo` linha 104, `lower_third`
  linha 138, `destaque` linha 187, resto cai no `marca` padrão linha 211), e a entrada em
  `TIPOS` (`estudio/editor/componentes/PainelTextos.tsx:12-22`).
- **Novo preset de legenda**: acrescente ao união `EstiloLegenda` em `tipos.ts:99-114`, um novo
  `case` no `switch(preset)` de `estudio/src/componentes/Legenda.tsx:155-209` (defina `cor`,
  `fundo`, `opacidade`, `escalaPalavra`, `sombra`, `padding`, `raio`), e a entrada + texto de
  ajuda em `PainelLegenda.tsx:36-65`.

### 4.3 Nova rota no servidor (`estudio/servidor.mjs`)

Padrão exato (exemplo real, `servidor.mjs:151-171`, PUT de roteiro):
```js
app.put("/api/projeto/:nome/roteiro", async (req, res) => {
  if (barrouNome(req, res)) return;          // 1. valida o :nome
  const corpo = req.body;                     // 2. valida o corpo mínimo
  if (!corpo || !Array.isArray(corpo.cenas) || corpo.cenas.length === 0) {
    return res.status(400).json({ erro: "Roteiro inválido: sem cenas." });
  }
  try {
    await gravarJson(path.join(PROJETOS, req.params.nome, "roteiro.json"), corpo); // 3. escrita atômica
    res.json({ ok: true });
  } catch (e) { erro(res, e); }               // 4. erro padronizado
});
```
Depois, acrescente a chamada correspondente em `estudio/editor/api.ts` usando o helper `pedir<T>`
(linhas 3-13). **Não precisa mexer no proxy do Vite** — qualquer caminho `^/api/` já é
redirecionado para `http://127.0.0.1:8788` (`estudio/vite.config.mts:25-28`).

### 4.4 Novo comando no `motor/supremo.py`

Padrão exato (`supremo.py:431-472` para o parser, `:475-488` para o despacho):
```python
p = sub.add_parser("nome-do-comando", help="descrição curta")
p.add_argument("nome")
p.add_argument("--alguma-flag", default=None)
...
if a.cmd == "nome-do-comando":
    cmd_nome_do_comando(a.nome, a.alguma_flag)
```
A função `cmd_xxx` segue a convenção de console de `motor/comum.py:266-275`
(`passo("1/N ...")`, `ok("...")`, `aviso("...")`) — é esse texto que `servidor.mjs:266-274`
faz *parse* linha a linha para preencher `preparo.mensagem`/`preparo.linhas` na UI. Se o comando
precisa ser disparável pela UI (como `preparar`/`render`), replique o padrão de
`servidor.mjs:248-285`: variável de módulo de estado (`estado: "rodando"|"pronto"|"erro"`),
`spawn(PYTHON, ["motor/supremo.py", "nome-do-comando", ...], {cwd: RAIZ})` com `.on("error", ...)`
obrigatório, e um GET `.../status` companheiro. **Hoje só `preparar` e `render` têm esse
caminho** — `migrar.py`, `varrer.py`, `voz.py`, `dublar.py` são scripts standalone chamados
direto pelo usuário (`python motor/dublar.py falar ...`), sem rota no servidor nem botão na UI.

### 4.5 Novo parâmetro de configuração (`config/*.json`)

Acrescente a chave em `config/direcao.json` (regras de direção/legenda) ou
`config/tratamento.json` (ffmpeg de áudio/cor/proxy) — ambos são recarregados do zero a cada
execução (`roteirizar.carregar_direcao()` em `roteirizar.py:25-35`;
`tratar.carregar_config()` em `tratar.py:71-81`), e chaves começadas com `_` são só comentário
(removidas por essa mesma função). **Prefira ler com `.get(..., default)`**, não com colchete —
ver fragilidade §6.10 sobre a mistura hoje existente.

---

## 5. Invariantes que precisam ser preservadas

| Invariante | Onde é garantida hoje | Evidência |
|---|---|---|
| Roll edit (`modo: "corte"`) não muda a duração total do vídeo | `Timeline.tsx:287-319` — `durA0+d` e `durB0-d` são complementares; `aoMudarCenas` grava os dois numa única entrada de histórico | `Timeline.tsx:313-319` |
| Tempos (`fonte_inicio`,`duracao`) ficam em múltiplos de `1/fps` | Editor: `emQuadros` (`Editor.tsx:157-168`), aplicada em TODOS os setters de cena (`mudarCena:170-187`, `mudarCenas:196-209`, `dividirNoCursor:433-438`, `inserirCopia:480-483`). Motor: `_q` (`roteirizar.py:376-377`), aplicada em `escrever_roteiro` (`:381-382`) | Ver ressalva §6.5 — o `toFixed(4)` final reintroduz um erro de ordem de 10⁻⁵s |
| Um clipe de áudio vinculado (`vinculado_a`) segue a cena quando ela é cortada/movida | `estudio/src/trilha.ts:49-71` (`seguirCenas`), chamada a cada `mudarCena`/`mudarCenas` (`Editor.tsx:184,206`) | `trilha.ts:60-70` |
| A cena de trás nunca desaparece antes da transição da cena de frente terminar | `Video.tsx:74-92` (`atravessa`/`COLCHAO`); `zIndex: i+1` garante quem entra fica por cima (`Video.tsx:119`) | `Video.tsx:86-92` |
| `Freeze` (congelar) recebe quadro relativo ao próprio bloco, nunca absoluto | `Video.tsx:135` — `Math.round(cena.congelar*fps)`, sem somar `inicio` | Comentário explícito em `Video.tsx:129-134` sobre o bug que isso evita |
| Pelo menos 1 cena sempre sobrevive | `Editor.tsx:449` (`apagarCena` recusa se `cenas.length <= 1`); botões desabilitados em `Timeline.tsx:424`, `PainelBloco.tsx:367` | — |
| Duração mínima de bloco (0.2s) e de trecho de fala (0.5s) | UI: `DURACAO_MINIMA=0.2` (`Timeline.tsx:28`); motor: `duracao_minima_do_trecho` em `config/direcao.json:10` | — |

---

## 6. Fragilidades observadas (mais perigosa primeiro)

### 6.1 — Contrato de tipos mistura relógio MESTRE e relógio FONTE sob o mesmo rótulo
Já detalhado no §2.2. `tipos.ts:81-84` e `:274-278` afirmam que `Palavra.t` e `marcadores[].t`
compartilham "a mesma base" de `Cena.fonte_inicio`; na prática precisam de
`+ roteiro.audio.offset` (`legendas.ts:38`, `Editor.tsx:296-311,323-335,351-360`) para baterem.
Zero risco em projeto de 1 fonte ou com `audio.offset == 0` (mascarado nos 2 projetos mais
usados hoje, `origyn` e `demanda-01`) — risco real em qualquer projeto de 2 fontes onde a fonte
de áudio não é a que começou primeiro (offset > 0), caso coberto por `projetos/teste`. Uma
feature nova que leia esses campos direto do JSON, seguindo o comentário do tipo ao pé da
letra, reintroduz a classe de bug já documentada em `composicao.md:62-93`.

### 6.2 — `legendas.ligada_em` não acompanha edição de corte
As janelas onde a legenda liga/desliga vivem em relógio FINAL (`tipos.ts:118-119`) e são criadas
uma única vez, somando a duração de todas as cenas no momento do clique
(`PainelLegenda.tsx:248-254`: `const total = roteiro.cenas.reduce(...)`). Diferente de
`palavras`, que passam por `palavrasNaLinhaDoTempo` a cada render (`legendas.ts:24-56`), não
existe nenhuma função equivalente para `ligada_em` — `Legenda.tsx:65-67` lê o array cru contra
`t = frame/fps`. Aparar, dividir ou reordenar um bloco desloca o conteúdo da legenda (que se
readequa sozinho) mas **não** desloca a janela onde ela é permitida a aparecer — a mesma classe
de defeito que motivou toda a reescrita de `legendas.ts`, só que sobrou neste campo.

### 6.3 — Erro de carregamento/gravação trava o editor sem saída
`Editor.tsx` chama `setErro(...)` em 3 pontos (`:79`, `:96`, `:250`) e **nunca** chama
`setErro(null)` em lugar nenhum do arquivo. Com `erro` preenchido, `:711-718` substitui o app
inteiro por uma tela estática sem botão de "tentar de novo", descartando o histórico de
desfazer em memória. Uma falha passageira (servidor reiniciando, rede oscilando) é permanente
até o usuário dar F5 — que perde qualquer edição não salva.

### 6.4 — "Processar" troca de projeto sem checar se há mudança não salva
`Editor.tsx:841-850` (prop `aoTerminar` passada a `<Processar>`) chama `setProjeto(nome)`
direto quando o pipeline termina, sem checar `sujo`. Isso ignora a proteção que EXISTE no
`<select>` manual de projeto (`Barra.tsx:84-87`, com `confirm()`). Como `preparo` no servidor
nunca volta para `"parado"` depois de terminar (`servidor.mjs` — `preparo` só é reatribuído
dentro de um novo POST em `:258`; o GET de status em `:285` só lê), reabrir o modal "+ novo
vídeo" depois de qualquer processamento anterior bem-sucedido dispara esse efeito de novo
(`Processar.tsx:36-40`, que roda sempre que `status.estado === "pronto"`).

### 6.5 — Duas implementações independentes do "encaixe em quadro inteiro", cada uma com o mesmo arredondamento residual
`Editor.tsx:160,163-164` (`snap` + `.toFixed(4)`) e `roteirizar.py:376-377` (`round(round(v*fps)/fps, 4)`)
resolvem o mesmo problema em linguagens diferentes, e as duas cortam o resultado em 4 casas
decimais DEPOIS de dividir por `fps` — para fps que não é múltiplo de uma potência de 10 (24,
30, 23.976...), `1/fps` não tem representação exata em 4 casas, então o valor gravado fica a
até ~5×10⁻⁵s do múltiplo exato de quadro. Inofensivo na prática (bem abaixo de 1 quadro), mas
contradiz o comentário "exato por construção" (`Editor.tsx:150-155`) e mostra que o invariante
depende de manter DUAS implementações em sincronia manual, não de uma fonte única de verdade.

### 6.6 — Estilo visual é global ao repositório, não por projeto
`servidor.mjs:173-194` (`PUT /api/estilo`) sempre lê/grava `config/estilo.json`, o mesmo
arquivo para todos os projetos; `comum.py:248-259` (`carregar_estilo`) e `supremo.py:341,356`
(`_sincronizar_estudio`) confirmam que é um único arquivo global. Mudar o tamanho da legenda
enquanto edita o projeto A muda o padrão herdado por B, C e por qualquer `preparar` futuro. É
comportamento deliberado hoje (não um bug), mas qualquer feature de "múltiplos clientes/marcas"
precisa resolver isso primeiro — não há campo `estilo` por projeto no `Roteiro` (tipos.ts:241-280
não tem esse campo; o estilo entra só via `PropsVideo.estilo`, `tipos.ts:322`).

### 6.7 — Classificação câmera/tela por substring frouxa
`supremo.py:38-39` (`PISTAS_CAMERA = (...,"eu")`) testado com `in` em `supremo.py:60`: um
arquivo chamado `reuniao.mp4` contém "eu" e vira câmera. Arquivos que não batem com nenhuma
pista caem em `sobra` e são distribuídos por ORDEM ALFABÉTICA (`supremo.py:68-74`), não por
conteúdo — o comentário da própria função (`:67`, "decide pelo formato") não corresponde ao
código, que não chama `sondar()` nesse ramo. Um projeto novo com nomes de arquivo fora do
padrão `camera.mp4`/`tela.mp4` pode inverter os papéis silenciosamente.

### 6.8 — `preparar` sempre reconstrói do zero (com backup, mas sem modo incremental)
`supremo.py:152-167` salva uma cópia datada e depois `cmd_preparar` reprocessa TUDO — fontes,
sincronia, vídeo, transcrição (se não usar `--reusar-transcricao`), roteiro, áudio — sem opção
de "só atualizar a transcrição preservando os cortes que já fiz no editor". Uma feature que
prometa "reprocessar parte de um projeto já editado" não tem hoje nenhum gancho pronto; a única
saída atual é copiar manualmente do `.backup.json`.

### 6.9 — Dublagem e varredura de lote não estão integradas à UI nem ao servidor
`motor/voz.py`, `motor/dublar.py` e `motor/varrer.py` não aparecem em nenhuma chamada de
`servidor.mjs` (grep confirmado: só `motor/supremo.py` é `spawn`ado, em `:254` e `:429`) nem em
nenhum componente de `estudio/editor/`. São CLIs standalone, já usadas de verdade (8 fichas em
`projetos/_dublagem/`, 4+ projetos gerados), mas uma feature que assuma "o botão de dublar já
existe no editor" estaria inventando — não existe.

### 6.10 — Leitura de config inconsistente (colchete vs. `.get`)
`roteirizar.py:54-60` acessa `cfg["corte_de_silencio"]["pausa_maxima"]` direto (levanta
`KeyError` se a chave sumir), enquanto `roteirizar.py:190-194` e `:333-349` usam
`cfg.get(..., default)`. Mesma mistura em `tratar.py` (`_cadeia_audio` acessa `a["presets"]`
direto em `:25`, mas `carregar_config`/chamadores usam `.get` em outros pontos). Uma chave nova
adicionada sem todos os pais presentes quebra em alguns lugares e silenciosamente usa default em
outros, dependendo de qual função a lê.

### 6.11 — `docs/pesquisa/editores.md` já lista como "faltando" uma feature que já existe
O item 5 desse documento (`docs/pesquisa/editores.md:57-62`, "Guias de zona segura 9:16") descreve
como gap algo que já está implementado: `Palco.tsx:53-59` desenha as 3 faixas, `Barra.tsx`
tem o botão de alternar (`zonaSegura`), `estilos.css:100-140` estiliza. Confirma exatamente o
risco que esta auditoria existe para prevenir — um planejamento baseado só na pesquisa
duplicaria trabalho já feito. Vale conferir os outros 21 itens desse doc contra o código antes
de priorizar qualquer um.

### 6.12 — Scripts de prova de conceito com dados pessoais/hardcoded
`motor/teste_dublagem.py:19` tem um caminho absoluto da máquina do desenvolvedor
(`C:\Users\willi\Downloads\...`) e IDs de voz fixos (`:33-34`) — é uma prova descartável ("não é
o pipeline final", comentário `:3-7`), não deve ser tratado como parte da API estável do motor.

---

## 7. Arquivos por tamanho (linhas)

Contagem por `rg "^" <arquivo> | wc -l` (linhas reais de conteúdo, sem contar arquivos de dados
JSON gerados como código).

### Motor (`motor/*.py`) — 2604 linhas em 12 arquivos

| Arquivo | Linhas |
|---|---:|
| `supremo.py` | 492 |
| `roteirizar.py` | 417 |
| `dublar.py` | 317 |
| `comum.py` | 275 |
| `tratar.py` | 261 |
| `voz.py` | 202 |
| `sincronizar.py` | 150 |
| `transcrever.py` | 115 |
| `varrer.py` | 113 |
| `teste_dublagem.py` | 105 |
| `migrar.py` | 99 |
| `ondas.py` | 58 |

### Composição (`estudio/src/*`, só `.ts`/`.tsx`) — 1933 linhas em 13 arquivos

| Arquivo | Linhas |
|---|---:|
| `tipos.ts` | 325 |
| `Video.tsx` | 279 |
| `componentes/Legenda.tsx` | 239 |
| `componentes/Overlay.tsx` | 228 |
| `layouts.ts` | 194 |
| `componentes/Cena.tsx` | 152 |
| `componentes/Camada.tsx` | 113 |
| `legendas.ts` | 87 |
| `musica.ts` | 85 |
| `srt.ts` | 80 |
| `Root.tsx` | 76 |
| `trilha.ts` | 71 |
| `index.ts` | 4 |

Dados gerados (não código): `roteiro-atual.json` 133 linhas (projeto `origyn` hoje),
`estilo-atual.json` 35 linhas.

### Editor (`estudio/editor/*` + `estudio/servidor.mjs`) — 5126 linhas em 18 arquivos

| Arquivo | Linhas |
|---|---:|
| `estilos.css` | 905 |
| `Editor.tsx` | 861 |
| `componentes/Timeline.tsx` | 764 |
| `../servidor.mjs` (mora em `estudio/`, não em `estudio/editor/`) | 462 |
| `componentes/PainelBloco.tsx` | 377 |
| `componentes/PainelLegenda.tsx` | 331 |
| `componentes/PainelTextos.tsx` | 268 |
| `componentes/PainelAudio.tsx` | 235 |
| `componentes/Barra.tsx` | 182 |
| `componentes/Onda.tsx` | 136 |
| `componentes/Processar.tsx` | 129 |
| `componentes/Diagnostico.tsx` | 127 |
| `componentes/controles.tsx` | 123 |
| `componentes/Palco.tsx` | 78 |
| `api.ts` | 77 |
| `componentes/Atalhos.tsx` | 43 |
| `index.html` | 18 |
| `main.tsx` | 10 |

### Config e build (não entram nos totais de código acima)

| Arquivo | Linhas |
|---|---:|
| `config/tratamento.json` | 69 |
| `config/direcao.json` | 67 |
| `config/estilo.json` | 40 |
| `estudio/vite.config.mts` | 40 |
| `estudio/remotion.config.ts` | 28 |

**Total geral das 3 áreas de código: 9663 linhas** (2604 motor + 1933 composição + 5126 editor).

---

## 8. Fora de escopo desta passagem

Não lidos nesta passagem (citados pelos docs antigos ou existentes no repo, mas fora do pedido):
`estudio/tsconfig.json`; conteúdo de `.env` (existe, ignorado por `.gitignore:21` — não aberto de
propósito, por conter segredo); binários em `estudio/public/*`; `node_modules/` (inclusive
internals do Remotion que os docs antigos leram para provar comportamento de `Freeze`/`volume`/
`Sequence` — não reaberto aqui, então nenhuma afirmação nova sobre semântica interna do Remotion
foi feita nesta passagem além do que o próprio código do projeto documenta em comentário);
`projetos/*/trabalho/*` e `*/bruto/*` (conteúdo binário); execução real de qualquer comando —
todas as conclusões vêm de leitura de código.

Nenhum arquivo do projeto foi alterado. O único arquivo escrito foi este.
