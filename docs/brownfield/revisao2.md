# Revisão adversarial dos commits `40c5948` e `8d5d8e9`

Revisão independente e READ-ONLY, feita sem confiar em nenhuma mensagem de commit.
Toda linha abaixo tem `arquivo:linha` ou número medido sobre os dados reais de
`projetos/demanda-01` (2060 palavras, 6 cenas, 24 fps) e `projetos/teste`
(10 cenas, 30 fps). Nenhum arquivo de código foi alterado; o único arquivo
escrito foi este.

Base: `git diff 8f2d5f1 40c5948` e `git diff 40c5948 8d5d8e9`.

---

## veredito

**REPROVADO** — por causa do commit **`8d5d8e9`**, não do `40c5948`.

- **`40c5948`** (as correções nunca revisadas): **4 confirmadas · 2 parciais · 0 refutadas.**
  As quatro regressões R1–R4 da revisão anterior estão de fato corrigidas, e a
  matemática do relógio fecha de ponta a ponta. Sozinho, seria APROVADO COM RESSALVAS.
- **`8d5d8e9`** (as seis funcionalidades): **3 confirmadas · 3 parciais · 1 refutada**,
  com **uma regressão crítica provada** (`Freeze` recebendo quadro absoluto onde o
  Remotion exige relativo) e **duas altas** (o PNG do "quadro" sai do projeto errado;
  a tela-morta de erro ficou trivial de disparar).

---

## commit-40c5948

| # | Correção alegada | Veredito | Evidência |
|---|---|---|---|
| 1 | Relógio das palavras volta a ser mestre no pipeline; conversão pro relógio do arquivo só em `montar_legendas`, somando `offset_audio` | **CONFIRMADA** | Traço completo verificado: `supremo.py:258-272` (`para_mestre` subtrai `off_audio` de palavras **e** frases) → `supremo.py:304-315` (`escrever_roteiro(duracao_total=duracao_util, offset_audio=off_audio)`) → `roteirizar.py:333` (`trechos_com_fala(palavras_mestre, duracao_util)`) → `roteirizar.py:246` (`fonte_inicio` nasce **mestre**) → `roteirizar.py:399` (`montar_legendas(palavras, cfg, offset_audio)`) → `roteirizar.py:289-290` (`t = round(p["t"] + offset_audio, 3)`, palavras saem em relógio de **arquivo**) → `supremo.py:332-338` (grava `audio.offset = off_audio`) → `legendas.ts:38` (`de = fonte_inicio + offsetAudio`, mestre+off = arquivo, mesma unidade de `p.t`) → `Legenda.tsx` recebe já convertido. **Fecha.** |
| 1b | Sub-alegação: os cortes (`fonte_inicio`) caem no lugar certo com `off_audio != 0` | **CONFIRMADA** | `fonte_inicio` é mestre e cada consumidor soma o offset **da sua própria fonte**: `Video.tsx:168` (`+ audio.offset`), `Cena.tsx:111` (`+ fCam.offset`), `Cena.tsx:125` (`+ fTela.offset`), `Editor.tsx:300-302`, `Editor.tsx:335`. A dupla contagem da R1 sumiu. Os dois danos colaterais também: `roteirizar.py:68,72` (`min(duracao_total,…)`) agora compara mestre×mestre, e `roteirizar.py:211,380` (`_frase_em(frases, cursor)`) compara mestre×mestre. O comentário de `supremo.py:247-254` passou a ser verdadeiro |
| 1c | Ressalva medida | — | `montar_legendas` faz `round(p.t + offset, 3)`, então a comparação de borda em `legendas.ts:43` pode escorregar ≤0,5 ms. Simulação em `demanda-01` com `off_audio=5.3`: **2036** palavras derivadas contra **2035** na base — uma palavra atravessou a borda de bloco por arredondamento. Inaudível, mas não é "exato" |
| 2 | `servidor.mjs::gravarJson` — `.catch().finally()` evita o `unhandledRejection` | **CONFIRMADA** | `servidor.mjs:91-95`: `atual.catch(()=>{})` devolve promessa **resolvida**; o `.finally()` encadeado nela nunca rejeita. A rejeição de `atual` tem dois handlers (o `catch` daqui e o `try/catch` do handler em `:163-170`). **Fila ainda serializa**: `:68-71` encadeia em `anterior`. **Sem vazamento no Map**: `:94` só apaga se `filaDeGravacao.get(p) === atual`, então em A→B o `finally` de A não tem efeito e só B limpa |
| 3 | `musica.ts::curvaDeVolume` nasce no relógio da música | **CONFIRMADA** | `musica.ts:36-37,43-44` deslocam por `inicio`; `Video.tsx:189` indexa com o quadro relativo. **Medido** em `demanda-01` (24 fps, 775,79 s) para `musica.inicio ∈ {0, 10, 40}`: `curva[0]=0` e `curva[36]=0,0616` → **o `fade_entrada` toca** (era a R3); último quadro efetivamente lido = `0,0022` de um volume-base de `0,22` → **o `fade_saida` chega ao fim**; o abaixamento cai exatamente sobre as palavras. A curva fica 1 quadro mais longa que o `Sequence` (`ceil` vs soma de `round`), diferença inaudível |
| 4 | `Editor.tsx::irParaFonte` traduz fonte→final | **PARCIAL** | `Editor.tsx:329-345` é o inverso exato de `tempoNaFonte` (`:293-308`) e de `palavrasNaLinhaDoTempo`, inclusive dividindo por `velocidade` em `:338`. Ligado corretamente em `Editor.tsx:725` (`aoIrPara={irParaFonte}`), e a Timeline continua com `irPara` em `:751`. Trecho aparado fora: laço termina sem achar e a função **retorna em silêncio** (`:342`) — não pula e não avisa. **Mas o rótulo não foi corrigido**: `PainelLegenda.tsx:238` continua exibindo `relogio(p.t)`, ou seja tempo de **fonte** (`04:41` para a primeira palavra de um vídeo que começa em `00:00`), que não bate com nenhuma régua da interface. Metade da R4 continua de pé |
| 5 | `emQuadros` em dividir/colar/duplicar mata o erro de 1 quadro | **PARCIAL** | Aplicado de fato: `Editor.tsx:370-377` (dividir) e `:417-420` (`inserirCopia`, usada por colar e duplicar). Mas a alegação de fundo não se sustenta: **o motor Python continua gravando `round(x,3)` sem alinhar à `fps`** (`roteirizar.py:173,178,238,243,246`). Monte Carlo de 200 mil emendas contíguas com tempos `round(x,3)`: **24,9 % erram 1 quadro a 24 fps e 25,0 % a 30 fps** (`round((F+D)·fps) ≠ round(F·fps)+round(D·fps)`). `projetos/teste` só escapa porque `duracao` caiu em múltiplos exatos; `demanda-01` só escapa porque usou `--cortes` com segundos inteiros. **No primeiro `preparar` de um projeto real o defeito volta**, e só some nos blocos que o usuário tocar no editor. Além disso `Editor.tsx:374` calcula `b.fonte_inicio = c.fonte_inicio + a.duracao` **ignorando `velocidade`** — errado sempre que `velocidade ≠ 1` |
| 5b | Sub-alegação implícita: `Number(snap(v).toFixed(4))` | **REFUTADA (sem dano)** | `Editor.tsx:152-153` continua cortando o snap em 4 casas (o N2 da revisão anterior). Erro ≤5·10⁻⁵ s → ≤1,5·10⁻³ quadro, nunca vira um `Math.round`. Não quebra, mas o comentário de `:144` ("exato por construção") segue falso |
| 6 | `Camada.tsx` — sombra escalada | **CONFIRMADA** | `Camada.tsx:73-76` multiplica os quatro valores em px por `height/1080`. Bate com `layouts.ts:66,89,92` (`k = altura/1080`), que já escalava margem, raio e borda. No preview de meia resolução (`Palco.tsx:40-41`) `height=540` → `k=0,5`, exatamente o que faltava. Fecha o item 2 de `composicao.md:183-188` |

**Placar `40c5948`: 4 confirmadas · 2 parciais · 0 refutadas.**

---

## commit-8d5d8e9

| # | Funcionalidade | Veredito | Evidência |
|---|---|---|---|
| 7 | `volume` por bloco em `Video.tsx` | **CONFIRMADA** | `Video.tsx:171` (`volume={cena.volume ?? 1}`). O tipo aceita: `@remotion/media/dist/audio/props.d.ts` declara `volume?: VolumeProp`, e `remotion/dist/cjs/volume-prop.js:5-7` trata número puro nos dois caminhos (preview e render). `?? 1` preserva `volume: 0` (mudo) porque `??` só captura `null`/`undefined`. Não interage com a curva de música: são dois `<Audio>` independentes. **Ressalva**: `PainelBloco.tsx` usa `max={2}` e `evaluateVolume` só faz `Math.max(0, …)` — não há teto, então >1 estoura sem aviso do motor |
| 8 | `Freeze` envolvendo só a `<Cena>`; áudio continua correndo | **PARCIAL — o quadro está errado** | **O áudio realmente continua**: `Video.tsx:125-143` põe o `<Freeze>` e o `<Sequence>/<Audio>` (`:157-173`) como **irmãos**, não aninhados. **Mas o `frame` passado é absoluto e o Remotion espera relativo.** Prova lida em `node_modules`: `remotion/dist/cjs/freeze.js:41` (`relativeFrom = sequenceContext.relativeFrom`), `:53` (`frame[id] = frameToFreeze + relativeFrom`), `:67` (`cumulatedFrom: 0`); `remotion/dist/cjs/use-current-frame.js:24-27` (`frame − (cumulatedFrom + relativeFrom)`); `Sequence.js` define `relativeFrom = from − trimBefore`. Substituindo: os filhos veem `(frameToFreeze + inicio) − (0 + inicio) = frameToFreeze`. **Logo `frame` é relativo ao `Sequence`.** `Video.tsx:126` passa `inicio + Math.round(cena.congelar*fps)` — soma o início do bloco **duas vezes**. Ver REG-1 |
| 9 | `srt.ts::gerarSrt` | **PARCIAL** | **Formato certo**: `srt.ts:16` produz `HH:MM:SS,mmm` com vírgula e `padStart`; `:67` numera `${i+1}` sequencial; blocos separados por linha em branco (`join("\n")` sobre entradas terminadas em `\n`). **Sobreposição é real**: `srt.ts:66` (`Math.max(l.fim, l.t + 0.6)`). Medido sobre as 2035 palavras derivadas de `demanda-01`: 177 linhas, **4 delas invadem a seguinte**, a pior por **0,360 s** — ex.: linha 16 `00:01:10,060 --> 00:01:10,660` ("funciona.") enquanto a 17 começa em `00:01:10,360`. Carimbos com milissegundo de 4 dígitos: 0 (o `Math.round((s%1)*1000)` de `:12` só estouraria com entrada não arredondada, e `legendas.ts:49` já entrega 3 casas) |
| 10 | Marcadores | **CONFIRMADA com ressalvas** | `apagarMarcador` (`Editor.tsx:212-222`) compara float por igualdade, e **funciona**: `Timeline.tsx:444` devolve literalmente o mesmo `m.t` que veio do objeto, então é round-trip de identidade, não recálculo. `key={m.t}` (`Timeline.tsx:432`) é estável porque `marcar` (`Editor.tsx:204`) recusa dois marcadores a menos de 0,4 s — o gesto vira "desmarcar". Dois marcadores no mesmo instante só entram por edição manual do JSON; aí a `key` duplica e `apagarMarcador` apaga os dois. Posicionamento correto: `.tl-conteudo` é `position: relative` (`estilos.css:432-436`) e marcadores e blocos usam a mesma origem `left: t*escala`. Ver REG-5 quanto ao relógio |
| 11 | Fila de render em `servidor.mjs` | **CONFIRMADA** | `servidor.mjs:362-372` recria `trabalho` (com `prontos: []`) a cada POST, e `:347` barra POST novo enquanto `estado === "rodando"` — **`prontos` não vaza entre execuções**. A recursão de `rodarUm` (`:383-410`) roda dentro do `close`, então nunca há dois `spawn` vivos. Falha de um formato: `:402-405` marca `erro` e para a fila; estado permanece coerente. **Ressalvas**: `:404` sobrescreve `mensagem`, então o usuário perde a lista dos formatos que **deram certo** (`prontos` continua preenchido mas não é mostrado); e `:386` publica nomes sem o prefixo `saida/` que a versão anterior usava |
| 12 | `/api/quadro` com `process.execPath` + CLI do Remotion | **CONFIRMADA** | `servidor.mjs:315` aponta para `node_modules/@remotion/cli/remotion-cli.js` — **existe** (v4.0.517, declarado em `bin`). O padrão sem entry point é o mesmo que o projeto já usa com sucesso em `supremo.py:374` / `:424` (`_remotion("render", formato, destino)`). Provado em `@remotion/cli/dist/entry-point.js`: `findEntryPointInner` testa `args[0]="Principal"` contra cwd e raiz, não acha, cai no config e depois nos "common paths" e escolhe `src/index.ts` (existe), devolvendo `remainingArgs = ["Principal", destino]` — logo composição = `Principal`, saída = o PNG. `--frame` é a flag correta do `still` |
| 13 | `exportarQuadro` garante que o quadro reflete a tela | **REFUTADA** | `Editor.tsx:485` só sincroniza **se `sujo`**. Abrir outro projeto **não** grava `roteiro-atual.json`: `GET /api/projeto/:nome` (`servidor.mjs:140-149`) só lê, e o único caminho que sincroniza é `_sincronizar_estudio` no Python (`supremo.py:351-356`), chamado por `preparar` e por `cmd_render` (`supremo.py:419`) — **`/api/quadro` não chama nada disso**. Ver REG-2 |

**Placar `8d5d8e9`: 3 confirmadas · 3 parciais · 1 refutada.**

---

## regressoes

### REG-1 — `Freeze` recebe quadro absoluto onde o Remotion exige relativo — **Crítica**

`Video.tsx:126`:

```tsx
<Freeze frame={inicio + Math.round(cena.congelar * fps)}>
```

`inicio` é o quadro **absoluto** de início do bloco na composição. Pela prova em
`freeze.js:41,53,67` + `use-current-frame.js:24-27`, os filhos do `Freeze` veem
`useCurrentFrame() === frameToFreeze`, isto é, o valor é **relativo ao
`<Sequence>` que envolve**. O correto é `frame={Math.round(cena.congelar * fps)}`.

Consequência, com `demanda-01` a 24 fps: congelar o bloco `c003` (que começa no
quadro 5035 ≈ 209,8 s) em `congelar = 0` mostra o segundo `565 + 209,8 = 774,8`
da fonte em vez de `565` — quase o fim do bloco. No `c006` (começa em 702,8 s)
o alvo vira `1290 + 702,8 = 1992,8 s`, **630 s além do fim do arquivo de origem**:
imagem parada no último quadro decodificado ou tela vazia. Só o **primeiro
bloco** (`inicio = 0`) funciona — que é exatamente onde alguém testaria.

Dano colateral no mesmo ponto: `Cena.tsx` usa `useCurrentFrame()` para a
animação de entrada, que com um quadro enorme já nasce concluída.

### REG-2 — o PNG do botão "quadro" sai do projeto errado — **Alta**

`servidor.mjs:304-337` roda `still` sobre o que estiver em
`estudio/src/roteiro-atual.json` (`Root.tsx:14,17,19` importa esse arquivo
estático, e `calculateMetadata` só relê `props.roteiro`, que é o mesmo import).
`req.params.nome` é usado **apenas para nomear o arquivo de saída** (`:316`).

O caminho de render Python não tem esse problema porque `cmd_render`
(`supremo.py:419`) chama `_sincronizar_estudio(nome)` antes. O `/api/quadro` não
chama, e o cliente só sincroniza quando `sujo` (`Editor.tsx:485`).

Reprodução: abrir o editor (ele seleciona `lista[0]`, hoje `demanda-01`), trocar
para `teste` na barra **sem editar nada** (`sujo === false`), clicar em "quadro".
Sai `saida/teste-quadro-N.png` **com o conteúdo de `demanda-01`**. Se o quadro
pedido passar da `durationInFrames` do roteiro em disco, o `still` falha e o erro
volta para a tela-morta da REG-3.

Segunda corrida no mesmo ponto: `salvar()` (`Editor.tsx:238`) **retorna em
silêncio** se `salvandoAgora.current` estiver ligado. Clicar em "quadro" durante
o autosave de 3 s (`Editor.tsx:637-643`) faz o `await salvar()` resolver sem ter
gravado nada, e o `still` roda contra o disco velho.

### REG-3 — a tela-morta de erro ficou trivial de disparar — **Alta**

Não existe **nenhum** `setErro(null)` no projeto (grep em `estudio/`, fora de
`node_modules`: as 9 ocorrências de `setErro` são todas de escrita). `Editor.tsx:647-654`
troca o editor inteiro por `"Deu ruim ao carregar"` sem botão de saída — o
histórico em memória morre no F5. Isso é o `editor.md:51`, que já estava intacto.

O que `8d5d8e9` fez foi ligar **dois botões novos** direto nesse gatilho:

- `Editor.tsx:472` — `setErro("Não há palavras transcritas para exportar.")`.
  Um projeto sem transcrição **destrói a sessão** ao clicar em `.srt`.
- `Editor.tsx:479` e `:490` — qualquer falha de rede ou do `still` faz o mesmo.

Antes só a carga inicial e o autosave chegavam ali. Agora dois cliques de rotina,
um deles com uma condição de erro **esperada e recuperável**, viram tela-morta.

### REG-4 — carimbos do `.srt` se sobrepõem — **Média**

`srt.ts:66`. Medido: 4 de 177 linhas de `demanda-01` invadem a seguinte, até
0,360 s. Um `.srt` com blocos sobrepostos é malformado; players toleram em graus
diferentes e o YouTube costuma reclamar. A correção é limitar pelo início da
próxima linha (`Math.min(Math.max(l.fim, l.t+0.6), proxima.t − ε)`).

### REG-5 — marcadores nascem congelados no relógio do vídeo final — **Média**

`tipos.ts:172-173` e `Editor.tsx:201` (`t = frame / fps`). É exatamente a classe de
defeito que `40c5948` acabou de eliminar das palavras: aparar, dividir ou
reordenar um bloco move o conteúdo e **não** move o marcador. Passam a conviver
três relógios dentro do mesmo `roteiro.json`: palavras em tempo de arquivo,
`legendas.ligada_em` em tempo final (o N3, ainda intacto — `PainelLegenda.tsx:31,193`)
e agora `marcadores` em tempo final. Nenhum é validado pelo PUT (`servidor.mjs:155`
só exige `cenas`) e todos somem num novo `preparar`.

### REG-6 — `spawn` sem `on("error")`, agora em quatro lugares — **Média**

`servidor.mjs:320` (novo), `:396` (novo, dentro da recursão), `:260`, e o antigo
render. Um `ChildProcess` que emite `'error'` sem listener **lança exceção não
capturada e mata o Node**. Basta `.venv/Scripts/python.exe` não existir
(`servidor.mjs:22`) — clone novo, venv não criada, ou máquina não-Windows. A fila
de 3 formatos triplica a exposição. No `/api/quadro` há um segundo dano: a
resposta só é enviada dentro de `proc.on("close")` (`:327`), então se o processo
falhar sem `close` a requisição **pendura para sempre**.

### REG-7 — volume por bloco sem teto — **Baixa**

`PainelBloco.tsx` expõe `max={2}` e `remotion/dist/cjs/volume-prop.js:21` só faz
`Math.max(0, …)`. Amplificar acima de 1 clipa silenciosamente no render. O texto
de ajuda avisa, o código não protege.

### REG-8 — `dividir` ignora `velocidade` — **Baixa**

`Editor.tsx:374`: `fonte_inicio: c.fonte_inicio + a.duracao`. Deveria ser
`a.duracao * (c.velocidade ?? 1)`. Com `velocidade ≠ 1` a segunda metade começa
no ponto errado da fonte. É o `composicao.md:130` reaparecendo em código novo,
não uma regressão nova — mas o commit reescreveu justamente essas linhas e não
consertou.

---

## novos-achados

**N10 — `projetos/teste` continua sem os arquivos que o roteiro passou a citar.**
`40c5948` reescreveu `projetos/teste/roteiro.json` para `audio-fonte.wav`,
`audio-fonte-preview.m4a`, `picos.json` e `offset: 0` — corrigindo o N1 da
revisão anterior **no papel**. Os arquivos existem em `estudio/public/teste/`
(que é de onde o `staticFile` lê, via `pasta = roteiro.projeto`), então o preview
funciona; mas `projetos/teste/` não tem pasta `publica/` nenhuma, ou seja o
projeto não é reproduzível a partir do repositório sem rodar `preparar`. O
`migrar.py` continua sem detectar o caso.

**N11 — `migrar.py` produz palavras em relógio MESTRE, não de arquivo.**
`migrar.py:27-35` converte `final → fonte` usando `_trechos_mantidos`, que foram
gravados em relógio mestre. `legendas.ts:38` soma `offset` por cima. Para
qualquer projeto antigo com `audio.offset ≠ 0`, as palavras migradas ficam
deslocadas de `−offset`. Latente nos dois projetos do repositório (offset 0), e
não foi introduzido por `40c5948` (já valia em `8f2d5f1`), mas continua sem
tratamento e sem aviso.

**N12 — `/api/quadro` não coordena com o render.** `servidor.mjs:304` não checa
`trabalho?.estado === "rodando"`. Um `still` e um `render` podem disputar o mesmo
`roteiro-atual.json` e a mesma pasta `saida/`. Também não há limite de arquivos:
cada clique cria `<nome>-quadro-<frame>.png` novo.

**N13 — `/api/legenda` grava sem escrita atômica.** `servidor.mjs:296` usa
`fs.writeFile` direto, fora da `gravarJson`. É a única gravação do servidor sem
temporário+rename. Baixo risco (arquivo derivado, regenerável), mas quebra a
regra que o próprio commit anterior estabeleceu. A lista branca de nome
(`barrouNome` em `:288`) protege a travessia de caminho corretamente.

**N14 — a barra faz polling eterno.** `Barra.tsx:51-56` mantém um `setInterval`
de 5 s batendo em `/api/render/status` mesmo com nada rodando, para sempre.
O intervalo **é** limpo no unmount e na troca de `rodando` — não vaza timer —
mas é tráfego e re-render contínuos. Pré-existente, agravado porque
`trabalho`/`preparo` nunca voltam a `"parado"` (`servidor.mjs:341,246`).

**N15 — o `.srt` sai em linha única.** `srt.ts:64-68` monta até 84 caracteres num
único parágrafo. A convenção de legenda é quebrar em duas linhas de ~42. Cosmético.

**N16 — sem vazamentos de listener nas partes novas.** Verificado um a um:
`keydown` (`Editor.tsx:598-599`, com `marcar` nas deps de `:614` — sem stale
closure), `beforeunload` (`:621-622`), timeout do `recado` (`:626-630`),
listeners do player (`:261-268`), intervalo da barra (`Barra.tsx:55`). Todos com
`cleanup`. `filaDeGravacao` (`servidor.mjs:65`) também não vaza. Procurei e não
achei nenhum listener novo sem remoção.

---

## verificacao-numerica-independente

Reimplementei `palavrasNaLinhaDoTempo`, `curvaDeVolume` e `gerarSrt` do zero em
Node e rodei contra `projetos/demanda-01/roteiro.json` (24 fps, 775,79 s,
18 619 quadros, 6 cenas, 2060 palavras):

| medida | resultado |
|---|---|
| palavras derivadas para a linha do tempo | 2035 de 2060 (25 caem nos trechos aparados — comportamento correto) |
| primeira / última palavra | `t=0,000` (`complexidade`) / `t=774,883` (`fase`) |
| deslocamento com `off_audio ∈ {0; 5,3; 12,75}` | 0,000 s (uma palavra a mais em 5,3 s por arredondamento de 3 casas) |
| curva de música, `inicio ∈ {0; 10; 40} s` | `fade_entrada` amostrado a partir do quadro 0; `fade_saida` termina em ~0,002; comprimento da curva 1 quadro acima do `Sequence` |
| linhas de `.srt` | 177; **4 com carimbo sobreposto**, pior invasão 0,360 s; 0 carimbos malformados |
| emendas contíguas com erro de 1 quadro em tempos `round(x,3)` | **24,9 % a 24 fps · 25,0 % a 30 fps** (200 000 amostras) |

---

## metodo

Diffs obtidos com `git diff 8f2d5f1 40c5948` e `git diff 40c5948 8d5d8e9`.
Lidos por inteiro no estado vivo: `musica.ts`, `legendas.ts`, `Video.tsx`,
`Root.tsx`, `srt.ts`, `tipos.ts`, `Camada.tsx`, `Cena.tsx`, `servidor.mjs`,
`Editor.tsx`, `Timeline.tsx`, `Barra.tsx`, `PainelBloco.tsx`, `PainelLegenda.tsx`,
`controles.tsx`, `estilos.css`, `api.ts`, `supremo.py`, `roteirizar.py`,
`migrar.py`, `remotion.config.ts`.

Lidos em `node_modules` para provar o comportamento do `Freeze` e do `volume`:
`remotion/dist/cjs/freeze.js`, `remotion/dist/cjs/use-current-frame.js`,
`remotion/dist/cjs/Sequence.js`, `remotion/dist/cjs/volume-prop.js`,
`@remotion/media/dist/audio/props.d.ts`, `@remotion/cli/dist/entry-point.js`,
`@remotion/cli/dist/still.js`, `@remotion/cli/package.json`.

Não executado: nenhum render, nenhum `still`, nenhuma medição de áudio real,
nenhum teste de navegador. As conclusões sobre `Freeze` e sobre o
`unhandledRejection` derivam da leitura do código de biblioteca e da semântica de
Promise, não de execução. Os números vêm de dois scripts de leitura (Node e
Python) sobre os `roteiro.json` reais.

Nenhum arquivo do projeto foi alterado. O único arquivo escrito foi este.
