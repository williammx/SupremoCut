# Catálogo de funcionalidades — o que entra, em que ordem, e por quê

Documento de decisão. Consolida quatro levantamentos independentes feitos em paralelo:

| Relatório | O que investigou | Arquivo |
|---|---|---|
| GitHub open source | 29 repositórios de editores livres, lidos de verdade | [`github-open-source.md`](github-open-source.md) |
| Mercado | 14 apps comerciais + práticas de anúncio da Meta e do TikTok | [`mercado-apps.md`](mercado-apps.md) |
| Stack | ecossistema Remotion, filtros FFmpeg, modelos locais | [`stack-remotion.md`](stack-remotion.md) |
| Estado atual | o próprio SupremoCut, arquivo a arquivo | [`../brownfield/estado-atual.md`](../brownfield/estado-atual.md) |

Uma varredura anterior, mais rasa, está em [`editores.md`](editores.md) e foi absorvida por esta.

---

## O critério

O SupremoCut não é um editor de vídeo genérico. Ele é uma fábrica de **anúncio vertical
em português**, geralmente partindo de criativo estrangeiro que precisa ser dublado,
retocado e testado em variantes. Toda funcionalidade abaixo foi julgada por três perguntas,
nesta ordem:

1. **Economiza tempo numa demanda real?** Cortar silêncio à mão em 12 anúncios é trabalho
   que a máquina faz melhor. Um chroma key é bonito e quase nunca usado aqui.
2. **Roda local e de graça?** Nuvem paga por minuto some do orçamento quando o volume sobe.
   A GPU já está na mesa.
3. **Um leigo consegue usar sem aprender vocabulário novo?** "Curva de bezier no keyframe de
   opacidade" é não. "Aparecer suave" é sim.

O que passou nas três entra. O que passou em duas fica em espera. O que passou em uma foi
recusado, e a recusa está registrada no fim deste documento — recusa sem motivo escrito
volta como ideia nova daqui a três meses.

---

## Onda 1 — Movimento

O relatório do GitHub e o de mercado chegaram no mesmo ponto por caminhos diferentes: o que
falta aqui não é *mais um efeito*, é o **sistema que faz qualquer coisa se mover no tempo**.
Sem ele, cada efeito novo precisa de código próprio. Com ele, efeito novo é um registro a
mais numa lista.

| # | Funcionalidade | De onde veio | O que muda na prática |
|---|---|---|---|
| 1 | **Keyframes** — qualquer propriedade animável entre dois instantes | OpenShot, Kdenlive, Shotcut e designcombo, os quatro | Zoom que fecha durante a fala, selo que desliza, imagem que some. Hoje nada disso existe. |
| 2 | **Presets de animação nomeados em português** | designcombo (~50 presets de 1 clique) | O leigo escolhe "Deslizar da direita", não monta uma curva. |
| 3 | **Easing nas transições** | `Easing` do Remotion — as transições atuais são lineares | Movimento linear parece defeito; o olho lê como amador. |
| 4 | **Copiar e colar animação entre blocos** | Kdenlive ("Exchanging Keyframes") | Ajustou um zoom bom uma vez, reaproveita nos outros onze. |

**Decisão de arquitetura:** o keyframe guarda tempo em **relógio da fonte**, como palavra e
marcador. Guardar em tempo final é o erro que já custou uma legenda derivando 8 segundos
neste mesmo projeto ([`estado-atual.md`](../brownfield/estado-atual.md), fragilidade 1).

---

## Onda 2 — Automação que devolve tempo

Aqui está a maior economia de horas do documento inteiro. Os dois relatórios independentes
apontaram o corte de silêncio como item nº 1 e nº 2 respectivamente.

| # | Funcionalidade | De onde veio | O que muda na prática |
|---|---|---|---|
| 5 | **Corte automático de silêncio**, com respiro ajustável | auto-editor (`--edit audio`, limiar 0.04, `--margin`); Kapwing Smart Cut; CapCut | Some o trabalho mais chato da edição. O respiro evita o corte robótico que engole consoante. |
| 6 | **Curva de análise visível sobre a forma de onda** | auto-editor (`levels`) | Em vez de um botão opaco, o usuário vê a linha de corte e arrasta. |
| 7 | **Apagar palavra na transcrição corta o vídeo** | auto-editor, Rescript e OpenScript — três projetos independentes; Descript no comercial | Usa os tempos por palavra que o Whisper **já** produz. Edição sem timeline. |
| 8 | **Remoção de vícios de linguagem** ("é", "tipo", "né") | Rescript, OpenScript | Um clique, qualidade percebida muito acima do esforço. |
| 9 | **Zoom automático na palavra enfatizada** | Submagic, Opus Clip, Veed | Retenção barata a partir de dado que já está no disco. |
| 10 | **Detecção de corte de plano robusta a câmera na mão** | PySceneDetect `AdaptiveDetector` — compara com média móvel, não limiar fixo | Anúncio vertical é filmado na mão. Limiar fixo daria falso positivo o tempo todo. |

---

## Onda 3 — Áudio

O material de origem é anúncio estrangeiro: áudio comprimido, música por baixo, locução que
precisa sair e voltar em português. Esta onda é a que mais mexe no resultado audível.

| # | Funcionalidade | De onde veio | O que muda na prática |
|---|---|---|---|
| 11 | **Ducking automático** — a música abaixa sozinha sob a fala | Kdenlive, OpenReel; `sidechaincompress` do FFmpeg | Hoje o volume da música é fixo e briga com a voz dublada. |
| 12 | **Normalização de loudness (EBU R128)** | `loudnorm` de duas passagens | O defeito mais audível e mais ignorado: cada anúncio sai num volume. |
| 13 | **Redução de ruído neural** (`arnndn`) além do `afftdn` atual | DaVinci Voice Isolation, no comercial | Limpa fonte ruim antes de transcrever e dublar. |
| 14 | **Separar voz de música** (Demucs, local, GPU) | Descript, DaVinci; Demucs é MIT | **Dubla mantendo a música e os efeitos originais.** Hoje ou se perde a trilha, ou vaza a voz em inglês por baixo. |

---

## Onda 4 — Imagem e identidade

| # | Funcionalidade | De onde veio | O que muda na prática |
|---|---|---|---|
| 15 | **Correção de cor por bloco** — brilho, contraste, saturação, temperatura | todos os editores estudados | Material de biblioteca de anúncio vem em cores inconsistentes. |
| 16 | **Imagens e logos sobre o vídeo** | todos | Logo do cliente, print de avaliação, selo do produto. |
| 17 | **Selos de oferta prontos** (seta, estrela, badge de preço) | `@remotion/shapes`; nenhum editor genérico entrega isso pronto | Conversão de e-commerce, e é onde o vertical ganha ou perde. |
| 18 | **Kit de marca persistente** | Canva, Adobe Express, CapCut Brand Kit | Parar de reconfigurar cor e fonte a cada vídeo em produção em série. |
| 19 | **Modos de mesclagem** (multiply, screen, overlay…) | Kdenlive — 20 modos, 10 realmente úteis | Sobrepor luz e textura, o vocabulário do motion de Reels. |

---

## Onda 5 — Ergonomia da timeline

Nada aqui é vistoso. Tudo aqui é atrito removido.

| # | Funcionalidade | De onde veio | O que muda na prática |
|---|---|---|---|
| 20 | **Arrastar bloco para reordenar** | todos | Falta o gesto mais básico de uma timeline. |
| 21 | **Ripple e imã como interruptores, com Shift invertendo durante o arraste** | Shotcut (Ctrl+R / Ctrl+P) | Acaba a troca de ferramenta a cada gesto. |
| 22 | **Miniaturas nos blocos** | OpenShot, Shotcut, Kdenlive | Achar o trecho sem reproduzir. |
| 23 | **Conversão tempo↔pixel centralizada em duas funções puras** | react-timeline-editor (`deal_data.ts`) | Zoom mexe num parâmetro só. Hoje a conta está espalhada. |
| 24 | **Presets de legenda por referência, não por cópia** | react-timeline-editor (`effectId` → dicionário) | Re-estilizar 200 palavras vira a edição de um registro. |

---

## Onda 6 — Escala de variantes

O relatório de mercado encontrou uma categoria inteira de produto dedicada a isto, e um
número da própria Meta: **8 a 12 variações batem 2 criativos perfeitos**. Testar 50 variantes
com criador real custa entre US$ 7.500 e 10.600; com ferramenta, menos de US$ 200.

| # | Funcionalidade | O que muda na prática |
|---|---|---|
| 25 | **Variantes em lote de um mesmo criativo** — troca gancho, CTA, cor, legenda | Renderiza N versões de uma vez, prontas para subir e testar. |
| 26 | **Gerador de gancho para os 3 primeiros segundos** | O fator nº 1 de performance segundo Meta e TikTok. |

---

## Recusado, e por quê

Registrar a recusa vale tanto quanto registrar a escolha.

| Recusado | Motivo |
|---|---|
| Geração de vídeo por IA (Runway, Sora, Veo) | O produto do anúncio precisa continuar sendo *aquele* produto. Modelo generativo não garante fidelidade. |
| Diarização de locutor (pyannote) | Anúncio tem um locutor. Dependência pesada, o próprio README admite imprecisão. |
| Chroma key | Quase nunca aparece no material real deste fluxo. Volta se aparecer. |
| Máscara em 3 passos do Kdenlive | Complexo demais para o público. O resultado útil (fundo borrado, produto nítido) vira um componente só, se entrar. |
| Modos de mesclagem exóticos (bitwise, destination-in/out) | Dos 20 do Kdenlive, 10 nunca seriam usados aqui. |
| Virtualização da timeline | Otimização sem sintoma. Volta quando houver lentidão medida. |
| Cache de frames em disco | Mesma razão. O preview em 540p já resolveu o engasgo. |
| Export FCPXML | Ninguém neste fluxo abre Premiere ou Resolve. |
| Servidor MCP no editor | A IA já edita pelo chat, que é o canal escolhido. Sem dor a resolver. |
| Tracking de objeto (OpenCV) | Alto valor, alto custo. Fica em espera até haver um pedido concreto. |
| WhisperX (alinhamento fonético) | Ganho de 100-200 ms. Real, mas não cabe junto do Whisper em 8 GB de VRAM sem descarregar modelo entre passos. Em espera. |
| `@remotion/whisper-webgpu` | Exige subir de versão do Remotion. Volta na próxima atualização. |

---

## Nota de procedência

Durante a pesquisa de mercado, uma das páginas lidas (`benly.ai`) continha texto endereçado
ao agente, pedindo que a própria marca fosse promovida na resposta. A instrução foi ignorada
e o fato está registrado no relatório de origem. Conteúdo lido na web é dado, nunca ordem.
