/**
 * SupremoCut — trilha de áudio.
 *
 * Converte um roteiro do modelo antigo (som soldado a cada cena) para o modelo
 * de trilha, onde o áudio é objeto próprio e pode andar sozinho.
 *
 * A conversão preserva EXATAMENTE o que se ouvia antes: cada cena vira um
 * clipe na mesma posição, com o mesmo trecho da fonte e o mesmo volume. A
 * diferença é que agora ele pode ser movido — o que soava igual passa a ser
 * editável.
 */

import type { Cena, ClipeAudio, Roteiro } from "./tipos";

export function trilhaDasCenas(cenas: Cena[]): ClipeAudio[] {
  const saida: ClipeAudio[] = [];
  let inicio = 0;

  for (const c of cenas) {
    saida.push({
      id: `a_${c.id}`,
      inicio: Number(inicio.toFixed(4)),
      duracao: c.duracao,
      fonte_inicio: c.fonte_inicio,
      volume: c.volume ?? 1,
      velocidade: c.velocidade ?? 1,
      fade_entrada: 0,
      fade_saida: 0,
      vinculado_a: c.id, // nasce seguindo a cena; soltar é escolha sua
      nota: c.nota,
    });
    inicio += c.duracao;
  }

  return saida;
}

/** Garante que o roteiro tem trilha, criando a partir das cenas se faltar. */
export function comTrilha(roteiro: Roteiro): Roteiro {
  if ((roteiro.trilha_audio?.length ?? 0) > 0) return roteiro;
  return { ...roteiro, trilha_audio: trilhaDasCenas(roteiro.cenas) };
}

/**
 * Põe a trilha de acordo com as cenas depois de uma edição estrutural.
 *
 * `seguirCenas()` sozinha só REPOSICIONA quem já existe. Isso basta para aparar
 * e arrastar, mas não para dividir, apagar, duplicar ou cortar silêncio — nessas
 * o conjunto de cenas muda de tamanho, e aí faltava tratamento para os dois
 * lados do descompasso:
 *
 *   - Cena nova sem clipe (dividir, duplicar, corte automático): o pedaço
 *     nascia MUDO. O usuário dividia um bloco e a segunda metade perdia a fala.
 *   - Clipe cujo dono sumiu (apagar): virava órfão e continuava tocando na
 *     posição antiga, por cima de outro bloco.
 *
 * Clipe SOLTO nunca é tocado. Ele é solto justamente porque alguém decidiu que
 * ele não segue o vídeo — a narração dublada é o caso típico.
 */
export function casarComCenas(roteiro: Roteiro): ClipeAudio[] {
  const trilha = roteiro.trilha_audio ?? [];
  // Sem trilha, o roteiro ainda usa o modelo antigo (som soldado à cena).
  // Inventar uma aqui mudaria o comportamento de um projeto que ninguém pediu
  // para migrar.
  if (trilha.length === 0) return trilha;

  const cenas = new Map(roteiro.cenas.map((c) => [c.id, c]));
  const jaTem = new Set<string>();
  const mantidos: ClipeAudio[] = [];

  for (const clipe of trilha) {
    if (!clipe.vinculado_a) {
      mantidos.push(clipe);
      continue;
    }
    // dono sumiu: o clipe some junto
    if (!cenas.has(clipe.vinculado_a)) continue;
    // dois clipes disputando a mesma cena: fica o primeiro
    if (jaTem.has(clipe.vinculado_a)) continue;
    jaTem.add(clipe.vinculado_a);
    mantidos.push(clipe);
  }

  // cena sem clipe ganha um, herdando o som daquele trecho da fonte
  for (const c of roteiro.cenas) {
    if (jaTem.has(c.id)) continue;
    mantidos.push({
      id: `a_${c.id}`,
      inicio: 0, // seguirCenas() ajusta logo abaixo
      duracao: c.duracao,
      fonte_inicio: c.fonte_inicio,
      volume: c.volume ?? 1,
      velocidade: c.velocidade ?? 1,
      fade_entrada: 0,
      fade_saida: 0,
      vinculado_a: c.id,
      nota: c.nota,
    });
  }

  return seguirCenas({ ...roteiro, trilha_audio: mantidos });
}

/**
 * Reaplica às cenas os clipes que continuam vinculados.
 *
 * Chamado depois de mexer nas cenas: quem tem vínculo acompanha o corte, quem
 * não tem fica onde está. É isso que faz "vincular" significar algo.
 */
export function seguirCenas(roteiro: Roteiro): ClipeAudio[] {
  const trilha = roteiro.trilha_audio ?? [];
  if (trilha.length === 0) return trilha;

  const posicao = new Map<string, { inicio: number; cena: Cena }>();
  let t = 0;
  for (const c of roteiro.cenas) {
    posicao.set(c.id, { inicio: t, cena: c });
    t += c.duracao;
  }

  return trilha.map((clipe) => {
    if (!clipe.vinculado_a) return clipe;
    const alvo = posicao.get(clipe.vinculado_a);
    if (!alvo) return { ...clipe, vinculado_a: null }; // a cena sumiu
    return {
      ...clipe,
      inicio: Number(alvo.inicio.toFixed(4)),
      duracao: alvo.cena.duracao,
      fonte_inicio: alvo.cena.fonte_inicio,
      // a velocidade também acompanha: um bloco acelerado precisa do som
      // acelerado junto, senão a fala descola da imagem
      velocidade: alvo.cena.velocidade ?? 1,
    };
  });
}
