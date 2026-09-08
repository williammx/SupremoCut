# Editores de vídeo — o que existe lá fora e falta aqui

Pesquisa feita em 2026-08-30. Alvo: anúncio vertical 9:16, dublado, de e-commerce.
Tudo abaixo foi lido no repositório ou na documentação real, não é chute.

## editores-estudados

| nome | repositório / URL | o que ele tem de notável (que o SupremoCut não tem) |
|---|---|---|
| OpenReel Video | https://github.com/Augani/openreel-video | O mais completo dos open source de navegador. Keyframe em **qualquer** propriedade com 20+ curvas de easing; 20+ animações de texto (typewriter, bounce, pop, elastic, glitch); legenda karaokê palavra a palavra; detecção de batida gerando marcadores; ducking automático; redução de ruído em 3 passes; chroma key; modos de mesclagem; rodas de cor + curvas + LUT 3D; trilhas ilimitadas com trancar/esconder; ripple delete; gravação de tela; export WebCodecs até 4K. React + TypeScript + WebCodecs + WebGPU, MIT. |
| ClippyMe | https://github.com/fralapo/clippyme | Pipeline inteiro de short vertical, auto-hospedado. O mais útil pra nós: corte com borda **encaixada na palavra → frase → vale de silêncio** (nunca corta o ataque de uma palavra); reenquadre 9:16 com YOLOv8 + MediaPipe e **modo conforto** (câmera travada por cena em vez de panorâmica contínua — a panorâmica é o que dá enjoo); normalização EBU R128 para −14 LUFS; Ken Burns automático 1.0→1.05×; `+faststart` no mux; 6 presets de legenda karaokê ASS; gancho (hook) com banner estilo Stories; 4 presets de correção de cor; logo de marca; "aplicar a todos" os clipes; QA do arquivo de saída (frame preto, congelado, loudness) antes de publicar. |
| auto-editor | https://github.com/WyattBlue/auto-editor | Corte automático de silêncio com `--margin` (respiro antes e depois do corte), limiar em dB (`--edit audio:-19dB`), corte por **falta de movimento** (`--edit motion`), rótulos por trecho para acelerar as partes mornas em vez de cortar (`--when:2 speed:1.5`), e exportação de linha de tempo para Premiere, Resolve, FCP, Shotcut e Kdenlive. Domínio público. |
| Remotion Editor Starter | https://www.remotion.dev/docs/editor-starter/features | Referência direta do que um editor Remotion "de mercado" traz: edição de rolagem (rolling edit), seleção múltipla por laço, miniaturas de filme na trilha, indicador de aparo máximo, modo de recorte por duplo clique, copiar/colar/duplicar camadas, alinhamento, entrelinha e espaçamento de letra, **duração da página de legenda**, correção dos tokens da legenda, cor da palavra falada, fundo do texto com padding e raio, cache de assets em IndexedDB, render no cliente com WebCodecs. Ele **assume que não tem** keyframes nem transições — e a doc de "features not included" explica como implementar. |
| Twick | https://github.com/ncounterspecialist/twick | SDK React de editor. Efeitos GL por shader (`@twick/effects`), export no navegador via WebCodecs + FFmpeg.wasm, e catálogo de assets públicos plugado em Pexels, Unsplash e Pixabay dentro do editor. |
| OpenVideo (ex-designcombo/react-video-editor) | https://github.com/openvideodev/react-video-editor | Clone de CapCut em React. Render 100% cliente com PixiJS v8 + WebCodecs, transições por shader, canvas interativo com arrastar/redimensionar/rotacionar/reordenar camada, transcrição via Deepgram, biblioteca Pexels embutida. |
| Vanta | https://github.com/itsjwill/vanta | Motor de vídeo em cima do Remotion. Interessa pelo mapa de peças: gl-transitions (100+), tsparticles, remotion-subtitles com presets (tiktok/youtube/reels/karaokê), templates de motion graphics prontos (lower third, contagem regressiva, confete, barra de progresso), remoção de fundo no cliente com WASM (imgly). |
| OpenCut | https://github.com/OpenCut-app/OpenCut | 79k estrelas, MIT. Está sendo reescrito: núcleo em Rust, arquitetura de plugins, **modo headless (render em lote)**, aba de script dentro do editor, servidor MCP. A versão usável hoje é `opencut-app/opencut-classic`. |
| Kdenlive / Shotcut | https://docs.kdenlive.org/en/effects_and_filters.html | Referência de desktop: **time remap** (rampa de velocidade com keyframe, não velocidade fixa por bloco), máscaras e rotoscopia, LUT, e proxy (edita em baixa, renderiza em alta). |
| CapCut | https://www.capcut.com | Remover fundo sem chroma, keyframes, curva de velocidade 0.1x–100x, texto-para-fala, legendas automáticas, redimensionar para redes, biblioteca de templates. |
| Submagic | https://www.submagic.co/features/auto-zooms | O melhor em legenda animada do mercado: biblioteca de estilos por categoria (Trending, New, Emoji, Premium, Speakers), **emoji automático por gatilho de palavra**, efeitos sonoros em palavra-chave, **Magic Zoom** (zoom automático nos pontos de ênfase — fast, crash, smooth, expo), B-roll automático lendo a transcrição, gerador de gancho de abertura. |
| Opus Clip | https://www.opus.pro/ai-reframe | AI Reframe com rastreio do falante ativo, troca de foco entre pessoas, score de viralidade 0–100, B-roll de banco. |
| Descript | https://www.descript.com | Remoção de muletas ("ãh", "tipo") em um clique no texto inteiro, Studio Sound (separa voz, fundo e música e tira reverberação), correção de contato visual, edição por transcrição. |
| Veed | https://www.veed.io | Brand kit (logo, fontes e cores da marca aplicados em 1 clique), legenda em 125+ idiomas, tradução e dublagem, presets de proporção por rede. |

## faltando-no-supremocut

Ordem = impacto em anúncio vertical dublado, não sofisticação técnica.

### 1. Biblioteca de estilos de legenda (presets)

- **O que faz:** troca o visual da legenda num clique. Hormozi (bold enorme, palavra estoura na batida), karaokê (linha inteira visível, palavra ativa colorida), caixa sólida atrás da palavra, contorno grosso, gradiente com escala, máquina de escrever, neon.
- **Por que importa:** o estilo da legenda é a diferença visual número 1 num Reels. Hoje só existe "palavra colorida" — o mesmo vídeo com legenda Hormozi e com legenda branca simples não performa igual.
- **Dificuldade:** **baixa**. O timing por palavra já existe; cada preset é um objeto de estilo + `interpolate` de escala e cor por palavra.
- **Onde vi:** Submagic (categorias de estilo), ClippyMe (`classic_white`, `hormozi_bold`, `neon_glow`, `mrbeast_box`, `minimal_clean`, `fire_impact`), OpenReel (20+ animações de texto).

### 2. Corte automático de silêncio e muletas (smart cut)

- **O que faz:** analisa a trilha e propõe cortes onde há silêncio abaixo de um limiar em dB, com margem configurável antes e depois de cada corte.
- **Por que importa:** dublagem tem respiro e pausa de leitura. Um anúncio de 20s não pode carregar 2s de ar morto, e esse é o corte que mais economiza tempo por vídeo.
- **Dificuldade:** **média**. A forma de onda já é calculada; falta o detector de limiar e a geração dos blocos resultantes.
- **Onde vi:** auto-editor (`--edit audio:-19dB --margin 0.2s`), ClippyMe (`smartcut_ops`), Descript.

### 3. Encaixe do corte no limite da palavra e no vale de silêncio

- **O que faz:** ao mover um ponto de corte, puxa para a borda da palavra mais próxima (a transcrição já dá isso) e depois para o vale de silêncio real da forma de onda.
- **Por que importa:** corte no meio do ataque de uma sílaba é o defeito mais audível de editor caseiro — e é exatamente o risco quando o ímã só gruda na agulha.
- **Dificuldade:** **baixa**. Os tempos de palavra do Whisper e a forma de onda já existem; é mais um modo de encaixe no ímã atual.
- **Onde vi:** ClippyMe `cut_ops.py` (palavra → frase → vale de silêncio via `silencedetect` do ffmpeg).

### 4. Normalização de volume final (EBU R128, −14 LUFS, pico real −1 dBTP)

- **O que faz:** mede e corrige o volume do render inteiro, não clipe por clipe.
- **Por que importa:** voz dublada, música e efeitos entram com níveis diferentes, e as redes normalizam o áudio na reprodução. Anúncio baixo demais soa amador; estourado clipa no AAC.
- **Dificuldade:** **baixa-média**. `ffmpeg -af loudnorm` em duas passagens no pós-render, ou medição via Web Audio antes de exportar.
- **Onde vi:** ClippyMe (−14 LUFS EBU R128 em todo clipe rendered), guias de `ffmpeg loudnorm` (I=-14:TP=-1.5:LRA=11).

### 5. Guias de zona segura 9:16

- **O que faz:** desenha sobre o preview o que a interface do TikTok e do Reels cobre: cerca de 130px no topo, 320px embaixo e 120px à direita em 1080×1920, mais a caixa central "universal" de 900×1160.
- **Por que importa:** legenda ou CTA na faixa de baixo fica atrás da descrição e dos botões. O argumento de venda simplesmente não é lido.
- **Dificuldade:** **baixa**. Uma camada de overlay no preview, desligável.
- **Onde vi:** guias públicos de safe zone (Kreatli, overlaycheck), presets de proporção por rede do Veed.

### 6. Zoom automático nos pontos de ênfase

- **O que faz:** usa os tempos das palavras para dar um empurrão de câmera em palavras-chave ou a cada N segundos, com curvas nomeadas (suave, seco, exponencial).
- **Por que importa:** é o truque de retenção mais barato que existe em short vertical. Segura o olho sem exigir corte novo. Hoje o zoom é estático por bloco.
- **Dificuldade:** **média**. O zoom por bloco já existe; falta variação no tempo e o gatilho automático.
- **Onde vi:** Submagic Magic Zoom (fast, crash, smooth, expo), ClippyMe (Ken Burns 1.0→1.05× automático).

### 7. Keyframes (animação de propriedade ao longo do tempo)

- **O que faz:** zoom, posição, opacidade e escala de overlay variando **dentro** do bloco, com curvas de easing. Hoje todo valor é fixo por bloco.
- **Por que importa:** destrava de uma vez empurrão de câmera, deslizar de selo de preço, revelação de logo e rampa de velocidade. Sem isso cada efeito novo vira um caso especial no código.
- **Dificuldade:** **média-alta**. Troca o tipo do valor por um vetor de keyframes e interpola. A própria documentação do Remotion recomenda esse caminho e admite ser o furo do Editor Starter.
- **Onde vi:** OpenReel (qualquer propriedade + 20 easings), Kdenlive (Time Remap), CapCut, Remotion `editor-starter/features-not-included`.

### 8. Realce por palavra-chave e emoji automático na legenda

- **O que faz:** uma lista de palavras ("grátis", "50% off", "hoje", nome do produto, preço) ganha cor ou fundo diferente, e um mapa palavra→emoji insere o ícone sozinho.
- **Por que importa:** em anúncio de e-commerce a oferta precisa saltar do bloco de texto. Isso é conversão, não enfeite.
- **Dificuldade:** **baixa**. É uma regra aplicada sobre os tokens que já existem.
- **Onde vi:** Submagic (emoji triggers e destaque por palavra-chave, categoria "Emoji" na biblioteca de estilos).

### 9. Camada de B-roll / foto do produto disparada pela transcrição

- **O que faz:** encaixa imagem ou clipe curto por cima quando a narração cita o produto, e volta sozinho para a cena.
- **Por que importa:** anúncio de e-commerce é majoritariamente produto na tela com voz por cima. Hoje isso exige montar bloco a bloco.
- **Dificuldade:** **média**. Precisa de trilha de sobreposição com tempo próprio e de um casador transcrição→asset.
- **Onde vi:** Submagic Magic B-roll, Opus AI B-roll, Twick e OpenVideo (Pexels/Unsplash/Pixabay dentro do editor).

### 10. Efeitos sonoros nos cortes e biblioteca de SFX

- **O que faz:** whoosh na transição, impacto no zoom, ding na palavra de oferta — tudo alinhado à mesma agulha do corte.
- **Por que importa:** som marcado no corte é metade da sensação de "editado profissionalmente" em short.
- **Dificuldade:** **baixa**. A trilha de áudio com posição independente já existe; falta o acervo e o gatilho automático no corte.
- **Onde vi:** Submagic (whooshes, dings e impactos nos cortes), Vanta.

### 11. Kit de marca persistente

- **O que faz:** fontes, paleta, logo e marca d'água salvos **fora** do projeto, aplicáveis em um clique em qualquer anúncio novo.
- **Por que importa:** quem edita anúncio faz variação em série. Reconfigurar cor e fonte a cada vídeo é o maior desperdício de tempo do fluxo.
- **Dificuldade:** **baixa**.
- **Onde vi:** Veed (brand kits), ClippyMe (Settings → Brand assets, com upload de `.ttf`/`.otf` e logo PNG).

### 12. Fontes próprias e ajuste automático de corpo (fitText)

- **O que faz:** carrega Anton, Montserrat Black e afins, e calcula o tamanho da fonte para o texto caber na largura sem estourar.
- **Por que importa:** a fonte é metade da identidade do anúncio, e legenda que vaza da tela em 9:16 é defeito visível em qualquer celular.
- **Dificuldade:** **baixa**. `@remotion/fonts` mais `fitText()` de `@remotion/layout-utils`.
- **Onde vi:** doc do Remotion `layout-utils/fit-text`, ClippyMe (fontes customizadas), lacuna assumida no Editor Starter ("Arbitrary fonts").

### 13. Presets de correção de cor

- **O que faz:** quatro a seis visuais fechados (quente cinematográfico, frio nítido, neutro contrastado, saturado vivo) aplicáveis por bloco ou no projeto todo.
- **Por que importa:** material de e-commerce vem de fontes diferentes (celular, estúdio, banco de imagem) e destoa. Um preset unifica sem abrir painel de colorista.
- **Dificuldade:** **baixa**. `filter` CSS no Remotion cobre quase tudo.
- **Onde vi:** ClippyMe (`warm_cinematic`, `cool_crisp`, `neutral_punch`, `vivid_pop`), OpenReel (presets + LUT), Kdenlive.

### 14. Gancho de abertura como elemento próprio

- **O que faz:** texto grande fixo nos primeiros segundos, com banner colorido opcional, contorno e fonte independentes da legenda.
- **Por que importa:** os 3 primeiros segundos decidem o anúncio. Hoje isso é improvisado no overlay de título genérico, sem o visual de Stories que o formato pede.
- **Dificuldade:** **baixa**. É uma variação do overlay de título que já existe.
- **Onde vi:** ClippyMe (aba Hook, banner estilo Instagram Stories, padrão Anton branco com contorno preto fino), Submagic (Generate Hook Title).

### 15. Overlays de e-commerce

- **O que faz:** selo de preço, "de/por", contagem regressiva, avaliação em estrelas, contador animado, distintivo de frete grátis.
- **Por que importa:** são exatamente os elementos de oferta e prova social que os formatos que mais convertem usam, e nenhum existe hoje.
- **Dificuldade:** **baixa**. SVG e CSS animados; o Vanta já traz lower third, contagem regressiva, confete e barra de progresso como templates prontos.
- **Onde vi:** Vanta (`motion-graphics.ts`, TEMPLATES), boas práticas de anúncio 2026 (uma oferta clara, um CTA, urgência e prova social).

### 16. Copiar, colar, duplicar bloco, seleção múltipla e miniaturas na timeline

- **O que faz:** higiene básica de edição que todo editor moderno tem.
- **Por que importa:** variação de anúncio é feita duplicando e trocando um pedaço. Sem duplicar, cada teste A/B é remontado à mão do zero.
- **Dificuldade:** **baixa-média**.
- **Onde vi:** Remotion Editor Starter (`FEATURE_DUPLICATE_LAYERS`, `FEATURE_TIMELINE_MARQUEE_SELECTION`, `FEATURE_FILMSTRIP`), OpenReel.

### 17. Aplicar em lote e variações do mesmo anúncio

- **O que faz:** pega as configurações de um projeto (legenda, cor, logo, música) e aplica a N variações, jogando todas na fila de render.
- **Por que importa:** quem anuncia testa 5 a 10 criativos por campanha. Hoje a fila só cobre as três proporções do **mesmo** vídeo.
- **Dificuldade:** **média**. A fila de render já existe; falta o modelo de "projeto derivado".
- **Onde vi:** ClippyMe ("Apply to all" e edição de N clipes selecionados), OpenCut (headless e batch rendering no roadmap da reescrita).

### 18. Rampa de velocidade (velocidade variável dentro do bloco)

- **O que faz:** acelera e desacelera dentro do mesmo bloco, em vez de um número fixo de velocidade por bloco.
- **Por que importa:** acelerar a parte chata do demo e voltar ao normal no detalhe do produto é o padrão de vídeo de produto.
- **Dificuldade:** **média**. Depende do item 7 (keyframes) e exige cuidado com a origem do áudio da cena seguinte.
- **Onde vi:** Kdenlive (Time Remap), CapCut (curva de velocidade), auto-editor (`--when:2 speed:1.5`).

### 19. Efeitos de textura implementáveis em CSS e Canvas

- **O que faz:** tremor de câmera (seno e cosseno em `translate`), grão de filme (ruído em canvas com alfa baixo), separação RGB e glitch (pseudo-elementos com `mix-blend-mode` ou filtro SVG), vinheta, vazamento de luz, rastro de movimento.
- **Por que importa:** dá o pulso de anúncio nativo em momentos de ênfase sem parecer template de banco. Nada disso pede GPU exótica.
- **Dificuldade:** **baixa-média**. CSS e SVG puros; e o Remotion ainda traz `@remotion/motion-blur` (`Trail`, `CameraMotionBlur`) pronto.
- **Onde vi:** Remotion motion-blur, OpenReel (glow, vinheta, glitch), receitas públicas de glitch e grão em CSS/Canvas.

### 20. Verificação do arquivo de saída (QA de render)

- **O que faz:** depois de renderizar, checa duração, presença de trilha de áudio, proporção, frames pretos ou congelados e loudness médio, e avisa antes de o vídeo subir para a campanha.
- **Por que importa:** anúncio pago com 2s de tela preta no fim é dinheiro queimado, e o defeito só aparece depois que a campanha já rodou.
- **Dificuldade:** **média**. `ffprobe` mais alguns probes simples no pós-render.
- **Onde vi:** ClippyMe `media_qa.py`, que roda essa checagem **antes** de o clipe novo substituir o público.

### 21. Reenquadramento automático para 9:16 com rastreio

- **O que faz:** corta uma fonte 16:9 para vertical seguindo quem fala ou o produto.
- **Por que importa:** permite reaproveitar material horizontal já gravado pelo cliente sem regravar nada.
- **Dificuldade:** **alta**. Precisa de detecção (MediaPipe ou YOLO, no navegador ou como passo externo).
- **Onde vi:** Opus AI Reframe, ClippyMe. **Lição registrada:** o ClippyMe mediu que panorâmica contínua causa enjoo e mudou o padrão para **crop travado por cena**, que só muda no corte. Se for implementar, comece travado, não seguindo.

### 22. Remoção de fundo no cliente (sem chroma)

- **O que faz:** isola a pessoa e a coloca sobre o produto ou sobre fundo de marca.
- **Por que importa:** o formato "apresentador flutuando sobre o produto" é um dos que mais aparecem em anúncio nativo de e-commerce.
- **Dificuldade:** **média**. `@imgly/background-removal-js` roda em WASM no navegador (cerca de 2s por imagem 1080p), mas em vídeo o custo por frame pesa — viável pré-processando o clipe, não ao vivo.
- **Onde vi:** imgly (6.9k estrelas), CapCut (Remove Background), OpenReel (chroma key).

## nao-vale-a-pena

O que encontrei, considerei, e **não** recomendo implementar — com o motivo.

- **Avatares de IA, clonagem de voz e lip-sync (SadTalker, Wav2Lip, GPT-SoVITS).** O usuário já chega com a dublagem pronta. Exige servidor com GPU, modelos de vários GB e um fluxo paralelo inteiro para resolver um problema que aqui não existe. Visto no Vanta.
- **Geração de vídeo por IA (Open-Sora, AnimateDiff).** Em anúncio de e-commerce o produto precisa ser *aquele* produto; modelo generativo não mantém fidelidade de embalagem, rótulo nem cor. Custo alto, resultado inutilizável para o caso de uso.
- **Catálogo de 100+ transições GL (gl-transitions).** O anúncio usa quatro ou cinco transições no total. Um menu de 100 é paralisia de escolha, e shader WebGL dentro do render Remotion abre uma classe nova de bug (contexto perdido, divergência preview/render) num projeto que já sofre disso. O conjunto atual cobre.
- **Colorista completo: rodas lift/gamma/gain, curvas por canal, LUT 3D.** Quatro presets fechados resolvem 95% dos casos em cinco segundos. O painel completo custa semanas e vai ser aberto uma vez. Visto no OpenReel e no Kdenlive.
- **Cadeia de efeitos de áudio (EQ, compressor, reverb, chorus, flanger, distorção).** Anúncio dublado precisa de volume consistente (item 4) e de ducking, que já existe. O resto é DAW disfarçada de editor. Visto no OpenReel.
- **Score de viralidade e detecção automática de momentos.** Serve para picar podcast longo em cortes. O anúncio aqui é roteirizado do zero — não há "melhor momento" a descobrir. Visto no Opus Clip e no ClippyMe (Gemini).
- **Correção de contato visual e remoção de muletas por IA.** A locução é dublada e lida de roteiro; não há "ãh" nem olhar fora da câmera para corrigir. Visto no Descript e no Veed.
- **Sequências aninhadas, rotoscopia, máscaras avançadas e motion tracking.** Ferramenta de pós-produção de peça longa. Em 20 segundos verticais nunca paga o custo. Visto no Kdenlive e no roadmap do OpenReel.
- **Export ProRes, AV1, 4K e profundidade de cor.** A rede re-comprime tudo; o alvo é H.264 em 1080×1920. Cada codec extra é superfície de bug no render sem ganho visível. Visto no OpenReel.
- **Gravação de tela e webcam dentro do editor.** É outro produto, com outro ciclo de bugs (permissões, dispositivos, sincronismo). Visto no OpenReel.
- **Sistema de plugins, servidor MCP e aba de script.** Arquitetura pesada antes de existir um segundo usuário para escrever plugin. Visto na reescrita do OpenCut, que por causa disso deixou a versão usável parada num repositório "classic".
- **Edição colaborativa em tempo real e gestão multi-projeto com login.** Roda local, um usuário. Visto no Twick e explicitamente marcado como fora de escopo pelo próprio Editor Starter.
- **Publicação automática em TikTok, Instagram e YouTube com agendador.** Anúncio pago sobe pelo gerenciador de anúncios, não como post orgânico. Construir integração de publicação é resolver o problema errado. Visto no ClippyMe (Zernio + SmartScheduler).
- **Suporte a múltiplos FPS e a celular.** O Editor Starter fixa 30fps de propósito e assume desktop; mexer nisso obriga a converter `from` e `durationInFrames` de todos os itens. Custo alto, benefício zero aqui.
- **Fluxo de proxy (editar em baixa resolução).** Faz sentido para timeline de 40 minutos em 4K. Para clipes de 20 segundos o preview do Remotion dá conta. Visto no Kdenlive.
