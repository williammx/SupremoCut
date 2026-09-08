/**
 * SupremoCut — Tipos do roteiro de edição
 *
 * Este arquivo define o "contrato": tudo que o motor Python gera
 * e que você pode editar na mão dentro de projetos/<nome>/roteiro.json
 */

/** Um retângulo na tela, em valores de 0 a 1 (proporção do quadro). */
export type Retangulo = {
  x: number; // 0 = esquerda, 1 = direita
  y: number; // 0 = topo,     1 = base
  largura: number;
  altura: number;
  raio: number; // cantos arredondados, em pixels
  opacidade: number; // 0 a 1
  sombra: boolean;
  borda: number; // espessura da borda em pixels (0 = sem borda)
};

/** Como as duas fontes de vídeo aparecem na tela. */
export type Layout =
  | "camera" // só a sua câmera, tela cheia
  | "tela" // só a gravação de tela, tela cheia
  | "pip" // tela cheia + seu quadradinho no canto
  | "pip_grande" // tela cheia + sua câmera grande no canto
  | "pip_invertido" // câmera cheia + quadradinho da tela
  | "split" // dividido ao meio
  | "split_diagonal"; // dividido na diagonal

/** Tipo de entrada da cena (a transição). */
export type Entrada =
  | { tipo: "corte" }
  | { tipo: "fade"; duracao: number }
  | { tipo: "morph"; duracao: number } // geometria desliza/escala — o "motion"
  | { tipo: "deslize"; duracao: number; direcao: "esq" | "dir" | "cima" | "baixo" }
  | { tipo: "zoom_cruzado"; duracao: number }
  | { tipo: "flash"; duracao: number };

/** Foco: zoom e pan dentro da camada (o "zoom no cursor"). */
export type Foco = {
  x: number; // centro do zoom, 0 a 1
  y: number;
  zoom: number; // 1 = sem zoom, 1.5 = 50% mais perto
  suavidade: number; // 0 = seco, 1 = bem suave
};

/**
 * Uma propriedade que pode se mexer ao longo do tempo.
 *
 * Estas são as mesmas que aparecem paradas em `Ajustes` — animar é só dar a
 * elas dois ou mais valores em instantes diferentes. Quando um bloco tem
 * animação numa propriedade, a animação MANDA e o valor parado é ignorado.
 */
export type PropriedadeAnimada =
  | "zoom"
  | "pos_x"
  | "pos_y"
  | "rotacao"
  | "opacidade"
  | "brilho"
  | "contraste"
  | "saturacao"
  | "temperatura"
  | "desfoque"
  | "vinheta";

/**
 * Um ponto de animação.
 *
 * `t` são segundos contados do COMEÇO DO BLOCO — a mesma régua que `congelar`
 * já usa. Não é o relógio da fonte nem o do vídeo final: é dentro do bloco.
 * Assim, aparar a ponta esquerda faz a animação acompanhar a nova borda em vez
 * de ficar pendurada num ponto do material bruto que ninguém mais vê.
 */
export type Chave = {
  t: number;
  valor: number;
  /**
   * Como o valor CHEGA neste ponto.
   * suave = acelera e desacelera (o padrão, é o que parece natural)
   * reta  = velocidade constante
   * mola  = passa um pouco do ponto e volta
   * degrau = fica parado e troca de uma vez
   */
  curva?: "suave" | "reta" | "mola" | "degrau";
};

/** Uma propriedade e o caminho que ela percorre. */
export type Animacao = {
  propriedade: PropriedadeAnimada;
  chaves: Chave[];
};

/**
 * Correção de imagem de um bloco — os valores parados.
 *
 * Tudo aqui é 0 = como veio, para que um bloco sem ajuste nenhum seja
 * indistinguível de um bloco sem este campo.
 */
export type Ajustes = {
  /** -1 (escuro) a 1 (claro). */
  brilho: number;
  contraste: number;
  /** -1 = preto e branco, 1 = cor berrante. */
  saturacao: number;
  /** -1 = frio/azulado, 1 = quente/alaranjado. */
  temperatura: number;
  /** Desfoque em px pensados para 1080p. 0 = nítido. */
  desfoque: number;
  /** Escurecimento das bordas. 0 = nenhum, 1 = forte. */
  vinheta: number;
};

export const AJUSTES_NEUTROS: Ajustes = {
  brilho: 0,
  contraste: 0,
  saturacao: 0,
  temperatura: 0,
  desfoque: 0,
  vinheta: 0,
};

/**
 * Recorte de uma região do quadro.
 *
 * Serve pra três coisas que aparecem toda hora em anúncio, e que hoje só dá
 * pra fazer com tarja preta em cima:
 *
 *   - borrar um pedaço (rosto de terceiro, placa, marca de outro vendedor)
 *   - destacar o produto escurecendo o resto
 *   - revelar só um trecho da imagem, com borda macia em vez de retângulo duro
 *
 * `pena` é o que separa recorte de tarja: com ela a borda derrete no vídeo e
 * ninguém percebe que houve montagem. Sem ela, é um retângulo — que às vezes
 * também é o que se quer.
 */
export type Mascara = {
  forma: "retangulo" | "elipse" | "circulo";
  /** Centro, de 0 a 1 do quadro. */
  x: number;
  y: number;
  /** Tamanho, de 0 a 1 do quadro. */
  largura: number;
  altura: number;
  /** Graus. Uma máscara torta acompanha texto em diagonal. */
  rotacao: number;
  /** Suavidade da borda, em px pensados para 1080p. 0 = corte seco. */
  pena: number;
  /**
   * Inverter troca o dentro pelo fora.
   *   false = o efeito vale DENTRO da forma (borra o rosto)
   *   true  = vale FORA dela (escurece tudo menos o produto)
   */
  inverter: boolean;
  /**
   * O que acontece na área escolhida.
   *   recortar = o resto some (fica o fundo do projeto)
   *   desfocar = borra
   *   escurecer = escurece
   */
  efeito: "recortar" | "desfocar" | "escurecer";
  /** Intensidade do desfoque (px) ou do escurecimento (0 a 1). */
  forca: number;
};

export const MASCARA_PADRAO: Mascara = {
  forma: "elipse",
  x: 0.5,
  y: 0.5,
  largura: 0.4,
  altura: 0.3,
  rotacao: 0,
  pena: 24,
  inverter: false,
  efeito: "desfocar",
  forca: 18,
};

/** Uma cena: um pedaço contínuo do vídeo final. */
export type Cena = {
  id: string;
  /** Onde esse pedaço começa no arquivo BRUTO (segundos). */
  fonte_inicio: number;
  /** Quanto tempo esse pedaço dura no vídeo FINAL (segundos). */
  duracao: number;
  layout: Layout;
  entrada: Entrada;
  /** Ajuste fino do quadradinho, quando o layout tem PiP. */
  pip?: {
    canto: "inferior_direito" | "inferior_esquerdo" | "superior_direito" | "superior_esquerdo";
    escala: number; // 0.26 = 26% da largura do quadro
    formato: "arredondado" | "circulo" | "reto";
  };
  /** Zoom/pan aplicado na camada de tela. */
  foco?: Foco | null;
  /** Velocidade do trecho. 1 = normal, 1.4 = acelera 40%. */
  velocidade?: number;
  /** Volume do áudio deste bloco. 0 = mudo, 1 = como veio. */
  volume?: number;
  /**
   * Congela a imagem num instante e segura ali, com o áudio correndo normal.
   * O número é o segundo DENTRO do bloco (0 = o primeiro quadro dele).
   * null/ausente = imagem correndo normalmente.
   */
  congelar?: number | null;
  /** Correção de imagem parada. Ausente = nada mexido. */
  ajustes?: Ajustes | null;
  /** Propriedades que se mexem ao longo do bloco. Ausente = nada se mexe. */
  animacoes?: Animacao[];
  /** Nome do preset que gerou as animações — só pra UI saber o que mostrar. */
  preset_animacao?: string | null;
  /** Mistura com o que está atrás (multiply, screen, overlay…). */
  mesclagem?: Mesclagem | null;
  /** Recorte de região: borrar, escurecer ou isolar um pedaço do quadro. */
  mascara?: Mascara | null;
  /** Anotação livre — só pra você se achar. */
  nota?: string;
};

/**
 * Modo de mesclagem — como o bloco se funde com o que está por baixo.
 * Dos 20 que um editor profissional oferece, estes são os que aparecem de
 * verdade em motion de anúncio vertical.
 */
export type Mesclagem =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "color-dodge"
  | "color-burn"
  | "difference"
  | "lighten"
  | "darken";

/** Uma palavra da legenda, com tempo exato. */
export type Palavra = {
  /**
   * Tempo no relógio da FONTE (o arquivo bruto), em segundos — a mesma base de
   * `fonte_inicio` das cenas. A posição no vídeo final é derivada dos cortes a
   * cada render, então editar a timeline move a legenda junto.
   */
  t: number;
  fim: number;
  texto: string;
  /** Se true, ganha a cor de destaque. */
  enfase: boolean;
};

/**
 * Estilos de legenda.
 *
 * Não são enfeite: num vertical, a legenda é o elemento que mais muda retenção,
 * porque a maioria assiste sem som. Cada preset abaixo existe em produto que
 * roda anúncio de verdade.
 */
export type EstiloLegenda =
  | "nenhum"
  /** Palavra a palavra: a que está sendo dita ganha cor. */
  | "destaque"
  /** Frase inteira com o mesmo peso. */
  | "bloco"
  /** As que ainda não foram ditas ficam apagadas. */
  | "karaoke"
  /** Caixa alta pesada, palavra ativa com fundo sólido colorido. */
  | "hormozi"
  /** Toda palavra com fundo sólido; a ativa troca de cor. */
  | "caixa"
  /** Brilho de neon na cor de destaque. */
  | "neon"
  /** A palavra ativa salta grande, as outras encolhem. */
  | "pop";

export type Legendas = {
  estilo: EstiloLegenda;
  /** Faixas de tempo (no vídeo final) onde a legenda aparece. Vazio = o vídeo todo. */
  ligada_em: [number, number][];
  palavras: Palavra[];
  /**
   * Palavras que ganham destaque automático onde aparecerem.
   * A oferta precisa saltar do bloco de texto — "grátis", "50%", o preço.
   */
  palavras_chave?: string[];
  /**
   * Em que relógio os tempos das palavras estão gravados.
   * "fonte" é o correto. "final" é o formato antigo, que descolava ao editar —
   * roteiros assim são convertidos ao abrir.
   */
  base_tempo?: "fonte" | "final";
};

/**
 * Aparência da tarja de cobertura.
 *
 * Existe pra tapar texto que está QUEIMADO no vídeo — legenda em outro idioma,
 * preço, nome de marca — e escrever por cima na língua certa. Por isso ela tem
 * tamanho próprio: precisa cobrir exatamente a área do texto original.
 */
export type Caixa = {
  /** Cor de preenchimento. Aceita rgba pra deixar semitransparente. */
  cor: string;
  cor_borda: string;
  /** Espessura da borda, em px pensados para 1080p. */
  borda: number;
  raio: number;
  cor_texto: string;
  /** Tamanho do texto, em px pensados para 1080p. */
  tamanho_texto: number;
  peso: number;
  alinhamento: "esquerda" | "centro" | "direita";
  /** Contorno preto atrás do texto, pra ler sobre qualquer fundo. */
  contorno: number;
  caixa_alta: boolean;
};

/** Um texto/lower-third/tarja que entra em cima do vídeo. */
export type Overlay = {
  id: string;
  inicio: number;
  duracao: number;
  tipo: "titulo" | "lower_third" | "destaque" | "marca" | "tarja";
  texto: string;
  subtexto?: string;
  /** Canto superior esquerdo, de 0 a 1 do quadro. */
  posicao?: { x: number; y: number };
  /** Só para a tarja: tamanho da caixa, de 0 a 1 do quadro. */
  tamanho?: { largura: number; altura: number };
  /** Só para a tarja: aparência. */
  caixa?: Caixa;
};

/**
 * Uma imagem sobre o vídeo — logo do cliente, print de avaliação, selo de oferta.
 *
 * Tempos em relógio FINAL (posição no vídeo montado), igual aos overlays de
 * texto: uma imagem não pertence a nenhum bloco, ela flutua por cima de todos.
 */
export type Imagem = {
  id: string;
  /** Nome do arquivo dentro de estudio/public/<projeto>/imagens/. */
  arquivo: string;
  inicio: number;
  duracao: number;
  /** Canto superior esquerdo, de 0 a 1 do quadro. */
  x: number;
  y: number;
  /** Largura de 0 a 1 do quadro. A altura sai da proporção original. */
  largura: number;
  opacidade: number;
  /** Graus. */
  rotacao: number;
  /** Cantos arredondados, em px pensados para 1080p. */
  raio: number;
  sombra: boolean;
  animacoes?: Animacao[];
  preset_animacao?: string | null;
  nota?: string;
};

export const TARJA_PADRAO: Caixa = {
  cor: "#000000",
  cor_borda: "#FFFFFF",
  borda: 0,
  raio: 8,
  cor_texto: "#FFFFFF",
  tamanho_texto: 46,
  peso: 800,
  alinhamento: "centro",
  contorno: 0,
  caixa_alta: false,
};

export type Fonte = {
  /** Nome do arquivo dentro de estudio/public/<projeto>/ — usado no render final. */
  arquivo: string;
  /** Versão leve, usada só no preview do editor pra não engasgar. */
  arquivo_preview?: string;
  /** Deslocamento de sincronia em segundos (calculado pelo motor). */
  offset: number;
  duracao: number;
  largura: number;
  altura: number;
};

/** Trilha de música de fundo. */
export type Musica = {
  /** Nome do arquivo dentro de assets/musica (servido em /musica/<arquivo>). */
  arquivo: string;
  /** Volume base, 0 a 1. */
  volume: number;
  /** Quanto o volume cai quando você fala. 0.25 = cai pra 25%. */
  abaixar: number;
  /** Segundos de subida no começo e descida no fim. */
  fade_entrada: number;
  fade_saida: number;
  /** Onde a música entra no vídeo final (segundos). */
  inicio: number;
};

/**
 * Um pedaço de áudio na trilha, independente do vídeo.
 *
 * Antes o som era soldado ao bloco de vídeo: mesmo Sequence, mesma busca. Isso
 * garantia que um corte movesse imagem e som juntos, mas impedia o básico de
 * qualquer editor — deslocar a fala meio segundo sem mexer na imagem.
 *
 * Agora é objeto próprio. `vinculado_a` guarda o id da cena quando você QUER
 * que ele siga o vídeo (o padrão); soltar o vínculo libera o clipe.
 */
export type ClipeAudio = {
  id: string;
  /** Onde entra no vídeo final, em segundos. */
  inicio: number;
  duracao: number;
  /** De onde, dentro do arquivo de áudio. */
  fonte_inicio: number;
  /** Nome do arquivo em public/<projeto>/. Vazio = usa o áudio principal. */
  arquivo?: string;
  volume: number;
  fade_entrada: number;
  fade_saida: number;
  /**
   * Velocidade de reprodução. 1 = normal.
   *
   * Precisa existir aqui, e não só na cena: um clipe vinculado a um bloco
   * acelerado tem que consumir a fonte no mesmo ritmo que a imagem. Sem isto,
   * um único bloco em 1,4x dessincronizava o vídeo inteiro dali pra frente.
   */
  velocidade?: number;
  /** Id da cena que este clipe acompanha. null = solto. */
  vinculado_a: string | null;
  nota?: string;
};

import type { Camada } from "./camadas";
export type { Camada } from "./camadas";

export type Roteiro = {
  versao: number;
  /**
   * Carimbo do último processamento da mídia.
   *
   * Vira `?v=` na URL do proxy de preview. Sem ele, o navegador serve o vídeo
   * antigo do cache depois que o motor reprocessa o material — o arquivo muda,
   * a URL não, e o editor mostra o passado sem avisar.
   */
  versao_midia?: string | number | null;
  projeto: string;
  fps: number;
  largura: number;
  altura: number;
  fontes: {
    camera?: Fonte | null;
    tela?: Fonte | null;
  };
  audio: {
    /**
     * Áudio da FONTE INTEIRA, já tratado — não pré-cortado.
     * Cada cena busca o pedaço dela, igual ao vídeo, pra que um corte no
     * editor mova imagem e som juntos.
     */
    arquivo: string;
    /** Versão comprimida, usada só no preview do editor. */
    arquivo_preview?: string;
    /** JSON com os picos, pra desenhar a forma de onda na timeline. */
    picos?: string;
    /** Deslocamento de sincronia da fonte de áudio (segundos). */
    offset?: number;
  };
  cenas: Cena[];
  /**
   * Trilha de áudio. Ausente = modo antigo (som soldado às cenas), mantido pra
   * roteiros gravados antes desta mudança.
   */
  trilha_audio?: ClipeAudio[];
  legendas: Legendas;
  /**
   * A pilha de camadas — texto, forma, imagem e vídeo flutuante.
   *
   * Ausente num projeto antigo: aí `camadasDoRoteiro` traduz `overlays` e
   * `imagens` na leitura. Presente, é ela que manda.
   */
  camadas?: Camada[];
  /** @deprecated Modelo antigo. Lido pra migrar; não escrever mais. */
  overlays: Overlay[];
  /** @deprecated Modelo antigo. Vira camada de imagem na migração. */
  imagens?: Imagem[];
  musica?: Musica | null;
  /**
   * Momentos marcados, no relógio da FONTE — mesma base das palavras e das
   * cenas. Guardar em tempo final faria a bandeirinha escorregar do momento
   * que você marcou assim que qualquer bloco fosse aparado.
   */
  marcadores?: { t: number; texto: string }[];
};

/** Estilo da marca — vive em config/estilo.json. */
export type Estilo = {
  nome: string;
  cores: {
    fundo: string;
    destaque: string;
    texto: string;
    texto_sombra: string;
    borda: string;
  };
  fonte: {
    familia: string;
    peso: number;
    tamanho_legenda: number; // px em relação a uma tela de 1080p
    tamanho_titulo: number;
    caixa_alta: boolean;
  };
  pip: {
    escala_padrao: number;
    raio: number;
    borda: number;
    margem: number; // distância da borda do quadro, em px
    sombra: boolean;
  };
  animacao: {
    /** Rigidez da mola. Maior = mais rápido e seco. */
    mola_rigidez: number;
    mola_amortecimento: number;
    duracao_padrao: number; // segundos
  };
  legenda: {
    posicao_y: number; // 0 a 1
    max_palavras: number; // quantas palavras por vez na tela
    fundo: boolean;
    contorno: number; // espessura do contorno em px
  };
};

export type PropsVideo = {
  roteiro: Roteiro;
  estilo: Estilo;
  /** Pasta dentro de estudio/public onde estão as mídias. */
  pasta: string;
};
