/**
 * SupremoCut — Camada
 *
 * Desenha uma fonte de vídeo (câmera ou tela) dentro de um retângulo,
 * com cantos, borda, sombra e zoom/pan (foco).
 */

import React from "react";
import {
  getRemotionEnvironment,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import type { Foco, Retangulo } from "../tipos";

type Props = {
  /** Caminho relativo dentro de estudio/public — o arquivo de qualidade. */
  src: string;
  /** Versão leve, usada quando estamos no editor e não renderizando. */
  srcPreview?: string;
  /** Carimbo do último processamento — vira `?v=` na URL e derruba o cache. */
  versaoMidia?: string | number | null;
  /** Segundo do arquivo bruto onde essa cena começa (já com o offset de sync). */
  inicioNaFonte: number;
  retangulo: Retangulo;
  foco?: Foco | null;
  velocidade?: number;
  corBorda: string;
  /** Corta a camada na diagonal (usado no split_diagonal). */
  diagonal?: "esq" | "dir" | null;
  zIndex: number;
};

export const Camada: React.FC<Props> = ({
  src,
  srcPreview,
  versaoMidia = null,
  inicioNaFonte,
  retangulo: r,
  foco,
  velocidade = 1,
  corBorda,
  diagonal = null,
  zIndex,
}) => {
  const { width, height, fps } = useVideoConfig();

  // Camada invisível: não renderiza nada (economiza render).
  if (r.opacidade <= 0.001 || r.largura <= 0.001 || r.altura <= 0.001) {
    return null;
  }

  const zoom = foco?.zoom ?? 1;
  // Pan: converte o ponto de foco (0..1) em deslocamento percentual.
  const panX = foco ? (0.5 - foco.x) * (zoom - 1) * 100 : 0;
  const panY = foco ? (0.5 - foco.y) * (zoom - 1) * 100 : 0;

  const clip =
    diagonal === "esq"
      ? "polygon(0 0, 100% 0, calc(100% - 12%) 100%, 0 100%)"
      : diagonal === "dir"
        ? "polygon(12% 0, 100% 0, 100% 100%, 0 100%)"
        : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left: r.x * width,
        top: r.y * height,
        width: r.largura * width,
        height: r.altura * height,
        borderRadius: r.raio,
        overflow: "hidden",
        opacity: r.opacidade,
        zIndex,
        // sombra em px também escala com a altura da composição, senão o
        // preview de meia resolução mostra uma sombra com o dobro do peso
        boxShadow: r.sombra
          ? `0 ${24 * (height / 1080)}px ${70 * (height / 1080)}px rgba(0,0,0,0.55), ` +
            `0 ${4 * (height / 1080)}px ${14 * (height / 1080)}px rgba(0,0,0,0.35)`
          : undefined,
        border: r.borda > 0 ? `${r.borda}px solid ${corBorda}` : undefined,
        clipPath: clip,
        // evita serrilhado nas bordas arredondadas durante a animação
        WebkitMaskImage: r.raio > 0 ? "-webkit-radial-gradient(white, black)" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`,
          transformOrigin: "center center",
        }}
      >
        {/*
          DOIS componentes, um pra cada trabalho. Nao e indecisao — cada um
          falha exatamente onde o outro funciona:

          NO EDITOR — <Video> do @remotion/media.
            O OffthreadVideo extrai quadro a quadro e crava o currentTime a
            cada frame. No player isso vira cabo de guerra com a reproducao
            natural do navegador, e a imagem avanca e recua. Foi o travamento
            que levou quatro tentativas pra achar.

          NO RENDER — <OffthreadVideo>.
            O @remotion/media decodifica por WebCodecs dentro da pagina. Serve
            pra tocar; nao serve pra render, onde cada quadro e pedido fora de
            ordem. Aqui ele estourava o tempo limite logo no comeco:

              Timeout while extracting frame at time 0.3sec

            e nenhum dos doze anuncios saia. O OffthreadVideo faz a extracao
            fora do navegador, que e justamente pra isso que ele existe.
        */}
        {getRemotionEnvironment().isRendering ? (
          <OffthreadVideo
            src={staticFile(src)}
            trimBefore={Math.max(0, Math.round(inicioNaFonte * fps))}
            playbackRate={velocidade}
            muted
            /* o audio vem da trilha, montada em Video.tsx */
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Video
            /*
              O `?v=` no fim nao e enfeite.

              O proxy de preview mora sempre no mesmo caminho —
              `<projeto>/camera-preview.mp4` — e o navegador guarda video em
              cache por URL. Quando o motor reprocessa o material, o arquivo no
              disco muda mas a URL nao: o editor continua mostrando o video
              ANTIGO, sem nenhum aviso, e nem Ctrl+Shift+R resolve porque o
              recarregamento forcado vale pra pagina, nao pro <video> dentro
              dela.

              Foi assim que o Campelo viu a versao com faixa desfocada depois
              de eu ja ter trocado tudo por tela cheia — e me disse que o
              editor estava "amassando" os videos.

              `versao_midia` e gravado pelo montador a cada processamento. Com
              ele na URL, arquivo novo e endereco novo, e o cache nao tem como
              servir o passado.
            */
            src={staticFile(srcPreview ?? src) + (versaoMidia ? `?v=${versaoMidia}` : "")}
            trimBefore={Math.max(0, Math.round(inicioNaFonte * fps))}
            playbackRate={velocidade}
            muted
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
    </div>
  );
};
