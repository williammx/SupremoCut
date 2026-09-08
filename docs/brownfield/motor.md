# Motor Python — mapa de campo

Passagem 1 do Arqueólogo. Escopo lido por inteiro: `motor/comum.py`, `motor/sincronizar.py`,
`motor/transcrever.py`, `motor/tratar.py`, `motor/roteirizar.py`, `motor/ondas.py`,
`motor/supremo.py`, `config/*.json`. Consumidores (`estudio/src/*`, `estudio/servidor.mjs`,
`estudio/editor/*`) foram lidos só o suficiente para confirmar quem lê o que o motor grava.
Nada foi executado. Toda afirmação abaixo tem `arquivo:linha`.

Convenção de relógios usada neste documento (deduzida do código, não de comentário):
- **bruto** = tempo dentro do arquivo original em `projetos/<n>/bruto/`.
- **mestre** = relógio comum às duas fontes. `bruto = mestre + offset` (`sincronizar.py:96`,
  confirmado no consumidor em `Cena.tsx:111` e `Cena.tsx:125`: `inicioNaFonte = cena.fonte_inicio + fonte.offset`).
- **final** = tempo do vídeo renderizado, que é a concatenação dos trechos mantidos.

---

## fluxos-reais

### `python motor/supremo.py preparar <nome>`

Entrada em `supremo.py:450` → `cmd_preparar` (`supremo.py:137`).

1. **Pastas** — `supremo.py:144-150`. Se `projetos/<nome>/` não existe, chama `cmd_novo`
   (`supremo.py:128`). Cria `projetos/<nome>/trabalho` e `estudio/public/<nome>`.
   Nota: usa `projeto / "trabalho"` (`supremo.py:147`); a constante `TRABALHO` de
   `comum.py:25` não é usada por ninguém.
2. **Descoberta das fontes** — `supremo.py:153-154` → `descobrir_fontes` (`supremo.py:44`).
   Varre `bruto/` filtrando por `EXTENSOES` (`supremo.py:36`), casa o *stem* minúsculo contra
   `PISTAS_CAMERA` / `PISTAS_TELA` (`supremo.py:38-39`) e, o que sobrar, distribui por ordem
   alfabética (`supremo.py:68-74`).
3. **Sincronia** — `supremo.py:157-166`. Com 2+ fontes chama `sincronizar.sincronizar`
   (`sincronizar.py:91`): `sondar` de cada arquivo (`sincronizar.py:104`), extração de WAV
   16 kHz mono em `trabalho/sync_<papel>.wav` (`sincronizar.py:108` → `comum.py:194`),
   envelope de energia a 100 Hz (`sincronizar.py:25-52`), correlação cruzada FFT
   (`sincronizar.py:68-69`), pico dentro de ±180 s (`sincronizar.py:72-82`), confiança pelo
   destaque do pico sobre a mediana (`sincronizar.py:85-86`). O atraso vira offset com sinal
   invertido (`sincronizar.py:123`) e o conjunto é normalizado para mínimo zero
   (`sincronizar.py:131-139`). Com 1 fonte, monta o dicionário à mão com offset 0
   (`supremo.py:161-163`).
   Depois `duracao_util` (`sincronizar.py:143`) = `min(duracao - offset)`.
   Aviso de baixa confiança em `supremo.py:168-174`.
4. **Vídeo** — `supremo.py:176-213`. `tratar.carregar_config()` lê `config/tratamento.json`
   (`tratar.py:39-49`). Para cada papel: reaproveita o proxy se existir, tiver tamanho > 0 e
   mtime ≥ mtime do bruto (`supremo.py:183-188`), senão `tratar.preparar_video`
   (`tratar.py:56`) — escala para no máximo `escala_maxima_altura`, aplica a cadeia de cor
   (`tratar.py:31-36`), encoda em `h264_nvenc` com GOP fixo e cai para libx264 se falhar
   (`tratar.py:96-106`). Mesma lógica para o `-preview.mp4` (`supremo.py:194-203` →
   `tratar.py:112`). Monta `fontes_roteiro` (`supremo.py:205-213`).
5. **Transcrição** — `supremo.py:216-242`. `papel_audio` = `camera` se existir, senão a
   primeira fonte (`supremo.py:217`). Cache só é consultado com `--reusar-transcricao`
   (`supremo.py:218` → `transcrever.py:109`). `transcrever.transcrever` (`transcrever.py:19`)
   chama `ativar_cuda` (`transcrever.py:35`), extrai `trabalho/transcricao.wav`
   (`transcrever.py:39`), roda faster-whisper com `word_timestamps` e VAD
   (`transcrever.py:47-59`) e cai para CPU int8 se a GPU estourar (`transcrever.py:61-68`).
   Grava `trabalho/transcricao.json` (`transcrever.py:104`).
   Em seguida `para_mestre` (`supremo.py:228-238`) subtrai `off_audio` de `t` e `fim` de
   palavras e frases e descarta o que cai fora de `[0, duracao_util]`.
6. **Roteiro** — `supremo.py:244-284`. Se veio `--cortes`, aceita string inline ou caminho de
   `.txt`, remove linhas com `#` e chama `ler_lista_de_cortes` (`supremo.py:246-264` →
   `roteirizar.py:100`). `fps` = arredondamento do fps da fonte de áudio (`supremo.py:266`);
   largura/altura fixas em 1920×1080, virando 1080×1920 se a fonte principal for retrato
   (`supremo.py:267-272`). `roteirizar.escrever_roteiro` (`roteirizar.py:288`) lê
   `config/direcao.json` (`roteirizar.py:25`), decide os trechos (`roteirizar.py:303-312`),
   os layouts (`roteirizar.py:315-322` → `roteirizar.py:162`), as transições
   (`roteirizar.py:325-349`) e as legendas (`roteirizar.py:378` → `roteirizar.py:259`).
7. **Áudio** — `supremo.py:286-299`. Reaproveita `audio-fonte.wav` pelo mesmo critério de
   mtime; senão `tratar.tratar_audio_completo` (`tratar.py:223`) limpa a **fonte inteira**,
   `tratar.audio_preview` (`tratar.py:251`) gera o `.m4a` e `ondas.gerar` (`ondas.py:21`)
   grava `picos.json`. O bloco `roteiro["audio"]` é **sobrescrito** em `supremo.py:301-307`.
8. **Gravação** — `salvar_json` do roteiro (`supremo.py:309`) e cópia para
   `estudio/src/roteiro-atual.json` + `estilo-atual.json` (`supremo.py:310` →
   `supremo.py:320-325`). Resumo em `supremo.py:312-317`.

### `python motor/supremo.py render <nome> [--formato F]`

1. `supremo.py:456` → `cmd_render` (`supremo.py:387`).
2. `_sincronizar_estudio(nome)` (`supremo.py:388`) relê `projetos/<nome>/roteiro.json`
   (`supremo.py:323`) e o copia para `estudio/src/roteiro-atual.json`, junto com
   `carregar_estilo()` (`supremo.py:325` → `comum.py:224`).
3. Cria `saida/` e resolve o destino `saida/<nome>-<formato minúsculo>.mp4`
   (`supremo.py:389-390`).
4. `_remotion("render", formato, destino)` (`supremo.py:393` → `supremo.py:328`) chama
   `node estudio/node_modules/@remotion/cli/remotion-cli.js` com `cwd=estudio`
   (`supremo.py:336-343`). Não usa `npx` de propósito (`supremo.py:331-334`).
5. Do lado JS: `Root.tsx:14` importa `roteiro-atual.json` estaticamente, registra as três
   composições `Principal` / `Vertical` / `Quadrado` (`Root.tsx:25`, `:42`, `:59`) — os mesmos
   três valores aceitos em `supremo.py:439`. A duração vem da soma das cenas
   (`Video.tsx:168-174`). Cada cena vira um `Sequence` que busca
   `cena.fonte_inicio + fonte.offset` no vídeo (`Cena.tsx:111` e `:125`) e
   `cena.fonte_inicio + roteiro.audio.offset` no áudio (`Video.tsx:123-126`).
6. Código de saída ≠ 0 vira `SystemExit` (`supremo.py:393-394`).

### `python motor/supremo.py editar` — não chega ao primeiro salto

`supremo.py:444-445` despacha para `cmd_editar` (`supremo.py:83`), cuja primeira instrução
executável (`supremo.py:92`) usa `ENTRADA`. Ver bug C1.

---

## bugs-confirmados

### Crítico

**C1 — `supremo.py editar` quebra na primeira linha (`NameError`).**
`supremo.py:92` e `supremo.py:96` usam `ENTRADA`. O bloco de import de `comum`
(`supremo.py:25-29`) traz `ESTUDIO, PROJETOS, SAIDA, aviso, carregar_estilo, caminho_roteiro,
ler_json, ok, pasta_bruto, pasta_projeto, pasta_publica, passo, salvar_json, sondar, tem_gpu`
— **sem `ENTRADA`**, que só existe em `comum.py:23`. Nenhuma outra atribuição a `ENTRADA` existe
em `motor/` (grep). Cenário: `python motor/supremo.py editar` → `NameError: name 'ENTRADA' is
not defined` antes de qualquer trabalho. Não é comando morto: o subparser existe
(`supremo.py:404`), a pasta existe (`entrada/_COLOQUE OS VIDEOS AQUI.txt`) e o `.gitignore:13-14`
a preserva.

**C2 — `preparar` num projeto já editado destrói o `roteiro.json` sem aviso nem backup.**
`cmd_preparar` não checa a existência do roteiro em lugar nenhum (`supremo.py:144-150`) e
grava por cima em `supremo.py:309`. `salvar_json` abre em `"w"` direto (`comum.py:217-221`) —
sem `.bak`, sem tmp+rename. Perde-se tudo que o editor escreveu: cenas divididas, textos de
legenda corrigidos, overlays, música, e o `offset` que o próprio `LEIA-ME.md:244` manda ajustar
à mão. Cenário concreto e já materializado no repositório:
`projetos/demanda-01/roteiro.json:39` tem `"id": "c002bigeb03hb6gd"` — id gerado pelo editor,
não pelo motor (que emite `c%03d`, `roteirizar.py:352`). Rodar `preparar demanda-01` de novo
apaga esse trabalho. O endpoint `POST /api/preparar/:nome` (`servidor.mjs:175`) também não tem
essa checagem; só a UI evita, porque só oferece projetos sem roteiro
(`servidor.mjs:147-169` + `Processar.tsx:108`).

**C3 — proxy truncado/obsoleto é reaproveitado; o critério de mtime não vê o config nem a
identidade da fonte.** `supremo.py:183-188` e `supremo.py:195-199` aceitam o arquivo se
`exists() and st_size > 0 and st_mtime >= mtime_do_bruto`. Três cenários que servem arquivo errado:
- **Encode interrompido.** `ffmpeg -y` (`tratar.py:83`) já criou o `.mp4` e escreveu MBs quando
  o usuário dá Ctrl+C. Tamanho > 0, mtime recente → a rodada seguinte imprime
  "proxy ja existe, reaproveitando" e renderiza um vídeo cortado no meio.
- **Config alterada.** Trocar `cor.camera.preset` ou `escala_maxima_altura`
  (`config/tratamento.json:26`, `:59`) não muda o mtime do bruto → o proxy antigo, com a cor
  antiga, é reaproveitado silenciosamente.
- **Fonte trocada por outra mais antiga.** O nome do proxy vem do *papel*, não do arquivo
  (`supremo.py:181`). Substituir `bruto/camera.mp4` por outro vídeo copiado com timestamp
  preservado (`shutil.move` em `supremo.py:107` preserva mtime) deixa o proxy do vídeo anterior
  válido pelo teste.

### Importante

**I1 — preview de áudio e `picos.json` podem nunca ser gerados, e o roteiro afirma que existem.**
`supremo.py:296-299`: `audio_preview` e `ondas.gerar` só rodam dentro do `else` do
reaproveitamento. Mas `supremo.py:301-307` grava `arquivo_preview` e `picos` de forma
incondicional. Cenário: `preparar` é interrompido (ou o ffmpeg do `audio_preview` falha,
`tratar.py:261` — `rodar` levanta e ninguém captura) depois que `tratar_audio_completo` já
escreveu o `.wav`. Na rodada seguinte `pronto_audio` é verdadeiro → `.m4a` e `picos.json`
nunca nascem, e o roteiro aponta para eles. Resultado: forma de onda vazia na timeline e áudio
do preview 404 (`Video.tsx:120` usa `arquivo_preview` sem checar existência).

**I2 — fallback para CPU come as flags de keyframe quando `usar_gpu` é `false`.**
`tratar.py:100-105` faz `cmd_cpu[i:i+10] = [6 itens]`, com `i = index("-c:v")`. Na configuração
GPU o bloco de codec tem exatamente 10 itens (`tratar.py:72-78`) e a troca é exata. Na
configuração CPU o bloco tem 6 (`tratar.py:80`), então a fatia de 10 remove também
`-g <kf> -keyint_min <kf>` (`tratar.py:87-88`). O comando resultante é ffmpeg válido, então
não dá erro — apenas gera um proxy sem os keyframes densos, que é a única razão de o proxy
existir (`tratar.py:57`). Idêntico em `preparar_preview` (`tratar.py:155-158` vs
`tratar.py:130-134`). Dispara quando alguém põe `"usar_gpu": false` em
`config/tratamento.json:51` ou `:56` e o primeiro encode falha por outro motivo.

**I3 — `--cortes` não tem relógio definido; os números são consumidos como tempo mestre.**
`ler_lista_de_cortes` (`roteirizar.py:100`) devolve segundos crus e
`escrever_roteiro` os recorta contra `duracao_total`, que é `duracao_util`
(`supremo.py:274-284`, `roteirizar.py:303-309`) — ou seja, relógio **mestre**. Só que tudo que
o usuário pode assistir para anotar minutagem está em relógio **bruto**: os arquivos em
`bruto/`, e os proxies `camera.mp4`/`tela.mp4`, que são reencodes do arquivo inteiro sem trim
(`tratar.py:82-94`). Cenário: `projetos/teste/roteiro.json:17` registra `tela.offset = 5.3`.
Se a fonte de áudio tivesse esse offset, todo `--cortes` anotado no arquivo bruto cairia 5,3 s
adiantado. Com offset 0 na fonte de áudio (caso de `demanda-01`) o erro é zero — por isso
passa despercebido.

**I4 — `LAG_MAX_SEG = 180` descarta o pico verdadeiro em silêncio.**
`sincronizar.py:22` e `sincronizar.py:72-75` mascaram lags fora de ±180 s. Se as gravações
começaram com mais de 3 minutos de diferença, o pico correto é jogado fora e
`np.argmax` (`sincronizar.py:80`) escolhe o melhor pico *errado* dentro da janela. A confiança
(`sincronizar.py:85-86`) é medida contra a mediana da própria janela mascarada, então pode sair
alta. O aviso de `supremo.py:168-174` só dispara abaixo de 0,35. É constante de módulo, não
config.

**I5 — fonte sem trilha de áudio é reportada com 100 % de confiança e offset 0.**
`sincronizar.py:105-107` faz `continue` sem tocar em `brutos`/`confiancas`, que já foram
inicializados com `0.0` e `1.0` (`sincronizar.py:113-114`). O filtro de
`supremo.py:168` exige `confianca < 0.35 and offset != 0`, então nunca avisa. E se a *câmera*
for a fonte sem áudio, `papel_audio` continua sendo ela (`supremo.py:217`): a transcrição e o
áudio final saem de um arquivo mudo. Na prática `extrair_audio_wav` (`comum.py:198-204`) vai
falhar no ffmpeg e `rodar` levanta (`comum.py:135-137`) sem ninguém capturar — mas só depois
que os proxies já foram encodados (passo 3), gastando o tempo todo de GPU.

**I6 — `duracao_util` ignora fontes com duração 0 em vez de falhar.**
`sincronizar.py:145-149` filtra `if s["midia"].duracao > 0`. Se o `ffprobe` não trouxer
`format.duration` (`comum.py:181` já usa `or 0` como fallback), essa fonte some do `min()` e a
duração útil fica maior que o material realmente disponível — cenas apontando para além do fim
do arquivo.

### Menor

**M1 — `ondas.gerar` grava antes de criar a pasta no caminho de áudio curto.**
`ondas.py:38` faz `saida.write_text(...)` no ramo `n == 0`, mas o `mkdir` do pai só acontece em
`ondas.py:55`. Áudio menor que uma fatia (1/50 s) + pasta inexistente → `FileNotFoundError`.

**M2 — `--cortes caminho.txt` com typo vira mensagem enganosa.**
`supremo.py:249-254`: se o `.txt` não existe, o caminho é tratado como lista de cortes.
`"C:\cortes.txt".split("-")` devolve 1 elemento → `ValueError` → `SystemExit`
"Nao entendi o corte '...'. Use o formato 4:41-5:53" (`roteirizar.py:113-116`), sem dizer que o
arquivo não foi encontrado. (Refutado no caminho oposto: `Path("4:41-5:53")` **não** explode,
porque `.suffix` é `""` e o `and` curto-circuita antes do `.exists()`.)

**M3 — `duracao_minima_da_cena` não é um mínimo.**
`config/direcao.json:46` promete 2,2 s, mas `roteirizar.py:205-210` só usa o valor para decidir
se engole a sobra do trecho. Um trecho de 0,5 s (o mínimo permitido por
`config/direcao.json:10`) passa pelo `while` de `roteirizar.py:205` e vira uma cena de 0,5 s
(`roteirizar.py:245-247`).

**M4 — `-stats` do ffmpeg é sempre descartado.**
`tratar.py:83`, `:137` e `:239` pedem `-stats`, mas `rodar` usa `capture_output=True`
(`comum.py:128-134`) e só imprime a stderr se `silencioso=False` (`comum.py:138-139`).
Nenhuma chamada em `motor/` passa `silencioso=False` (grep). Efeito: zero progresso durante
encodes de horas, tanto no terminal quanto no log do editor (`servidor.mjs:187-195`).

---

## riscos-e-fragilidades

- **`ativar_cuda` falha em silêncio.** `comum.py:69-70`: se `<venv>/Lib/site-packages/nvidia/*/bin`
  não existir, devolve `0` sem avisar e **sem** marcar `_CUDA_PRONTA`, então a varredura roda
  de novo a cada chamada. Cada `ctypes.WinDLL` que falha é engolida (`comum.py:105-106`), e o
  contador de DLLs carregadas é descartado nos dois pontos de uso (`comum.py:114`,
  `transcrever.py:35`). O sintoma final é `tem_gpu()` devolver `False` pelo `except Exception`
  genérico (`comum.py:118-119`) e o Whisper cair para CPU int8 — `cmd_checar` imprime
  `[--] GPU CUDA` (`supremo.py:123`) sem dizer o porquê. **Não trava**; degrada.
- **`ativar_cuda` altera o `PATH` do processo inteiro** (`comum.py:79`), herdado por todo
  `subprocess.run` posterior — inclusive os ffmpeg do passo 6, que rodam depois do passo 4.
  Se isso afeta o ffmpeg, não verificado nesta passagem.
- **`CUDA_PATH` aponta para um diretório que não é raiz de toolkit** (`comum.py:80`):
  `site-packages/nvidia` não tem `bin/`, `include/`, `lib/`. Só é definido se ainda não existir
  (`setdefault`). Consequência para terceiros, não verificada nesta passagem.
- **Nenhum `rodar()` tem timeout** (`comum.py:126-134`). Um ffmpeg travado pendura o
  `preparar` para sempre; do lado do editor, `preparo.estado` fica `"rodando"` eternamente e
  todo novo pedido leva 409 (`servidor.mjs:176-178`), sem botão de cancelar.
- **Quem captura o `RuntimeError` do ffmpeg:** só `tratar.py:96-106` e `tratar.py:152-159`, e
  só para trocar de codec. `sondar`, `extrair_audio_wav`, `montar_audio`,
  `tratar_audio_completo` e `audio_preview` deixam propagar; `cmd_preparar` não tem nenhum
  `try`. Estado meio-feito resultante: proxies e `transcricao.json` no disco, `roteiro.json`
  ausente (é gravado só em `supremo.py:309`) — recuperável. O caso não recuperável é o I1.
- **`ffmpeg`/`ffprobe` ausentes levantam `FileNotFoundError`, não `RuntimeError`**
  (`comum.py:128`), então o `except RuntimeError` de `tratar.py:98` não pega — e o usuário
  recebe traceback cru em vez da mensagem de `cmd_checar` (`supremo.py:119-121`).
- **Vazamento de disco:** `trabalho/sync_camera.wav`, `sync_tela.wav` e `transcricao.wav`
  (`sincronizar.py:108`, `transcrever.py:39`) são WAV 16 kHz mono (~115 MB/hora cada) e nunca
  são apagados. Além disso a extração dos `sync_*.wav` não tem cache: `sincronizar` roda um
  decode completo dos dois arquivos **a cada** `preparar` (`sincronizar.py:103-108`), mesmo
  quando todo o resto é reaproveitado.
- **Memória em `ondas.gerar`:** `sf.read(..., dtype="float32")` carrega o WAV inteiro
  (`ondas.py:30`), depois `mean(axis=1)` e `abs(...).reshape(...)` alocam mais duas cópias
  (`ondas.py:31`, `:41`). Com `-ar 48000 -ac 2` PCM (`tratar.py:243`) uma hora dá ~691 MB no
  disco e pico de alguns GB em RAM. O comentário de `tratar.py:255` fala em "140 MB numa hora",
  número que não bate com as flags.
- **Encoding no Windows.** O venv é CPython 3.11 (`.venv/pyvenv.cfg:4`), onde o modo UTF-8 não é
  padrão e `sys.stdout` usa a code page ANSI com `errors='strict'`. `servidor.mjs:188` decodifica
  a saída com `buf.toString()` (UTF-8). `supremo.py:77` imprime `caminho.name` — nome de arquivo
  do usuário. Nome com acento → mojibake no log do editor; nome com caractere fora da code page →
  `UnicodeEncodeError` no `print`. Nenhum arquivo do repositório define `PYTHONUTF8` ou
  `PYTHONIOENCODING` (grep). Os *arquivos* estão seguros: `ler_json`/`salvar_json` fixam
  `encoding="utf-8"` e `ensure_ascii=False` (`comum.py:212-221`), e `direcao.json` acentuado é
  lido corretamente. Não verificado nesta passagem: se a code page real da máquina é 1252 ou 65001.
- **Injeção de shell: refutada.** Todo `subprocess.run` recebe lista sem `shell=True`
  (`comum.py:128`, `supremo.py:343`), então as cadeias de filtro de `tratamento.json` não podem
  virar comando. A exceção é `supremo.py:366-369`, que usa `shell=(os.name == "nt")` com lista —
  ver primeira entrada de `inconsistencias`.
- **`_cadeia_audio` roda `str.format()` sobre texto editável pelo usuário** (`tratar.py:23-28`).
  O `_leia_me` de `config/tratamento.json:2` convida a "escrever sua propria cadeia de filtros";
  uma cadeia com `{` ou `}` literal (expressões de `drawtext`, `%{pts}`) levanta
  `KeyError`/`ValueError` opaco. As cadeias de cor não passam por `format` (`tratar.py:36`),
  então a regra é diferente para áudio e para cor.
- **Defensividade misturada na leitura de config.** `roteirizar.py:54` e `:56-60` acessam
  `cfg["corte_de_silencio"]["pausa_maxima"]` etc. com colchete (KeyError se o usuário apagar a
  chave), enquanto `roteirizar.py:190-194` e `:333-349` usam `.get` com default. Mesma mistura
  em `tratar.py:20-27` vs `tratar.py:63`.
- **Valores fixos que deveriam ser config:** `1920`/`1080` do roteiro (`supremo.py:267-268`),
  `TAXA_ENVELOPE=100`, `JANELA_MAX_SEG=480`, `LAG_MAX_SEG=180` (`sincronizar.py:20-22`), o
  divisor `12.0` da confiança (`sincronizar.py:86`), `PICOS_POR_SEGUNDO=50` (`ondas.py:18`),
  o `max(min_cena, 4.0)` do fatiamento (`roteirizar.py:206`), a escala 0.26 e o canto do PiP
  (`roteirizar.py:361-366`), `-ar 48000 -ac 2` e `-b:a 128k` (`tratar.py:243`, `:264`).
- **`descobrir_fontes` é frágil por substring.** `PISTAS_CAMERA` inclui `"eu"`
  (`supremo.py:38`), testado com `in` (`supremo.py:60`): `reuniao.mp4` contém `eu` → vira
  câmera. E o `elif` de `supremo.py:62` faz um segundo arquivo de câmera (`camera2.mp4`) cair
  em `sobra` e ser promovido a `tela` no laço de `supremo.py:68-72`.
- **Gatilhos de layout também casam por substring sem fronteira de palavra**
  (`roteirizar.py:221-224`). `voltar_pra_camera` inclui `"então"` (`config/direcao.json:33`),
  muletas de fala que aparecem em boa parte das frases — o layout `camera` tende a dominar.
- **Arredondamento de duração.** `roteirizar` emite durações em milissegundos
  (`roteirizar.py:238`), `Video.tsx:37` arredonda para quadros inteiros e cada cena rebusca o
  áudio pelo próprio `fonte_inicio` (`Video.tsx:123-126`). Cada emenda pode ficar até
  `1/(2·fps)` fora do ponto pretendido, com corte seco no som.
- **Corrida ao rodar pelo editor:** `servidor.mjs:186` faz `spawn` do Python e nunca mata o
  filho. O guard de `servidor.mjs:176` mora na memória do Node; reiniciar o servidor com um
  `preparar` em andamento permite disparar um segundo processo sobre os mesmos arquivos.

---

## inconsistencias

- **`supremo.py` contradiz a si mesmo sobre `npx`.** O docstring de `_remotion`
  (`supremo.py:331-334`) explica que `npx` é evitado porque no Windows é um `.cmd` que trava no
  prompt "Deseja finalizar o arquivo em lotes (S/N)?". Vinte linhas depois, `cmd_editor`
  (`supremo.py:366-369`) chama exatamente `npx` com `shell=(os.name == "nt")`.
- **`montar_audio` está morta.** Definida em `tratar.py:170-220`; grep em todo `F:\SupremoCut`
  encontra apenas a definição — zero chamadores em `motor/`, `estudio/` ou scripts. Seu
  docstring (`tratar.py:176-180`) descreve a arquitetura de áudio pré-cortado que
  `tratar_audio_completo` (`tratar.py:224-233`) diz explicitamente ter sido abandonada. **A
  pista se confirma.**
- **O docstring do módulo `tratar.py` ainda descreve a arquitetura antiga.**
  `tratar.py:4-9`: "monta a trilha de audio final, ja limpa e ja CORTADA igual a linha do
  tempo". `LEIA-ME.md:44` repete ("cola já cortado"). O código faz o oposto
  (`tratar.py:223-248`).
- **`_trechos_mantidos` é gravado e nunca lido.** Escrito em `roteirizar.py:380`; presente em
  `projetos/teste/roteiro.json:556`, `projetos/demanda-01/roteiro.json:12470` e
  `estudio/src/roteiro-atual.json:12470`. Grep por `_trechos_mantidos` e por `trechos` em
  `motor/`, `estudio/src/`, `estudio/editor/` e `servidor.mjs` não encontra nenhum leitor — só a
  escrita e os JSONs gerados. Não está sequer no contrato de tipos (`tipos.ts:126-154`).
  **A pista se confirma: campo órfão.**
- **`fonte_inicio` está documentado no relógio errado.** `tipos.ts:50` e `LEIA-ME.md:98` dizem
  "onde começa no arquivo bruto". O consumidor soma o offset por cima
  (`Cena.tsx:111`, `:125`; `Video.tsx:125`), portanto o valor é tempo **mestre**. O docstring de
  `trechos_com_fala` (`roteirizar.py:52-53`) tem o mesmo erro: diz devolver tempo do arquivo
  bruto, mas recebe palavras já convertidas para mestre em `supremo.py:241-242`.
  Isso importa porque `LEIA-ME.md:244` manda o usuário editar `offset` à mão.
- **O parâmetro `arquivo_audio` de `escrever_roteiro` é vestigial.** Default `"audio.wav"`
  (`roteirizar.py:296`), passado explicitamente em `supremo.py:282`, gravado em
  `roteirizar.py:376` — e sobrescrito integralmente em `supremo.py:301-307`. Nenhum arquivo
  `audio.wav` é produzido em lugar nenhum do motor (grep). `projetos/teste/roteiro.json:24`
  ainda aponta para ele: é um roteiro anterior à mudança, que hoje renderizaria sem áudio.
- **O comentário de `descobrir_fontes` promete um critério que o código não tem.**
  `supremo.py:67`: "sem pista no nome: decide pelo formato (tela costuma ser maior/mais larga)".
  O laço de `supremo.py:68-74` não consulta largura, altura nem `sondar` — atribui por ordem
  alfabética.
- **`config/direcao.json:65` documenta `'so_quando_mostra_tela'`** como comportamento da
  legenda. `montar_legendas` só lê `ligada`/`estilo` (`roteirizar.py:262-281`), e `tipos.ts:82`
  aceita apenas `destaque | bloco | karaoke | nenhum`. `ligada_em` sai sempre `[]` do motor
  (`roteirizar.py:264`, `:281`) — quem preenche é o editor (`PainelLegenda.tsx:153-193`) e quem
  lê é `Legenda.tsx:62`.
- **O preset `agressivo` ignora dois dos quatro números editáveis.**
  `config/tratamento.json:17` fixa `highpass=f=95` e `nr=20`, então mexer em `corte_grave_hz` e
  `reducao_ruido_db` (`:9-10`) não tem efeito nenhum sob esse preset, embora `_leia_me` diga
  "Mexa nos numeros" (`:2`).
- **`keyframe_por_segundo` é, na verdade, segundos por keyframe.** `tratar.py:63` e
  `tratar.py:124` calculam `fps * valor` como tamanho do GOP em quadros. Com `1` no proxy
  (`config/tratamento.json:58`) dá 1 keyframe/s; com `0.5` no preview (`:50`) dá um keyframe a
  cada meio segundo, isto é, **2** por segundo — que é o que o docstring diz
  (`tratar.py:118`) e o nome da chave não diz.
- **`salvar_json` e `servidor.mjs` gravam o mesmo arquivo com garantias diferentes.**
  `comum.py:217-221` escreve direto sobre o destino; `servidor.mjs:31-36` escreve em `.tmp` e
  faz `rename` justamente para "nunca deixar um JSON pela metade".
- **Política de cache inconsistente.** Proxy, preview e áudio são reaproveitados
  automaticamente (`supremo.py:183`, `:195`, `:290`); a transcrição, que é a etapa mais cara
  (`LEIA-ME.md:224`), só é reaproveitada com a flag `--reusar-transcricao`
  (`supremo.py:218`).
- **`limpar()` está triplicado em Python e uma quarta vez em JS**: `comum.py:228-235`,
  `tratar.py:42-49`, `roteirizar.py:28-35`, `servidor.mjs:39-49`.
- **Código e imports mortos confirmados por grep:** `TRABALHO` (`comum.py:25`) não é usado em
  lugar nenhum; `PROJETOS` é importado em `supremo.py:26` e nunca usado; `passo` é importado em
  `tratar.py:16` e nunca usado; `Path` é importado em `roteirizar.py:16` e nunca usado; o
  parâmetro `taxa_audio` de `_envelope` (`sincronizar.py:25`) é ignorado — a taxa vem do
  `sf.read` (`sincronizar.py:29`); a variável `dur` de `roteirizar.py:202` não é lida; o
  parâmetro `silencioso` de `rodar` (`comum.py:126`) nunca recebe `False`.

---

## fora-de-escopo

Não coberto nesta passagem, sem opinião registrada:

- `estudio/src/*` (`layouts.ts`, `musica.ts`, `Legenda.tsx`, `Overlay.tsx`) e
  `estudio/editor/*` — lidos apenas o suficiente para confirmar quem consome os campos que o
  motor grava. A matemática de geometria, a curva de volume e o comportamento da timeline não
  foram auditados.
- `estudio/servidor.mjs` — auditado só nos pontos em que invoca o motor
  (`spawn`, parsing de log, gravação do roteiro).
- Discrepância aparente entre `staticFile('musica/...')` (`Video.tsx:142`, resolve em
  `estudio/public/musica`) e a listagem em `assets/musica` (`servidor.mjs:129`): não
  investigada, é caminho JS.
- `estudio/remotion.config.ts`, `vite.config.mts`, `tsconfig.json`, `package.json`.
- Execução real de qualquer comando: nada foi rodado, então nenhum comportamento em tempo de
  execução foi observado — todas as conclusões vêm de leitura.
- Code page real do console da máquina, e se `Path`/`staticFile` lidam bem com nomes de projeto
  com espaço ou acento.
- Comportamento do `cmd.exe` com `shell=True` + lista em `supremo.py:366-369` (a regra de
  aspas do `cmd /c` depende de versão; não verificado nesta passagem).
- Conteúdo de `projetos/*/trabalho/` e dos binários em `estudio/public/`.
