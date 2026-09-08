import React, { useMemo } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { VideoPrincipal, duracaoEmFrames } from "../../src/Video";
import type { Estilo, Roteiro } from "../../src/tipos";

/**
 * O Player, isolado do resto do editor.
 *
 * Isto aqui NÃO é organização: é a correção do travamento.
 *
 * O Editor guarda o quadro atual no estado e isso muda 24 vezes por segundo.
 * Enquanto o Player morava lá dentro, cada uma dessas mudanças criava um
 * `inputProps` novo e remontava a composição inteira — 24 remontagens por
 * segundo, brigando com a decodificação. Aqui ele só re-renderiza quando o
 * roteiro ou o estilo realmente mudam.
 */
export const Palco = React.memo(
  ({
    player,
    roteiro,
    estilo,
    zonaSegura,
  }: {
    player: React.RefObject<PlayerRef | null>;
    roteiro: Roteiro;
    estilo: Estilo;
    zonaSegura: boolean;
  }) => {
    const props = useMemo(
      () => ({ roteiro, estilo, pasta: roteiro.projeto }),
      [roteiro, estilo],
    );

    const duracao = useMemo(() => duracaoEmFrames(roteiro), [roteiro]);

    /*
      O preview desenha em METADE das dimensões — 960x540 em vez de 1920x1080.
      São 4x menos pixels por quadro, e nada se perde: toda a geometria do
      projeto é proporcional (0 a 1) e as fontes escalam pela altura, então o
      enquadramento é idêntico. O render final continua em resolução cheia.
    */
    const larguraPreview = Math.round(roteiro.largura / 2 / 2) * 2;
    const alturaPreview = Math.round(roteiro.altura / 2 / 2) * 2;

    return (
      <>
        {/*
          Zonas seguras do 9:16 — guia do EDITOR, não entra no render.
          A interface do TikTok e do Reels cobre a faixa de baixo e a coluna
          da direita: legenda ou CTA ali simplesmente não é lida. Vale mais
          ver isso enquanto edita do que descobrir depois de publicar.
        */}
        {zonaSegura && (
          /*
            `aspectRatio` do próprio vídeo, e não 100% do palco.
            O Player deixa barras pretas dos lados quando a janela não tem a
            mesma proporção do vídeo. Sem esta caixa, as guias eram desenhadas
            sobre o palco inteiro, barras incluídas — e mostravam a faixa de
            interface do TikTok caindo num lugar onde não há imagem nenhuma.
            Guia que mente é pior que guia nenhuma.
          */
          <div
            className="zona-segura"
            style={
              { "--ar": larguraPreview / alturaPreview } as React.CSSProperties
            }
          >
            <div className="zs-faixa zs-topo" data-rot="perfil / topo" />
            <div className="zs-faixa zs-base" data-rot="interface do app" />
            <div className="zs-faixa zs-direita" data-rot="botões" />
          </div>
        )}
        <Player
          ref={player}
        component={VideoPrincipal}
        inputProps={props}
        durationInFrames={duracao}
        fps={roteiro.fps}
        compositionWidth={larguraPreview}
        compositionHeight={alturaPreview}
        style={{ width: "100%", height: "100%" }}
          controls
          doubleClickToFullscreen
          acknowledgeRemotionLicense
        />
      </>
    );
  },
);

Palco.displayName = "Palco";
