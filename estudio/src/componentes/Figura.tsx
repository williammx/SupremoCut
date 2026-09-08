/**
 * SupremoCut — Figura
 *
 * Uma imagem por cima do vídeo: logo do cliente, print de avaliação, selo de
 * oferta, seta apontando o produto.
 *
 * Ela usa o MESMO motor de animação dos blocos de vídeo. Foi de propósito:
 * "deslizar da direita" tem que significar a mesma coisa aplicada a um bloco ou
 * a um logo, senão o usuário precisa aprender duas vezes.
 */

import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Imagem } from "../tipos";
import { estadoEm } from "../animacao";

export const Figura: React.FC<{ imagem: Imagem; pasta: string }> = ({ imagem, pasta }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Segundos desde o começo da figura — a mesma régua dos blocos.
  const est = estadoEm(frame / fps, null, imagem.animacoes);

  const escala = height / 1080;

  return (
    /*
      z-index obrigatorio: cada cena recebe `zIndex: i + 1` em Video.tsx e
      preenche a tela inteira com fundo opaco. Sem uma camada acima disso, a
      figura e desenhada e imediatamente coberta — o upload funciona, o roteiro
      guarda, e nada aparece na tela.
      54 fica acima das cenas e um degrau ABAIXO dos textos (55/58) e da legenda
      (60), que e a ordem certa: quando um logo e uma tarja de traducao dividem
      o mesmo canto, o texto precisa ser lido. Numero proprio, e nao empate em
      55, pra que a ordem nao dependa de quem foi escrito primeiro no JSX.
    */
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 54 }}>
      <div
        style={{
          position: "absolute",
          left: `${imagem.x * 100}%`,
          top: `${imagem.y * 100}%`,
          width: `${imagem.largura * 100}%`,
          opacity: Math.max(0, Math.min(1, imagem.opacidade * est.opacidade)),
          transform: [
            `translate(${est.pos_x * width}px, ${est.pos_y * height}px)`,
            `rotate(${imagem.rotacao + est.rotacao}deg)`,
            `scale(${est.zoom})`,
          ].join(" "),
          // O ponto de origem é o centro: girar e escalar em torno do canto
          // superior esquerdo joga a figura pra fora da tela.
          transformOrigin: "center center",
          filter: imagem.sombra
            ? `drop-shadow(0 ${(10 * escala).toFixed(1)}px ${(28 * escala).toFixed(
                1,
              )}px rgba(0,0,0,0.45))`
            : undefined,
        }}
      >
        <Img
          src={staticFile(`${pasta}/imagens/${imagem.arquivo}`)}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: imagem.raio > 0 ? `${imagem.raio * escala}px` : undefined,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
