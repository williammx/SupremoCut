/**
 * SupremoCut — cor em pedaço de texto.
 *
 * Uma camada de texto tem UMA cor. Este arquivo é a exceção: faixas do texto
 * que saem em outra cor, pra destacar a palavra que importa sem ter que
 * quebrar a frase em três camadas e alinhar as três à mão.
 *
 * TUDO AQUI É FUNÇÃO PURA
 *
 * Nada de React, nada de DOM. É de propósito: o painel usa pra editar, o vídeo
 * usa pra desenhar, e o teste usa pra provar — os três exercitando o MESMO
 * código. Regra de faixa duplicada em dois lugares é regra que vai divergir.
 *
 * AS BORDAS
 *
 * `inicio` inclusivo, `fim` exclusivo, como `selectionStart`/`selectionEnd` do
 * campo de texto. Escolhido pra que "o que o usuário selecionou" e "o que a
 * gente guarda" sejam o mesmo par de números, sem conversão no meio.
 */

import type { TrechoTexto } from "./camadas";

/** Faixa vazia ou invertida não existe; fora do texto é cortada. */
const valida = (t: TrechoTexto, comprimento: number): TrechoTexto | null => {
  const inicio = Math.max(0, Math.min(Math.round(t.inicio), comprimento));
  const fim = Math.max(0, Math.min(Math.round(t.fim), comprimento));
  return fim > inicio ? { ...t, inicio, fim } : null;
};

/**
 * Põe em ordem, corta o que saiu do texto e junta vizinhas da mesma cor.
 *
 * Juntar importa porque pintar duas palavras seguidas, uma de cada vez, geraria
 * duas faixas coladas idênticas — e cada faixa vira um `<span>` no vídeo. Dois
 * spans onde cabia um mudam a quebra de linha em alguns navegadores.
 */
export const normalizar = (trechos: TrechoTexto[], comprimento: number): TrechoTexto[] => {
  const limpos = trechos
    .map((t) => valida(t, comprimento))
    .filter((t): t is TrechoTexto => t !== null)
    .sort((a, b) => a.inicio - b.inicio);

  const juntos: TrechoTexto[] = [];
  for (const t of limpos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && ultimo.cor === t.cor && ultimo.fim >= t.inicio) {
      ultimo.fim = Math.max(ultimo.fim, t.fim);
    } else {
      juntos.push({ ...t });
    }
  }
  return juntos;
};

/**
 * Aplica uma cor à faixa `[inicio, fim)`. `cor: null` devolve a faixa à cor da
 * camada.
 *
 * A faixa nova SEMPRE ganha: o que já estava pintado ali é recortado antes.
 * É o comportamento que qualquer editor de texto tem, e o único que não
 * surpreende quem pinta duas vezes o mesmo lugar.
 */
export const aplicar = (
  trechos: TrechoTexto[],
  inicio: number,
  fim: number,
  cor: string | null,
  comprimento: number,
): TrechoTexto[] => {
  const a = Math.min(inicio, fim);
  const b = Math.max(inicio, fim);
  if (b <= a) return normalizar(trechos, comprimento);

  const restantes: TrechoTexto[] = [];
  for (const t of trechos) {
    // pedaço que sobra à esquerda da faixa nova
    if (t.inicio < a) restantes.push({ ...t, fim: Math.min(t.fim, a) });
    // pedaço que sobra à direita
    if (t.fim > b) restantes.push({ ...t, inicio: Math.max(t.inicio, b) });
  }
  if (cor !== null) restantes.push({ inicio: a, fim: b, cor });

  return normalizar(restantes, comprimento);
};

/** Um pedaço já pronto pra virar `<span>`: texto e a cor com que sai. */
export type PedacoPintado = { texto: string; cor: string };

/**
 * Corta o texto nos pontos das faixas.
 *
 * Sem faixa nenhuma devolve UM pedaço com o texto inteiro — o caso de quase
 * todas as camadas, e o que garante que a mudança não altera em nada o que já
 * estava aprovado.
 */
export const pintar = (
  texto: string,
  corBase: string,
  trechos: TrechoTexto[] | undefined,
): PedacoPintado[] => {
  const faixas = normalizar(trechos ?? [], texto.length);
  if (faixas.length === 0) return [{ texto, cor: corBase }];

  const pedacos: PedacoPintado[] = [];
  let cursor = 0;
  for (const f of faixas) {
    if (f.inicio > cursor) pedacos.push({ texto: texto.slice(cursor, f.inicio), cor: corBase });
    pedacos.push({ texto: texto.slice(f.inicio, f.fim), cor: f.cor });
    cursor = f.fim;
  }
  if (cursor < texto.length) pedacos.push({ texto: texto.slice(cursor), cor: corBase });
  return pedacos;
};

/**
 * Reposiciona as faixas depois que o texto foi editado.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * As faixas são índices. Digitar uma letra no começo da frase empurra tudo um
 * caractere pra frente — e sem este ajuste a cor ficaria um caractere atrás,
 * pintando o espaço em vez da palavra. O erro cresce a cada tecla, em silêncio,
 * e só aparece no vídeo.
 *
 * COMO
 *
 * Acha o prefixo e o sufixo que não mudaram; o que sobra no meio é a edição.
 * Índice antes da edição fica onde está; índice depois anda a diferença de
 * comprimento; índice dentro do pedaço editado recua pra borda da edição.
 *
 * O EFEITO, QUE É O QUE IMPORTA: A COR SEGUE A TROCA
 *
 * Corrigir uma letra dentro da palavra pintada mantém a palavra pintada. E
 * trocar a palavra inteira — "GRANDES" por "TODAS AS" — deixa a cor na palavra
 * NOVA, que é o que o Word e o Docs fazem e o que a pessoa espera de um
 * destaque. A alternativa (apagar a faixa a cada edição) faria perder a
 * pintura toda vez que se conserta um typo.
 *
 * O preço é que a faixa pode abocanhar um espaço vizinho quando as duas
 * palavras compartilham letras nas bordas — um diff de caractere não tem como
 * saber que "AS" e "GRANDES" terminam no mesmo "S" por coincidência. Espaço
 * pintado não tem tinta: não aparece.
 *
 * NA BORDA, A FAIXA NÃO CRESCE
 *
 * Digitar exatamente ENCOSTADO no fim da faixa deixa a letra nova de fora. É
 * ambíguo por natureza (o Word herdaria a cor da letra anterior), e entre as
 * duas leituras esta é a que nunca pinta o que ninguém escolheu — o único tipo
 * de erro aqui que passaria despercebido.
 */
export const remapear = (
  trechos: TrechoTexto[] | undefined,
  antigo: string,
  novo: string,
): TrechoTexto[] => {
  if (!trechos || trechos.length === 0) return [];
  if (antigo === novo) return normalizar(trechos, novo.length);

  let prefixo = 0;
  const menor = Math.min(antigo.length, novo.length);
  while (prefixo < menor && antigo[prefixo] === novo[prefixo]) prefixo++;

  let sufixo = 0;
  while (
    sufixo < menor - prefixo &&
    antigo[antigo.length - 1 - sufixo] === novo[novo.length - 1 - sufixo]
  ) {
    sufixo++;
  }

  const fimAntigo = antigo.length - sufixo; // primeiro índice depois da edição
  const delta = novo.length - antigo.length;

  const mover = (i: number): number => {
    if (i <= prefixo) return i;
    if (i >= fimAntigo) return i + delta;
    return prefixo; // caiu dentro do que foi reescrito
  };

  return normalizar(
    trechos.map((t) => ({ ...t, inicio: mover(t.inicio), fim: mover(t.fim) })),
    novo.length,
  );
};
