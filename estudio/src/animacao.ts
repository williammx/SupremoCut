/**
 * SupremoCut — Motor de animação
 *
 * Este arquivo é a peça que faltava. Antes dele, cada efeito precisava de
 * código próprio: a transição de entrada tinha o dela, o zoom tinha o dele, e
 * nada mais se mexia. Depois dele, "mexer alguma coisa no tempo" virou um
 * registro numa lista — e efeito novo é dado, não código.
 *
 * As três regras que valem em tudo aqui:
 *
 * 1. `t` de uma chave são segundos contados do COMEÇO DO BLOCO. Não é o
 *    relógio da fonte nem o do vídeo final. É a mesma régua que `congelar` já
 *    usava. Assim, aparar a ponta esquerda faz a animação acompanhar a nova
 *    borda em vez de ficar presa a um ponto do bruto que ninguém mais vê.
 *
 * 2. Quem tem animação ignora o valor parado. Ter os dois valendo ao mesmo
 *    tempo produz aquele bug em que o usuário arrasta um controle e nada
 *    acontece porque outra coisa está mandando.
 *
 * 3. Fora do intervalo das chaves o valor SEGURA na primeira/última. Nunca
 *    extrapola. Extrapolação vira zoom de 400% quando o usuário apara um bloco.
 */

import type { Animacao, Ajustes, Chave, Mesclagem, PropriedadeAnimada } from "./tipos";
import { AJUSTES_NEUTROS } from "./tipos";

// ---------------------------------------------------------------------------
// Curvas
// ---------------------------------------------------------------------------

/** Acelera e desacelera. É o que o olho lê como natural. */
const suave = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * Passa do ponto e volta. Amortecida o bastante pra não parecer defeito.
 *
 * Fórmula fechada em vez de simulação: é avaliada uma vez por quadro por
 * propriedade, e simular uma mola aqui pesaria à toa.
 *
 * O seno e o sinal de mais NÃO são intercambiáveis com cosseno e menos. A
 * primeira versão usava `1 - 2^(-10p)·cos(…)` e dava mola(0) = 1: a animação
 * já nascia no destino, depois afundava e voltava. Em vez de "chega e quica",
 * o olho via "pisca e escorrega". Vale conferir que mola(0) = 0 e mola(1) = 1
 * sempre que alguém mexer nesta linha.
 */
const mola = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

const CURVAS: Record<string, (p: number) => number> = {
  reta: (p) => p,
  suave,
  mola,
  degrau: () => 0, // só troca ao chegar na chave seguinte
};

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

/**
 * Onde esta propriedade está no instante `t` (segundos desde o começo do bloco).
 *
 * `padrao` é o que vale quando não há chave nenhuma — normalmente o valor
 * neutro da propriedade.
 */
export const valorEm = (chaves: Chave[], t: number, padrao: number): number => {
  if (!chaves || chaves.length === 0) return padrao;

  // A ordem é responsabilidade de quem grava, mas um roteiro editado na mão
  // pode chegar fora de ordem. Ordenar aqui custa pouco e evita um valor
  // saltando pra trás no meio da animação.
  const ord = chaves.length > 1 ? [...chaves].sort((a, b) => a.t - b.t) : chaves;

  if (t <= ord[0].t) return ord[0].valor;
  const ultima = ord[ord.length - 1];
  if (t >= ultima.t) return ultima.valor;

  for (let i = 0; i < ord.length - 1; i++) {
    const a = ord[i];
    const b = ord[i + 1];
    if (t < a.t || t > b.t) continue;

    const vao = b.t - a.t;
    // Duas chaves no mesmo instante: salta pro valor de destino em vez de
    // dividir por zero.
    if (vao <= 0) return b.valor;

    const bruto = (t - a.t) / vao;
    const curva = CURVAS[b.curva ?? "suave"] ?? suave;
    return a.valor + (b.valor - a.valor) * curva(bruto);
  }

  return ultima.valor;
};

/** Índice das animações por propriedade, pra não varrer a lista toda vez. */
export const indexar = (animacoes?: Animacao[]): Map<PropriedadeAnimada, Chave[]> => {
  const m = new Map<PropriedadeAnimada, Chave[]>();
  for (const a of animacoes ?? []) {
    if (a.chaves && a.chaves.length > 0) m.set(a.propriedade, a.chaves);
  }
  return m;
};

/** O conjunto completo de valores de um bloco num instante. */
export type Estado = {
  zoom: number;
  pos_x: number;
  pos_y: number;
  rotacao: number;
  opacidade: number;
  ajustes: Ajustes;
};

export const ESTADO_NEUTRO: Estado = {
  zoom: 1,
  pos_x: 0,
  pos_y: 0,
  rotacao: 0,
  opacidade: 1,
  ajustes: AJUSTES_NEUTROS,
};

/**
 * Resolve tudo de uma vez: parte dos valores parados e deixa a animação
 * sobrescrever propriedade por propriedade (regra 2 lá de cima).
 */
export const estadoEm = (
  t: number,
  parados: Ajustes | null | undefined,
  animacoes: Animacao[] | undefined,
): Estado => {
  const base = parados ?? AJUSTES_NEUTROS;
  if (!animacoes || animacoes.length === 0) {
    // Caminho rápido: a esmagadora maioria dos blocos não tem animação, e
    // este é chamado uma vez por quadro por bloco visível.
    return parados ? { ...ESTADO_NEUTRO, ajustes: base } : ESTADO_NEUTRO;
  }

  const ix = indexar(animacoes);
  const v = (p: PropriedadeAnimada, padrao: number) => {
    const ch = ix.get(p);
    return ch ? valorEm(ch, t, padrao) : padrao;
  };

  return {
    zoom: v("zoom", 1),
    pos_x: v("pos_x", 0),
    pos_y: v("pos_y", 0),
    rotacao: v("rotacao", 0),
    opacidade: v("opacidade", 1),
    ajustes: {
      brilho: v("brilho", base.brilho),
      contraste: v("contraste", base.contraste),
      saturacao: v("saturacao", base.saturacao),
      temperatura: v("temperatura", base.temperatura),
      desfoque: v("desfoque", base.desfoque),
      vinheta: v("vinheta", base.vinheta),
    },
  };
};

// ---------------------------------------------------------------------------
// Ajustes → CSS
// ---------------------------------------------------------------------------

/** Se este conjunto de ajustes muda alguma coisa. */
export const temAjuste = (a: Ajustes): boolean =>
  a.brilho !== 0 ||
  a.contraste !== 0 ||
  a.saturacao !== 0 ||
  a.temperatura !== 0 ||
  a.desfoque !== 0 ||
  a.vinheta !== 0;

/**
 * A string de `filter` do CSS.
 *
 * Sai vazia quando nada foi mexido — e isso importa: um `filter` presente,
 * mesmo neutro, cria uma camada de composição nova no Chrome e derruba a
 * fluidez do preview sem nenhum ganho visual.
 *
 * Temperatura não vira filtro: não existe filtro CSS de temperatura de cor.
 * Ela sai como uma camada de cor por cima, em `camadaTemperatura()`.
 */
export const filtroCss = (a: Ajustes, escala = 1): string => {
  const partes: string[] = [];
  if (a.brilho !== 0) partes.push(`brightness(${(1 + a.brilho).toFixed(3)})`);
  if (a.contraste !== 0) partes.push(`contrast(${(1 + a.contraste).toFixed(3)})`);
  if (a.saturacao !== 0) partes.push(`saturate(${(1 + a.saturacao).toFixed(3)})`);
  if (a.desfoque > 0) partes.push(`blur(${(a.desfoque * escala).toFixed(2)}px)`);
  return partes.join(" ");
};

/**
 * A camada de cor da temperatura.
 *
 * `soft-light` em vez de `overlay` de propósito: aquece sem estourar o branco
 * nem afundar o preto, que é o que se espera de um ajuste de temperatura.
 * Devolve null quando não há o que fazer.
 */
export const camadaTemperatura = (
  a: Ajustes,
): { backgroundColor: string; mixBlendMode: "soft-light" } | null => {
  if (a.temperatura === 0) return null;
  const f = Math.min(1, Math.abs(a.temperatura));
  const cor = a.temperatura > 0 ? `rgba(255, 164, 66, ${f * 0.55})` : `rgba(66, 150, 255, ${f * 0.55})`;
  return { backgroundColor: cor, mixBlendMode: "soft-light" };
};

/** O gradiente da vinheta, ou null. */
export const vinhetaCss = (a: Ajustes): string | null => {
  if (a.vinheta <= 0) return null;
  const f = Math.min(1, a.vinheta);
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) ${(58 - f * 18).toFixed(
    0,
  )}%, rgba(0,0,0,${(f * 0.85).toFixed(3)}) 100%)`;
};

// ---------------------------------------------------------------------------
// Presets — o catálogo que o usuário realmente enxerga
// ---------------------------------------------------------------------------

/**
 * Um preset recebe a duração do bloco e devolve as animações prontas.
 *
 * Precisa da duração porque metade deles é relativa ao bloco inteiro: um
 * "aproximar devagar" tem que terminar exatamente no fim do bloco, seja ele de
 * 2 ou de 20 segundos.
 */
export type Preset = {
  id: string;
  nome: string;
  /** Uma frase, sem jargão — é isto que o usuário lê pra escolher. */
  descricao: string;
  grupo: "entrada" | "movimento" | "saida" | "enfase";
  gerar: (duracao: number) => Animacao[];
};

/** Uma entrada dura no máximo isto, mesmo em bloco longo. */
const ENTRADA = (d: number) => Math.min(0.6, d * 0.4);
const SAIDA = (d: number) => Math.min(0.6, d * 0.4);

export const PRESETS: Preset[] = [
  // ---- entrada ------------------------------------------------------------
  {
    id: "aparecer",
    nome: "Aparecer suave",
    descricao: "Surge do transparente. Serve pra quase tudo.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "opacidade",
        chaves: [
          { t: 0, valor: 0 },
          { t: ENTRADA(d), valor: 1, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "crescer",
    nome: "Crescer",
    descricao: "Nasce pequeno e cresce até o tamanho certo.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [
          { t: 0, valor: 0.82 },
          { t: ENTRADA(d) * 1.4, valor: 1, curva: "mola" },
        ],
      },
      {
        propriedade: "opacidade",
        chaves: [
          { t: 0, valor: 0 },
          { t: ENTRADA(d) * 0.7, valor: 1, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "deslizar_dir",
    nome: "Deslizar da direita",
    descricao: "Entra vindo da direita e freia no lugar.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "pos_x",
        chaves: [
          { t: 0, valor: 1 },
          { t: ENTRADA(d) * 1.3, valor: 0, curva: "mola" },
        ],
      },
    ],
  },
  {
    id: "deslizar_esq",
    nome: "Deslizar da esquerda",
    descricao: "Entra vindo da esquerda e freia no lugar.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "pos_x",
        chaves: [
          { t: 0, valor: -1 },
          { t: ENTRADA(d) * 1.3, valor: 0, curva: "mola" },
        ],
      },
    ],
  },
  {
    id: "subir",
    nome: "Subir de baixo",
    descricao: "Sobe entrando pelo rodapé. Bom pra selo de oferta.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "pos_y",
        chaves: [
          { t: 0, valor: 0.55 },
          { t: ENTRADA(d) * 1.3, valor: 0, curva: "mola" },
        ],
      },
      {
        propriedade: "opacidade",
        chaves: [
          { t: 0, valor: 0 },
          { t: ENTRADA(d) * 0.6, valor: 1, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "cair",
    nome: "Cair com peso",
    descricao: "Despenca de cima e quica ao parar. Chama atenção.",
    grupo: "entrada",
    gerar: (d) => [
      {
        propriedade: "pos_y",
        chaves: [
          { t: 0, valor: -0.7 },
          { t: ENTRADA(d) * 1.6, valor: 0, curva: "mola" },
        ],
      },
    ],
  },

  // ---- movimento contínuo -------------------------------------------------
  {
    id: "aproximar",
    nome: "Aproximar devagar",
    descricao: "Fecha lentamente durante o bloco inteiro. Dá vida a plano parado.",
    grupo: "movimento",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [
          { t: 0, valor: 1 },
          { t: d, valor: 1.14, curva: "reta" },
        ],
      },
    ],
  },
  {
    id: "afastar",
    nome: "Afastar devagar",
    descricao: "Começa perto e abre. Bom pra revelar o cenário.",
    grupo: "movimento",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [
          { t: 0, valor: 1.14 },
          { t: d, valor: 1, curva: "reta" },
        ],
      },
    ],
  },
  {
    id: "panoramica",
    nome: "Panorâmica lateral",
    descricao: "Desliza de lado bem devagar, com um leve zoom pra não mostrar borda.",
    grupo: "movimento",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [{ t: 0, valor: 1.12 }],
      },
      {
        propriedade: "pos_x",
        chaves: [
          { t: 0, valor: -0.045 },
          { t: d, valor: 0.045, curva: "reta" },
        ],
      },
    ],
  },
  {
    id: "balanco",
    nome: "Balanço suave",
    descricao: "Vai e volta de leve, como câmera na mão. Tira o ar de foto parada.",
    grupo: "movimento",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [{ t: 0, valor: 1.06 }],
      },
      {
        propriedade: "pos_x",
        chaves: [
          { t: 0, valor: -0.012 },
          { t: d / 2, valor: 0.012, curva: "suave" },
          { t: d, valor: -0.012, curva: "suave" },
        ],
      },
      {
        propriedade: "rotacao",
        chaves: [
          { t: 0, valor: -0.5 },
          { t: d / 2, valor: 0.5, curva: "suave" },
          { t: d, valor: -0.5, curva: "suave" },
        ],
      },
    ],
  },

  // ---- ênfase -------------------------------------------------------------
  {
    id: "soco",
    nome: "Soco",
    descricao: "Estoura grande e recolhe num tranco. É o gancho dos 3 segundos.",
    grupo: "enfase",
    gerar: () => [
      {
        propriedade: "zoom",
        chaves: [
          { t: 0, valor: 1.3 },
          { t: 0.42, valor: 1, curva: "mola" },
        ],
      },
    ],
  },
  {
    id: "pulsar",
    nome: "Pulsar",
    descricao: "Respira: cresce e volta sem parar. Bom pra selo de preço.",
    grupo: "enfase",
    gerar: (d) => {
      const chaves: Chave[] = [];
      const ciclo = 1.1;
      for (let t = 0; t <= d + ciclo; t += ciclo / 2) {
        chaves.push({
          t: Math.min(t, d),
          valor: chaves.length % 2 === 0 ? 1 : 1.055,
          curva: "suave",
        });
        if (t >= d) break;
      }
      return [{ propriedade: "zoom", chaves }];
    },
  },
  {
    id: "tremer",
    nome: "Tremida",
    descricao: "Chacoalha por um instante. Marca impacto ou urgência.",
    grupo: "enfase",
    gerar: () => [
      {
        propriedade: "pos_x",
        chaves: [
          { t: 0, valor: 0 },
          { t: 0.05, valor: 0.016, curva: "reta" },
          { t: 0.1, valor: -0.014, curva: "reta" },
          { t: 0.15, valor: 0.01, curva: "reta" },
          { t: 0.2, valor: -0.006, curva: "reta" },
          { t: 0.26, valor: 0, curva: "reta" },
        ],
      },
      {
        propriedade: "rotacao",
        chaves: [
          { t: 0, valor: 0 },
          { t: 0.07, valor: 1.1, curva: "reta" },
          { t: 0.14, valor: -0.9, curva: "reta" },
          { t: 0.26, valor: 0, curva: "reta" },
        ],
      },
      {
        propriedade: "zoom",
        chaves: [
          { t: 0, valor: 1.04 },
          { t: 0.26, valor: 1, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "piscar_luz",
    nome: "Estouro de luz",
    descricao: "Clareia forte e volta ao normal. Corte de impacto.",
    grupo: "enfase",
    gerar: () => [
      {
        propriedade: "brilho",
        chaves: [
          { t: 0, valor: 0.85 },
          { t: 0.3, valor: 0, curva: "suave" },
        ],
      },
      {
        propriedade: "contraste",
        chaves: [
          { t: 0, valor: -0.25 },
          { t: 0.3, valor: 0, curva: "suave" },
        ],
      },
    ],
  },

  // ---- saída --------------------------------------------------------------
  {
    id: "sumir",
    nome: "Sumir no fim",
    descricao: "Desaparece nos últimos instantes do bloco.",
    grupo: "saida",
    gerar: (d) => [
      {
        propriedade: "opacidade",
        chaves: [
          { t: Math.max(0, d - SAIDA(d)), valor: 1 },
          { t: d, valor: 0, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "encolher",
    nome: "Encolher e sumir",
    descricao: "Diminui enquanto desaparece.",
    grupo: "saida",
    gerar: (d) => [
      {
        propriedade: "zoom",
        chaves: [
          { t: Math.max(0, d - SAIDA(d)), valor: 1 },
          { t: d, valor: 0.86, curva: "suave" },
        ],
      },
      {
        propriedade: "opacidade",
        chaves: [
          { t: Math.max(0, d - SAIDA(d)), valor: 1 },
          { t: d, valor: 0, curva: "suave" },
        ],
      },
    ],
  },
  {
    id: "aparecer_sumir",
    nome: "Aparecer e sumir",
    descricao: "Entra suave no começo e sai suave no fim. O par completo.",
    grupo: "saida",
    gerar: (d) => [
      {
        propriedade: "opacidade",
        chaves: [
          { t: 0, valor: 0 },
          { t: ENTRADA(d), valor: 1, curva: "suave" },
          { t: Math.max(ENTRADA(d) + 0.05, d - SAIDA(d)), valor: 1 },
          { t: d, valor: 0, curva: "suave" },
        ],
      },
    ],
  },
];

export const PRESET_POR_ID = new Map(PRESETS.map((p) => [p.id, p]));

export const ROTULO_GRUPO: Record<Preset["grupo"], string> = {
  entrada: "Como entra",
  movimento: "Movimento durante",
  enfase: "Chamar atenção",
  saida: "Como sai",
};

/** Aplica um preset e devolve as animações. Id desconhecido = lista vazia. */
export const aplicarPreset = (id: string, duracao: number): Animacao[] => {
  const p = PRESET_POR_ID.get(id);
  if (!p) return [];
  // Bloco absurdamente curto quebraria presets que dividem a duração.
  return p.gerar(Math.max(0.1, duracao));
};

export const ROTULO_PROPRIEDADE: Record<PropriedadeAnimada, string> = {
  zoom: "Aproximação",
  pos_x: "Posição ↔",
  pos_y: "Posição ↕",
  rotacao: "Giro",
  opacidade: "Transparência",
  brilho: "Brilho",
  contraste: "Contraste",
  saturacao: "Saturação",
  temperatura: "Temperatura",
  desfoque: "Desfoque",
  vinheta: "Vinheta",
};

export const ROTULO_MESCLAGEM: Record<Mesclagem, string> = {
  normal: "Normal",
  multiply: "Multiplicar (escurece)",
  screen: "Clarear",
  overlay: "Sobrepor (contraste)",
  "soft-light": "Luz suave",
  "hard-light": "Luz forte",
  "color-dodge": "Estourar claro",
  "color-burn": "Queimar escuro",
  difference: "Diferença (inverte)",
  lighten: "Manter o mais claro",
  darken: "Manter o mais escuro",
};
