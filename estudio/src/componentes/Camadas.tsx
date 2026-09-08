/**
 * SupremoCut — desenha a pilha de camadas por cima do vídeo.
 *
 * Uma camada por elemento na tela, na ordem da lista: o último desenha por
 * cima. Nada aqui sabe o que é um "lower third" — isso virou um arranjo de três
 * camadas que um atalho monta, e depois some enquanto conceito.
 *
 * A ESCALA
 *
 * Todo tamanho em pixel neste arquivo é "px pensados para 1080 de ALTURA", e é
 * multiplicado por `altura/1080`. Não é escolha nova: é a convenção que o
 * projeto já usava nos overlays antigos, e mantê-la é o que faz a migração sair
 * igual ao que já estava aprovado. Trocar por largura mudaria o corpo de todo
 * texto de todo projeto de uma vez.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { OffthreadVideo, getRemotionEnvironment } from "remotion";
import {
  ENTRADA_PADRAO,
  SAIDA_PADRAO,
  zDaCamada,
  type Camada,
  type CamadaForma,
  type CamadaImagem,
  type CamadaTexto,
  type CamadaVideo,
  type EntradaCamada,
  type SaidaCamada,
} from "../camadas";
import { pintar } from "../trechos";
import { familiaSegura } from "../fonte";


type Ctx = {
  escala: number;
  largura: number;
  altura: number;
  familia: string;
  sombraTexto: string;
};

/**
 * Visibilidade e deslocamento de entrada.
 *
 * A saída é sempre um esmaecer curto; a entrada é escolhida por camada. Os dois
 * são calculados aqui pra que uma barra e o texto que vem com ela possam
 * combinar o gesto sem duplicar conta.
 */
const useGesto = (c: Camada, ctx: Ctx) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entradaCfg: EntradaCamada = c.entrada ?? ENTRADA_PADRAO;

  const total = Math.round(c.duracao * fps);
  const mola = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.8 },
    durationInFrames: Math.max(1, Math.round(entradaCfg.duracao * fps)),
  });
  const chegou = entradaCfg.tipo === "nenhuma" ? 1 : mola;

  /*
    A saída tem tipo próprio, e "nenhuma" significa NENHUMA.

    Uma tarja que cobre legenda queimada não pode esmaecer no fim: uma cobertura
    que some não cobre. Quando isto era um esmaecer fixo aplicado a toda camada,
    o russo do anúncio do Othor reaparecia por baixo — o mesmo defeito que o
    modelo antigo já tinha corrigido e que a migração ressuscitou.
  */
  const saidaCfg: SaidaCamada = c.saida ?? SAIDA_PADRAO;
  const quadrosSaida = Math.max(1, Math.round(saidaCfg.duracao * fps));
  const saindo =
    saidaCfg.tipo === "nenhuma"
      ? 1
      : interpolate(frame, [total - quadrosSaida, total], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const vis = Math.min(chegou, saindo) * (c.opacidade ?? 1);

  let transform = "";
  if (entradaCfg.tipo === "subir") {
    transform = `translateY(${interpolate(chegou, [0, 1], [40 * ctx.escala, 0])}px)`;
  } else if (entradaCfg.tipo === "deslizar") {
    transform = `translateX(${interpolate(chegou, [0, 1], [-30 * ctx.escala, 0])}px)`;
  }
  if (c.rotacao) transform += ` rotate(${c.rotacao}deg)`;

  /** Só a forma usa: abre da esquerda pra direita em vez de aparecer inteira. */
  const abrindo = entradaCfg.tipo === "abrir" ? chegou : 1;

  return { vis, transform, abrindo };
};

const Texto: React.FC<{ c: CamadaTexto; ctx: Ctx }> = ({ c, ctx }) => {
  const { vis, transform } = useGesto(c, ctx);
  // centrar pela metade da própria altura, que o navegador conhece e eu não
  const centrado = c.ancora === "centro" ? "translateY(-50%) " : "";
  return (
    <div
      style={{
        position: "absolute",
        left: c.x * ctx.largura,
        top: c.y * ctx.altura,
        width: c.largura * ctx.largura,
        letterSpacing: c.espacamento ? `${c.espacamento}em` : undefined,
        // fonte da camada, se ela escolheu uma; senão a do projeto
        fontFamily: c.fonte ? familiaSegura(c.fonte) : ctx.familia,
        fontSize: c.tamanho * ctx.escala,
        fontWeight: c.peso,
        lineHeight: c.entrelinha > 0 ? c.entrelinha : "normal",
        color: c.cor,
        textAlign:
          c.alinhamento === "centro" ? "center" : c.alinhamento === "direita" ? "right" : "left",
        /*
          Palavra que não cabe QUEBRA, em vez de vazar.

          O comportamento normal do navegador é deixar uma palavra longa
          transbordar a caixa em silêncio. Num parágrafo isso é razoável; num
          lettering em corpo grande é o texto saindo pelos dois lados da tela,
          que foi o que aconteceu com "SUSTENTA" a 130px numa caixa de 80%.

          Quebrar dentro da palavra é feio — mas some da tela é pior, e o
          usuário vê o problema e conserta o tamanho. Vazar, ele só descobre
          no vídeo pronto.
        */
        overflowWrap: "break-word",
        /*
          Quebra de linha DIGITADA vale.

          Sem isto, o navegador engole o `\n` e só quebra onde a caixa acaba —
          e onde a caixa acaba raramente é onde a frase respira: "As melhores
          bombas da / Itália" deixa uma palavra órfã embaixo. `pre-line`
          preserva a quebra que a pessoa pôs e continua juntando os espaços
          sobrando, que é o comportamento que se quer num lettering.
        */
        whiteSpace: "pre-line",
        textTransform: c.caixa_alta ? "uppercase" : "none",
        textShadow: c.sombra
          ? `0 ${3 * ctx.escala}px ${12 * ctx.escala}px ${ctx.sombraTexto}`
          : undefined,
        WebkitTextStroke: c.contorno ? `${c.contorno * ctx.escala}px rgba(0,0,0,0.85)` : undefined,
        paintOrder: "stroke fill",
        opacity: vis,
        transform: centrado + transform,
      }}
    >
      {/*
        Sem trecho pintado, `pintar` devolve UM pedaço com o texto inteiro — o
        caso de quase toda camada. O `<span>` a mais não muda nada: um span sem
        estilo próprio não afeta quebra de linha, entrelinha nem espaçamento.

        A cor vai no span, não no `div`, porque é o span que pode ser diferente.
        O resto — corpo, peso, contorno, sombra — continua na caixa, herdado por
        todos os pedaços, pra que pintar uma palavra não a desalinhe das outras.
      */}
      {pintar(c.texto, c.cor, c.trechos).map((p, i) => (
        <span key={i} style={{ color: p.cor }}>
          {p.texto}
        </span>
      ))}
    </div>
  );
};

/**
 * "#0FB5A6" + 0.8  ->  "rgba(15,181,166,0.8)".
 *
 * Existe porque o degradê precisa da MESMA cor em duas opacidades, e
 * `background-color` + `opacity` não serve: `opacity` esmaeceria a camada
 * inteira, inclusive a parte que devia continuar cheia.
 */
const comAlfa = (hex: string, alfa: number): string => {
  const h = hex.replace("#", "");
  const largo = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(largo.slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
};

/**
 * O `sentido` diz pra onde o degradê ESMAECE, e é isso que o CSS quer também:
 * `linear-gradient(to top, ...)` corre de baixo pra cima.
 *
 * O que engana é a porcentagem. `0%` não é "o começo da tela", é o começo da
 * LINHA do degradê — que em `to top` fica EMBAIXO. Então a ponta cheia vai em
 * 0% e a transparente em 100%, ao contrário do que a leitura de cima pra baixo
 * sugere. Escrever ao contrário deixa o véu escuro no céu e limpo no texto:
 * exatamente o oposto do que ele existe pra fazer, e sem erro nenhum no
 * console.
 */
const PARA_ONDE_ESMAECE: Record<string, string> = {
  cima: "to top",
  baixo: "to bottom",
  esquerda: "to left",
  direita: "to right",
};

const Forma: React.FC<{ c: CamadaForma; ctx: Ctx }> = ({ c, ctx }) => {
  const { vis, transform, abrindo } = useGesto(c, ctx);
  const d = c.degrade;
  return (
    <div
      style={{
        position: "absolute",
        left: c.x * ctx.largura,
        top: c.y * ctx.altura,
        width: c.largura * ctx.largura * abrindo,
        height: c.altura * ctx.altura,
        ...(d
          ? {
              backgroundImage: `linear-gradient(${
                PARA_ONDE_ESMAECE[d.sentido] ?? "to top"
              }, ${comAlfa(c.cor, d.opacidade)} 0%, ${comAlfa(c.cor, 0)} 100%)`,
            }
          : { backgroundColor: c.cor }),
        borderRadius: c.raio * ctx.escala,
        opacity: vis,
        transform,
        transformOrigin: "left center",
      }}
    />
  );
};

const Imagem: React.FC<{ c: CamadaImagem; ctx: Ctx; pasta: string }> = ({ c, ctx, pasta }) => {
  const { vis, transform } = useGesto(c, ctx);
  return (
    <Img
      src={staticFile(`${pasta}/imagens/${c.arquivo}`)}
      style={{
        position: "absolute",
        left: c.x * ctx.largura,
        top: c.y * ctx.altura,
        width: c.largura * ctx.largura,
        height: "auto",
        borderRadius: c.raio * ctx.escala,
        boxShadow: c.sombra ? `0 ${10 * ctx.escala}px ${40 * ctx.escala}px rgba(0,0,0,.45)` : undefined,
        opacity: vis,
        transform,
      }}
    />
  );
};

/**
 * Vídeo flutuante — um arquivo solto por cima da montagem.
 *
 * Não participa do corte: enquanto as `cenas` são a sequência que forma o
 * vídeo, esta camada é um vídeo que se sobrepõe, como um PiP ou uma vinheta.
 *
 * Os dois componentes de vídeo aparecem aqui pelo mesmo motivo de sempre, e o
 * motivo está escrito por extenso em `Camada.tsx`: `@remotion/media` toca bem
 * e não renderiza; `OffthreadVideo` renderiza bem e não toca.
 */
const VideoCamada: React.FC<{ c: CamadaVideo; ctx: Ctx; pasta: string }> = ({ c, ctx, pasta }) => {
  const { vis, transform } = useGesto(c, ctx);
  const { fps } = useVideoConfig();
  const src = `${pasta}/${c.arquivo}`;
  const preview = c.arquivo_preview ? `${pasta}/${c.arquivo_preview}` : src;
  const corte = Math.max(0, Math.round(c.fonte_inicio * fps));

  const estilo: React.CSSProperties = {
    position: "absolute",
    left: c.x * ctx.largura,
    top: c.y * ctx.altura,
    width: c.largura * ctx.largura,
    borderRadius: c.raio * ctx.escala,
    overflow: "hidden",
    opacity: vis,
    transform,
  };

  return (
    <div style={estilo}>
      {getRemotionEnvironment().isRendering ? (
        <OffthreadVideo
          src={staticFile(src)}
          trimBefore={corte}
          volume={c.volume}
          style={{ width: "100%", height: "auto" }}
        />
      ) : (
        <Video
          src={staticFile(preview)}
          trimBefore={corte}
          volume={c.volume}
          style={{ width: "100%", height: "auto" }}
        />
      )}
    </div>
  );
};

export const Camadas: React.FC<{
  camadas: Camada[];
  /**
   * Posição da primeira destas camadas na pilha completa.
   *
   * Existe porque cada camada é renderizada dentro da própria `Sequence` — ela
   * precisa aparecer e sumir na hora dela — e uma Sequence só recebe uma
   * camada por vez. Sem este número, todas calculariam z-index 100 e a ordem
   * de empilhamento sumiria.
   */
  indiceBase?: number;
  pasta: string;
  familia: string;
  sombraTexto: string;
}> = ({ camadas, indiceBase = 0, pasta, familia, sombraTexto }) => {
  const { width, height } = useVideoConfig();
  const ctx: Ctx = {
    escala: height / 1080,
    largura: width,
    altura: height,
    familia,
    sombraTexto,
  };

  return (
    <>
      {camadas.map((c, i) =>
        c.oculta ? null : (
          <AbsoluteFill key={c.id} style={{ zIndex: zDaCamada(indiceBase + i) }}>
            {c.tipo === "texto" && <Texto c={c} ctx={ctx} />}
            {c.tipo === "forma" && <Forma c={c} ctx={ctx} />}
            {c.tipo === "imagem" && <Imagem c={c} ctx={ctx} pasta={pasta} />}
            {c.tipo === "video" && <VideoCamada c={c} ctx={ctx} pasta={pasta} />}
          </AbsoluteFill>
        ),
      )}
    </>
  );
};
