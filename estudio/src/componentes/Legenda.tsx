/**
 * SupremoCut — Legenda dinâmica.
 *
 * A maioria assiste vertical SEM SOM. Isso faz da legenda o elemento que mais
 * mexe em retenção — por isso ela tem presets de verdade, e não só uma cor.
 * Cada preset aqui existe em produto que roda anúncio: o tipo "hormozi" com
 * fundo sólido na palavra falada, o karaokê, o neon, a caixa.
 *
 * Os tempos chegam já convertidos pro relógio do vídeo final (ver legendas.ts).
 */

import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Estilo, Legendas, Palavra } from "../tipos";
import { familiaSegura } from "../fonte";

type Grupo = { inicio: number; fim: number; palavras: Palavra[] };

/** Junta as palavras em grupos que cabem na tela. */
function agrupar(palavras: Palavra[], max: number): Grupo[] {
  const grupos: Grupo[] = [];
  let atual: Palavra[] = [];

  const fechar = () => {
    if (atual.length === 0) return;
    grupos.push({
      inicio: atual[0].t,
      fim: atual[atual.length - 1].fim,
      palavras: atual,
    });
    atual = [];
  };

  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    const anterior = atual[atual.length - 1];
    const pausaLonga = anterior ? p.t - anterior.fim > 0.6 : false;
    const terminouFrase = anterior ? /[.!?…]$/.test(anterior.texto) : false;

    if (atual.length >= max || pausaLonga || terminouFrase) fechar();
    atual.push(p);
  }
  fechar();
  return grupos;
}

type Props = {
  legendas: Legendas;
  /** Palavras JÁ no relógio do vídeo final. */
  palavras: Palavra[];
  estilo: Estilo;
};

export const Legenda: React.FC<Props> = ({ legendas, palavras, estilo }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const t = frame / fps;

  const grupos = useMemo(
    () => agrupar(palavras ?? [], estilo.legenda.max_palavras),
    [palavras, estilo.legenda.max_palavras],
  );

  if (legendas.estilo === "nenhum" || grupos.length === 0) return null;

  const faixas = legendas.ligada_em ?? [];
  const ligada = faixas.length === 0 || faixas.some(([a, b]) => t >= a && t <= b);
  if (!ligada) return null;

  const grupo = grupos.find((g) => t >= g.inicio - 0.12 && t <= g.fim + 0.35);
  if (!grupo) return null;

  const preset = legendas.estilo;
  const escala = height / 1080;
  // o hormozi pede letra maior: é o estilo que ocupa a tela de propósito
  const tamanho =
    estilo.fonte.tamanho_legenda * escala * (preset === "hormozi" ? 1.15 : 1);

  const framesDesdeInicio = (t - grupo.inicio) * fps;
  const entrada = spring({
    frame: Math.max(0, framesDesdeInicio),
    fps,
    config: { damping: 16, stiffness: 180, mass: 0.6 },
    durationInFrames: Math.round(0.22 * fps),
  });

  const contorno = estilo.legenda.contorno * escala;
  const sombraPadrao = [
    `0 ${3 * escala}px ${10 * escala}px ${estilo.cores.texto_sombra}`,
    contorno > 0
      ? `-${contorno}px -${contorno}px 0 #000, ${contorno}px -${contorno}px 0 #000, ` +
        `-${contorno}px ${contorno}px 0 #000, ${contorno}px ${contorno}px 0 #000`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  const caixaAlta = preset === "hormozi" ? true : estilo.fonte.caixa_alta;
  const peso = preset === "hormozi" ? 900 : estilo.fonte.peso;

  // fundo do bloco inteiro: só nos presets que não pintam palavra a palavra
  const fundoDoBloco =
    estilo.legenda.fundo && preset !== "caixa" && preset !== "hormozi";

  return (
    <AbsoluteFill
      style={{
        zIndex: 60,
        justifyContent: "flex-start",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: estilo.legenda.posicao_y * height,
          transform: `translateY(-50%) scale(${interpolate(entrada, [0, 1], [0.88, 1])})`,
          opacity: interpolate(entrada, [0, 1], [0, 1]),
          maxWidth: width * 0.84,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: `${0.22 * tamanho}px ${0.3 * tamanho}px`,
          padding: fundoDoBloco ? `${0.3 * tamanho}px ${0.55 * tamanho}px` : 0,
          borderRadius: fundoDoBloco ? 0.35 * tamanho : 0,
          backgroundColor: fundoDoBloco ? "rgba(0,0,0,0.62)" : "transparent",
        }}
      >
        {grupo.palavras.map((p, i) => {
          const ativa = t >= p.t && t <= p.fim;
          const jaPassou = t > p.fim;
          const chave = p.enfase;

          // salto da palavra no momento em que ela é dita
          const pop =
            ativa && preset !== "bloco" && preset !== "karaoke"
              ? spring({
                  frame: Math.max(0, (t - p.t) * fps),
                  fps,
                  config: { damping: 12, stiffness: 320, mass: 0.5 },
                  durationInFrames: Math.round(0.18 * fps),
                })
              : 0;

          // ---- cada preset decide cor, fundo e escala ----
          let cor = estilo.cores.texto;
          let fundo = "transparent";
          let opacidade = 1;
          let escalaPalavra = 1;
          let sombra = sombraPadrao;
          let padding = "0";
          let raio = 0;

          switch (preset) {
            case "hormozi":
              // o peso do estilo vem do bloco sólido atrás da palavra falada
              if (ativa) {
                fundo = estilo.cores.destaque;
                cor = "#0b0b0d";
              } else if (chave) {
                cor = estilo.cores.destaque;
              }
              padding = `${0.06 * tamanho}px ${0.16 * tamanho}px`;
              raio = 0.14 * tamanho;
              escalaPalavra = 1 + pop * 0.1;
              break;

            case "caixa":
              fundo = ativa ? estilo.cores.destaque : "rgba(0,0,0,0.78)";
              cor = ativa ? "#0b0b0d" : estilo.cores.texto;
              padding = `${0.05 * tamanho}px ${0.14 * tamanho}px`;
              raio = 0.1 * tamanho;
              sombra = "none";
              escalaPalavra = 1 + pop * 0.08;
              break;

            case "neon": {
              const c = ativa || chave ? estilo.cores.destaque : estilo.cores.texto;
              cor = c;
              sombra =
                `0 0 ${0.08 * tamanho}px ${c}, 0 0 ${0.2 * tamanho}px ${c}, ` +
                `0 0 ${0.4 * tamanho}px ${c}`;
              escalaPalavra = 1 + pop * 0.12;
              break;
            }

            case "pop":
              // a palavra dita domina; as outras recuam pra dar contraste
              cor = ativa ? estilo.cores.destaque : estilo.cores.texto;
              opacidade = ativa ? 1 : 0.55;
              escalaPalavra = ativa ? 1 + pop * 0.34 : 0.86;
              break;

            case "karaoke":
              opacidade = jaPassou || ativa ? 1 : 0.42;
              cor = chave ? estilo.cores.destaque : estilo.cores.texto;
              break;

            case "bloco":
              cor = chave ? estilo.cores.destaque : estilo.cores.texto;
              break;

            case "destaque":
            default:
              cor = ativa || chave ? estilo.cores.destaque : estilo.cores.texto;
              escalaPalavra = 1 + pop * 0.13;
              break;
          }

          return (
            <span
              key={`${i}-${p.texto}`}
              style={{
                fontFamily: familiaSegura(estilo.fonte.familia),
                fontWeight: peso,
                fontSize: tamanho,
                lineHeight: 1.08,
                color: cor,
                backgroundColor: fundo,
                padding: padding === "0" ? `0 ${0.07 * tamanho}px` : padding,
                borderRadius: raio,
                opacity: opacidade,
                textTransform: caixaAlta ? "uppercase" : "none",
                textShadow: sombra,
                display: "inline-block",
                transform: `scale(${escalaPalavra}) translateY(${-pop * 0.045 * tamanho}px)`,
                transformOrigin: "center bottom",
                letterSpacing: "-0.01em",
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
