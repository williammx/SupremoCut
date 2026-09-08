/**
 * SupremoCut — mapeamento das legendas.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * Os tempos das palavras vinham do Whisper e eram convertidos, no momento do
 * `preparar`, para o relógio do vídeo FINAL daquele instante. Ficavam
 * congelados. Bastava aparar um bloco, dividir ou reordenar no editor para
 * toda a legenda descolar — e o erro se acumulava em silêncio.
 *
 * Agora as palavras vivem no relógio da FONTE, exatamente como `fonte_inicio`
 * das cenas e como os picos da forma de onda. A posição no vídeo final é
 * DERIVADA das cenas a cada render. Qualquer edição move a legenda junto,
 * porque ela deixou de ser um dado gravado e virou uma consequência.
 */

import type { Cena, Palavra } from "./tipos";

/**
 * Converte as palavras do relógio da fonte para o relógio do vídeo final,
 * seguindo os cortes atuais. Palavras que caíram fora dos blocos somem —
 * que é o comportamento certo: aquele trecho não está mais no vídeo.
 */
export function palavrasNaLinhaDoTempo(
  palavras: Palavra[],
  cenas: Cena[],
  offsetAudio = 0,
): Palavra[] {
  if (!palavras || palavras.length === 0 || cenas.length === 0) return [];

  const saida: Palavra[] = [];
  let inicioNaLinha = 0;

  for (const cena of cenas) {
    const velocidade = cena.velocidade ?? 1;
    // quanto de material da fonte este bloco consome
    const consumido = cena.duracao * velocidade;
    const de = cena.fonte_inicio + offsetAudio;
    const ate = de + consumido;

    for (const p of palavras) {
      // a palavra precisa começar dentro do bloco
      if (p.t < de || p.t >= ate) continue;

      const t = inicioNaLinha + (p.t - de) / velocidade;
      const fim = inicioNaLinha + Math.min(consumido, p.fim - de) / velocidade;
      if (fim <= t) continue;

      saida.push({ ...p, t: Number(t.toFixed(3)), fim: Number(fim.toFixed(3)) });
    }

    inicioNaLinha += cena.duracao;
  }

  return saida.sort((a, b) => a.t - b.t);
}

/**
 * Converte um roteiro antigo (palavras já no relógio final) de volta para o
 * relógio da fonte, usando os trechos que foram mantidos no `preparar`.
 * Existe só para não perder as transcrições já feitas.
 */
export function converterParaTempoDeFonte(
  palavras: Palavra[],
  trechos: [number, number][],
): Palavra[] {
  if (!trechos || trechos.length === 0) return palavras;

  const paraFonte = (tFinal: number): number | null => {
    let acumulado = 0;
    for (const [ini, fim] of trechos) {
      const dur = fim - ini;
      if (tFinal <= acumulado + dur) return ini + (tFinal - acumulado);
      acumulado += dur;
    }
    return null;
  };

  const saida: Palavra[] = [];
  for (const p of palavras) {
    const t = paraFonte(p.t);
    const fim = paraFonte(p.fim);
    if (t === null || fim === null || fim <= t) continue;
    saida.push({ ...p, t: Number(t.toFixed(3)), fim: Number(fim.toFixed(3)) });
  }
  return saida;
}
