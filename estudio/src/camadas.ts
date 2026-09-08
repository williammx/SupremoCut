/**
 * SupremoCut — as camadas que ficam por cima do vídeo.
 *
 * POR QUE ISTO EXISTE
 *
 * O modelo antigo tinha "overlays" compostos: um `lower_third` era UM objeto
 * que desenhava três coisas — uma barra colorida, um texto grande e um texto
 * pequeno. Prático pra criar, impossível de editar: pra mover só a barra, ou
 * dar outra cor só à segunda linha, não havia onde clicar. E os três nasciam e
 * morriam juntos, no mesmo instante, no mesmo lugar.
 *
 * Aqui cada coisa na tela é uma CAMADA independente, de um dos quatro tipos
 * primitivos: texto, forma, imagem e vídeo. Um lower third deixa de ser um tipo
 * e passa a ser um ARRANJO — três camadas que um atalho cria de uma vez, e que
 * depois vivem separadas.
 *
 * A ORDEM É O EMPILHAMENTO
 *
 * A posição na lista decide quem fica na frente: o ÚLTIMO da lista desenha por
 * cima de todos. É a convenção do `z-index` do CSS e a da linha do tempo de
 * qualquer editor, só que ali a lista aparece invertida — a camada de cima da
 * pilha é a primeira linha que se lê.
 *
 * O vídeo montado (as `cenas`) continua sendo o fundo, sempre atrás de tudo.
 * Um vídeo que precise flutuar POR CIMA de outra coisa entra como camada
 * `video`, que é um arquivo solto e não participa do corte.
 */

/** Segundos em relógio FINAL — posição no vídeo montado, não na fonte. */
type Segundos = number;

/** De 0 a 1 do quadro, pra sobreviver a qualquer resolução de saída. */
type Fracao = number;

type Comum = {
  id: string;
  inicio: Segundos;
  duracao: Segundos;
  /** O que aparece na linha do tempo. Vazio = o motor inventa um. */
  nome?: string;
  /** Desligada continua na lista e some da tela. */
  oculta?: boolean;
  /** Travada não se move nem se apaga por acidente. */
  travada?: boolean;
  opacidade?: number;
  rotacao?: number;
};

export type CamadaTexto = Comum & {
  tipo: "texto";
  texto: string;
  x: Fracao;
  y: Fracao;
  /**
   * Largura máxima da caixa. É o que faz a frase QUEBRAR em vez de sair pela
   * borda — o defeito que fez "Presença em mais de" vazar da tela.
   */
  largura: Fracao;
  /** px pensados para 1080 de largura; o motor reescala. */
  tamanho: number;
  peso: number;
  /**
   * Fonte só desta camada. Vazio herda a do projeto.
   *
   * A fonte era uma só pro vídeo inteiro, o que basta enquanto todo texto é da
   * mesma família. Deixa de bastar no primeiro lettering de verdade: título num
   * display pesado e o subtítulo numa grotesca de leitura é o arranjo mais
   * comum que existe, e não dava pra montar.
   *
   * Herdar por omissão é o que mantém a troca de fonte do projeto valendo pra
   * quem não pediu nada — trocar a fonte do vídeo continua trocando tudo, menos
   * as camadas que escolheram a sua.
   */
  fonte?: string;
  cor: string;
  alinhamento: "esquerda" | "centro" | "direita";
  caixa_alta: boolean;
  /**
   * Multiplicador da altura da linha. 1.02 é o aperto de lettering.
   *
   * ZERO significa "a padrão da fonte". Não é um valor mágico por preguiça: a
   * entrelinha natural de uma fonte sai das métricas dela (ascendente,
   * descendente, entrelinha embutida) e não é 1,2 nem nenhum número redondo.
   * Fixar 1,2 num título deslocava o bloco inteiro alguns pixels em relação ao
   * que o navegador faria sozinho.
   */
  entrelinha: number;
  /** Espaçamento entre letras, em `em`. Negativo aperta. */
  espacamento?: number;
  /**
   * O que o `y` significa.
   *
   * `topo` é o normal: y é a borda de cima do bloco. `centro` mantém o bloco
   * centrado NAQUELE y — e existe porque um título centralizado precisa
   * continuar centralizado quando o texto muda de duas pra três linhas. Com
   * `topo`, cada edição de texto exigiria recalcular a posição à mão.
   */
  ancora?: "topo" | "centro";
  /** Contorno escuro atrás, pra ler sobre qualquer imagem. */
  contorno: number;
  sombra: boolean;
  /**
   * Pedaços do texto com cor própria — a palavra em destaque.
   *
   * Ausente ou vazio significa "tudo na cor da camada", que é o que TODA
   * camada de texto que já existe tem. Por isso o campo é opcional: nenhum
   * projeto precisa ser convertido.
   */
  trechos?: TrechoTexto[];
  entrada?: EntradaCamada;
  saida?: SaidaCamada;
};

/**
 * Uma faixa do texto com cor diferente.
 *
 * POR QUE ÍNDICE, E NÃO A PALAVRA
 *
 * Guardar a palavra ("GRANDES") seria mais simples de ler, e erraria toda vez
 * que a palavra aparecesse duas vezes na mesma frase. Índice diz exatamente
 * QUAL das duas — que é o que o usuário selecionou com o mouse.
 *
 * `inicio` é inclusivo, `fim` é exclusivo: as mesmas bordas que o campo de
 * texto do navegador usa em `selectionStart`/`selectionEnd`, pra não haver
 * conversão (nem erro de ±1) entre selecionar e guardar.
 *
 * Os índices são do texto CRU, antes do CAIXA ALTA. A caixa alta é `text-
 * transform` no CSS: muda o desenho, não a string — então a contagem continua
 * valendo.
 */
export type TrechoTexto = {
  inicio: number;
  fim: number;
  cor: string;
};

export type CamadaForma = Comum & {
  tipo: "forma";
  x: Fracao;
  y: Fracao;
  largura: Fracao;
  altura: Fracao;
  cor: string;
  /** px @1080. Um valor alto vira pílula. */
  raio: number;
  /**
   * Degradê que vai de `cor` até transparente. Ausente = cor chapada.
   *
   * PRA QUE SERVE
   *
   * É o véu de leitura: uma mancha escura que desce até sumir, entre o vídeo e
   * o texto. Sem ela, um lettering branco sobre concreto claro some. Com uma
   * caixa chapada, some o vídeo. O degradê resolve os dois — escurece onde o
   * texto está e devolve a imagem logo acima.
   *
   * A cor é UMA só, e o degradê é no ALFA. Dois pontos de cor dariam mais
   * liberdade e abririam a porta pro degradê que chama atenção pra si; aqui a
   * peça existe pra não ser notada.
   */
  degrade?: DegradeForma;
  entrada?: EntradaCamada;
  saida?: SaidaCamada;
};

export type DegradeForma = {
  /**
   * Pra onde o degradê ESMAECE.
   *
   * "cima" é o caso do véu de rodapé: cheio embaixo, transparente em cima.
   */
  sentido: "cima" | "baixo" | "esquerda" | "direita";
  /** Opacidade na ponta cheia, de 0 a 1. A outra ponta é sempre 0. */
  opacidade: number;
};

export type CamadaImagem = Comum & {
  tipo: "imagem";
  /** Dentro de estudio/public/<projeto>/imagens/. */
  arquivo: string;
  x: Fracao;
  y: Fracao;
  /** A altura sai da proporção original do arquivo. */
  largura: Fracao;
  raio: number;
  sombra: boolean;
  entrada?: EntradaCamada;
  saida?: SaidaCamada;
};

export type CamadaVideo = Comum & {
  tipo: "video";
  /** Dentro de estudio/public/<projeto>/. */
  arquivo: string;
  arquivo_preview?: string;
  /** Segundo do arquivo onde a camada começa a tocar. */
  fonte_inicio: Segundos;
  x: Fracao;
  y: Fracao;
  largura: Fracao;
  raio: number;
  volume: number;
  entrada?: EntradaCamada;
  saida?: SaidaCamada;
};

export type Camada = CamadaTexto | CamadaForma | CamadaImagem | CamadaVideo;

/**
 * Como a camada entra na tela.
 *
 * Fica no tipo base porque vale pros quatro: uma barra que abre da esquerda e
 * um texto que sobe são o mesmo gesto aplicado a coisas diferentes.
 */
export type EntradaCamada = {
  tipo: "nenhuma" | "surgir" | "subir" | "deslizar" | "abrir";
  /** Segundos que o gesto leva. */
  duracao: number;
};

/**
 * Como a camada sai.
 *
 * Existe separada da entrada porque há um caso em que a diferença é o que faz o
 * vídeo funcionar: a TARJA que cobre legenda queimada. Ela não pode esmaecer no
 * fim — uma cobertura que some não cobre, e o texto em russo reaparece por
 * baixo bem no meio do anúncio. A primeira versão deste modelo aplicava o
 * esmaecer a tudo e trouxe o defeito de volta.
 */
export type SaidaCamada = {
  tipo: "nenhuma" | "sumir";
  duracao: number;
};

export const ENTRADA_PADRAO: EntradaCamada = { tipo: "surgir", duracao: 0.45 };
export const SAIDA_PADRAO: SaidaCamada = { tipo: "sumir", duracao: 0.4 };

/** Rótulo curto pra linha do tempo, quando a camada não tem nome próprio. */
export const nomeDaCamada = (c: Camada): string => {
  if (c.nome) return c.nome;
  switch (c.tipo) {
    case "texto":
      return c.texto || "texto";
    case "forma":
      return "forma";
    case "imagem":
      return c.arquivo;
    case "video":
      return c.arquivo;
  }
};

/**
 * Quanto de `z-index` cada camada recebe.
 *
 * O fundo (as cenas de vídeo) vive abaixo de 100; as camadas começam em 100 e
 * sobem de 10 em 10. O passo largo deixa espaço pra encaixar coisa entre duas
 * sem renumerar tudo — por exemplo o contorno de um texto, que é desenhado
 * junto e precisa ficar logo atrás dele.
 */
export const BASE_Z = 100;
export const zDaCamada = (indice: number): number => BASE_Z + indice * 10;
