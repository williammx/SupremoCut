/**
 * SupremoCut — Overlays
 *
 * Títulos, lower-thirds e caixas de destaque que entram por cima do vídeo.
 */

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TARJA_PADRAO, type Estilo, type Overlay as TOverlay } from "../tipos";
import { familiaSegura } from "../fonte";

export const Overlay: React.FC<{ overlay: TOverlay; estilo: Estilo }> = ({ overlay, estilo }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const escala = height / 1080;

  const totalFrames = Math.round(overlay.duracao * fps);
  const entrada = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.8 },
    durationInFrames: Math.round(0.5 * fps),
  });
  const saida = interpolate(
    frame,
    [totalFrames - Math.round(0.4 * fps), totalFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const vis = Math.min(entrada, saida);

  const base: React.CSSProperties = {
    fontFamily: familiaSegura(estilo.fonte.familia),
    color: estilo.cores.texto,
    textShadow: `0 ${3 * escala}px ${12 * escala}px ${estilo.cores.texto_sombra}`,
    opacity: vis,
  };

  /*
    TARJA — cobre texto queimado no vídeo e escreve por cima.

    Diferente dos outros overlays, ela tem tamanho próprio: precisa cobrir uma
    área específica do quadro, não se posicionar por um ponto. Entra sem
    animação de escala de propósito — uma tarja que "cresce" denuncia a
    montagem.

    A CAIXA NÃO DESAPARECE. Só o texto dentro dela.

    Isso não é preferência de estilo: uma cobertura que some não cobre. A
    versão anterior usava o mesmo `vis` do resto — meio segundo entrando, quatro
    décimos saindo — e numa tarja curta as duas rampas se encontravam sem nunca
    chegar a 100%. O resultado era a legenda russa aparecendo por baixo, no meio
    do anúncio, exatamente onde ela deveria estar tapada.

    O texto continua com a suavização: quando uma tarja emenda na outra, a caixa
    fica firme e só a frase troca.
  */
  if (overlay.tipo === "tarja") {
    const c = { ...TARJA_PADRAO, ...(overlay.caixa ?? {}) };

    // rampa curta, só pro texto (ver comentário no `span` abaixo)
    const RAMPA = Math.max(1, Math.round(0.15 * fps));
    const visTarja = Math.min(
      interpolate(frame, [0, RAMPA], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      interpolate(frame, [totalFrames - RAMPA, totalFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    const tam = overlay.tamanho ?? { largura: 0.8, altura: 0.08 };
    const pos = overlay.posicao ?? { x: 0.1, y: 0.75 };

    const contorno = c.contorno * escala;
    const sombraTexto =
      contorno > 0
        ? `-${contorno}px -${contorno}px 0 #000, ${contorno}px -${contorno}px 0 #000,` +
          `-${contorno}px ${contorno}px 0 #000, ${contorno}px ${contorno}px 0 #000`
        : undefined;

    return (
      <AbsoluteFill style={{ zIndex: 58 }}>
        <div
          style={{
            position: "absolute",
            left: pos.x * width,
            top: pos.y * height,
            width: tam.largura * width,
            height: tam.altura * height,
            background: c.cor,
            border: c.borda > 0 ? `${c.borda * escala}px solid ${c.cor_borda}` : undefined,
            borderRadius: c.raio * escala,
            // sem `opacity` aqui — ver o comentário acima
            display: "flex",
            alignItems: "center",
            justifyContent:
              c.alinhamento === "esquerda"
                ? "flex-start"
                : c.alinhamento === "direita"
                  ? "flex-end"
                  : "center",
            padding: `0 ${10 * escala}px`,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: familiaSegura(estilo.fonte.familia),
              fontWeight: c.peso,
              fontSize: c.tamanho_texto * escala,
              color: c.cor_texto,
              lineHeight: 1.15,
              textAlign: c.alinhamento === "centro" ? "center" : "left",
              textTransform: c.caixa_alta ? "uppercase" : "none",
              textShadow: sombraTexto,
              whiteSpace: "pre-wrap",
              /*
                Só o TEXTO suaviza; a caixa fica firme.

                E suaviza RÁPIDO — 0,15s de cada lado, não o meio segundo dos
                outros overlays. Uma tarja de tradução costuma durar menos de um
                segundo, e com a rampa longa a frase passava inteira em cinza,
                sem chegar ao branco em nenhum quadro. Curto assim ela troca
                sem piscar e ainda por cima é legível.
              */
              opacity: visTarja,
            }}
          >
            {overlay.texto}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  if (overlay.tipo === "titulo") {
    return (
      <AbsoluteFill style={{ zIndex: 55, justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            ...base,
            fontSize: estilo.fonte.tamanho_titulo * escala,
            fontWeight: 800,
            textTransform: estilo.fonte.caixa_alta ? "uppercase" : "none",
            textAlign: "center",
            maxWidth: width * 0.8,
            transform: `translateY(${interpolate(entrada, [0, 1], [40 * escala, 0])}px)`,
            letterSpacing: "-0.02em",
          }}
        >
          {overlay.texto}
          {overlay.subtexto ? (
            <div
              style={{
                fontSize: estilo.fonte.tamanho_titulo * 0.42 * escala,
                fontWeight: 500,
                opacity: 0.85,
                marginTop: 16 * escala,
                textTransform: "none",
              }}
            >
              {overlay.subtexto}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (overlay.tipo === "lower_third") {
    const larguraBarra = interpolate(entrada, [0, 1], [0, 1]);
    return (
      <AbsoluteFill style={{ zIndex: 55 }}>
        <div
          style={{
            position: "absolute",
            left: (overlay.posicao?.x ?? 0.07) * width,
            top: (overlay.posicao?.y ?? 0.76) * height,
            opacity: vis,
          }}
        >
          <div
            style={{
              height: 6 * escala,
              width: 220 * escala * larguraBarra,
              backgroundColor: estilo.cores.destaque,
              borderRadius: 999,
              marginBottom: 14 * escala,
            }}
          />
          <div
            style={{
              ...base,
              fontSize: 62 * escala,
              fontWeight: 800,
              /*
                Entrelinha apertada de propósito.

                O padrão do navegador (~1,2) é feito pra parágrafo de texto
                corrido, onde a folga ajuda a ler linha a linha. Num lettering
                de duas ou três palavras em corpo 62, a mesma folga separa o que
                deveria ler como um bloco só: "Gestão de" e "resíduos"
                apareciam distantes, como se fossem duas informações.
              */
              lineHeight: 1.02,
              transform: `translateX(${interpolate(entrada, [0, 1], [-30 * escala, 0])}px)`,
            }}
          >
            {overlay.texto}
          </div>
          {overlay.subtexto ? (
            <div
              style={{
                ...base,
                fontSize: 32 * escala,
                fontWeight: 500,
                lineHeight: 1.15,
                opacity: vis * 0.82,
                // encostada na linha de cima: as duas são a mesma frase partida
                // em dois pesos, não dois avisos separados
                marginTop: 3 * escala,
              }}
            >
              {overlay.subtexto}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (overlay.tipo === "destaque") {
    return (
      <AbsoluteFill style={{ zIndex: 55, justifyContent: "flex-start", alignItems: "center" }}>
        <div
          style={{
            ...base,
            marginTop: (overlay.posicao?.y ?? 0.12) * height,
            fontSize: 54 * escala,
            fontWeight: 800,
            backgroundColor: estilo.cores.destaque,
            color: "#0b0b0d",
            padding: `${14 * escala}px ${30 * escala}px`,
            borderRadius: 16 * escala,
            transform: `scale(${interpolate(entrada, [0, 1], [0.9, 1])}) rotate(${interpolate(entrada, [0, 1], [-2.5, 0])}deg)`,
            textShadow: "none",
          }}
        >
          {overlay.texto}
        </div>
      </AbsoluteFill>
    );
  }

  // marca d'água / logo textual
  return (
    <AbsoluteFill style={{ zIndex: 55 }}>
      <div
        style={{
          ...base,
          position: "absolute",
          left: (overlay.posicao?.x ?? 0.04) * width,
          top: (overlay.posicao?.y ?? 0.05) * height,
          fontSize: 34 * escala,
          fontWeight: 700,
          opacity: vis * 0.72,
        }}
      >
        {overlay.texto}
      </div>
    </AbsoluteFill>
  );
};
