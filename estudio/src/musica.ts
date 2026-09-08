/**
 * SupremoCut — abaixamento automático da música (ducking).
 *
 * A ideia: já temos o tempo exato de cada palavra falada. Então dá pra saber,
 * quadro a quadro, se tem voz naquele instante — e baixar a música só ali,
 * subindo de volta nas pausas. Sem isso, ou a música cobre a fala ou fica
 * inaudível o vídeo inteiro.
 */

import type { Musica, Palavra } from "./tipos";

/** Antecipa a descida e atrasa a subida, pra não cortar em cima da palavra. */
const RESPIRO = 0.28;
/** Tempo da rampa de subida/descida. Curto demais estala, longo demais atrasa. */
const RAMPA = 0.45;

/**
 * Monta a curva de volume da música, um valor por quadro.
 * Pré-calculada de uma vez porque rodar isso a cada quadro seria caro.
 */
export function curvaDeVolume(
  musica: Musica,
  palavras: Palavra[],
  duracaoTotal: number,
  fps: number,
): number[] {
  /*
    A curva é indexada a partir do INÍCIO DA MÚSICA, não do início do vídeo.

    Ela é lida de dentro de um <Sequence>, onde o quadro chega relativo. Se a
    curva começasse no zero do vídeo, ou o abaixamento atrasaria (lendo com
    índice relativo) ou a subida inicial nunca seria amostrada (compensando o
    índice). Nascendo junto com a música, o `fade_entrada` toca no primeiro
    quadro dela e o `fade_saida` no último — que é o que os nomes prometem.
  */
  const inicio = Math.max(0, musica.inicio ?? 0);
  const totalQuadros = Math.max(1, Math.ceil((duracaoTotal - inicio) * fps));
  const passoRampa = Math.max(1, Math.round(RAMPA * fps));

  // 1) marca os quadros que têm voz, deslocados pro relógio da música
  const temVoz = new Uint8Array(totalQuadros);
  for (const p of palavras) {
    const a = Math.max(0, Math.floor((p.t - RESPIRO - inicio) * fps));
    const b = Math.min(totalQuadros - 1, Math.ceil((p.fim + RESPIRO - inicio) * fps));
    for (let i = a; i <= b; i++) temVoz[i] = 1;
  }

  // 2) alvo por quadro: cheio no silêncio, abaixado na fala
  const alvo = new Float32Array(totalQuadros);
  for (let i = 0; i < totalQuadros; i++) {
    alvo[i] = temVoz[i] ? musica.volume * musica.abaixar : musica.volume;
  }

  // 3) suaviza: sem isso o volume pula e estala a cada palavra
  const suave = new Float32Array(totalQuadros);
  let atual = alvo[0];
  for (let i = 0; i < totalQuadros; i++) {
    const passo = (musica.volume - musica.volume * musica.abaixar) / passoRampa;
    if (alvo[i] < atual) atual = Math.max(alvo[i], atual - passo);
    else if (alvo[i] > atual) atual = Math.min(alvo[i], atual + passo);
    suave[i] = atual;
  }

  // 4) entrada e saída
  const fIn = Math.max(0, Math.round(musica.fade_entrada * fps));
  const fOut = Math.max(0, Math.round(musica.fade_saida * fps));
  const saida: number[] = new Array(totalQuadros);
  for (let i = 0; i < totalQuadros; i++) {
    let v = suave[i];
    if (fIn > 0 && i < fIn) v *= i / fIn;
    const restante = totalQuadros - 1 - i;
    if (fOut > 0 && restante < fOut) v *= restante / fOut;
    saida[i] = Number(Math.max(0, Math.min(1, v)).toFixed(4));
  }

  return saida;
}

export const MUSICA_PADRAO: Omit<Musica, "arquivo"> = {
  volume: 0.22,
  abaixar: 0.28,
  fade_entrada: 1.5,
  fade_saida: 2.5,
  inicio: 0,
};
