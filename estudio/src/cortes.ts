/**
 * SupremoCut — cortes automáticos
 *
 * Duas coisas que parecem diferentes e são a mesma: "tirar os silêncios" e
 * "apagar esta palavra do texto". As duas terminam na mesma pergunta — quais
 * trechos do material bruto ficam? — e por isso terminam na mesma função.
 *
 * Tudo aqui trabalha em **tempo da fonte** (posição dentro do arquivo bruto),
 * porque é a única régua em que "onde tem fala" faz sentido. A montagem final
 * é consequência.
 */

import type { Cena } from "./tipos";
import { aplicarPreset } from "./animacao";

/** Um intervalo em segundos, no relógio da fonte. */
export type Faixa = { a: number; b: number };

// ---------------------------------------------------------------------------
// Álgebra de faixas
// ---------------------------------------------------------------------------

/** Ordena, descarta o que é vazio e funde o que se toca. */
export const normalizar = (faixas: Faixa[], folga = 0): Faixa[] => {
  const vivas = faixas.filter((f) => f.b > f.a).sort((x, y) => x.a - y.a);
  const saida: Faixa[] = [];
  for (const f of vivas) {
    const ultima = saida[saida.length - 1];
    if (ultima && f.a <= ultima.b + folga) {
      ultima.b = Math.max(ultima.b, f.b);
    } else {
      saida.push({ a: f.a, b: f.b });
    }
  }
  return saida;
};

/** O que sobra de `universo` depois de tirar `remover`. */
export const complemento = (remover: Faixa[], universo: Faixa[]): Faixa[] => {
  const tirar = normalizar(remover);
  const saida: Faixa[] = [];

  for (const u of normalizar(universo)) {
    let cursor = u.a;
    for (const r of tirar) {
      if (r.b <= cursor) continue;
      if (r.a >= u.b) break;
      if (r.a > cursor) saida.push({ a: cursor, b: Math.min(r.a, u.b) });
      cursor = Math.max(cursor, r.b);
      if (cursor >= u.b) break;
    }
    if (cursor < u.b) saida.push({ a: cursor, b: u.b });
  }

  return normalizar(saida);
};

/** O trecho da fonte que cada cena consome hoje. */
export const faixasDasCenas = (cenas: Cena[]): Faixa[] =>
  cenas.map((c) => ({
    a: c.fonte_inicio,
    // `duracao` é tempo FINAL; a fonte consumida escala com a velocidade.
    b: c.fonte_inicio + c.duracao * (c.velocidade ?? 1),
  }));

// ---------------------------------------------------------------------------
// Detecção de fala a partir da forma de onda
// ---------------------------------------------------------------------------

export type Picos = { por_segundo: number; duracao: number; picos: number[] };

export type OpcoesSilencio = {
  /** Abaixo disto é silêncio, em dB (−60 = quase nada, −20 = exigente). */
  limiar_db: number;
  /** Respiro mantido antes e depois de cada fala, em segundos. */
  margem: number;
  /** Pausa mais curta que isto não vale a pena cortar, em segundos. */
  silencio_minimo: number;
  /** Trecho de fala mais curto que isto é ruído, não fala. */
  fala_minima: number;
};

export const SILENCIO_PADRAO: OpcoesSilencio = {
  limiar_db: -34,
  margem: 0.12,
  silencio_minimo: 0.35,
  fala_minima: 0.1,
};

/**
 * Converte o pico gravado (0-255) de volta em amplitude.
 *
 * `ondas.py` grava a RAIZ da amplitude — ela realça as partes baixas e faz a
 * onda desenhada ficar legível. Desfazer a raiz aqui é obrigatório: sem isso o
 * limiar em dB mede a coisa errada e o corte sai em lugar nenhum.
 */
export const amplitudeDoPico = (p: number): number => {
  const raiz = p / 255;
  return raiz * raiz;
};

/** dB (0 = volume cheio) → amplitude linear. */
export const dbParaAmplitude = (db: number): number => Math.pow(10, db / 20);

/**
 * Onde tem fala, no relógio da fonte.
 *
 * Detecção por pico normalizado em blocos, como o auto-editor faz: para cada
 * fatia da onda, o pico está acima do limiar? Blocos vizinhos acesos viram um
 * trecho de fala. Depois vêm as três correções que separam corte natural de
 * corte robótico:
 *
 *  - pausa curta demais não é pausa, é respiração dentro da frase;
 *  - trecho aceso curto demais não é fala, é uma batida de mesa;
 *  - todo trecho ganha um respiro nas pontas, senão o corte come a consoante
 *    inicial e a fala fica com aquele "tc" de rádio pirata.
 */
export const detectarFala = (dados: Picos, op: OpcoesSilencio): Faixa[] => {
  const { picos, por_segundo } = dados;
  if (!picos || picos.length === 0 || !por_segundo) return [];

  const limiar = dbParaAmplitude(op.limiar_db);
  const dt = 1 / por_segundo;

  // 1. blocos acesos → trechos crus
  const cru: Faixa[] = [];
  let dentro = false;
  let inicio = 0;
  for (let i = 0; i < picos.length; i++) {
    const alto = amplitudeDoPico(picos[i]) >= limiar;
    if (alto && !dentro) {
      dentro = true;
      inicio = i * dt;
    } else if (!alto && dentro) {
      dentro = false;
      cru.push({ a: inicio, b: i * dt });
    }
  }
  if (dentro) cru.push({ a: inicio, b: picos.length * dt });

  // 2. fecha as pausas curtas (funde o que está separado por menos que o mínimo)
  const semPausinha = normalizar(cru, op.silencio_minimo);

  // 3. descarta estalo solto
  const semEstalo = semPausinha.filter((f) => f.b - f.a >= op.fala_minima);

  // 4. respiro nas pontas, sem deixar passar do começo do arquivo
  const comRespiro = semEstalo.map((f) => ({
    a: Math.max(0, f.a - op.margem),
    b: Math.min(dados.duracao || f.b + op.margem, f.b + op.margem),
  }));

  return normalizar(comRespiro);
};

// ---------------------------------------------------------------------------
// Aplicar aos blocos
// ---------------------------------------------------------------------------

/**
 * Arredonda pra quadro inteiro — invariante do projeto inteiro.
 *
 * Sem corte de casas decimais, de propósito. A tentação é fechar em 4 casas
 * pra deixar o JSON bonito, e foi o que a primeira versão fez: 169 quadros a
 * 30 fps dão 5,633333…s, que aparado vira 5,6333 — e 5,6333 × 30 = 168,999.
 * Um quadro a menos, escondido atrás de um número arrumadinho. O valor exato é
 * feio de ler e certo de contar, e contar é o que importa.
 */
const emQuadros = (v: number, fps: number) => Math.round(v * fps) / fps;

export type Resultado = {
  cenas: Cena[];
  /** Quantos segundos saíram do vídeo final. */
  removido: number;
  /** Quantos pedaços novos existem agora. */
  blocos: number;
};

/**
 * Reescreve as cenas mantendo só o que está em `manter`.
 *
 * O primeiro pedaço de cada cena HERDA O ID dela. Isso não é detalhe: os
 * clipes de áudio vinculados apontam pra esse id, e `seguirCenas()` só
 * reencontra o dono se ele continuar existindo. Trocar todos os ids faria a
 * trilha inteira se soltar em silêncio.
 */
export const manterApenas = (cenas: Cena[], manter: Faixa[], fps: number): Resultado => {
  const janelas = normalizar(manter);
  const minimo = 2 / fps; // menos que dois quadros não é um bloco, é um piscar
  const saida: Cena[] = [];
  const antes = cenas.reduce((s, c) => s + c.duracao, 0);

  for (const cena of cenas) {
    const vel = cena.velocidade ?? 1;
    const s0 = cena.fonte_inicio;
    const s1 = s0 + cena.duracao * vel;
    let n = 0;

    for (const j of janelas) {
      const a = Math.max(s0, j.a);
      const b = Math.min(s1, j.b);
      if (b - a <= 0) continue;

      const duracao = emQuadros((b - a) / vel, fps);
      if (duracao < minimo) continue;

      const pedaco: Cena = {
        ...cena,
        id: n === 0 ? cena.id : `${cena.id}_c${n}`,
        fonte_inicio: emQuadros(a, fps),
        duracao,
      };

      // Quanto o começo deste pedaço andou dentro do bloco original, em
      // tempo FINAL — que é a régua das chaves e do `congelar`.
      const deslocou = (a - s0) / vel;

      // A animação é medida do começo do bloco. Um bloco que virou três
      // pedaços tem três começos novos.
      if (cena.preset_animacao) {
        // Veio de preset: regerar é a leitura honesta de "aparecer suave"
        // depois do corte — cada pedaço aparece no próprio começo.
        pedaco.animacoes = aplicarPreset(cena.preset_animacao, duracao);
      } else if (cena.animacoes?.length) {
        /*
          Animação feita à mão não pode ser regerada — não há de quê. Então ela
          é DESLOCADA junto com o começo do pedaço e aparada nas bordas. Sem
          isto, um zoom marcado no segundo 8 continuava marcado no segundo 8 de
          um pedaço que agora começa no 8 — ou seja, no lugar errado.
        */
        const movidas = cena.animacoes
          .map((an) => ({
            ...an,
            chaves: an.chaves
              .map((k) => ({ ...k, t: Number((k.t - deslocou).toFixed(4)) }))
              // uma folga de meio segundo de cada lado: a chave logo fora da
              // borda ainda define de onde a interpolação vem
              .filter((k) => k.t >= -0.5 && k.t <= duracao + 0.5),
          }))
          .filter((an) => an.chaves.length > 0);
        pedaco.animacoes = movidas.length > 0 ? movidas : undefined;
      }

      // `congelar` também é medido do começo do bloco, então acompanha o
      // deslocamento. Se o instante congelado caiu fora deste pedaço, o
      // congelamento some — congelar no lugar errado é pior que não congelar.
      if (typeof cena.congelar === "number") {
        const novo = cena.congelar - deslocou;
        pedaco.congelar = novo >= 0 && novo <= duracao ? Number(novo.toFixed(4)) : null;
      }

      // Só o primeiro pedaço herda a transição de entrada: os outros nascem
      // no meio de uma fala, e uma transição ali é um defeito, não um efeito.
      if (n > 0) pedaco.entrada = { tipo: "corte" };

      saida.push(pedaco);
      n++;
    }
  }

  const depois = saida.reduce((s, c) => s + c.duracao, 0);
  return {
    cenas: saida,
    removido: Number(Math.max(0, antes - depois).toFixed(2)),
    blocos: saida.length,
  };
};

/** Simulação: quanto sairia, sem mexer em nada. */
export const prever = (cenas: Cena[], manter: Faixa[], fps: number) => {
  const r = manterApenas(cenas, manter, fps);
  return { removido: r.removido, blocos: r.blocos, restante: r.cenas.length > 0 };
};
