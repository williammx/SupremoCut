import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ClipeAudio } from "../../src/tipos";
import { usePicos } from "../picos";

/**
 * Forma de onda do áudio, desenhada dentro dos blocos.
 *
 * Os picos são do arquivo de ÁUDIO DA FONTE, inteiro. Então pra cada pixel da
 * timeline eu descubro em que bloco ele cai, converto pro instante equivalente
 * dentro da fonte, e leio o pico de lá. É o que faz a onda continuar certa
 * depois de você aparar, dividir ou reordenar os blocos.
 *
 * Só desenha a parte visível: num zoom alto a pista passaria de 150.000px,
 * muito além do limite de canvas do navegador.
 */
export const Onda: React.FC<{
  arquivo: string | null;
  pasta: string;
  /** Clipes da trilha de áudio — a onda segue ELES, não as cenas de vídeo. */
  clipes: ClipeAudio[];
  offsetAudio: number;
  escala: number;
  rolagem: React.RefObject<HTMLDivElement | null>;
  recuo: () => number;
  altura?: number;
}> = ({ arquivo, pasta, clipes, offsetAudio, escala, rolagem, recuo, altura = 46 }) => {
  // Mesmo carregamento que o corte automático de silêncio usa: a linha de
  // corte e a onda desenhada precisam ler exatamente o mesmo arquivo.
  const dados = usePicos(arquivo, pasta);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tique, forcar] = useState(0);

  const desenhar = useCallback(() => {
    const c = canvas.current;
    const caixa = rolagem.current;
    if (!c || !caixa || !dados || dados.picos.length === 0) return;

    const largura = caixa.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    if (c.width !== Math.round(largura * dpr) || c.height !== Math.round(altura * dpr)) {
      c.width = Math.round(largura * dpr);
      c.height = Math.round(altura * dpr);
    }
    c.style.width = `${largura}px`;
    c.style.height = `${altura}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const tempoInicial = (caixa.scrollLeft - recuo()) / escala;
    const meio = altura / 2;

    ctx.fillStyle = "rgba(150, 190, 255, 0.55)";
    ctx.beginPath();

    // ordenados por posição pra varrer os pixels em sequência
    const ordenados = [...clipes].sort((a, b) => a.inicio - b.inicio);

    let i_clipe = 0;
    for (let x = 0; x < largura; x++) {
      const t = tempoInicial + x / escala;
      if (t < 0) continue;

      // avança até o clipe que cobre este instante da linha do tempo
      while (
        i_clipe < ordenados.length &&
        t >= ordenados[i_clipe].inicio + ordenados[i_clipe].duracao
      ) {
        i_clipe++;
      }
      if (i_clipe >= ordenados.length) break;
      const clipe = ordenados[i_clipe];
      if (t < clipe.inicio) continue; // buraco entre clipes: nada a desenhar

      // A velocidade escala quanto da fonte cada segundo da linha do tempo
      // consome. Sem ela, num bloco acelerado a onda desenhada mostrava um
      // trecho e o alto-falante tocava outro — e é ESTA onda que o corte
      // automático de silêncio lê pra decidir onde cortar.
      const vel = clipe.velocidade ?? 1;
      const naFonte = clipe.fonte_inicio + offsetAudio + (t - clipe.inicio) * vel;
      if (naFonte < 0 || naFonte > dados.duracao) continue;

      // num zoom baixo cada pixel cobre vários picos: pega o maior,
      // senão a onda "pisca" e some conforme o zoom muda
      const i0 = Math.floor(naFonte * dados.por_segundo);
      const i1 = Math.max(i0 + 1, Math.floor((naFonte + 1 / escala) * dados.por_segundo));
      let pico = 0;
      for (let i = i0; i < i1 && i < dados.picos.length; i++) {
        if (dados.picos[i] > pico) pico = dados.picos[i];
      }

      const h = (pico / 255) * (altura * 0.44);
      ctx.rect(x, meio - h, 1, h * 2);
    }
    ctx.fill();
  }, [dados, escala, rolagem, recuo, altura, clipes, offsetAudio]);

  useEffect(() => {
    desenhar();
    // `tique` na lista de propósito: rolar a timeline não muda nenhuma das
    // dependências de `desenhar`, então a função é a MESMA referência e o
    // efeito não rodava de novo. A onda ficava desenhada no trecho antigo
    // enquanto a régua já mostrava outro.
  }, [desenhar, tique]);

  useEffect(() => {
    const caixa = rolagem.current;
    if (!caixa) return;
    const aoRolar = () => forcar((n) => n + 1);
    caixa.addEventListener("scroll", aoRolar, { passive: true });
    const obs = new ResizeObserver(aoRolar);
    obs.observe(caixa);
    return () => {
      caixa.removeEventListener("scroll", aoRolar);
      obs.disconnect();
    };
  }, [rolagem]);

  if (!dados) return null;

  return (
    <canvas
      ref={canvas}
      className="onda"
      style={{ left: (rolagem.current?.scrollLeft ?? 0) - recuo() }}
    />
  );
};
