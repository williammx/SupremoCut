# Mapa arqueológico — editor visual do SupremoCut

Levantamento READ-ONLY de `estudio/editor/`, `estudio/servidor.mjs` e `estudio/vite.config.mts`. Todos os arquivos do escopo foram lidos por inteiro. Cada afirmação cita `arquivo:linha`.

## sumario

Achados de severidade **Crítica**, em ordem de risco para o trabalho do usuário:

| # | Achado | Evidência |
|---|--------|-----------|
| 1 | Ctrl+S dentro da janela de 450ms marca a edição seguinte como já salva; ela nunca vai pro disco e o `beforeunload` não avisa | `Editor.tsx:85-88, 46, 168, 460-461` |
| 2 | Troca de projeto com autosave pendente grava o roteiro ANTIGO por cima do roteiro NOVO | `Editor.tsx:60-72, 172, 460-466` + `servidor.mjs:89-98` |
| 3 | Modal "✚ novo vídeo" troca de projeto sem confirmação, e repetidamente, por causa de estado grudento no servidor | `Processar.tsx:36-40` + `servidor.mjs:173,206` + `Editor.tsx:580-586` |
| 4 | `gravarJson` usa `.tmp` de nome fixo: dois saves concorrentes se atropelam e um deles corrompe ou some | `servidor.mjs:31-36` + `Editor.tsx:163-172` |
| 5 | O Python grava os mesmos JSON com `open(...,"w")`, sem temporário nem rename, enquanto o editor grava | `motor/comum.py:217-221` + `supremo.py:309,324-325` |
| 6 | `erro` nunca é limpo: uma falha transitória tranca o editor até o F5, que descarta todo o histórico | `Editor.tsx:57,71,171,470-477` |
| 7 | PUT grava `req.body` sem validação nenhuma; corpo inválido corrompe o roteiro e apaga a tela (sem ErrorBoundary) | `servidor.mjs:89-98` + `PainelLegenda.tsx:23,31` |
| 8 | Travessia de caminho: `/api/projeto/:nome` aceita `..` e `%2F`, com leitura E escrita arbitrária | `servidor.mjs:81,91` + `router/lib/layer.js:72,90,219-231` |
| 9 | Primeira execução sem projeto nenhum: editor preso em "carregando…" sem acesso ao botão que criaria o projeto | `Editor.tsx:55, 479-481, 498` |

## fluxo-de-dados

1. `main.tsx:6-10` monta `<Editor>` sob `React.StrictMode`. Grep por `ErrorBoundary|componentDidCatch|getDerivedStateFromError` em `estudio/` (fora de node_modules): **zero ocorrências** — qualquer exceção de render apaga a tela inteira.

2. `Editor.tsx:50-58` → `GET /api/projetos`. O Vite intercepta pelo regex `^/api/` (`vite.config.mts:22-28`) e repassa pra `127.0.0.1:8788`. `servidor.mjs:58-77` varre `RAIZ/projetos/*`, devolve só pastas que já têm `roteiro.json`, ordenadas por mtime decrescente. `Editor.tsx:55` escolhe `lista[0]`.

3. `Editor.tsx:60-72` reage a `projeto` → `GET /api/projeto/:nome`. `servidor.mjs:79-87` lê `projetos/<nome>/roteiro.json` + `config/estilo.json` e remove as chaves com `_` (`39-49`). O resultado vira o instante 0: `setHist({pilha:[{roteiro,estilo}], i:0})`, `setSalvoEm(0)` (`Editor.tsx:65-69`).

4. Estado vivo: `atual = hist.pilha[hist.i]` (`Editor.tsx:43-45`). **O histórico é o estado** — não existe outra cópia do roteiro em memória.

5. Clique do usuário → um dos mutadores (`mudarRoteiro:114`, `mudarEstilo:119`, `mudarCena:124`, `mudarCenas:146`, `mudarOverlays:158`) → `registrar` (`Editor.tsx:76-92`), que empilha um `Instante` novo ou, se a mudança anterior foi há menos de `JANELA_AGRUPAMENTO=450`ms (`22,78,85-88`), **substitui** a última entrada.

6. `sujo` é derivado de índice, não de conteúdo: `hist.i !== salvoEm` (`Editor.tsx:46`).

7. Autosave: `Editor.tsx:460-466`, `setTimeout(salvar, 3000)`, deps `[sujo, salvar]`. Como `salvar` depende de `[roteiro, estilo, projeto, hist]` (`172`), cada edição recria `salvar`, o efeito re-roda e o relógio de 3s reinicia — o comentário em `455-459` confere.

8. `salvar` (`163-172`) → `PUT /api/projeto/:nome/roteiro` (`api.ts:20-24`) e em seguida `PUT /api/estilo` (`api.ts:26-27`), sequencialmente com `await`.

9. `servidor.mjs:89-98` grava **dois** arquivos por PUT de roteiro: `projetos/<nome>/roteiro.json` e `estudio/src/roteiro-atual.json`. O de estilo (`100-121`) mescla com o disco pra preservar comentários e grava `config/estilo.json` + `estudio/src/estilo-atual.json`. `gravarJson` (`31-36`) escreve em `<caminho>.tmp` e faz `fs.rename`.

10. Só depois do sucesso roda `setSalvoEm(hist.i)` (`Editor.tsx:168`).

**Volta ao preview:** o preview **não relê o disco**. `Palco` (`Editor.tsx:504` → `Palco.tsx:27-30`) monta `inputProps` a partir do estado em memória via `useMemo([roteiro, estilo])`; o disco só é relido numa troca de projeto ou num reload. Mídia: `Onda.tsx:48` faz `fetch('/<projeto>/picos.json')`, servido pelo `publicDir: "../public"` (`vite.config.mts:14`) = `estudio/public/<projeto>/`, mesma pasta que o Python escreve (`motor/comum.py:40-42`). Render: `Barra.tsx:48-56` salva e chama `POST /api/render/:nome` → `spawn` do Python (`servidor.mjs:221-223`), que relê o `roteiro.json` do disco (`supremo.py:388`).

## bugs-confirmados

**1. Ctrl+S dentro da janela de 450ms marca a edição SEGUINTE como já salva — Crítico.** O ramo de agrupamento devolve `i = base.length - 1`, ou seja **o mesmo índice de antes** (`Editor.tsx:85-88`). Ctrl+S funciona mesmo digitando (`346-350`) e não mexe em `ultimaMudanca` (só `registrar:79` e `encerrarGesto:96` mexem). Cenário: digita numa palavra da legenda em t=0 (vai pro índice k+1), aperta Ctrl+S em t=100ms (`salvoEm`=k+1, `sujo=false`), digita mais uma letra em t=300ms → 300<450 → agrupa → o índice continua k+1 → `sujo` continua **false**. O autosave sai na hora por `if (!sujo) return` (`460-461`), o `beforeunload` não avisa (`447-453`) e o botão exibe "Salvo" (`Barra.tsx:100`). Enquanto os intervalos forem menores que 450ms tudo cai no mesmo índice; se o usuário parar aí, o estado fica sujo pra sempre sem nunca ser marcado como tal.

**2. `salvoEm` não é reajustado quando o histórico estoura o limite — Importante.** `Editor.tsx:89` (`[...base, novo].slice(-LIMITE_HISTORICO)`, limite 120 em `23`) descarta a entrada mais antiga, deslocando todos os índices em 1. `salvoEm` (`31,168`) nunca é decrementado. Depois de 120 passos numa sessão ele aponta pra um instante diferente do que foi gravado; desfazer até esse índice faz `sujo` virar false e o editor anuncia "Salvo" pra conteúdo que não está em disco.

**3. `erro` nunca é limpo: uma falha transitória inutiliza o editor — Crítico.** `setErro` aparece em `Editor.tsx:57, 71, 171` e **sempre com uma mensagem** — não existe `setErro(null)` em lugar nenhum. Com `erro` setado, `470-477` substitui a aplicação por uma tela estática sem botão de tentar de novo. Um único autosave que falhe (servidor reiniciado, `EPERM` no `fs.rename` do Windows com antivírus segurando o arquivo) tranca a sessão; o estado segue vivo na memória, inalcançável pela interface.

**4. Arraste fica preso se o `mouseup` cair fora da janela — Importante.** `Timeline.tsx:290-295` só escuta `mousemove`/`mouseup` no `window`. Não há `pointercancel`, `mouseleave`, `blur`, `setPointerCapture` nem tratamento de `Escape`; `setArraste(null)` só existe dentro de `soltar` (`283-288`). Soltando o botão sobre a barra do navegador, o devtools ou outro monitor, o bloco volta a seguir o mouse com o botão já solto.

**5. Campos numéricos zeram ao digitar decimal — Importante.** `controles.tsx:39-45` (`Numero`) e `PainelLegenda.tsx:161-183` usam `aoMudar(Number(e.target.value))` num `<input type="number">` controlado. Num estado intermediário inválido ("1.", "-", vazio) o navegador reporta `value === ""` e `Number("")` é `0` — o campo salta pra 0 e apaga o que estava sendo digitado. Atinge "Começa em"/"Dura" (`PainelBloco.tsx:71-82`), "Entra em"/"Fica" (`PainelTextos.tsx:94-105`), "Começa em" da música (`PainelAudio.tsx:128-133`) e as duas pontas das faixas de legenda. Mesmo padrão no campo de texto do `Cor` (`controles.tsx:68`): digitar "#f" já grava "#f" no estilo.

**6. `fonte_inicio` aceita valor negativo — Menor.** `PainelBloco.tsx:71-76` não faz clamp — compare com "Dura" na linha `81`, que faz `Math.max(0.2, v)` — apesar de passar `min={0}` pro DOM, atributo que não bloqueia digitação nem colagem.

**7. Colisão de id ao dividir o mesmo bloco — Menor.** `Editor.tsx:242` usa `` `${c.id}b${Date.now().toString(36).slice(-3)}` ``. Três dígitos base36 do timestamp repetem a cada 36³ = 46 656 ms ≈ 46,7 s. Dividir o mesmo bloco duas vezes nesse intervalo produz ids idênticos; a partir daí `mudarCena` (`133`) altera os dois e `apagarCena` (`257`) apaga os dois. `inserirCopia` (`288`) usa o timestamp inteiro + `Math.random` e não tem o problema.

**8. `preparo` e `trabalho` nunca voltam pra "parado" — Importante.** `servidor.mjs:173` e `210` são variáveis de módulo que só mudam de estado dentro do handler. `GET /api/preparar/status` (`206`) e `/api/render/status` (`249`) devolvem eternamente o último resultado. A `Barra` exibe "✓ saida/outro-projeto-principal.mp4" indefinidamente (`Barra.tsx:124-125`), e o `Processar` usa esse estado grudento pra disparar troca de projeto (perda-de-dados nº 3).

**9. Delete sem efeito possível não dá retorno nenhum — Menor.** `Editor.tsx:411-415` chama `apagarCena`, que sai calado quando resta um só bloco (`255`). Os botões equivalentes ficam desabilitados (`Timeline.tsx:357`, `PainelBloco.tsx:307`), mas a tecla não avisa nada.

**10. `mesclar` do estilo é recursiva sem limite de profundidade — Menor.** `servidor.mjs:104-113` desce em todo objeto do body. Um `PUT /api/estilo` com aninhamento suficientemente profundo estoura a pilha do Node e derruba o processo do servidor — que, sem supervisor, não volta sozinho (`servidor.mjs:254-256`).

**11. Projeto chamado `api` fica sem forma de onda — Menor.** `Onda.tsx:48` monta `fetch('/<projeto>/picos.json')`. Com um projeto de nome `api`, a URL vira `/api/picos.json`, que casa com o regex do proxy (`vite.config.mts:25`) e é desviada pro Express, que devolve 404. O `catch` de `Onda.tsx:51` engole e a onda some sem explicação.

**12. Efeito do Player não re-roda quando o `Palco` desmonta — Menor.** `Editor.tsx:176-190` tem deps `[roteiro?.projeto]`. Quando `erro` é setado, `470-477` desmonta o `Palco` mas o efeito não é re-executado, deixando os três listeners registrados num `PlayerRef` já morto.

**13. Imports mortos no `Editor.tsx` — Menor.** `Editor.tsx:2` importa `Player` (só `PlayerRef` é usado, em `40`) e `Editor.tsx:3` importa `VideoPrincipal`, que só é usado dentro do `Palco.tsx:3`. São restos da refatoração descrita em `Palco.tsx:6-16` e puxam o bundle do Player pro módulo do Editor sem necessidade.

**14. Reversão visual do `<select>` de projeto — não verificado nesta passagem.** `Barra.tsx:70-73` cancela a troca com `return` quando o `confirm` é recusado, sem tocar no estado. O `<select>` é controlado por `value={projeto}` (`68`); se o React 19 restaura o valor do DOM sem uma nova renderização não foi testado em execução.

## perda-de-dados

**1. Troca de projeto com autosave pendente escreve o roteiro antigo por cima do novo — Crítico.** `Barra.tsx:70-73` pede confirmação e chama `setProjeto`. O efeito de carga (`Editor.tsx:60-72`) é assíncrono: até ele resolver, `projeto` já é o NOVO e `hist`/`roteiro` ainda são os do ANTIGO, com `sujo` ainda true. `salvar` é recriado com projeto novo + roteiro velho (deps em `172`), o efeito de autosave re-roda (`460-466`) e arma 3s frescos. Se `api.abrir` **rejeitar** (`71`), `hist` nunca é substituído, `sujo` fica true pra sempre e em 3s dispara `PUT /api/projeto/<NOVO>/roteiro` com o corpo do projeto ANTIGO — `servidor.mjs:89-98` grava sem validar nada. **O roteiro do projeto novo é destruído.** Se `api.abrir` apenas demorar mais de 3s (o limite do body é 200 MB, `servidor.mjs:25`), o mesmo PUT sai antes do GET voltar.

**2. Zero validação do corpo no PUT — Crítico.** `servidor.mjs:89-98` e `100-121` gravam `req.body` exatamente como veio: sem schema, sem checar `cenas`, `legendas` ou `fontes`. Um body `{}` sobrescreve `roteiro.json` **e** `estudio/src/roteiro-atual.json` na mesma requisição. Na volta, `PainelLegenda.tsx:23,31` acessa `roteiro.legendas.ligada_em` e `Timeline.tsx:217` acessa `roteiro.fontes.camera` sem guarda — a exceção sobe até a raiz e, sem ErrorBoundary, apaga a tela junto com todo o histórico em memória.

**3. `Processar` força troca de projeto sem confirmação, e repetidamente — Crítico.** `Processar.tsx:36-40` dispara `aoTerminar(status.projeto)` sempre que o estado for `"pronto"`. Como `preparo` é grudento (`servidor.mjs:173,206`), **abrir o modal "✚ novo vídeo" depois de qualquer preparo bem-sucedido anterior já dispara a troca**. `Editor.tsx:580-586` chama `setProjeto(nome)` sem consultar `sujo` — o `confirm` da `Barra.tsx:71` é contornado, e a partir daí vale o cenário nº 1. Agravante: `aoTerminar` é uma arrow inline (`Editor.tsx:580`), recriada a cada render do Editor, e está nas deps do efeito (`Processar.tsx:40`); como o Editor re-renderiza a cada quadro durante a reprodução (`Editor.tsx:179`), o efeito re-executa dezenas de vezes por segundo, disparando `api.projetos()` junto.

**4. `gravarJson` NÃO protege contra gravação concorrente — Crítico.** `servidor.mjs:31-36` usa um nome de temporário **fixo** (`${p}.tmp`) e não tem lock nem fila. O `rename` é atômico, mas o `.tmp` é compartilhado. `salvar` (`Editor.tsx:163-172`) não tem trava de "em voo", então um Ctrl+S manual cruza com o autosave: A escreve o tmp, B escreve por cima, A renomeia (levando conteúdo de B, possivelmente truncado no meio da escrita), B renomeia e recebe `ENOENT` → 500 → `setErro` → editor trancado (bug nº 3 acima).

**5. O Python grava os mesmos arquivos sem proteção nenhuma — Crítico.** `motor/comum.py:217-221` (`salvar_json`) abre com `open(caminho,"w")` — trunca no lugar, **sem temporário e sem rename**. `supremo.py:309` grava `projetos/<nome>/roteiro.json` e `supremo.py:324-325` grava `estudio/src/roteiro-atual.json` e `estilo-atual.json` — exatamente os caminhos de `servidor.mjs:91,93,115,116`. Nada coordena os dois processos: com o editor aberto e um `preparar` ou `render` rodando (ambos passam por `_sincronizar_estudio`), o `rename` do Node cai no meio do `write` do Python e vice-versa. Resultado: JSON truncado ou uma das duas gravações perdida.

**6. Falha de rede no PUT trava a interface sem reverter o estado.** `api.ts:8-11` lança; `salvar` captura e chama `setErro` (`Editor.tsx:169-171`). `setSalvoEm` não roda, então `sujo` continua true e o autosave tentaria de novo — mas a tela já virou a tela de erro sem saída (bug nº 3). O trabalho continua na memória, irrecuperável pela interface.

**7. O PUT grava dois arquivos e pode falhar no segundo.** `servidor.mjs:91` e `93`. Se o primeiro grava e o segundo falha, a resposta é 500, `setSalvoEm` não roda e o editor entra em erro — apesar de o `roteiro.json` do projeto **já estar salvo**. Falso alarme que leva o usuário a repetir a operação.

**8. Render usa o disco mesmo quando o salvamento falha.** `Barra.tsx:49-51`: `if (sujo) await aoSalvar();` — mas `salvar` engole o próprio erro (`Editor.tsx:169-171`) e resolve normalmente. Se o save falhar, o `POST /api/render` sai assim mesmo e o Python renderiza o conteúdo **antigo** do disco (`supremo.py:388`), enquanto a tela vira a tela de erro.

## seguranca

O servidor escuta só em `127.0.0.1` (`servidor.mjs:254`) — é isso que segura o resto. Ainda assim:

**1. Travessia de caminho em `/api/projeto/:nome` — CONFIRMADA.** Nenhum handler valida `req.params.nome`. `servidor.mjs:81` faz `path.join(PROJETOS, req.params.nome, "roteiro.json")`; `91` idem no PUT. O router do Express 5 decodifica o parâmetro com `decodeURIComponent` (`node_modules/router/lib/layer.js:72,90,219-231`), então `%2F` vira `/` **depois** do casamento da rota: `GET /api/projeto/..%2F..%2Fconfig` resolve `nome === "../../config"` e lê `RAIZ/../config/roteiro.json`; o `PUT` na mesma URL **escreve** ali. Com `..` literal funciona em qualquer cliente que não normalize o caminho. Ou seja: leitura e escrita arbitrária de JSON no disco. A mesma ausência de validação vale para `POST /api/preparar/:nome` (`175-204`) e `POST /api/render/:nome` (`212-247`), onde `nome` vira argumento do Python e depois `PROJETOS / nome` (`comum.py:32-33`), com `cmd_novo` (`supremo.py:128-134`) criando diretórios nesse caminho.

**2. Injeção de comando pelo campo `cortes` — REFUTADA.** `Processar.tsx:44` → `api.ts:39-43` → `servidor.mjs:181` `args.push("--cortes", String(req.body.cortes))` → `servidor.mjs:186` `spawn(PYTHON, args, { cwd: RAIZ })`. **Sem `shell: true`**, e `PYTHON` é `.venv/Scripts/python.exe` (`servidor.mjs:22`), não `.bat`/`.cmd`. Os argumentos vão direto ao `CreateProcess`, sem interpretação de shell: `;`, `&&`, `|` e crase não têm efeito. Injeção de *argumento* também não passa: `argparse` recusa valor iniciado por `-` para `--cortes` (`supremo.py:425-429`), abortando em vez de aceitar a flag.

**3. `cortes` vira leitura de arquivo arbitrário COM vazamento de conteúdo — Importante.** `supremo.py:247-254`: se a string terminar em `.txt` e o arquivo existir, ele é lido com `read_text()` — caminho absoluto e livre. As linhas viram trechos separados por vírgula (`256-259`) e, no primeiro pedaço que não casar com a minutagem, `roteirizar.py:114-116` levanta `SystemExit(f"Nao entendi o corte '{pedaco}'...")`. Esse stderr é capturado em `preparo.linhas` (`servidor.mjs:187-197`) e renderizado na tela (`Processar.tsx:70-72, 83`): **um pedaço do conteúdo de qualquer `.txt` do disco volta pra interface**. Serve também como oráculo de existência de arquivo (`possivel.exists()`).

**4. CSRF: qualquer página web dispara processos locais — Importante.** Não há autenticação, token, checagem de `Origin` nem CORS. `PUT` é preflightado e portanto bloqueado cross-origin — mas `POST` com content-type simples não é. Um `<form method="POST" action="http://127.0.0.1:8788/api/preparar/x">` numa página qualquer chega ao handler; `express.json()` (`servidor.mjs:25`) não parseia esse content-type, `req.body` fica indefinido e o `req.body?.cortes` opcional (`181-182`) não quebra — o `spawn` acontece (`186`). Idem `/api/render/:nome`, cujo `formato` tem default (`216`). O atacante não lê a resposta, mas provoca transcrição em GPU, render de vídeo e criação de pastas na máquina do usuário.

**5. Mensagens de erro cruas expostas.** `servidor.mjs:51-54` devolve `String(e.message)`, que inclui caminhos absolutos (`ENOENT: ... F:\SupremoCut\...`), exibidos em `Editor.tsx:474`. Impacto baixo num servidor local, mas é o que confirma a travessia de caminho para quem estiver sondando.

**6. Não verificado nesta passagem:** se o proxy do Vite (`vite.config.mts:22-29`) preserva ou reescreve sequências percent-encoded no caminho antes de repassar ao Express. A travessia foi provada no nível do Express; o caminho via porta 5188 não foi testado em execução.

## estado-e-desempenho

**1. `PainelLegenda` varre todas as palavras a cada quadro.** `Editor.tsx:543` passa `tempoAtual={frame / roteiro.fps}` — valor novo a cada `frameupdate` (`179`), 24–30×/s durante a reprodução, o que vence o `React.memo` (`PainelLegenda.tsx:266`). Dentro, uma IIFE não memoizada (`205-209`) faz `palavras.map(...).filter(...).slice(0,24)`: passada O(n) completa com uma alocação de objeto por palavra. Com 2000+ palavras são ~60 mil objetos por segundo na thread principal.

**2. Editar uma palavra: a cópia do array não é o gargalo, o efeito cascata é.** `PainelLegenda.tsx:219-223` copia as 2000 posições por tecla (barato, são ponteiros). O que trava é a cadeia disparada: `registrar` empilha um `Instante` → `roteiro` novo → `Palco.tsx:27-30` gera `inputProps` novos e o Remotion re-renderiza a composição inteira → `Editor.tsx:192-205` recalcula `posicoes` e `duracaoTotal` → a `Timeline` re-renderiza todos os blocos e todas as marcas → `Onda.tsx:111` muda a identidade de `desenhar` (deps incluem `cenas` e `posicoes`) e o canvas é repintado por inteiro. **Tudo isso por tecla digitada**, sem debounce.

**3. Redesenho da onda é caro e roda em todo evento de scroll — Confirmado.** `Onda.tsx:117-128` escuta `scroll` e chama `forcar` (um `setState` só pra provocar repaint), sem `requestAnimationFrame` e sem throttle. `desenhar` (`84-109`) itera **por pixel visível** e, por pixel, percorre `(1/escala) * por_segundo` picos (`100-105`), com `por_segundo` = 50 (`motor/ondas.py:18`). No "⤢ tudo" de um vídeo de 40 min numa janela de ~1400 px a escala fica em ~0,57 → ~88 iterações por pixel → ~123 mil iterações **por evento de scroll**. E a timeline gera scroll sozinha durante a reprodução (`Timeline.tsx:313-325`).

**4. Leitura do DOM na fase de render.** `Onda.tsx:136`: `style={{ left: (rolagem.current?.scrollLeft ?? 0) - recuo() }}` — impuro, executado duas vezes sob `StrictMode` (`main.tsx:7`) e potencialmente divergente da leitura feita depois no efeito (`77`), o que desalinha a onda em rolagens rápidas.

**5. Fetch dos picos: resultado descartado, requisição não abortada.** `Onda.tsx:42-55` tem a flag `vivo` e o cleanup em `52-54`, então uma resposta atrasada **não** sobrescreve o estado do projeto novo. Mas não há `AbortController` — o download e o `JSON.parse` acontecem mesmo assim (~500 KB para 40 min a 50 picos/s).

**6. O `React.memo` da `Timeline` não protege nada durante a reprodução.** `Timeline.tsx:576`, com o comentário em `572-575`. `frame` é prop (`Editor.tsx:566`) e muda a cada quadro, então a `Timeline` re-renderiza 24–30×/s de qualquer forma, refazendo todos os `<div>` de bloco e de marca.

**7. Régua e blocos sem virtualização.** `Timeline.tsx:329-336` gera uma marca por `passo` em toda a duração. Com `escala=200`, `passo` cai pra 0,5 s (`330`) — um vídeo de 1 h vira **7200 divs** posicionados, e `larguraTotal` (`132`) chega a 720 000 px. Os blocos (`432-547`) também são todos renderizados, sem janela virtual.

**8. Listeners: todos removidos, mas com rebind excessivo.** `wheel` (`Timeline.tsx:189-190`): removido; deps `[escala]` → rebind a cada passo de zoom. `mousemove`/`mouseup` (`290-295`): removidos em **todos** os caminhos, porém as deps (`296-309`) incluem `tempoAtual`, `roteiro.cenas` e `posicoes` — os listeners são desmontados e remontados a cada quadro tocado e a cada movimento do mouse durante o arraste; `modo` (`308`) está nas deps mas não é usado dentro do efeito. `keydown` (`Editor.tsx:429-430`), `beforeunload` (`451-452`), eventos do Player (`182-189`), `scroll` e `ResizeObserver` (`Onda.tsx:121-127`) e os `setInterval` de polling (`Barra.tsx:44-45`, `Processar.tsx:31-32`): todos com cleanup correto. O `requestAnimationFrame` do `Diagnostico` (`73-77`) cancela só o último id agendado, mas a flag `vivo` é o que de fato interrompe o loop de `70`. **Nenhum vazamento de listener confirmado.**

**9. Polling permanente.** `Barra.tsx:41-46` consulta `/api/render/status` a cada 5 s pra sempre, mesmo sem render nenhum; idem `Processar.tsx:28-33` a cada 6 s enquanto o modal está aberto.

**10. A onda continua custando mesmo quando não é desenhada.** `Onda.tsx:130` sai com `return null` quando `dados` é nulo, mas o efeito de `117-128` já registrou o listener de `scroll` que chama `forcar` — ou seja, um `setState` e uma re-renderização por evento de scroll mesmo em projeto sem `picos.json`.

**11. Todo o estado do editor vive num só nó da árvore.** `Editor.tsx:26-41` concentra 14 `useState` no componente raiz; `frame` (`32`) muda 24–30×/s e força a re-renderização de tudo que não estiver memoizado. `Palco` (`Palco.tsx:17`) e `PainelBloco` (`PainelBloco.tsx:316`) se protegem bem; `Timeline` e `PainelLegenda` não, porque recebem props derivadas de `frame` (`Editor.tsx:566, 543`).

## acessibilidade-e-uso

**1. Sem projeto nenhum, o editor fica preso em "carregando…" — Crítico pra usuário novo.** `Editor.tsx:55`: `if (lista.length > 0) setProjeto(lista[0])`. Com a lista vazia, `projeto` fica `null` e `479-481` devolve a tela `carregando…` pra sempre. A `Barra` não é renderizada, então **não há como abrir o modal "✚ novo vídeo"** (`498`) — que é justamente o que criaria o primeiro projeto. Beco sem saída na primeira execução.

**2. Servidor fora do ar = tela morta.** `Editor.tsx:470-477` mostra "Deu ruim ao carregar" mais a mensagem crua do Express, sem botão de tentar de novo e sem instrução ("suba o servidor.mjs"). Combinado com o `erro` que nunca é limpo, a única saída é F5 — que descarta o histórico.

**3. Modal de processamento não fecha enquanto roda — Importante.** `Processar.tsx:52` desliga o clique no fundo quando `rodando`, e o botão "Fechar" (`121-123`) só existe no ramo `else`. Não há `Escape` (o handler de `Editor.tsx:426` só fecha `verAtalhos`) nem botão de cancelar o processo. A transcrição leva minutos por hora de vídeo (o próprio texto avisa, `73-76`) e o usuário fica preso ao modal esse tempo todo, sem acesso à timeline.

**4. Ação destrutiva sem confirmação.** `Delete`/`Backspace` apaga o bloco selecionado direto (`Editor.tsx:411-415`); idem "🗑 Apagar" (`Timeline.tsx:354-360`) e "Apagar este bloco" (`PainelBloco.tsx:303-310`). O "×" apaga overlay (`PainelTextos.tsx:79`) e faixa de legenda (`PainelLegenda.tsx:150-156`). "Remover a música" (`PainelAudio.tsx:136-142`) descarta todos os ajustes de volume e fade. "✂ Tudo corte seco" e "Aplicar esta entrada a todos" (`PainelBloco.tsx:209-222`) reescrevem **todos** os blocos de uma vez. Existe desfazer para tudo isso, mas ele não é óbvio pra leigo e os bugs 1 e 2 de perda-de-dados o tornam pouco confiável. A troca de projeto é a única ação com `confirm` (`Barra.tsx:71`) — e é contornável pelo caminho do `Processar` (perda-de-dados nº 3).

**5. Erros silenciosos.** `Barra.tsx:42` e `Processar.tsx:29` fazem `.catch(() => {})`: se o servidor cair no meio da sessão, o progresso de render simplesmente para de atualizar e nada é dito. `Onda.tsx:51` também engole a falha do fetch — a onda desaparece sem explicação.

**6. Estados de carregamento ausentes.** Não há indicador de "salvando": entre o clique em "Salvar" e a resposta, o botão continua mostrando "Salvar" (`Barra.tsx:99-101`) e segue clicável, produzindo PUTs concorrentes (perda-de-dados nº 4). O `Palco` não tem placeholder enquanto o Remotion carrega a mídia. Já `PainelAudio.tsx:46-53`, `PainelTextos.tsx:69-73` e `PainelBloco.tsx:49-51` têm bons estados vazios.

**7. Roteiro sem cenas degrada bem.** `duracaoEmFrames` retorna `Math.max(1, total)` (`src/Video.tsx:168-174`), então o Player não quebra com `cenas: []`. A timeline fica vazia, `selecionado` vira `null` (`Editor.tsx:67`) e o painel mostra o estado vazio. Falta apenas uma mensagem explícita do tipo "este projeto não tem cenas".

**8. Selecionar um bloco sempre move a agulha.** `Timeline.tsx:439-443`: o `onMouseDown` do bloco chama `aoSelecionar(c.id)` **e** `aoIrPara(posicoes[i] + 0.03)`. Não há como só selecionar um bloco pra editar seus parâmetros sem perder a posição atual de reprodução — comportamento que o `Atalhos.tsx` não documenta.

**9. O campo "Cortes" aceita formato livre e só reclama depois de disparar o processo.** `Processar.tsx:87-99` tem um `placeholder` como única orientação; a validação acontece lá no Python (`roteirizar.py:110-119`) e só chega de volta como texto de log (`Processar.tsx:83`), depois de o `spawn` já ter começado (`servidor.mjs:186`). Não há validação nem no cliente nem no endpoint.

**10. Acessibilidade.** Nenhum `aria-label`, `role` ou gestão de foco em nenhum arquivo do escopo. Os modais (`Atalhos.tsx:27`, `Processar.tsx:52`, `Diagnostico.tsx:83`) não prendem o foco nem o devolvem à origem. Os puxadores de arraste (`Timeline.tsx:457,501`) são `<div>` sem equivalente por teclado, e vários controles são identificados só por emoji (`Barra.tsx:88,96`). As faixas de legenda usam `key={i}` (`PainelLegenda.tsx:145`) numa lista da qual se remove pelo meio (`153`), reconciliando por índice.

## fora-de-escopo

Lidos apenas o suficiente para sustentar afirmações do escopo, **não auditados**: `estudio/src/Video.tsx` (só `duracaoEmFrames`), `estudio/src/tipos.ts`, `motor/supremo.py`, `motor/comum.py`, `motor/roteirizar.py`, `motor/ondas.py`, `estudio/package.json`, `node_modules/router/lib/layer.js`.

Não abertos: `estudio/src/layouts.ts`, `musica.ts`, `Root.tsx`, `motor/tratar.py`, `motor/sincronizar.py`, `motor/transcrever.py`, `config/estilo.json`, `estudio/tsconfig.json`, `estudio/remotion.config.ts`.

Não investigado nesta passagem: correção do render final do Remotion; sincronia áudio/vídeo; qualidade da transcrição; `estilos.css` além das classes citadas; a build de produção (`vite.config.mts:35-39`); e o comportamento em execução do proxy do Vite quanto a percent-encoding.
