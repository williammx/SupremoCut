/**
 * SupremoCut — máscara de região
 *
 * Borra, escurece ou isola um pedaço do quadro.
 *
 * COMO FUNCIONA
 *
 * Não existe filtro de CSS que borre "só este pedaço" — `filter` vale pro
 * elemento inteiro. Então são duas camadas:
 *
 *   1. o vídeo como está, embaixo;
 *   2. uma CÓPIA já tratada (borrada ou escurecida) por cima, recortada pela
 *      forma da máscara.
 *
 * Onde a máscara deixa passar, aparece a cópia tratada. Onde ela corta, aparece
 * o original.
 *
 * O CAMINHO ATÉ AQUI (duas tentativas descartadas, e por quê)
 *
 * 1. `mask-image` com gradiente de CSS. Funciona pra elipse. Retângulo com
 *    borda macia já exige dois gradientes cruzados e composição, e inverter
 *    (o efeito valer FORA da forma) vira um `clip-path` com polígono de nove
 *    pontos que ninguém lê depois.
 *
 * 2. Máscara SVG no DOM, referenciada por `mask: url(#id)`. Conceito certo,
 *    mas o `<svg width={0} height={0}>` que guardava a definição colapsava o
 *    espaço de coordenadas: a máscara avaliava preta em todo lugar e o quadro
 *    saía 100% preto. Dava pra consertar dando tamanho ao svg e região
 *    explícita à máscara — mas sobrariam ids globais disputando entre cenas.
 *
 * 3. (esta) SVG COMPLETO dentro de um `data:` URI. Autocontido: os ids são
 *    locais ao documento embutido, então duas cenas com máscara não brigam;
 *    não depende de nada estar montado no DOM na ordem certa; e funciona igual
 *    no preview e no render, que é a regra da casa.
 *
 * A borda macia é um `feGaussianBlur` na forma — a mesma conta que qualquer
 * editor chama de "pena", e que vale igual em retângulo, elipse e círculo.
 */

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { Mascara as TMascara } from "../tipos";

/**
 * O SVG da máscara, como data URI.
 *
 * O desenho final é branco onde deve passar e TRANSPARENTE onde deve cortar —
 * uma máscara de alfa, que é como o CSS interpreta uma imagem em `mask-image`.
 * Quem produz esse alfa é a `<mask>` interna: nela, branco deixa passar e preto
 * segura. Inverter é só trocar qual cor pinta o fundo e qual pinta a forma.
 */
const svgMascara = (m: TMascara, w: number, h: number, penaPx: number): string => {
  const cx = m.x * w;
  const cy = m.y * h;
  const rx = (m.largura * w) / 2;
  const ry = m.forma === "circulo" ? rx : (m.altura * h) / 2;

  const fundo = m.inverter ? "#fff" : "#000";
  const forma = m.inverter ? "#000" : "#fff";
  const giro = m.rotacao ? ` transform="rotate(${m.rotacao} ${cx} ${cy})"` : "";
  const filtro = penaPx > 0 ? ' filter="url(#p)"' : "";

  const desenho =
    m.forma === "retangulo"
      ? `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" fill="${forma}"${filtro}${giro}/>`
      : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${forma}"${filtro}${giro}/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    // a região do filtro sobra dos dois lados: sem isso o borrão da pena é
    // cortado na borda e a suavização vira um degrau
    `<filter id="p" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur stdDeviation="${(penaPx / 2).toFixed(2)}"/>` +
    `</filter>` +
    `<mask id="m">` +
    `<rect width="${w}" height="${h}" fill="${fundo}"/>` +
    desenho +
    `</mask>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="#fff" mask="url(#m)"/>` +
    `</svg>`;

  // encodeURIComponent e não base64: fica legível ao inspecionar, e o `#` das
  // cores precisa escapar de qualquer jeito
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

export const Mascara: React.FC<{
  mascara: TMascara;
  children: React.ReactNode;
}> = ({ mascara: m, children }) => {
  const { width, height } = useVideoConfig();
  const escala = height / 1080;
  const penaPx = Math.max(0, m.pena * escala);

  const tratamento: React.CSSProperties =
    m.efeito === "desfocar"
      ? { filter: `blur(${Math.max(0, m.forca) * escala}px)` }
      : m.efeito === "escurecer"
        ? { filter: `brightness(${Math.max(0, 1 - Math.min(1, m.forca))})` }
        : {};

  const mascaraCss = svgMascara(m, width, height, penaPx);

  /*
    "recortar" é o único que NÃO desenha o vídeo por baixo: a graça dele é o
    resto sumir e aparecer o fundo. Nos outros dois o de baixo tem que ficar,
    senão o que está fora da máscara vira buraco em vez de continuar como era.
  */
  const mostraBase = m.efeito !== "recortar";

  /*
    `isolation: isolate` nos dois envelopes, e não só um z-index no de cima.

    As camadas de vídeo trazem z-index próprio (10 e 20, de `layouts.ts`, que é
    o que decide quem fica na frente no PiP). Sem uma barreira, esses números
    escapam pro contexto de empilhamento da raiz — e aí a cópia de BAIXO, com
    z-index 20, pintava por cima da cópia mascarada, que não tem z-index
    nenhum. O resultado era um quadro idêntico ao original: a máscara existia,
    estava certa, e ficava escondida atrás da própria base.

    Foi assim que "borrar" e "escurecer" pareciam não funcionar enquanto
    "recortar" funcionava — recortar não desenha a base, então não havia nada
    pra passar na frente.
  */
  return (
    <AbsoluteFill>
      {mostraBase ? (
        <AbsoluteFill style={{ isolation: "isolate", zIndex: 0 }}>{children}</AbsoluteFill>
      ) : null}

      <AbsoluteFill
        style={{
          ...tratamento,
          isolation: "isolate",
          zIndex: 1,
          maskImage: mascaraCss,
          WebkitMaskImage: mascaraCss,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Se esta máscara faz alguma coisa.
 *
 * Máscara de tamanho zero não deve custar duas camadas de composição e um
 * filtro por quadro — e o preview é o lugar mais sensível do sistema.
 */
export const mascaraAtiva = (m: TMascara | null | undefined): m is TMascara =>
  !!m && m.largura > 0 && m.altura > 0;
