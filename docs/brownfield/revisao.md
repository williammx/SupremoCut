# Revisão adversarial do commit `8f2d5f1`

Revisão independente e READ-ONLY do commit `8f2d5f1 "FORJA: corrige perda de dados,
legendas descolando e travessia de caminho"` contra `411e481`.

Nada do que o commit alega foi aceito sem verificação. Toda afirmação abaixo tem
`arquivo:linha` ou número medido no arquivo vivo. Nenhum código foi alterado; o
único arquivo escrito foi este.

---

## veredito

**REPROVADO** — duas regressões de severidade crítica (relógio de `fonte_inicio`
quebrado no motor Python; queda do processo do servidor em qualquer falha de
gravação), uma alegação frontalmente falsa e três parcialmente falsas.

---

## alegacoes-verificadas

| # | Alegação do commit | Veredito | Evidência |
|---|---|---|---|
| 1 | "Legendas vivem no relógio da fonte e a posição final é derivada das cenas a cada render" | **PARCIAL** | Núcleo correto e medido: `legendas.ts:24-56` + `Video.tsx:34-42` + `Legenda.tsx:60-63`. Verificação numérica independente em `demanda-01`: a palavra `'Covid,'` sai em **71,103 s** derivado contra **79,32 s** gravado no roteiro antigo — exatamente os **8,217 s** de descolamento que `composicao.md:84-86` documentou. 25 das 2060 palavras somem, e as 25 são legítimas (caem nos trechos aparados 353→405,124 e nas emendas 544/783/1071/1253). Mas: soma indevida de `audio.offset` (ver regressão R1), `aoIrPara` quebrado (R4) e `ligada_em` continua congelado (ver novos-achados N3) |
| 1b | Sub-alegação: `PainelLegenda` ainda edita a palavra certa | **CONFIRMADA** | `PainelLegenda.tsx:206-208` faz `.map((p,i)=>({p,i}))` **antes** do `.filter`, então `trocar(i,…)` em `:219-223` indexa o array original. `Editor.tsx:615` passa `tempoNaFonte`, no mesmo relógio das palavras. Índice correto |
| 1c | Sub-alegação: `velocidade != 1` | **CONFIRMADA** | `legendas.ts:37,45,46`: `consumido = duracao*velocidade`, `t = ini + (p.t-de)/velocidade`, `fim` limitado por `Math.min(consumido, …)/velocidade`. Matemática correta, inclusive o clamp na borda |
| 1d | Sub-alegação: blocos reordenados | **CONFIRMADA** | `legendas.ts:34,52` percorre `cenas` na ordem do array e acumula `inicioNaLinha += cena.duracao`; `:55` reordena a saída. Reordenar move a legenda junto |
| 2 | "`preparar` faz backup antes de reescrever" | **CONFIRMADA** | `supremo.py:152-167` é o passo **0**, antes de fontes/sincronia/tratamento. A única escrita do roteiro é `supremo.py:336`. Falha no meio (transcrição, ffmpeg) deixa `roteiro.json` intacto + a cópia datada. Nenhuma escrita destrutiva precede o backup |
| 3 | "Ctrl+S não marca mais a edição seguinte como salva" | **CONFIRMADA** | `Editor.tsx:40,55` troca índice por referência de objeto. O ramo de agrupamento `Editor.tsx:95-98` substitui `base[base.length-1]` por um objeto **novo**, então `atual !== salvo` e `sujo` fica true. Procurei o caminho inverso: `desfazer`/`refazer` (`:109-117`) só mexem em `i` e devolvem o **mesmo** objeto da pilha, logo voltar ao ponto salvo restaura `sujo=false` corretamente. E o estouro de `LIMITE_HISTORICO` (`:99`), que era o bug #2 de `editor.md`, passou a falhar para o lado seguro (marca sujo em vez de "salvo") |
| 4 | "Trocar de projeto não grava o roteiro antigo sobre o novo" | **CONFIRMADA** | Dupla guarda: cliente em `Editor.tsx:206` (`atual.roteiro.projeto !== projeto`) e servidor em `servidor.mjs:150-154` (409). Cobre os dois caminhos de troca (`Barra` e `Processar`) porque a checagem é feita **dentro** de `salvar`, não no chamador. **Sobre o `estilo.json`:** não é gravável errado — `api.salvarEstilo` (`Editor.tsx:213`) só é alcançado depois do `return` da linha 206, então a mesma guarda o protege. Ele continua global por design (risco pré-existente, não regressão) |
| 5 | "Travessia de caminho fechada" | **CONFIRMADA** | Enumerei **todas** as rotas com parâmetro. São quatro e as quatro têm `barrouNome`: `servidor.mjs:133` (GET projeto), `:144` (PUT roteiro), `:241` (POST preparar), `:279` (POST render). Nenhuma ficou de fora. A lista branca `servidor.mjs:37-44` (`/^[A-Za-z0-9_.-]+$/` + rejeita `.` inicial, `.` e `..`) barra `%2F`, `..` literal, barra invertida e NUL |
| 6 | "Gravação concorrente resolvida com fila por caminho" | **PARCIAL** | A fila **serializa de verdade** (`servidor.mjs:68-70`: encadeia em `anterior`) e o temporário virou único (`:72-74`). O `finally` **não** apaga a fila de outra gravação: `:86` compara identidade (`filaDeGravacao.get(p) === atual`) antes do `delete` — encadeamento A→B deixa o `finally` de A sem efeito e só B limpa. **Sem vazamento no Map.** Mas introduziu queda do processo — ver regressão R2 |
| 7 | "Curva de música corrigida (quadro relativo vs absoluto)" | **PARCIAL** | A soma está certa: `musica.ts:27` dimensiona a curva em quadros **absolutos** (`ceil(duracaoTotal*fps)`), e `Video.tsx:175` lê `f + inicioMusica`. Ducking e `fade_saida` passam a cair no lugar. Mas quebrou o `fade_entrada` — ver regressão R3 |
| 8 | "Tempos encaixam em quadros inteiros por construção" | **REFUTADA** | `emQuadros` (`Editor.tsx:142-153`) só é aplicado em `mudarCena` (`:165`) e `mudarCenas` (`:186`). **Escapam:** `dividirNoCursor` (`Editor.tsx:311-317`, usa `.toFixed(3)` cru), `inserirCopia`/`colar`/`duplicar` (`:354-368`, copia a cena verbatim sem snap) e o **motor Python**, que grava `round(x, 3)` (`roteirizar.py:173,178,238,243,246`) e nunca alinha a `fps`. O painel numérico **está** coberto (`PainelBloco.tsx:75,81` → `aoMudar` = `mudarCena`), assim como a Timeline. "Por construção" é falso: a maioria dos roteiros nasce fora da grade e o `dividir`, que é o gesto mais comum, sai dela de novo |
| 8b | Sub-alegação implícita: stale closure em `emQuadros` | **REFUTADA (não há bug)** | `emQuadros` só fecha sobre `roteiro?.fps` (`Editor.tsx:152`) e `mudarCena` inclui `emQuadros` nas próprias deps (`:169`). Os dois são recriados juntos. Nenhum caminho lê um `fps` velho |
| 9 | "PiP escala corretamente entre preview e render" | **PARCIAL** | Correto e necessário: `Palco.tsx:40-41` desenha o preview em **metade** das dimensões, então `useVideoConfig().height` é 540 no preview e 1080 no render. `layouts.ts:66,89,92` (`k = altura/1080`) passa a normalizar margem, raio e borda. **Mas `Camada.tsx:71` ficou de fora:** o `boxShadow` continua string literal (`0 24px 70px …`), então a sombra do quadradinho segue com o dobro do peso proporcional no preview. Exatamente o item 2 de `composicao.md:183-188`, corrigido pela metade |
| 10 | "`montar_audio` e `_trechos_mantidos` removidos" | **CONFIRMADA** | `montar_audio` sumiu de `tratar.py` e não tem chamador nenhum (grep em `motor/`). `_trechos_mantidos` deixou de ser escrito (`roteirizar.py:384-396`). `migrar.py:57-59` lê o campo **de propósito e corretamente**: é o migrador, lê o campo de arquivos **antigos em disco**, e `migrar.py:46` só migra quando `base_tempo != "fonte"` — roteiros novos nunca entram nesse ramo. Não é problema. Sobrou lixo, ver N6 |

**Placar: 5 confirmadas · 4 parciais · 1 refutada (2 refutadas contando 8b).**

---

## regressoes

### R1 — `fonte_inicio` mudou de relógio e ninguém do outro lado foi avisado — **Crítica**

A correção mais perigosa do commit está na parte que ele **não** menciona.

Antes (`411e481`), `supremo.py` convertia palavras **e** frases para o relógio
mestre com `para_mestre`, subtraindo `off_audio` das duas. Agora
`supremo.py:255-269` deixa as palavras no relógio do **arquivo**
(`recortar(..., 0.0)`) e só as frases vão para o mestre
(`recortar(..., off_audio)`).

O problema: `fonte_inicio` **é derivado das palavras**, não das frases.

```
supremo.py:268   palavras -> relógio do ARQUIVO, faixa [off_audio, off_audio+duracao_util]
supremo.py:301   escrever_roteiro(transcricao=…, duracao_total=duracao_util)
roteirizar.py:327  trechos = trechos_com_fala(palavras, duracao_total, cfg)
roteirizar.py:368  "fonte_inicio": c["fonte_inicio"]      <-- agora em relógio de ARQUIVO
```

Mas os três consumidores continuam tratando `fonte_inicio` como **mestre** e
somando o offset por cima:

- `Cena.tsx:111` — `cena.fonte_inicio + fCam.offset`
- `Cena.tsx:125` — `cena.fonte_inicio + fTela.offset`
- `Video.tsx:149` — `cena.fonte_inicio + audio.offset`
- `legendas.ts:38` — `cena.fonte_inicio + offsetAudio`
- `Editor.tsx:270,276` — mesma soma em `tempoNaFonte`

Resultado com `off_audio != 0`: **todo corte entra `off_audio` segundos depois
do ponto calculado**. Câmera, tela, áudio e legenda erram juntos (o erro é
uniforme), então não há dessincronia entre eles — o que torna a falha ainda mais
difícil de perceber: o vídeo simplesmente entra no meio da palavra em cada bloco,
e o corte de silêncio recorta o lugar errado.

Dano colateral no mesmo ponto: `roteirizar.py:68,72` faz
`min(duracao_total, …)` comparando tempo de **arquivo** contra uma duração de
**mestre** — com `off_audio > 0` os blocos finais são truncados, e blocos
inteiramente além de `duracao_util` produzem duração negativa.

Terceiro dano: `roteirizar.py:211` e `:374` chamam `_frase_em(frases, cursor)`
com `cursor`/`fonte_inicio` em relógio de arquivo contra `frases` em relógio
mestre. Os gatilhos de layout (`mostrar_tela`, `voltar_pra_camera`) e a `nota`
de cada cena leem a frase errada, deslocada de `off_audio`. O comentário
recém-escrito em `supremo.py:246-251` afirma que essa comparação é feita "no
relógio mestre" — a afirmação está no código e é falsa.

**Quando morde:** `sincronizar.py:123,132,136` normaliza pelo mínimo, então
`offset[camera] > 0` exatamente quando a gravação de tela **começou antes** da
câmera — caso comum (OBS aberto antes da webcam). Latente nos dois projetos do
repositório (`demanda-01` tem fonte única, `audio.offset: 0`; `teste` tem
`camera: 0, tela: 5.3`), o que explica não ter sido notado.

### R2 — qualquer falha de gravação agora derruba o servidor — **Crítica**

`servidor.mjs:85-87`:

```js
atual.finally(() => {
  if (filaDeGravacao.get(p) === atual) filaDeGravacao.delete(p);
});
```

`Promise.prototype.finally` devolve uma **promessa derivada nova**. Se `atual`
rejeitar, essa derivada rejeita com o mesmo motivo — e ninguém anexa `catch`
nela. O `await gravarJson(...)` do handler trata `atual`, não a derivada. Node
≥15 termina o processo em `unhandledRejection` por padrão.

Ou seja: um `EPERM` no `fs.rename` (antivírus segurando o arquivo no Windows —
o cenário exato descrito em `editor.md:51`) deixava o editor com um 500; agora
**mata o `servidor.mjs`**, e não há supervisor para reerguê-lo
(`servidor.mjs:321-323`). O usuário perde o autosave e todo o histórico em
memória no F5 seguinte. A correção da concorrência trocou um erro recuperável
por uma queda de processo.

### R3 — o `fade_entrada` da música nunca mais toca quando `musica.inicio > 0` — **Importante**

`musica.ts:55,60` aplica o fade de entrada nos quadros **absolutos** `0..fIn`.
`Video.tsx:175` agora lê a curva em `f + inicioMusica`, então os índices
`0..inicioMusica-1` **nunca são amostrados**. Com `fade_entrada: 1.5`
(`musica.ts:73`) e `musica.inicio >= 1.5`, a música entra em volume cheio, sem
rampa nenhuma.

Antes do commit, `volumeMusica[f]` usava o quadro relativo: o fade de entrada
tocava certo e o ducking/`fade_saida` é que estavam deslocados. O commit
transferiu o defeito de uma ponta para a outra em vez de eliminá-lo. A correção
completa exige indexar a curva a partir de `inicioMusica` (ou gerar a curva já
relativa ao início da música).

### R4 — clicar no tempo de uma palavra pula para o lugar errado — **Importante**

`PainelLegenda.tsx:235`: `onClick={() => aoIrPara(p.t)}`. `p.t` agora está no
relógio da **fonte**, mas `irPara` (`Editor.tsx:279-288`) interpreta o argumento
como segundos da **linha do tempo final** (`Math.round(segundos * roteiro.fps)`).
Em `demanda-01` isso significa clicar na primeira palavra e ser levado ao
segundo 281 de um vídeo de 775 s — ou, para palavras acima de 775 s, ao clamp do
último quadro. O rótulo exibido em `:239` (`relogio(p.t)`) também virou tempo de
fonte, o que não bate com nenhuma régua da interface. Antes do commit os dois
funcionavam.

### R5 — edição pendente do projeto antigo é descartada em silêncio na troca — **Menor**

Consequência direta e correta da guarda de `Editor.tsx:206`: o autosave pendente
do projeto A é bloqueado, e o `hist` é substituído pelo projeto B assim que
`api.abrir` resolve. Nada tenta gravar A antes de trocar e nada avisa. O
`confirm` da `Barra` cobre o caminho manual; o caminho do `Processar`
(`Editor.tsx:652-657`) continua sem confirmação nenhuma. Trocou corrupção
silenciosa por perda silenciosa — melhor, mas ainda perda.

### R6 — corrida de `setSalvo` marca o projeto recém-aberto como sujo — **Menor**

`salvar` (`Editor.tsx:200-220`) é assíncrono e chama `setSalvo(instante)` depois
de dois `await`. Se o usuário trocar de projeto durante o voo, `Editor.tsx:76`
já executou `setSalvo(inicial)` do projeto novo e a resolução tardia sobrescreve
`salvo` com o instante do projeto **antigo**. `sujo` fica true logo ao abrir e
dispara um autosave espúrio em 3 s. Não corrompe (as guardas de projeto seguram),
mas grava sem motivo e mente no indicador da barra.

---

## ainda-quebrado

Achados originais dentro do escopo declarado do commit que **não** foram tocados:

| Origem | Achado | Estado |
|---|---|---|
| `editor.md:51` (perda-de-dados, Crítico) | `erro` nunca é limpo — não existe `setErro(null)` em `Editor.tsx`. Uma falha transitória de autosave ainda tranca a sessão numa tela sem saída (`Editor.tsx:542-549`), descartando o histórico no F5. Com R2, agora é fácil de provocar | intacto |
| `editor.md:81` (perda-de-dados #3, Crítico) | `Processar` força troca de projeto sem confirmação: `preparo` continua grudento (`servidor.mjs:238,272` nunca voltam a "parado") e `Editor.tsx:652-657` chama `setProjeto` sem consultar `sujo`. O `confirm` da `Barra` segue contornável | intacto |
| `editor.md:101` (segurança #3, Importante) | `--cortes` ainda lê arquivo arbitrário e vaza conteúdo: `servidor.mjs:247` repassa a string crua e `supremo.py:277-281` faz `read_text()` em qualquer `.txt`; o erro de parsing volta para a tela via `preparo.linhas` (`servidor.mjs:253-261`) | intacto |
| `editor.md:103` (segurança #4, Importante) | CSRF: sem `Origin`/token, um `<form method=POST>` de qualquer página dispara `/api/preparar/:nome` e `/api/render/:nome`. A lista branca de nomes não muda isso | intacto |
| `composicao.md:120` (bug 4, Importante) | Grupo de legenda "segura" o próximo por até 0,35 s — `Legenda.tsx:72` continua com `grupos.find(g => t >= g.inicio-0.12 && t <= g.fim+0.35)` e janelas sobrepostas | intacto |
| `composicao.md:130` (bug 5, Importante) | `velocidade != 1` não move o `fonte_inicio` da cena seguinte. `Timeline` e `Onda` seguem discordando entre si | intacto |
| `composicao.md:146,155` (bugs 6 e 7, Menores) | `premountFor` não aquece camada que nasce no morph; overshoot do `zoom_cruzado` | intactos |
| `composicao.md:164` (bug 8, Menor) | Falha ao salvar não impede o render: `salvar` (`Editor.tsx:215`) segue engolindo a exceção sem relançar | intacto |
| `editor.md:53,55,57,59` | Arraste preso fora da janela; campos numéricos zerando em decimal; `fonte_inicio` negativo aceito; colisão de id ao dividir (`Editor.tsx:314`, ainda `slice(-3)`) | intactos |
| `composicao.md:329` | Estilo global afetando todos os projetos | intacto (por design) |

---

## novos-achados

Coisas que nenhuma das três auditorias tinha visto, encontradas nesta passagem:

**N1 — `roteiro.json` de projeto antigo aponta para áudio pré-cortado e agora é
insalvável. Crítico.** O projeto `teste` tem `audio: {"arquivo": "audio.wav"}` —
sem `offset`, sem `arquivo_preview`, sem `picos`. É o formato antigo, em que
`montar_audio` produzia um WAV **já montado**, do tamanho exato do vídeo final
(29,94 s). `Video.tsx:147-150` busca `Math.round(fonte_inicio * fps)` dentro
dele, e `fonte_inicio` chega a **38,83 s** — 9 s além do fim do arquivo. Os
blocos finais tocam silêncio. A migração (`migrar.py`) converteu o relógio das
legendas e **não mexeu no áudio**; e como `montar_audio` foi removido
(`tratar.py`), não existe mais caminho que regenere aquele formato. A única
saída é rodar `preparar` de novo — que ninguém avisa, e que reescreve o roteiro.
`migrar.py` deveria detectar `audio` sem `offset`/`picos` e recusar ou avisar.

**N2 — `Number(snap(v).toFixed(4))` desfaz parte do próprio snap.**
`Editor.tsx:148-149`: `snap` produz `Math.round(v*f)/f`, e `toFixed(4)` corta em
seguida. A 30 fps, `76/30 = 2.533333…` vira `2.5333` — que não é múltiplo exato
de `1/30`. O erro (≤ 5·10⁻⁵ s) é pequeno demais para mudar o
`Math.round(duracao*fps)` de `Video.tsx:55`, então na prática não quebra; mas
invalida a palavra "exato por construção" do próprio comentário em
`Editor.tsx:140`, e mantém a divergência entre o `posicoes` em segundos crus do
editor (`Editor.tsx:240-248`) e o `cursor` em quadros da composição.

**N3 — `ligada_em` ficou órfão no relógio antigo.** `legendas.ligada_em` continua
em tempo de **vídeo final** (`tipos.ts:87`, `Legenda.tsx:69`, e
`PainelLegenda.tsx:192-193` cria a faixa a partir da soma das cenas). As palavras
migraram para tempo de fonte; as faixas não. Agora convivem dois relógios dentro
do mesmo objeto `legendas`, e as faixas voltaram a ter exatamente o defeito que o
commit foi corrigir: aparar um bloco desloca a janela onde a legenda aparece.
Ninguém documentou nem migrou isso.

**N4 — `payload` do PUT valida `cenas`, mas não `legendas`.**
`servidor.mjs:147-149` exige `Array.isArray(corpo.cenas)`. Um corpo sem
`legendas` passa, e na volta `PainelLegenda.tsx:23,31` acessa
`roteiro.legendas.ligada_em` sem guarda — a exceção sobe até a raiz e, sem
`ErrorBoundary` (`editor.md:23`), apaga a tela e o histórico. A validação
resolveu metade do achado `editor.md:79`.

**N5 — a segunda gravação do PUT usa `req.body`, não `corpo`.**
`servidor.mjs:156` grava `corpo` (validado) em `projetos/<nome>/roteiro.json`;
`servidor.mjs:158` grava `req.body` em `src/roteiro-atual.json`. São o mesmo
objeto hoje, então é inofensivo — mas é uma assimetria que convida a divergir
assim que alguém normalizar `corpo`.

**N6 — código morto deixado pelo commit.** `mapear_tempo`
(`roteirizar.py:139-148`) perdeu o último chamador quando `montar_legendas` foi
reescrito e continua exportado; `PROJETOS` é importado em `supremo.py:26` e não
é usado em lugar nenhum do arquivo. Nada quebra, mas `mapear_tempo` é justamente
a função que implementava o relógio antigo — deixá-la à mão é convite para
alguém reintroduzir o bug.

**N7 — `Ctrl+S` durante um autosave em voo não faz nada e não avisa.**
`Editor.tsx:207` (`if (salvandoAgora.current) return;`) descarta a segunda
chamada em silêncio. O efeito de autosave (`:532-538`) reconcilia depois, então
não há perda — mas o usuário aperta Ctrl+S, o botão não muda, e nada indica que
o pedido foi ignorado.

**N8 — palavra que atravessa a borda de entrada do bloco é descartada inteira.**
`legendas.ts:43` exige que a palavra **comece** dentro do bloco
(`if (p.t < de) continue`). Uma palavra que começa 40 ms antes do corte e se
estende por dentro dele some por completo, em vez de aparecer truncada — o caso
simétrico da borda de saída, que `:46` trata com `Math.min`. Nos dados de
`demanda-01` isso não custou nenhuma palavra além das 25 legítimas, mas o
tratamento assimétrico das duas bordas é acidental, não deliberado.

**N9 — a IIFE dentro do JSX está correta.** Verifiquei porque foi levantado
como suspeita: `Video.tsx:160-182` usa
`{cond ? (() => { … return <Sequence/>; })() : null}`. É uma expressão de chamada
dentro de `{}`, sintaticamente válida em JSX e semanticamente equivalente ao
código anterior. Sem defeito. O custo é uma função nova por render — irrelevante
aqui.

---

## verificacao-independente-da-migracao

Recalculei a conversão do zero, sem usar `migrar.py`, reimplementando
`final → fonte` a partir do `_trechos_mantidos` do backup:

| projeto | palavras antes | depois | recálculo independente | divergências | descartadas |
|---|---|---|---|---|---|
| `demanda-01` | 2060 | 2060 | 2060 | **0** | 0 |
| `teste` | 63 | 63 | 63 | **0** | 0 |

`_trechos_mantidos` de `demanda-01`:
`[281,353] [398,544] [565,783] [888,1071] [1161,1253] [1290,1363]`.

Amostras conferidas (final → fonte): `0 → 281.0` (`'complexidade'`),
`406.88 → 753.88` (`'você'`), `783.09 → 1362.09` (`'fase'`). Todas batem com a
soma acumulada dos trechos. `base_tempo: "fonte"` gravado nos dois projetos e
`_trechos_mantidos` removido dos dois.

**A migração está numericamente correta.** As 25 palavras que somem depois, na
derivação em tempo de render, são as dos trechos que o usuário já havia aparado
no editor (`c001` encurtada de 353 → 351,907; `c002` movida de 398 → 405,124) e
das quatro emendas — comportamento correto, não perda.

---

## metodo

Commit obtido com `git log`/`git diff HEAD~1 HEAD`. Lidos por inteiro:
`legendas.ts`, `Video.tsx`, `tipos.ts`, `musica.ts`, `layouts.ts`,
`componentes/Legenda.tsx`, `componentes/Cena.tsx`, `Root.tsx`, `Editor.tsx`,
`Palco.tsx`, `PainelLegenda.tsx`, `servidor.mjs`, `supremo.py`, `roteirizar.py`,
`migrar.py`, `sincronizar.py`, `tratar.py`, e os diffs de `comum.py` e
`Camada.tsx`. Os números de `demanda-01` e `teste` vêm de dois scripts de
leitura executados sobre `roteiro.json` e `roteiro.json.antes-da-migracao`
(reimplementação independente de `_para_fonte` e de `palavrasNaLinhaDoTempo`).

Não executado: nenhum render, nenhuma medição de áudio real, nenhum teste de
navegador. As conclusões sobre `unhandledRejection` (R2) e sobre o
comportamento do `Promise.finally` derivam de semântica de linguagem e do padrão
do Node ≥15, não de execução.

Nenhum arquivo do projeto foi alterado. O único arquivo escrito foi este.
