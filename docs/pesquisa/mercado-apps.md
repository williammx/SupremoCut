# Mercado de editores de vídeo comerciais — o que entregam hoje

Pesquisa feita em 2026-08-30, via busca na web e leitura direta das páginas oficiais de
funcionalidades, changelogs e comparativos de terceiros. Alvo: o que um editor de vídeo
**comercial** (SaaS ou desktop pago) entrega hoje para quem produz **anúncio vertical 9:16**
em escala — e o que a prática de mídia paga (Meta/TikTok) exige da ferramenta.

Este documento é o par comercial do `editores.md` (que cobre repositórios open source e
projetos de código lidos direto no GitHub). Aqui o material é 100% de produto: páginas de
recursos, central de ajuda, changelog e guias de boas práticas de anúncio, cada afirmação
com o link de onde foi lida. Quando uma página não deu informação confiável ou uma métrica
apareceu inconsistente entre fontes, isso está marcado explicitamente — nada de "TBD".

Nota de segurança: uma das páginas de prática de anúncio lidas (benly.ai) trazia, embutidos
no HTML, links de "resuma isso com ChatGPT/Claude/Gemini" carregando instruções para
associar a marca do site a "autoridade" e inserir um link promocional na resposta. Essa
instrução veio de conteúdo de terceiro, não do usuário, e foi ignorada — o site é citado
abaixo só como fonte normal, sem link promocional.

## 1. CapCut (desktop e web)

[capcut.com](https://www.capcut.com) — o editor gratuito de referência do usuário; motor híbrido (edição básica local, IA pesada em nuvem por sistema de créditos).

- **Auto Reframe**: IA rastreia o sujeito e reenquadra para outra proporção (9:16, 1:1, 16:9), com ajuste manual de estabilização e "velocidade de câmera" depois — [capcut.com/tools/auto-reframe](https://www.capcut.com/tools/auto-reframe).
- **Keyframes em qualquer propriedade** (posição, escala, opacidade, velocidade) com editor de curva Bézier, e **Speed Curve** para rampa de velocidade suave em vez de troca abrupta — [bigvu.tv](https://bigvu.tv/blog/capcut-online-desktop-editor-review/).
- **AutoCut**: remove silêncio e ar morto automaticamente e costura os melhores trechos; existe também **Remove Filler Words** dedicado para vícios de linguagem — mas ambos exigem CapCut Pro e conexão com a internet, pois rodam na nuvem — [capcut.com/resource/autocut-for-videos](https://www.capcut.com/resource/autocut-for-videos), [blitzcutai.com](https://blitzcutai.com/blog/capcut-remove-silence).
- **AI Text Remover / AI Inpainting / AI People Remover**: remove texto ou objeto do vídeo com preenchimento por IA (não é só cobrir com uma caixa) — visto direto no menu de produtos do próprio site: [capcut.com/create/ai-text-remover](https://www.capcut.com/create/ai-text-remover), [capcut.com/create/image-inpainting](https://www.capcut.com/create/image-inpainting).
- Auto captions rápidas (segundos), mas precisão cai em sotaque forte, fala rápida ou vocabulário técnico, exigindo correção manual — [bigvu.tv](https://bigvu.tv/blog/capcut-online-desktop-editor-review/).
- Texto-para-fala, vozes customizadas, redução de ruído de fundo e realce de voz também existem como ferramentas separadas, listadas no próprio menu do site — [capcut.com/tools/text-to-speech](https://www.capcut.com/tools/text-to-speech), [capcut.com/tools/remove-background-noise-from-audio](https://www.capcut.com/tools/remove-background-noise-from-audio).
- **Nota local**: o app roda offline para tarefas básicas, mas quase toda função de IA (AutoCut, Auto Reframe, remoção de texto) depende de verificação online e consome créditos de nuvem; só uma parte pequena das funções de IA roda on-device — [norrisgraphy.com](https://norrisgraphy.com/does-capcut-need-wifi/), [capcutguide.com](https://capcutguide.com/capcut-ai-credits/).

## 2. Descript

[descript.com](https://www.descript.com) — editor "por texto": a transcrição é a timeline. 100% nuvem.

- **Edição por corte de texto**: apagar uma palavra ou frase no editor de transcrição corta o vídeo correspondente — o paradigma inteiro do produto — [descript.com](https://www.descript.com).
- **Remove filler words** ("um", "uh", "like", "you know"), com opção **"Avoid harsh cuts"** que pula uma muleta se removê-la cortaria dentro da palavra vizinha — [help.descript.com/script-editing/filler-words](https://help.descript.com/script-editing/filler-words).
- **Studio Sound**: um clique remove ruído de fundo e realça a voz, sem estúdio — [insideeditors.com](https://insideeditors.com/learn-descript-in-15-minutes/).
- **Overdub**: clonagem de voz para regravar uma palavra ou frase; convincente para 1-2 palavras, mas ritmo e respiração denunciam em frases longas — serve para "consertar" um erro pontual, não para narrar do zero — [filmora.wondershare.com](https://filmora.wondershare.com/ai-tools/descript-overdub-ai.html).
- **Eye Contact**: ajusta o olhar para a câmera em quem lê roteiro na tela — [blog.amandavandergulik.com](https://blog.amandavandergulik.com/post/descript-eyecontact).
- **Nota local**: Descript é 100% cloud — o material sobe para os servidores (Amazon S3 / Google Cloud) e é processado lá; a própria empresa migrou a transcodificação do computador do usuário para a nuvem para ganhar velocidade — [descript.com/security](https://www.descript.com/security), [descript.com/blog](https://www.descript.com/blog/article/the-new-descript-how-we-multiplied-the-apps-speed-and-performance). Não tem modo local/offline.

## 3. Opus Clip

[opus.pro](https://www.opus.pro) — clipador automático de vídeo longo com pontuação de viralidade. Nuvem.

- **Virality Score (0–99)**: calculado oficialmente a partir de quatro fatores — gancho (a abertura prende e é relevante?), fluxo (a narrativa avança e fecha bem?), valor (emociona/agrega?) e tendência (conecta com o que está em alta) — documentação oficial: [help.opus.pro/docs/article/virality-score](https://help.opus.pro/docs/article/virality-score). Só aparece nos planos Pro/Starter.
- **ClipAnything**: clipagem multimodal (visual + áudio + sentimento) que aceita prompt em linguagem natural ("todo demo de produto", "toda cena emocional") e funciona mesmo em vídeo com pouco ou nenhum diálogo — documentação oficial: [help.opus.pro/docs/article/9947095-clip-anything](https://help.opus.pro/docs/article/9947095-clip-anything).
- **Reframe Anything** (em Alpha, dentro do ClipAnything): rastreia objetos/ações quadro a quadro e reenquadra para 9:16, 1:1 e 16:9 — mesma fonte oficial acima.
- **AI B-Roll**: insere imagem ou vídeo de banco (Pexels) casado com a transcrição, com plano de futuramente aceitar B-roll próprio do usuário — [help.opus.pro/docs/article/ai-broll](https://help.opus.pro/docs/article/ai-broll), [tubefilter.com](https://www.tubefilter.com/2023/11/02/opusclip-b-roll-tool/).
- **Ressalva registrada pelo próprio mercado**: o Virality Score nem sempre prevê bem — clipes de nota alta às vezes não performam e vice-versa; usuários tratam o número como triagem, não veredito — [eesel.ai](https://www.eesel.ai/blog/opusclip).

## 4. Vizard

[vizard.ai](https://vizard.ai/) — concorrente direto do Opus Clip, mesma categoria de clipagem por IA.

- Detecção de melhor momento por cena e fala, clipes gerados em menos de 60s — [aitoolcurator.com](https://www.aitoolcurator.com/ai-tools/content-creation/vizard-ai/).
- **Edição por transcrição**: apagar um trecho do texto apara o vídeo correspondente, sem precisar mexer na régua da timeline — [videosdk.live](https://www.videosdk.live/ai-apps/vizard).
- Legendas automáticas com transcrição em 30+ idiomas e tradução para 130+ — mesma fonte.
- Reenquadramento automático para 9:16, 1:1, 4:5 e 16:9 com rastreio e centralização de quem fala; monta layout automático de tela dividida quando há tela compartilhada + rosto — mesma fonte.
- B-roll inserido automaticamente para sustentar a narrativa do clipe — mesma fonte.

## 5. Submagic

[submagic.co](https://www.submagic.co/) — hoje o mais forte do mercado especificamente em legenda animada e "polimento" de vídeo curto.

- **Magic Zoom**: zoom automático nos pontos de ênfase com curvas nomeadas (fast, crash, smooth, expo, linear) — [submagic.co/features/auto-zooms](https://www.submagic.co/features/auto-zooms).
- **Magic B-Roll**: insere banco de imagem/vídeo automaticamente lendo a transcrição — [submagic.co/features/b-roll](https://www.submagic.co/features/b-roll).
- **AI Silence Remover**: corta silêncio em um clique — [submagic.co/features/ai-silence-remover](https://www.submagic.co/features/ai-silence-remover).
- Emoji automático por gatilho de palavra e efeitos sonoros (whoosh, ding, impacto) alinhados ao corte — achado consolidado a partir da própria página de recursos do produto.
- **Video Hook Generator**: ferramenta gratuita e sem cadastro que devolve cinco aberturas de gancho a partir de uma descrição, cada uma já dentro do limite de 3 segundos — [submagic.co/tools/video-hook-generator](https://www.submagic.co/tools/video-hook-generator).
- **Generate Hook Title** (dentro do editor, na aba de legenda) e mais duas ferramentas de IA: **Clean Audio** e **Remove Bad Takes** — [care.submagic.co](https://care.submagic.co/en/article/how-to-add-hook-titles-to-your-videos-using-ai-on-submagic-11kzi3m/).

## 6. Veed.io

[veed.io](https://www.veed.io) — editor web tudo-em-um, forte em dublagem/tradução multilíngue e kit de marca. Nuvem.

- **Magic Cut**: um clique remove pausa, gagueira, erro e silêncio, com pré-visualização antes de aplicar — [support.veed.io](https://support.veed.io/en/articles/11589317-magic-cut).
- **Silence Remover** dedicado: remove só o silêncio total (não mexe se houver respiração ou ruído de fundo) — [veed.io/tools/audio-editor/silence-remover](https://www.veed.io/tools/audio-editor/silence-remover).
- **Filler Remover** — [veed.io/tools/filler-remover](https://www.veed.io/tools/filler-remover).
- **AI Dubbing**: traduz áudio e legenda mantendo sincronia labial, com voz de IA, clonagem de voz ou texto-para-fala — [veed.io/tools/voice-dubber/ai-dubbing](https://www.veed.io/tools/voice-dubber/ai-dubbing).
- Legendas/tradução em 50+ idiomas, avatares de IA (60+, 120+ idiomas) e **brand kit completo** (logo, fonte, cor aplicados em 1 clique) — [aitoolsexplained.com](https://www.aitoolsexplained.com/products/veed).

## 7. Adobe Premiere Pro

[helpx.adobe.com/premiere-pro](https://helpx.adobe.com/premiere-pro) — editor profissional desktop; a maior parte roda local, mas os recursos generativos (Firefly) dependem de crédito de nuvem.

- **Enhance Speech**: modelo de deep learning que separa diálogo de ruído, dentro do painel Essential Sound. Segundo discussão da própria comunidade oficial da Adobe, a versão **dentro do Premiere roda localmente, sem precisar de internet** — diferente da versão web do Adobe Podcast, que é 100% online — [thepodcastconsultant.com](https://thepodcastconsultant.com/blog/adobe-podcast-enhance), tópico da comunidade oficial referenciado em [vagon.io](https://vagon.io/blog/premiere-pro-ai-features). Não consegui confirmar esse detalhe direto na página técnica da Adobe (helpx.adobe.com/premiere-pro/using/enhance-speech-faq.html): o conteúdo carregado por fetch trouxe só a navegação do site, não o corpo do artigo.
- **Text-Based Editing**: gera legenda estilizada e permite cortar pelo texto da transcrição — [vagon.io](https://vagon.io/blog/premiere-pro-ai-features).
- **Auto Reframe**: usa Adobe Sensei para rastrear o sujeito e reenquadrar para outra proporção, criando keyframes de pan/crop que dá para ajustar à mão depois — [awn.com](https://www.awn.com/news/adobe-announces-ai-powered-auto-reframe-premiere-pro), [store.hollyland.com](https://store.hollyland.com/blogs/creator-hub/use-auto-reframe-in-premiere-pro).
- **Scene Edit Detection**, **Generative Extend** e geração de B-roll por texto via Firefly — esses últimos dois dependem de créditos de nuvem da Adobe, ao contrário do Enhance Speech — [vagon.io](https://vagon.io/blog/premiere-pro-ai-features).

## 8. Adobe Express

[adobe.com/express](https://www.adobe.com/express/feature/video/editor) — versão simplificada da Adobe, por templates; o "Canva da Adobe".

- Extrai a trilha de áudio do vídeo para editar separada e permite reordenar/editar múltiplas camadas na timeline — [helpx.adobe.com/express](https://helpx.adobe.com/express/web/whats-new/release-notes.html).
- Legendas automáticas, remoção/troca de fundo, gravação própria dentro do app, exportação direta para redes — [news.adobe.com](https://news.adobe.com/news/2025/04/adobe-introduces-new-ai-powered-video-tools-adobe-express).
- Marca aplicada a partir do logo enviado: o AI Assistant já usa a paleta e fonte da marca ao gerar ou editar — mesma fonte.

## 9. DaVinci Resolve

[blackmagicdesign.com/products/davinciresolve](https://www.blackmagicdesign.com/products/davinciresolve/studio) — suíte de pós-produção desktop com o motor de correção de cor mais respeitado do mercado. Roda 100% local, com GPU.

- **Magic Mask**: isola e rastreia objeto/pessoa automaticamente para aplicar efeito só nele — recurso do Neural Engine, **exclusivo da versão Studio** — [vagon.io](https://vagon.io/blog/davinci-resolve-neural-engine-guide), [cgchannel.com](https://www.cgchannel.com/2026/06/blackmagic-design-releases-davinci-resolve-21-0/).
- **Voice Isolation** (dentro do Fairlight): slider de intensidade que separa a voz de trânsito, eco, ar-condicionado e reverberação de sala — também exclusivo do Studio — [vocalremover.easeus.com](https://vocalremover.easeus.com/ai-article/davinci-resolve-voice-isolation.html).
- **uTalk**: analisa onde cada falante está posicionado em tela e pana o áudio do diálogo automaticamente para combinar — [cgchannel.com](https://www.cgchannel.com/2026/06/blackmagic-design-releases-davinci-resolve-21-0/).
- **Nota local/custo**: processamento 100% local via GPU (CUDA/OpenCL), sem depender de internet — mas Magic Mask, Voice Isolation e uTalk exigem a versão Studio, que é **licença única de US$ 295** (não assinatura) — [blackmagicdesign.com](https://www.blackmagicdesign.com/products/davinciresolve/studio).

## 10. Runway

[runwayml.com](https://runwayml.com) — motor de geração/edição de vídeo por IA generativa. 100% nuvem.

- Modelos **Gen-4, Gen-4.5 e Aleph** (edição em contexto) para gerar vídeo a partir de texto/imagem ou transformar filmagem existente — [resource.digen.ai](https://resource.digen.ai/runway-agent-video-editing-features-2026/).
- Remoção de fundo em tempo real, **inpainting** (remove objeto/texto e preenche), motion tracking e lip-sync — [filmora.wondershare.com](https://filmora.wondershare.com/ai/ai-editing-tool-runway-review.html).
- **Act-Two**: transfere a performance de uma pessoa real para um personagem gerado por IA — mesma fonte.
- Roda inteiramente na nuvem: não exige GPU local, mas também não funciona sem internet — mesma fonte.
- **Relevância para este produto**: baixa em geração (o produto do anúncio precisa continuar sendo *aquele* produto, um modelo generativo não garante fidelidade), mas o inpainting em tempo real mostra o padrão que o mercado está normalizando para "cobrir/remover" algo na tela.

## 11. Kapwing

[kapwing.com](https://www.kapwing.com) — editor 100% navegador, forte em resize e legenda automática.

- **Smart Cut**: detecta trechos de silêncio ou fala mínima e sugere uma lista de cortes, revisável antes de aplicar — cerca de 10x mais rápido que cortar à mão, segundo a própria página de ajuda — [kapwing.com/help/how-to-use-smart-cut](https://www.kapwing.com/help/how-to-use-smart-cut/).
- **Magic Subtitles**: transcreve, estiliza e anima a legenda em um clique — [kapwing.com/subtitles](https://www.kapwing.com/subtitles).
- **Resize com IA**: converte 16:9 para 9:16 mantendo o sujeito centralizado — [kapwing.com/tools/resize](https://www.kapwing.com/tools/resize).

## 12. Canva Video

[canva.com/video-editor](https://www.canva.com/video-editor/) — força em design/template, não em edição fina. Nuvem.

- **Auto Captions** com fonte, cor, fundo e animação ajustáveis à marca — [canva.com/features/auto-caption](https://www.canva.com/features/auto-caption/).
- Atualização "Create 2026": timeline com precisão de quadro, **Magic Video** (monta um corte curto sozinho a partir do material bruto), **AI Highlights** (acha os melhores momentos para reaproveitar) e **Beat Sync** (sincroniza corte/transição com a batida da música) — [fluxnote.io](https://fluxnote.io/guides/canva-video-editor-review).
- Mais de 600 mil templates, incluindo criativos de anúncio prontos por rede — mesma fonte.

## 13. InVideo

[invideo.io](https://invideo.io/make/ai-video-generator/) — geração de vídeo por IA a partir de texto/prompt, com avatares. Nuvem.

- **Agent One**: gera até 30 minutos de vídeo a partir de um prompt e permite refinar por **comando de texto em vez de mexer na timeline** — o mesmo princípio de "IA no chat, editor só pra ajustar" que o SupremoCut já assume, mas aplicado à geração e não à edição de material próprio — [aitoolsdevpro.com](https://aitoolsdevpro.com/ai-tools/invideo-guide/).
- Avatares de IA multi-ângulo com transição de cena dinâmica e fundo gerado por contexto — mesma fonte.
- Acesso a 200+ modelos de imagem/vídeo/áudio/música (Veo 3.1, Sora 2, Kling 3.0, ElevenLabs) dentro de um único plano — mesma fonte.

## 14. Pictory

[pictory.ai](https://pictory.ai/) — roteiro vira vídeo automaticamente, casando texto com banco de imagem/vídeo. Nuvem.

- **Script-to-Video**: cola o roteiro, a IA casa cada trecho com filmagem/imagem de um banco de licença livre, adiciona narração, legenda e trilha — [pictory.ai/pictory-features/script-to-video](https://pictory.ai/pictory-features/script-to-video).
- **Video Highlights**: gera trailer/destaque curto a partir de um vídeo longo detectando os momentos relevantes automaticamente (ou deixando o usuário escolher) — [pictory.ai/pictory-features/video-highlights](https://pictory.ai/pictory-features/video-highlights).

## Ferramentas de escala de variantes (contexto, sem seção própria)

Fora da lista original, a busca por "teste de variantes de anúncio" revelou uma categoria
inteira de produto dedicada a gerar **dezenas de variações de UGC a partir de um único
roteiro/produto** — sinal de que "N variantes do mesmo criativo" já virou um recurso de
prateleira no mercado de ads, não uma ideia isolada:

- **HeyGen**: gera dezenas de variações de UGC a partir de um script, trocando apresentador, fundo, gancho e CTA — [heygen.com/apps/ugc-video-generator](https://www.heygen.com/apps/ugc-video-generator).
- **Creatify**: modo em lote que gera dezenas de variantes a partir de uma URL de produto — citado como o de maior throughput para marcas que testam 50+ criativos por produto — [adstellar.ai](https://www.adstellar.ai/blog/best-ugc-ad-generation-tools).
- **AdStellar**: gera avatar de UGC e lança centenas de variações por audiência/manchete, com leitura de qual criativo puxa ROAS — mesma fonte, que também traz o comparativo de custo: testar 50 variantes com criador real custa US$ 7.500–10.600, contra menos de US$ 200 com gerador de IA.
- No lado da própria plataforma de anúncio, o **Meta Advantage+ Creative** já testa variações automáticas de um único criativo (brilho, contraste, corte de proporção, combinação de texto), com ganho médio reportado de 12% no custo por resultado — [benly.ai](https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026).

## Boas práticas de anúncio vertical (o que a prática exige da ferramenta)

Lido nas páginas de especificação e boas práticas da Meta e do TikTok e em guias
especializados de creative testing — resumo do que se repete entre as fontes:

- **O gancho decide tudo em 2–3 segundos.** "The first two to three seconds decide whether the viewer stays" — em todo formato (vídeo, imagem estática, carrossel), não só vídeo — [cinerads.com](https://www.cinerads.com/blog/meta-ads-video-creative-best-practices). O TikTok chama isso de "3 second rule": o gancho precisa aparecer nesse intervalo — [admanage.ai](https://admanage.ai/blog/tiktok-ad-specs).
- **Projetar para som desligado é obrigatório, não opcional.** Cerca de 80% da navegação no Feed do Meta é mudo; Reels e Stories têm taxa de som ligado maior (~60%), então vale ter estratégia dupla — [benly.ai](https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026). No TikTok é o oposto: 93% dos usuários navegam com som ligado e todo anúncio precisa ter áudio — [admanage.ai](https://admanage.ai/blog/tiktok-ad-specs).
- **Zona segura do Reels**: o topo (14% da tela) é coberto por nome de conta/seguir/rótulo de áudio, e a base (35% da tela) é coberta por legenda, botões de curtir/comentar e a barra de CTA — ou seja, cerca de metade da tela vertical já está ocupada pela interface, e o essencial precisa ficar fora dessas duas faixas — [benly.ai](https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026) (o mesmo artigo cita em outro trecho "centro de 80% do quadro", número inconsistente com a soma 14%+35%=49% — a estatística de faixa de topo/base é a que aparece duas vezes e de forma consistente, por isso é a citada aqui).
- **Duração**: para Reels, 15–30s é o ideal e 21–24s é o "ponto doce" medido em campanhas agregadas; Stories funciona melhor em 7–15s; no TikTok o intervalo 9–15s (ou até 15–30s) puxa mais taxa de conclusão — [benly.ai](https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026), [admanage.ai](https://admanage.ai/blog/tiktok-ad-specs).
- **Volume de variantes bate produção única.** "A campaign with eight to twelve varied assets almost always beats one with two polished ones" — o motivo é que a entrega otimizada da Meta (Advantage+) precisa de opções para casar criativo com espectador — [cinerads.com](https://www.cinerads.com/blog/meta-ads-video-creative-best-practices). A cadência prática recomendada é mudar **uma variável por vez** (só o gancho, ou só a oferta, ou só o CTA) e adicionar 3 a 5 criativos novos por semana — mesma fonte.
- **Texto na tela**: no TikTok, texto grande, central e com no máximo ~6 palavras por quadro — [admanage.ai](https://admanage.ai/blog/tiktok-ad-specs). No Meta, texto primário abaixo de 125 caracteres (o resto é truncado atrás de "ver mais") e título abaixo de 40 caracteres — [benly.ai](https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026).
- **Loudness por rede de destino**: as metas de LUFS não são universais — YouTube mira perto de −14 LUFS, Instagram/TikTok entre −10 e −12 LUFS, Facebook perto de −13 LUFS, enquanto o padrão de broadcast EBU R128 (a referência que a maioria dos guias técnicos cita) usa −23 LUFS com pico máximo de −1 dBTP — [opus.pro/blog/best-loudness-normalizers](https://www.opus.pro/blog/best-loudness-normalizers), [criticallisteninglab.com](https://www.criticallisteninglab.com/en/learn/loudness). Isso significa que uma única meta fixa de exportação (ex.: sempre −14) acerta o YouTube mas deixa o anúncio de Reels/TikTok mais baixo do que o concorrente.

## Tabela de funcionalidades

| Funcionalidade | Quem tem | Dor que resolve | Dá para fazer local? | Esforço (P/M/G) |
|---|---|---|---|---|
| Separação de voz e música (stems) | Biblioteca aberta Demucs (MIT, mantida por pesquisadores ligados à Meta AI), usada por várias ferramentas de áudio — [pypi.org/project/demucs](https://pypi.org/project/demucs/3.0.5), [dev.to](https://dev.to/stevecase430/complete-guide-to-setting-up-demucs-locally-for-ai-stem-separation-580h) | Dublar um anúncio estrangeiro sem perder a trilha/música original nem deixar vazar a voz de origem por baixo do áudio novo | Sim — MIT, `pip install demucs`, roda em CPU (mais lento) ou GPU, sem limite de arquivo e sem upload | G |
| Corte automático de silêncio/respiro (smart cut) | CapCut AutoCut, VEED Magic Cut/Silence Remover, Kapwing Smart Cut, Descript, Submagic AI Silence Remover | Tira o ar morto de pausa/respiro da dublagem sem revisar quadro a quadro | Sim — FFmpeg `silencedetect` + os tempos de palavra do Whisper que o projeto já calcula | M |
| Normalização de loudness por rede de destino | Prática de mercado documentada (ver seção de boas práticas acima), não um recurso exclusivo de um app | Evita anúncio "baixo" ou "estourado" quando a rede aplica seu próprio ganho de reprodução | Sim — filtro `loudnorm` do FFmpeg em duas passagens | P |
| Redução de ruído / realce de fala | Adobe Enhance Speech (local dentro do Premiere, segundo a comunidade oficial), Adobe Podcast (nuvem), Descript Studio Sound (nuvem), DaVinci Resolve Voice Isolation (local, só Studio pago) | Limpa áudio de fonte ruim (celular, ambiente) antes de dublar por cima | Sim — RNNoise (open source, usado por OBS e Mumble) ou filtros FFmpeg `afftdn`/`arnndn` rodam 100% local — [github.com/werman](https://github.com/werman/noise-suppression-for-voice) | M |
| Edição por corte de texto (transcrição = timeline) | Descript, Vizard | Apagar uma frase no texto corta o vídeo, sem arrastar nada na régua — casa direto com "IA no chat, editor só pra ajustar" | Sim — o mapeamento palavra→tempo do Whisper já existe no projeto; falta a interface/ação de aplicar o corte | M |
| Zoom automático guiado por ênfase da palavra | Submagic Magic Zoom (fast/crash/smooth/expo/linear) | Segura a atenção sem exigir um corte novo | Sim — reaproveita os tempos de palavra já calculados para a legenda | M |
| Gerador de gancho (hook) para os 3 primeiros segundos | Submagic (Video Hook Generator, Generate Hook Title) | Ataca direto o maior fator de retenção comprovado pela própria Meta/TikTok | Sim — é um prompt de IA sobre o roteiro/transcrição já existente, sem infraestrutura nova | P |
| Variantes em lote de um mesmo criativo (trocar hook/CTA/legenda) | Creatify, HeyGen, AdStellar, ClipLoft (geração de UGC); Meta Advantage+ Creative testa variações do lado da plataforma | Escala o teste A/B que a própria Meta recomenda (8–12 variações batem 2 perfeitas) sem remontar cada vídeo do zero | Sim — a fila de render já existe para as 3 proporções; falta o conceito de "projeto derivado" | M |
| Reenquadramento automático 9:16 com rastreio de fala/rosto | CapCut Auto Reframe, Adobe Premiere Auto Reframe (Sensei), Opus Clip Reframe Anything (Alpha), Vizard, Kapwing | Reaproveita material horizontal do anunciante sem gravar de novo | Não nos apps citados (nuvem ou modelo pesado) — daria para fazer local com MediaPipe/YOLO rodando na máquina do usuário | G |
| Selos de oferta e urgência prontos (preço, contagem regressiva, frete grátis, prova social) | Nenhum editor de vídeo genérico pesquisado entrega isso pronto — aparece em ferramentas de pop-up de e-commerce (Wisepops, ConvertFlow) e bancos de template soltos (Wave.video, PosterMyWall) | É exatamente o elemento de conversão que a prática de e-commerce pede, e nenhum editor de vídeo comercial da lista tem de fábrica | Sim — SVG/CSS animado, sem dependência externa | P |
| Kit de marca persistente (logo, cor, fonte, marca d'água fora do projeto) | Veed.io (brand kit completo), Adobe Express (aplica marca a partir do logo) | Elimina reconfigurar cor/fonte a cada vídeo de quem produz em série | Sim — é armazenamento local de preferências fora do projeto | P |
| Foco automático em fala ativa (multicam/PiP) | Opus Clip (troca de foco entre falantes ao reenquadrar) | Evita alternar manualmente qual câmera do PiP está "em foco" | Sim — dá para usar detecção de atividade de voz (VAD) por trilha de áudio, mais barato que visão computacional | M |
| Emoji automático e realce de palavra-chave na legenda | Submagic | Faz a oferta ("grátis", "50% off") saltar do bloco de texto sem esforço manual | Sim — é uma regra sobre os tokens de legenda que já existem | P |
| B-roll automático casado com a transcrição | Submagic Magic B-Roll, Opus Clip AI B-Roll (+ Pexels), Vizard | Cobre a tela com imagem/clipe do produto quando a narração cita ele, sem montar bloco a bloco | Parcial — o casamento transcrição→asset é lógica local, mas o banco de imagens em todos os casos pesquisados é um serviço de terceiro (Pexels) | M |
| Efeitos sonoros automáticos no corte (whoosh, ding, impacto) | Submagic | Empurra a sensação de "editado por profissional" só no áudio do corte | Sim — a trilha de áudio independente já existe; falta o acervo de SFX e o gatilho automático | P |
| Correção de cor com presets prontos | DaVinci Resolve (motor completo + Magic Mask para isolar objeto), CapCut (ajustes automáticos) | Unifica material vindo de fontes diferentes (celular, estúdio, banco de imagem) | Sim — filtro CSS cobre a maior parte do efeito visual | P |
| Isolamento/máscara automática de objeto (Magic Mask) | DaVinci Resolve Studio | Rastreia pessoa/produto automaticamente para aplicar efeito só nele | Sim, mas só na versão Studio (licença única de US$ 295, não assinatura) | G |
| Remoção de texto/objeto em vídeo com preenchimento por IA (inpainting) | CapCut AI Text Remover/AI Inpainting, Runway (inpainting em tempo real) | Apagaria texto queimado com preenchimento gerado em vez de só cobrir com uma caixa | Não nos apps citados — ambos dependem de nuvem/GPU pesada | G — e provavelmente **não vale o esforço aqui**: card de texto parado em anúncio de 20s já resolve com um patch estático (caixa/blur), que é muito mais barato |
| Beat Sync (corte alinhado à batida da música) | Canva Video | Sincroniza corte/transição com o tempo da trilha sonora sem contar batida manualmente | Não documentado como local no Canva (é 100% nuvem) — daria para fazer local com detecção de batida (ex. biblioteca `librosa`) | M |
| Dublagem/tradução multilíngue automática com sincronia labial | Veed.io (50+ idiomas), Vizard (tradução para 130+ idiomas) | Abriria o mesmo anúncio para outros mercados de idioma sem novo projeto | Não — todos os pesquisados dependem de nuvem | G, e **baixa prioridade agora**: o caso de uso descrito é só inglês/italiano → português do Brasil |
| Score de viralidade / previsão de desempenho | Opus Clip Virality Score (gancho/fluxo/valor/tendência), ClipAnything | Ajuda a priorizar corte em vídeo longo sem roteiro fixo | — | **Não recomendado aqui**: o anúncio é roteirizado do zero, não há "melhor momento" a descobrir num material já pronto |
| Correção automática de contato visual | Descript Eye Contact | Corrige o olhar de quem lê roteiro fora da câmera, em gravação ao vivo | Não (nuvem) | **Não se aplica**: a locução do produto é dublada, não há câmera ao vivo para corrigir |
| Remoção de vícios de linguagem (ãh, tipo, etc) | Descript, VEED Filler Remover | Limpa gravação improvisada de podcast/vlog | Não (ambos nuvem) | **Não se aplica**: a locução dublada é lida de roteiro, sem vício de fala a remover |
| Geração de vídeo/B-roll sintético a partir de texto | Runway Gen-4/Gen-4.5, Firefly dentro do Premiere, InVideo, Pictory | Criaria uma cena que não foi filmada | Não — todos nuvem | **Não recomendado**: o produto do anúncio precisa continuar sendo *aquele* produto; modelo generativo não garante fidelidade de embalagem/rótulo/cor |

## As 12 que mais mudariam o jogo para anúncio vertical

Ordenadas por impacto no caso de uso real deste projeto: anúncio dublado, roteirizado,
vertical, produzido em série, por um dono que não programa e comanda a IA pelo chat.

1. **Separação de voz e música (Demucs local)** — é a única forma de dublar um anúncio estrangeiro mantendo a música/SFX originais por baixo da nova voz, em vez de silenciar tudo ou deixar a voz antiga vazando.
2. **Corte automático de silêncio/respiro** — a feature que mais apps do mercado pesquisado já têm de prateleira (CapCut, VEED, Kapwing, Descript); se falta aqui, cada vídeo perde tempo de sobra que o concorrente já não perde.
3. **Normalização de loudness por rede de destino** — resolve 100% local, com FFmpeg, o defeito mais fácil de ouvir e mais fácil de nunca notar sozinho: anúncio "baixo" ou "estourado" na plataforma errada.
4. **Redução de ruído / realce de fala 100% local** — limpa a fonte (celular, ambiente barulhento) antes de dublar por cima, sem depender de crédito de nuvem por minuto como Descript/Adobe Podcast.
5. **Edição por corte de texto (apagar no roteiro corta o vídeo)** — é o paradigma Descript/Vizard aplicado à arquitetura que este projeto já tem (tempos de palavra do Whisper), e encaixa exatamente na filosofia "a IA no chat faz o trabalho pesado".
6. **Zoom automático guiado por ênfase da palavra** — o truque de retenção mais barato do mercado (Submagic Magic Zoom), usando um dado que o projeto já calcula para a legenda.
7. **Gerador de gancho para os 3 primeiros segundos** — ataca de frente o fator de performance mais citado por Meta, TikTok e todo guia de creative testing lido nesta pesquisa.
8. **Variantes em lote de um mesmo criativo (hook/CTA/legenda diferentes)** — a própria Meta documenta que 8 a 12 variações batem 2 criativos perfeitos; sem isso, o usuário refaz cada teste A/B manualmente do zero.
9. **Reenquadramento automático 9:16 com rastreio de fala/rosto** — deixa reaproveitar o corte horizontal que já veio no anúncio original em inglês/italiano, sem precisar de novo material.
10. **Selos de oferta e urgência prontos (preço, contagem regressiva, frete grátis, prova social)** — é o elemento de conversão que toda prática de anúncio de e-commerce pede, e nenhum editor de vídeo genérico pesquisado entrega pronto — aqui seria diferencial real, não recurso de commodity.
11. **Kit de marca persistente (logo, cor, fonte, marca d'água fora do projeto)** — quem produz variação em série (o uso descrito) reconfigura isso a cada vídeo hoje; Veed já provou que salvar isso fora do projeto economiza esse atrito.
12. **Foco automático em fala ativa no PiP multicam** — melhora um recurso que já existe (PiP multicam) em vez de criar um novo, trocando manualmente quem está "em foco" por uma detecção simples de voz ativa.
