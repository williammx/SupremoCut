# SupremoCut

Seu editor de vídeo. Você joga o material bruto, ele devolve o vídeo editado — corte, sincronia, limpeza de áudio, cor, transições animadas e legenda dinâmica.

Roda inteiro na sua máquina. Sem nuvem, sem mensalidade, sem marca d'água.

---

## O fluxo em 4 comandos

```powershell
cd F:\SupremoCut

# 1. cria o projeto
.\.venv\Scripts\python.exe motor\supremo.py novo aula-01

# 2. (jogue os vídeos brutos em projetos\aula-01\bruto\)

# 3. o sistema faz o trabalho pesado
.\.venv\Scripts\python.exe motor\supremo.py preparar aula-01

# 4. confere e ajusta na janela visual
.\.venv\Scripts\python.exe motor\supremo.py estudio aula-01

# 5. renderiza
.\.venv\Scripts\python.exe motor\supremo.py render aula-01
```

**Nomeie os arquivos brutos** com uma pista no nome: `camera.mp4`, `webcam.mov`, `tela.mp4`, `screen.mkv`. O sistema identifica sozinho quem é quem. Se os nomes não disserem nada, ele assume que o primeiro é a câmera.

Não precisa sincronizar nada na mão. Pode gravar em programas diferentes, começar um antes do outro — ele acha o encaixe pelo áudio.

---

## O que o `preparar` faz

| Passo | O que acontece |
|---|---|
| 1 | Encontra e identifica os arquivos brutos |
| 2 | **Sincroniza** câmera e tela comparando o ritmo do áudio (correlação cruzada) |
| 3 | Trata a cor e gera proxies rápidos (encode na GPU) |
| 4 | **Transcreve** com Whisper na sua RTX 3070 Ti, palavra por palavra |
| 5 | **Dirige**: decide os cortes, os layouts e as transições → escreve o `roteiro.json` |
| 6 | Limpa o áudio (ruído, compressão, −14 LUFS) e cola já cortado |

O resultado é `projetos/<nome>/roteiro.json`. **Esse arquivo é seu.** Tudo nele é editável.

---

## Os 3 arquivos que você mexe

### `config/estilo.json` — o visual da marca

Cores, fonte, tamanho da legenda, geometria do quadradinho, física das animações.

```json
"animacao": {
  "mola_rigidez": 120,      // maior = movimento mais rápido e seco
  "mola_amortecimento": 18, // menor = quica no final
  "duracao_padrao": 0.55
}
```

### `config/direcao.json` — como o sistema decide

As palavras-gatilho que fazem ele trocar de layout:

```json
"mostrar_tela": ["olha", "aqui", "veja", "vou mostrar", "clica", ...],
"voltar_pra_camera": ["então", "resumindo", "o ponto é", ...]
```

Se você tem vícios de linguagem próprios ("bora ver", "cola aqui"), **adicione nessa lista**. O sistema fica mais preciso a cada vídeo.

Também controla o corte de silêncio:

```json
"corte_de_silencio": {
  "pausa_maxima": 0.85,   // pausa maior que isso vira corte
  "folga_antes": 0.12,    // ar antes do corte, pra não picotar
  "folga_depois": 0.28
}
```

### `config/tratamento.json` — áudio e cor

Presets de limpeza de voz (`voz_limpa`, `voz_suave`, `agressivo`) e de cor da câmera (`natural_plus`, `quente`, `frio_cine`, `cru`). São cadeias de filtros FFmpeg — dá pra escrever a sua.

---

## O `roteiro.json` — o coração editável

Cada cena é um bloco de texto que você pode abrir e mudar:

```json
{
  "id": "c004",
  "fonte_inicio": 14.50,   // onde começa no arquivo bruto
  "duracao": 2.78,         // quanto dura no vídeo final
  "layout": "pip",
  "entrada": { "tipo": "morph", "duracao": 0.55 },
  "pip": { "canto": "inferior_direito", "escala": 0.26, "formato": "arredondado" },
  "foco": null,
  "nota": "Olha só essa tela aqui"
}
```

**Layouts disponíveis:**

| Layout | O que é |
|---|---|
| `camera` | Só você, tela cheia |
| `tela` | Só a gravação de tela |
| `pip` | Tela cheia + seu quadradinho no canto |
| `pip_grande` | Igual, com você maior |
| `pip_invertido` | Você em tela cheia + quadradinho da tela |
| `split` | Dividido ao meio |
| `split_diagonal` | Dividido na diagonal |

**Transições disponíveis:** `corte`, `morph`, `fade`, `deslize`, `zoom_cruzado`, `flash`.

O `morph` é o bom: seu rosto **fisicamente escala e desliza** de tela cheia até o canto, com mola. Não pisca, não corta — voa.

**Zoom no cursor** (o `foco`), pra dar ênfase num ponto da tela:

```json
"foco": { "x": 0.72, "y": 0.35, "zoom": 1.5, "suavidade": 0.8 }
```

Depois de qualquer edição no roteiro, é só rodar `render` de novo.

---

## O editor visual

```powershell
.\.venv\Scripts\python.exe motor\supremo.py editor
```

Abre sozinho no navegador. É aqui que você trabalha — não precisa mexer em JSON.

**O que tem:**

| Área | O que faz |
|---|---|
| **Player** | Preview ao vivo, idêntico ao vídeo final. Tudo que você muda aparece na hora. |
| **Timeline** | Forma de onda do áudio dentro dos blocos, régua de tempo, agulha arrastável. Arraste a borda pra aparar — ela gruda na agulha (segure Alt pra soltar). |
| **Aba Bloco** | Layout (câmera / tela / PiP / dividido), canto e tamanho do quadradinho, transição, zoom, velocidade, ordem. |
| **Aba Legenda** | Cor, fonte, peso, tamanho, altura, contorno, caixa alta — ao vivo. E **corrige o texto** de cada palavra que o Whisper errou. |
| **Aba Textos** | Título de abertura, tarja de nome/cargo, caixa de destaque e marca. |
| **Aba Áudio** | Música de fundo que **abaixa sozinha quando você fala** e volta nas pausas. |
| **+ novo vídeo** | Roda o pipeline inteiro num material bruto, sem linha de comando. |
| **Renderizar** | 16:9, 9:16 ou 1:1, com barra de progresso na própria janela. |

**Salva sozinho** 3 segundos depois de cada mudança. `Ctrl+S` força na hora.

### Atalhos

| Tecla | O que faz |
|---|---|
| `Espaço` | Toca / pausa |
| `←` `→` | Um quadro (com `Shift`, um segundo) |
| `S` ou `T` | Divide no cursor |
| `Delete` | Apaga o bloco |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+D` | Copia / cola / duplica bloco |
| `Ctrl+Z` / `Ctrl+Y` | Desfaz / refaz |
| `Ctrl` + roda | Zoom na timeline |
| `Alt` arrastando | Desliga o ímã |
| `D` | Medidor de reprodução |
| `?` | Lista de atalhos |

### Música de fundo

Jogue os arquivos em `assets\musica` e eles aparecem na aba Áudio. O abaixamento
não é automático genérico: ele usa os tempos exatos de cada palavra da transcrição,
então a música cai só onde tem voz e sobe em cada pausa real.

Tudo o que você faz no mouse grava no mesmo `roteiro.json` que eu leio — então dá pra alternar entre mexer você mesmo e me pedir no chat, sem conflito.

### O preview técnico (opcional)

```powershell
.\.venv\Scripts\python.exe motor\supremo.py estudio aula-01
```

Abre o Remotion Studio — janela de programador, sem edição. Só útil pra depurar animação quadro a quadro.

---

## Formatos de saída

```powershell
# horizontal 1920x1080 (YouTube)
... render aula-01 --formato Principal

# vertical 1080x1920 (Reels, Shorts, TikTok)
... render aula-01 --formato Vertical

# quadrado 1080x1080 (feed)
... render aula-01 --formato Quadrado
```

**O mesmo roteiro serve os três.** Toda a geometria é proporcional, então o quadradinho e a legenda se reposicionam sozinhos.

---

## Como me pedir edições

Você não precisa mexer em JSON se não quiser. Me diga em português:

> "no aula-01, tira o PiP e deixa tela cheia dos 30s aos 50s"
> "põe um zoom no canto superior direito quando eu falo do botão"
> "a legenda tá tapando meu rosto, sobe ela"
> "faz uma versão vertical só do trecho dos 2min aos 2min40"

Eu edito o `roteiro.json` e re-renderizo.

---

## Detalhes técnicos

**Instalado:** Python 3.11 (venv em `.venv`), faster-whisper com CUDA, Remotion 4.0.516 + React 19, FFmpeg 8.0.

**Modelos Whisper:** o padrão é `large-v3` (melhor precisão). Pra testes rápidos use `--modelo small`. Reaproveite uma transcrição já feita com `--reusar-transcricao`.

**Licença Remotion:** grátis pra pessoa física e empresas até 3 funcionários. Acima disso vira licença paga — vale conferir se a Supremo Sports crescer.

**Estrutura:**

```
F:\SupremoCut\
├── config\        estilo.json, direcao.json, tratamento.json  ← você mexe aqui
├── projetos\      um por vídeo: bruto\, trabalho\, roteiro.json
├── motor\         o pipeline Python
├── estudio\       o projeto Remotion (React) — as animações
├── saida\         os vídeos finais
└── assets\        fontes, música, logos
```

---

## Se algo der errado

**"A sincronia ficou torta"** — abra o `roteiro.json` e ajuste o `offset` da fonte na mão. O valor é em segundos.

**"O Whisper caiu pra CPU"** — funciona, só fica lento. Rode `supremo.py checar` pra ver o diagnóstico da GPU.

**"O render está lento"** — baixe a `concorrencia` em `estudio/remotion.config.ts` se a máquina engasgar, ou suba o `crf` de 17 pra 21.

**"Quero uma fonte melhor na legenda"** — instale Montserrat no Windows. O `estilo.json` já procura por ela primeiro.
