/**
 * SupremoCut — Raiz
 *
 * Registra as composições. A janela do Remotion Studio lê daqui.
 * O roteiro e o estilo vêm de arquivos JSON que o motor Python atualiza —
 * e que você pode editar na mão a qualquer momento.
 */

import React from "react";
import { Composition } from "remotion";
import { VideoPrincipal, duracaoEmFrames } from "./Video";
import type { Estilo, Roteiro } from "./tipos";

import roteiroAtual from "./roteiro-atual.json";
import estiloAtual from "./estilo-atual.json";

const roteiro = roteiroAtual as unknown as Roteiro;
const estilo = estiloAtual as unknown as Estilo;
const pasta = roteiro.projeto;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Horizontal — YouTube, tutorial, podcast */}
      <Composition
        id="Principal"
        component={VideoPrincipal}
        durationInFrames={duracaoEmFrames(roteiro)}
        fps={roteiro.fps}
        width={roteiro.largura}
        height={roteiro.altura}
        defaultProps={{ roteiro, estilo, pasta }}
        calculateMetadata={({ props }) => ({
          durationInFrames: duracaoEmFrames(props.roteiro),
          fps: props.roteiro.fps,
          width: props.roteiro.largura,
          height: props.roteiro.altura,
        })}
      />

      {/* Vertical — Reels, Shorts, TikTok. Mesmo roteiro, quadro 9:16. */}
      <Composition
        id="Vertical"
        component={VideoPrincipal}
        durationInFrames={duracaoEmFrames(roteiro)}
        fps={roteiro.fps}
        width={1080}
        height={1920}
        defaultProps={{ roteiro, estilo, pasta }}
        calculateMetadata={({ props }) => ({
          durationInFrames: duracaoEmFrames(props.roteiro),
          fps: props.roteiro.fps,
          width: 1080,
          height: 1920,
        })}
      />

      {/* Quadrado — feed do Instagram */}
      <Composition
        id="Quadrado"
        component={VideoPrincipal}
        durationInFrames={duracaoEmFrames(roteiro)}
        fps={roteiro.fps}
        width={1080}
        height={1080}
        defaultProps={{ roteiro, estilo, pasta }}
        calculateMetadata={({ props }) => ({
          durationInFrames: duracaoEmFrames(props.roteiro),
          fps: props.roteiro.fps,
          width: 1080,
          height: 1080,
        })}
      />
    </>
  );
};
