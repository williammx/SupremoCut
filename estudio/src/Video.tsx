/**
 * SupremoCut — Composição principal
 *
 * Monta a linha do tempo inteira: cenas em sequência, áudio já tratado,
 * legenda dinâmica por cima e overlays.
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Freeze,
  getRemotionEnvironment,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { curvaDeVolume } from "./musica";
import { palavrasNaLinhaDoTempo } from "./legendas";
import type { PropsVideo } from "./tipos";
import { geometriaDaCena, type Geometria } from "./layouts";
import { Cena } from "./componentes/Cena";
import { Legenda } from "./componentes/Legenda";
import { Camadas } from "./componentes/Camadas";
import { camadasDoRoteiro } from "./migrar";
import { nomeDaCamada } from "./camadas";
import { familiaSegura } from "./fonte";

/**
 * Presets de entrada que deixam ver o que está por baixo enquanto acontecem.
 *
 * Quem estiver nesta lista obriga a cena anterior a continuar viva durante a
 * entrada. Preset novo do grupo "entrada" em `animacao.ts` provavelmente
 * pertence aqui também — a exceção é o que entra já cobrindo a tela inteira.
 */
const ENTRADAS_QUE_REVELAM = new Set([
  "aparecer",
  "aparecer_sumir",
  "crescer",
  "deslizar_dir",
  "deslizar_esq",
  "subir",
  "cair",
]);

/** Quanto tempo a cena anterior fica viva por baixo de uma entrada dessas. */
const SOBRA_PRESET = 0.7;

export const VideoPrincipal: React.FC<PropsVideo> = ({ roteiro, estilo, pasta }) => {
  const fps = roteiro.fps;
  const { width: larguraComp, height: alturaComp } = useVideoConfig();

  /** Roteiro novo (com trilha) ou antigo (som soldado às cenas)? */
  const temTrilha = (roteiro.trilha_audio?.length ?? 0) > 0;

  /**
   * Palavras convertidas para o relógio do vídeo final, seguindo os cortes
   * ATUAIS. É derivado, não gravado — por isso aparar ou reordenar um bloco
   * leva a legenda junto em vez de descolá-la.
   */
  const palavrasFinais = useMemo(
    () =>
      palavrasNaLinhaDoTempo(
        roteiro.legendas?.palavras ?? [],
        roteiro.cenas,
        roteiro.audio?.offset ?? 0,
      ),
    [roteiro.legendas?.palavras, roteiro.cenas, roteiro.audio?.offset],
  );

  /**
   * A pilha de camadas.
   *
   * Projeto novo já traz `camadas` pronta; projeto antigo é traduzido aqui, na
   * leitura, sem tocar no arquivo do disco.
   */
  const camadas = useMemo(() => camadasDoRoteiro(roteiro, estilo), [roteiro, estilo]);

  // curva de volume da música, calculada uma vez e reusada em todos os quadros
  const volumeMusica = useMemo(() => {
    if (!roteiro.musica?.arquivo) return null;
    const total = roteiro.cenas.reduce((a, c) => a + c.duracao, 0);
    return curvaDeVolume(roteiro.musica, palavrasFinais, total, fps);
  }, [roteiro.musica, palavrasFinais, roteiro.cenas, fps]);

  // Posição de cada cena na linha do tempo final
  let cursor = 0;
  const blocos = roteiro.cenas.map((cena, i) => {
    const inicio = cursor;
    const dur = Math.max(1, Math.round(cena.duracao * fps));
    cursor += dur;

    /**
     * Sobreposição para as transições que atravessam duas cenas.
     *
     * Fade e zoom cruzado sobem a opacidade de 0 até 1. Se a cena anterior já
     * tivesse acabado, esse zero revelaria o FUNDO — ou seja, um piscar de
     * preto em vez de uma dissolução. Então a cena que sai continua viva por
     * baixo durante a transição da que entra.
     */
    const proxima = roteiro.cenas[i + 1];
    const entradaProx = proxima?.entrada;
    // Toda transição que revela o que está atrás precisa da cena anterior viva.
    // O `deslize` estava de fora e mostrava o fundo pelo rastro do movimento.
    const atravessa =
      entradaProx?.tipo === "fade" ||
      entradaProx?.tipo === "zoom_cruzado" ||
      entradaProx?.tipo === "deslize" ||
      // Os presets de movimento entram na mesma conta. "Aparecer suave" sobe a
      // opacidade a partir do zero, "deslizar" chega de fora do quadro,
      // "crescer" nasce menor que a tela — os três revelam o que está atrás. Se
      // a cena anterior já tiver morrido, o que aparece é o fundo preto, e a
      // entrada bonita vira um piscar.
      ENTRADAS_QUE_REVELAM.has(proxima?.preset_animacao ?? "");

    /**
     * Colchão de segurança, mesmo no corte seco.
     *
     * A cena que entra fica POR CIMA, então esses quadros extras não aparecem
     * quando tudo vai bem. Eles só importam se o decodificador atrasar: aí
     * você vê o último quadro da cena anterior em vez de um flash preto.
     */
    const COLCHAO = 4;
    const sobra = !proxima
      ? 0
      : atravessa && entradaProx && "duracao" in entradaProx
        ? Math.ceil(entradaProx.duracao * fps)
        : atravessa
          ? // preset de entrada: não há duração declarada na transição, então
            // vale o teto dos presets de entrada (ver ENTRADA() em animacao.ts)
            Math.ceil(SOBRA_PRESET * fps)
          : COLCHAO;

    return { cena, inicio, dur, durComSobra: dur + sobra };
  });

  let geoAnterior: Geometria | null = null;

  return (
    <AbsoluteFill style={{ backgroundColor: estilo.cores.fundo }}>
      {/* ---- vídeo ---- */}
      {blocos.map(({ cena, inicio, dur, durComSobra }, i) => {
        const anterior = geoAnterior;
        // Dimensões da COMPOSIÇÃO, não as do roteiro: no formato Vertical as
        // duas divergem, e o morph partia de uma caixa com proporção errada.
        geoAnterior = geometriaDaCena(cena, estilo, larguraComp, alturaComp);
        return (
          <Sequence
            key={cena.id}
            from={inicio}
            durationInFrames={durComSobra}
            /**
             * Monta a cena antes da hora (sem mostrar) pro vídeo já estar
             * decodificado quando o corte chegar. Sem isso, cada emenda
             * mostra o fundo por alguns quadros até o decodificador acordar.
             */
            premountFor={Math.round(fps * 0.8)}
            styleWhilePremounted={{ opacity: 0 }}
            style={{ zIndex: i + 1 }}
            name={`${cena.layout} · ${cena.nota ?? cena.id}`}
          >
            {/*
              Congelar segura a IMAGEM num instante e deixa o áudio correndo —
              por isso o Freeze envolve só a cena, nunca o Audio abaixo.
              `congelar` é o segundo dentro do bloco, então vira quadro somando
              o início do próprio bloco.
            */}
            {typeof cena.congelar === "number" ? (
              /*
                O quadro do Freeze é RELATIVO ao Sequence, não absoluto: dentro
                dele os filhos leem `useCurrentFrame() === frame`. Somar o
                início do bloco fazia o congelamento apontar para fora da fonte
                em todos os blocos menos o primeiro.
              */
              <Freeze frame={Math.round(cena.congelar * fps)}>
                <Cena
                  cena={cena}
                  geoAnterior={anterior}
                  roteiro={roteiro}
                  estilo={estilo}
                  pasta={pasta}
                />
              </Freeze>
            ) : (
              <Cena
                cena={cena}
                geoAnterior={anterior}
                roteiro={roteiro}
                estilo={estilo}
                pasta={pasta}
              />
            )}
            {/*
              O áudio vive AQUI DENTRO, no mesmo Sequence do vídeo, buscando o
              mesmo trecho da fonte. É isso que garante que cortar, aparar ou
              reordenar um bloco mova imagem e som juntos — antes o áudio era
              um arquivo pré-montado e ficava para trás a cada edição.
            */}
            {/*
              Só monta o áudio aqui quando o roteiro NÃO tem trilha própria.
              Com trilha, o som é desenhado fora das cenas (mais abaixo) e
              deixa de ser refém do corte de vídeo.
            */}
            {!temTrilha && roteiro.audio?.arquivo ? (
              <Sequence durationInFrames={dur} layout="none" showInTimeline={false}>
                <Audio
                  src={staticFile(
                    `${pasta}/${
                      getRemotionEnvironment().isRendering
                        ? roteiro.audio.arquivo
                        : (roteiro.audio.arquivo_preview ?? roteiro.audio.arquivo)
                    }`,
                  )}
                  trimBefore={Math.max(
                    0,
                    Math.round((cena.fonte_inicio + (roteiro.audio.offset ?? 0)) * fps),
                  )}
                  playbackRate={cena.velocidade ?? 1}
                  volume={cena.volume ?? 1}
                />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}

      {/* ---- trilha de áudio, independente do vídeo ---- */}
      {temTrilha
        ? roteiro.trilha_audio!.map((c) => {
            const arquivoRender = c.arquivo ?? roteiro.audio?.arquivo;
            if (!arquivoRender) return null;
            const arquivoPreview =
              c.arquivo ?? roteiro.audio?.arquivo_preview ?? arquivoRender;
            const quadros = Math.max(1, Math.round(c.duracao * fps));
            const fIn = Math.max(0, Math.round((c.fade_entrada ?? 0) * fps));
            const fOut = Math.max(0, Math.round((c.fade_saida ?? 0) * fps));

            return (
              <Sequence
                key={c.id}
                from={Math.round(c.inicio * fps)}
                durationInFrames={quadros}
                layout="none"
                name={`áudio · ${c.nota ?? c.id}`}
              >
                <Audio
                  src={staticFile(
                    `${pasta}/${
                      getRemotionEnvironment().isRendering ? arquivoRender : arquivoPreview
                    }`,
                  )}
                  trimBefore={Math.max(
                    0,
                    Math.round((c.fonte_inicio + (roteiro.audio?.offset ?? 0)) * fps),
                  )}
                  /* Sem isto, um bloco acelerado tocava o som em velocidade
                     normal: a imagem corria na frente e a fala ficava para trás
                     — e o atraso se acumulava até o fim do vídeo. */
                  playbackRate={c.velocidade ?? 1}
                  volume={(f) => {
                    // subida e descida do próprio clipe, em quadro relativo
                    let v = c.volume ?? 1;
                    if (fIn > 0 && f < fIn) v *= f / fIn;
                    const resta = quadros - 1 - f;
                    if (fOut > 0 && resta < fOut) v *= Math.max(0, resta) / fOut;
                    return Math.max(0, v);
                  }}
                />
              </Sequence>
            );
          })
        : null}

      {/* ---- música de fundo, abaixando sozinha quando tem fala ---- */}
      {roteiro.musica?.arquivo && volumeMusica ? (
        (() => {
          const inicioMusica = Math.round((roteiro.musica.inicio ?? 0) * fps);
          return (
            <Sequence from={inicioMusica} name={`música · ${roteiro.musica.arquivo}`}>
              <Audio
                src={staticFile(`musica/${roteiro.musica.arquivo}`)}
                /* A curva já nasce no relógio da música (ver musica.ts), então
                   o quadro relativo do Sequence indexa direto. */
                volume={(f) => volumeMusica[Math.min(f, volumeMusica.length - 1)] ?? 0}
                loop
              />
            </Sequence>
          );
        })()
      ) : null}

      {/* ---- legendas ---- */}
      {roteiro.legendas ? (
        <Legenda
          legendas={roteiro.legendas}
          palavras={palavrasFinais}
          estilo={estilo}
        />
      ) : null}

      {/*
        ---- a pilha de camadas ----

        Texto, forma, imagem e vídeo flutuante, na ordem da lista: o último
        desenha por cima. As cenas de vídeo continuam sendo o fundo, sempre
        atrás de tudo isto.

        `camadasDoRoteiro` traduz na hora os projetos que ainda estão no modelo
        antigo de overlays. Nenhum arquivo é reescrito — a tradução vive só na
        memória, até o usuário salvar.
      */}
      {camadas.map((c, i) => (
        <Sequence
          key={c.id}
          from={Math.round(c.inicio * fps)}
          durationInFrames={Math.max(1, Math.round(c.duracao * fps))}
          name={`${c.tipo} · ${nomeDaCamada(c)}`}
          layout="none"
        >
          <Camadas
            camadas={[c]}
            indiceBase={i}
            pasta={pasta}
            familia={familiaSegura(estilo.fonte.familia)}
            sombraTexto={estilo.cores.texto_sombra}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Duração total = soma das cenas. */
export function duracaoEmFrames(roteiro: PropsVideo["roteiro"]): number {
  const total = roteiro.cenas.reduce(
    (acc, c) => acc + Math.max(1, Math.round(c.duracao * roteiro.fps)),
    0,
  );
  return Math.max(1, total);
}
