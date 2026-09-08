/**
 * SupremoCut — converte o modelo antigo de overlays para camadas.
 *
 * POR QUE CONVERTER NA LEITURA, E NÃO NO ARQUIVO
 *
 * Existem treze projetos gravados no disco com o modelo antigo, e doze deles
 * já viraram MP4 entregue. Reescrever esses arquivos seria trocar o histórico
 * por uma tradução minha — e se a tradução estivesse errada, não haveria
 * original pra comparar.
 *
 * Então a conversão acontece toda vez que o roteiro é lido. O arquivo no disco
 * só muda quando o usuário salva de fato, e aí já salva no modelo novo.
 *
 * O QUE É DIFÍCIL AQUI
 *
 * Os overlays antigos posicionavam por FLUXO: a barra vinha primeiro, o texto
 * grande depois dela, e a segunda linha depois do texto grande. Nenhum deles
 * tinha coordenada própria — cada um caía onde o anterior tivesse terminado.
 *
 * Camadas têm posição absoluta. Traduzir fluxo em coordenada exige saber a
 * ALTURA do texto grande, que depende de em quantas linhas ele quebra, que
 * depende da largura de cada letra na fonte escolhida. Um navegador sabe isso;
 * um arquivo TypeScript, não.
 *
 * A saída é a estimativa documentada em `linhasDoTexto`, conferida contra
 * quadros renderizados ANTES da migração. Onde ela erra, o valor é corrigido à
 * mão no projeto — e passa a ser um número explícito, que é justamente o ganho
 * de sair do fluxo.
 */

import { TARJA_PADRAO, type Estilo, type Overlay, type Imagem } from "./tipos";
import type { Camada, CamadaForma, CamadaTexto } from "./camadas";

/**
 * Quantas linhas um texto ocupa numa caixa de certa largura.
 *
 * A conta é `caracteres × fator × corpo ÷ largura`. O `fator` é a largura média
 * de uma letra em relação ao corpo da fonte — 0,58 em caixa mista e 0,62 em
 * caixa alta, porque maiúscula é mais larga.
 *
 * É estimativa, e assumidamente. Foi conferida contra os cinco letterings do
 * Reels da Super San renderizados antes da migração, e acertou os cinco. Numa
 * fonte muito estreita (Teko) ou muito larga (Impact) ela vai errar — e errar
 * aqui significa a segunda linha alta ou baixa demais, não o vídeo quebrado.
 */
export const linhasDoTexto = (
  texto: string,
  corpoPx: number,
  larguraPx: number,
  caixaAlta: boolean,
): number => {
  if (!texto || larguraPx <= 0) return 1;
  const fator = caixaAlta ? 0.62 : 0.58;
  return Math.max(1, Math.ceil((texto.length * fator * corpoPx) / larguraPx));
};

let semente = 0;
const novoId = (prefixo: string) => `${prefixo}_${(semente++).toString(36)}`;

const textoBase = (): Omit<CamadaTexto, "id" | "inicio" | "duracao" | "texto" | "x" | "y"> => ({
  tipo: "texto",
  largura: 0.84,
  tamanho: 48,
  peso: 700,
  cor: "#FFFFFF",
  alinhamento: "esquerda",
  caixa_alta: false,
  entrelinha: 1.15,
  contorno: 0,
  sombra: true,
});

/**
 * Converte um overlay antigo em uma ou mais camadas.
 *
 * A ordem devolvida importa: o que vem primeiro fica ATRÁS. Por isso a barra e
 * a caixa de tarja saem antes do texto que mora em cima delas.
 */
const doOverlay = (
  o: Overlay,
  estilo: Estilo,
  largura: number,
  altura: number,
): Camada[] => {
  const escala = altura / 1080;
  const t = { inicio: o.inicio, duracao: o.duracao };

  if (o.tipo === "lower_third") {
    const x = o.posicao?.x ?? 0.07;
    const y = o.posicao?.y ?? 0.76;
    const larguraCaixaPx = largura * (1 - x);

    // a barra: 220x6 px @1080, com 14 de respiro embaixo
    const barra: CamadaForma = {
      id: novoId("forma"),
      ...t,
      tipo: "forma",
      nome: "barra do lettering",
      x,
      y,
      largura: (220 * escala) / largura,
      altura: (6 * escala) / altura,
      cor: estilo.cores.destaque,
      raio: 999,
      entrada: { tipo: "abrir", duracao: 0.5 },
    };

    const yGrande = y + ((6 + 14) * escala) / altura;
    const corpoGrande = 62;
    const linhas = linhasDoTexto(o.texto, corpoGrande * escala, larguraCaixaPx, false);
    const alturaGrandePx = linhas * corpoGrande * 1.02 * escala;

    const grande: CamadaTexto = {
      ...textoBase(),
      id: novoId("txt"),
      ...t,
      texto: o.texto,
      nome: o.texto,
      x,
      y: yGrande,
      largura: 1 - x,
      tamanho: corpoGrande,
      peso: 800,
      entrelinha: 1.02,
      cor: estilo.cores.texto,
      entrada: { tipo: "deslizar", duracao: 0.5 },
    };

    const camadas: Camada[] = [barra, grande];

    if (o.subtexto) {
      camadas.push({
        ...textoBase(),
        id: novoId("txt"),
        ...t,
        texto: o.subtexto,
        nome: o.subtexto,
        x,
        y: yGrande + (alturaGrandePx + 3 * escala) / altura,
        largura: 1 - x,
        tamanho: 32,
        peso: 500,
        entrelinha: 1.15,
        cor: estilo.cores.texto,
        opacidade: 0.82,
        entrada: { tipo: "deslizar", duracao: 0.5 },
      });
    }
    return camadas;
  }

  if (o.tipo === "titulo") {
    /*
      O título antigo era centralizado pelo próprio navegador, nos dois eixos.

      A primeira tradução calculou o Y a partir da altura estimada do bloco — e
      errou: quatro linhas de estimativa não caem no mesmo lugar que quatro
      linhas medidas de verdade, e o fecho subiu alguns pixels. Por isso existe
      a âncora `centro`: em vez de eu adivinhar a altura, o navegador continua
      centrando, e o Y guarda o CONCEITO ("no meio") em vez de um número que
      só valia pra aquele texto.
    */
    return [
      {
        ...textoBase(),
        id: novoId("txt"),
        ...t,
        texto: o.texto,
        nome: o.texto,
        x: 0.1,
        y: 0.5,
        ancora: "centro",
        largura: 0.8,
        tamanho: estilo.fonte.tamanho_titulo,
        peso: 800,
        alinhamento: "centro",
        caixa_alta: estilo.fonte.caixa_alta,
        // 0 = a natural da fonte, que é o que o título antigo usava
        entrelinha: 0,
        // o antigo apertava as letras; sem isto o título sai mais largo
        espacamento: -0.02,
        cor: estilo.cores.texto,
        entrada: { tipo: "subir", duracao: 0.5 },
      },
    ];
  }

  if (o.tipo === "tarja") {
    const c = { ...TARJA_PADRAO, ...(o.caixa ?? {}) };
    const x = o.posicao?.x ?? 0.02;
    const y = o.posicao?.y ?? 0.7;
    const larg = o.tamanho?.largura ?? 0.96;
    const alt = o.tamanho?.altura ?? 0.135;
    const caixa: CamadaForma = {
      id: novoId("forma"),
      ...t,
      tipo: "forma",
      nome: "tarja",
      x,
      y,
      largura: larg,
      altura: alt,
      cor: c.cor,
      raio: c.raio,
      // a caixa NÃO aparece nem some: cobertura que esmaece deixa ver o que
      // deveria estar tapado, e foi assim que a legenda russa reapareceu
      entrada: { tipo: "nenhuma", duracao: 0 },
      saida: { tipo: "nenhuma", duracao: 0 },
    };
    if (!o.texto) return [caixa];
    return [
      caixa,
      {
        ...textoBase(),
        id: novoId("txt"),
        ...t,
        texto: o.texto,
        nome: o.texto,
        x,
        // centrado na caixa pela âncora, não por uma altura que eu estimaria:
        // a tarja usava `align-items: center` e o navegador acertava sozinho
        y: y + alt / 2,
        ancora: "centro",
        largura: larg,
        tamanho: c.tamanho_texto,
        peso: c.peso,
        alinhamento: c.alinhamento,
        caixa_alta: c.caixa_alta,
        cor: c.cor_texto,
        contorno: c.contorno,
        sombra: false,
        // rampa curta nas duas pontas: quando uma tarja emenda na outra, a
        // caixa fica firme e só a frase troca
        entrada: { tipo: "surgir", duracao: 0.15 },
        saida: { tipo: "sumir", duracao: 0.15 },
      },
    ];
  }

  if (o.tipo === "destaque") {
    const y = o.posicao?.y ?? 0.12;
    return [
      {
        ...textoBase(),
        id: novoId("txt"),
        ...t,
        texto: o.texto,
        nome: o.texto,
        x: 0.1,
        y,
        largura: 0.8,
        tamanho: 54,
        peso: 800,
        alinhamento: "centro",
        cor: "#0b0b0d",
        sombra: false,
        entrada: { tipo: "surgir", duracao: 0.5 },
      },
    ];
  }

  // marca
  return [
    {
      ...textoBase(),
      id: novoId("txt"),
      ...t,
      texto: o.texto,
      nome: o.texto,
      x: o.posicao?.x ?? 0.04,
      y: o.posicao?.y ?? 0.05,
      largura: 0.5,
      tamanho: 34,
      peso: 700,
      opacidade: 0.72,
      cor: estilo.cores.texto,
      entrada: { tipo: "surgir", duracao: 0.5 },
    },
  ];
};

const daImagem = (i: Imagem): Camada => ({
  id: i.id,
  inicio: i.inicio,
  duracao: i.duracao,
  tipo: "imagem",
  nome: i.nota || i.arquivo,
  arquivo: i.arquivo,
  x: i.x,
  y: i.y,
  largura: i.largura,
  raio: i.raio,
  sombra: i.sombra,
  opacidade: i.opacidade,
  rotacao: i.rotacao,
});

/**
 * Devolve as camadas de um roteiro, venha ele no modelo novo ou no antigo.
 *
 * Se `camadas` já existe, é ela que vale — projeto já migrado não é convertido
 * de novo, senão uma edição do usuário seria desfeita a cada abertura.
 */
export const camadasDoRoteiro = (
  roteiro: {
    camadas?: Camada[];
    overlays?: Overlay[];
    imagens?: Imagem[];
    largura: number;
    altura: number;
  },
  estilo: Estilo,
): Camada[] => {
  if (roteiro.camadas) return roteiro.camadas;
  semente = 0;
  const saida: Camada[] = [];
  for (const o of roteiro.overlays ?? []) {
    saida.push(...doOverlay(o, estilo, roteiro.largura, roteiro.altura));
  }
  for (const i of roteiro.imagens ?? []) saida.push(daImagem(i));
  return saida;
};
