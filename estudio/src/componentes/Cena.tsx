/**
 * SupremoCut — Cena
 *
 * Uma cena = um pedaço contínuo do vídeo final.
 * A mágica do "motion" mora aqui: a cena NÃO aparece do nada — ela
 * nasce na geometria da cena anterior e desliza/escala até a sua própria.
 * É isso que faz o quadradinho da webcam "voar" pro canto em vez de piscar.
 */

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cena as TCena, Estilo, Roteiro } from "../tipos";
import { geometriaDaCena, misturarGeometria, type Geometria } from "../layouts";
import { camadaTemperatura, estadoEm, filtroCss, vinhetaCss } from "../animacao";
import { Camada } from "./Camada";
import { Mascara, mascaraAtiva } from "./Mascara";

type Props = {
  cena: TCena;
  geoAnterior: Geometria | null;
  roteiro: Roteiro;
  estilo: Estilo;
  pasta: string;
};

export const Cena: React.FC<Props> = ({ cena, geoAnterior, roteiro, estilo, pasta }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const geoAlvo = geometriaDaCena(cena, estilo, width, height);
  const entrada = cena.entrada ?? { tipo: "corte" as const };

  const duracaoEntrada =
    "duracao" in entrada ? entrada.duracao : estilo.animacao.duracao_padrao;
  const framesEntrada = Math.max(1, Math.round(duracaoEntrada * fps));

  // ---- progresso da entrada -------------------------------------------------
  let p = 1; // 0 = ainda na geometria anterior, 1 = na geometria da cena
  let opacidadeGeral = 1;
  let deslocX = 0;
  let deslocY = 0;
  let escalaGeral = 1;
  let brilho = 0;

  const mola = spring({
    frame,
    fps,
    config: {
      damping: estilo.animacao.mola_amortecimento,
      stiffness: estilo.animacao.mola_rigidez,
      mass: 1,
    },
    durationInFrames: framesEntrada,
  });

  const linear = interpolate(frame, [0, framesEntrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  switch (entrada.tipo) {
    case "corte":
      p = 1;
      break;

    case "morph":
      p = mola;
      break;

    case "fade":
      p = 1;
      opacidadeGeral = linear;
      break;

    case "deslize": {
      p = 1;
      const fora = 1 - mola;
      if (entrada.direcao === "esq") deslocX = -fora * width;
      if (entrada.direcao === "dir") deslocX = fora * width;
      if (entrada.direcao === "cima") deslocY = -fora * height;
      if (entrada.direcao === "baixo") deslocY = fora * height;
      break;
    }

    case "zoom_cruzado":
      p = 1;
      escalaGeral = interpolate(mola, [0, 1], [1.14, 1]);
      opacidadeGeral = linear;
      break;

    case "flash":
      p = 1;
      brilho = interpolate(frame, [0, framesEntrada * 0.35, framesEntrada], [1, 0.6, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      break;
  }

  const geo = geoAnterior ? misturarGeometria(geoAnterior, geoAlvo, p) : geoAlvo;

  // ---- animação e correção de imagem ---------------------------------------
  /*
    O tempo aqui são segundos desde o começo do bloco, na régua do vídeo FINAL —
    a mesma que `congelar` usa. É o que o usuário enxerga na timeline: um bloco
    de 3 segundos tem chaves de 0 a 3, independente de velocidade ou de onde ele
    caiu no material bruto.

    O que vem da animação se SOMA ao que vem da transição de entrada, em vez de
    substituir: um bloco pode perfeitamente entrar deslizando e, depois de
    parado, seguir aproximando devagar.
  */
  const est = estadoEm(frame / fps, cena.ajustes, cena.animacoes);

  const filtro = filtroCss(est.ajustes, height / 1080);
  const temperatura = camadaTemperatura(est.ajustes);
  const vinheta = vinhetaCss(est.ajustes);

  const opacidadeFinal = opacidadeGeral * est.opacidade;
  const transformes = [
    `translate(${deslocX + est.pos_x * width}px, ${deslocY + est.pos_y * height}px)`,
    est.rotacao !== 0 ? `rotate(${est.rotacao}deg)` : "",
    `scale(${escalaGeral * est.zoom})`,
  ]
    .filter(Boolean)
    .join(" ");

  const mesclagem = cena.mesclagem && cena.mesclagem !== "normal" ? cena.mesclagem : undefined;

  // ---- fontes ---------------------------------------------------------------
  const fCam = roteiro.fontes.camera;
  const fTela = roteiro.fontes.tela;

  const diagonal = cena.layout === "split_diagonal";

  const camera = fCam ? (
    <Camada
      key="camera"
      src={`${pasta}/${fCam.arquivo}`}
      srcPreview={fCam.arquivo_preview ? `${pasta}/${fCam.arquivo_preview}` : undefined}
      versaoMidia={roteiro.versao_midia ?? null}
      inicioNaFonte={cena.fonte_inicio + fCam.offset}
      retangulo={geo.camera}
      velocidade={cena.velocidade ?? 1}
      corBorda={estilo.cores.borda}
      diagonal={diagonal ? "esq" : null}
      zIndex={geo.camera_na_frente ? 20 : 10}
    />
  ) : null;

  const tela = fTela ? (
    <Camada
      key="tela"
      src={`${pasta}/${fTela.arquivo}`}
      srcPreview={fTela.arquivo_preview ? `${pasta}/${fTela.arquivo_preview}` : undefined}
      versaoMidia={roteiro.versao_midia ?? null}
      inicioNaFonte={cena.fonte_inicio + fTela.offset}
      retangulo={geo.tela}
      foco={cena.foco}
      velocidade={cena.velocidade ?? 1}
      corBorda={estilo.cores.borda}
      diagonal={diagonal ? "dir" : null}
      zIndex={geo.camera_na_frente ? 10 : 20}
    />
  ) : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: estilo.cores.fundo,
        opacity: opacidadeFinal,
        transform: transformes,
        // `filter` vazio de propósito quando nada foi mexido: um filtro presente,
        // ainda que neutro, força uma camada de composição nova no Chrome e
        // derruba a fluidez do preview sem mudar um pixel.
        ...(filtro ? { filter: filtro } : {}),
        ...(mesclagem ? { mixBlendMode: mesclagem } : {}),
      }}
    >
      {/*
        A máscara embrulha as camadas de vídeo, e não a cena inteira: ela é
        pra tratar a IMAGEM. Se envolvesse tudo, borraria também a camada de
        temperatura e a vinheta, que são correção de cor e devem valer no
        quadro todo.
      */}
      {mascaraAtiva(cena.mascara) ? (
        <Mascara mascara={cena.mascara}>
          {camera}
          {tela}
        </Mascara>
      ) : (
        <>
          {camera}
          {tela}
        </>
      )}
      {temperatura ? (
        <AbsoluteFill style={{ ...temperatura, zIndex: 40, pointerEvents: "none" }} />
      ) : null}
      {vinheta ? (
        <AbsoluteFill style={{ background: vinheta, zIndex: 41, pointerEvents: "none" }} />
      ) : null}
      {brilho > 0 ? (
        <AbsoluteFill
          style={{ backgroundColor: "white", opacity: brilho * 0.85, zIndex: 50 }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
