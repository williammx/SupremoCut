/**
 * SupremoCut — legenda em .srt
 *
 * Gera o arquivo que o YouTube, o Instagram e qualquer player pedem. Usa as
 * palavras JÁ convertidas para o relógio do vídeo final, então o .srt sempre
 * bate com o corte atual — inclusive depois de você aparar ou reordenar blocos.
 */

import type { Palavra } from "./tipos";

/** 83.456 -> "00:01:23,456" — o formato exige vírgula, não ponto. */
function carimbo(segundos: number): string {
  const s = Math.max(0, segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(h)}:${dois(m)}:${dois(seg)},${String(ms).padStart(3, "0")}`;
}

/**
 * Junta as palavras em linhas legíveis.
 *
 * Legenda de arquivo não é legenda de tela: no vídeo aparecem 3-4 palavras
 * saltando, mas num .srt isso vira uma enxurrada ilegível. Aqui as linhas
 * fecham por pausa, por pontuação ou por comprimento — como um humano faria.
 */
export function gerarSrt(
  palavras: Palavra[],
  opcoes: { maxCaracteres?: number; pausaQuebra?: number } = {},
): string {
  const maxCaracteres = opcoes.maxCaracteres ?? 84;
  const pausaQuebra = opcoes.pausaQuebra ?? 0.7;

  if (!palavras || palavras.length === 0) return "";

  const linhas: { t: number; fim: number; texto: string }[] = [];
  let atual: Palavra[] = [];

  const fechar = () => {
    if (atual.length === 0) return;
    linhas.push({
      t: atual[0].t,
      fim: atual[atual.length - 1].fim,
      texto: atual.map((p) => p.texto).join(" ").replace(/\s+/g, " ").trim(),
    });
    atual = [];
  };

  for (const p of palavras) {
    const anterior = atual[atual.length - 1];
    if (anterior) {
      const comprimento = atual.reduce((n, x) => n + x.texto.length + 1, 0);
      const pausou = p.t - anterior.fim > pausaQuebra;
      const pontuou = /[.!?…]$/.test(anterior.texto);
      if (pausou || pontuou || comprimento + p.texto.length > maxCaracteres) fechar();
    }
    atual.push(p);
  }
  fechar();

  return (
    linhas
      .map((l, i) => {
        /*
          Uma linha precisa durar o bastante pra ser lida, mas NUNCA pode
          invadir a seguinte: carimbos sobrepostos fazem players descartarem
          legenda ou piscarem duas ao mesmo tempo. O limite mínimo vale só até
          onde a próxima começa.
        */
        const proxima = linhas[i + 1];
        const tetoNatural = Math.max(l.fim, l.t + 0.6);
        const teto = proxima ? Math.min(tetoNatural, proxima.t - 0.001) : tetoNatural;
        const fim = Math.max(l.t + 0.05, teto);
        return `${i + 1}\n${carimbo(l.t)} --> ${carimbo(fim)}\n${l.texto}\n`;
      })
      .join("\n") + "\n"
  );
}
