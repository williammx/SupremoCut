/**
 * SupremoCut — Layouts
 *
 * Converte um layout ("pip", "split"...) na geometria de cada camada.
 * É AQUI que você mexe se quiser mudar onde o quadradinho fica,
 * o tamanho dele, o corte do split, etc.
 */

import type { Cena, Estilo, Retangulo } from "./tipos";

export type Geometria = {
  camera: Retangulo;
  tela: Retangulo;
  /** Ordem de empilhamento: quem fica por cima. */
  camera_na_frente: boolean;
};

const ESCONDIDO: Retangulo = {
  x: 0.5,
  y: 0.5,
  largura: 0,
  altura: 0,
  raio: 0,
  opacidade: 0,
  sombra: false,
  borda: 0,
};

const CHEIO = (): Retangulo => ({
  x: 0,
  y: 0,
  largura: 1,
  altura: 1,
  raio: 0,
  opacidade: 1,
  sombra: false,
  borda: 0,
});

/**
 * Calcula o retângulo do quadradinho (PiP) num canto.
 * Mantém proporção 16:9 e respeita a margem do estilo.
 */
function retanguloPip(
  cena: Cena,
  estilo: Estilo,
  largura: number,
  altura: number,
  escalaOverride?: number,
): Retangulo {
  const cfg = cena.pip ?? {
    canto: "inferior_direito" as const,
    escala: estilo.pip.escala_padrao,
    formato: "arredondado" as const,
  };

  const escala = escalaOverride ?? cfg.escala ?? estilo.pip.escala_padrao;

  /*
    Margem, raio e borda estão em pixels pensados para 1080p. O preview desenha
    em metade da resolução, então usá-los crus fazia a margem ocupar o DOBRO da
    proporção na tela — o preview mostrava um enquadramento que o render não ia
    reproduzir. Escalar pela altura mantém a mesma proporção em qualquer
    tamanho de composição.
  */
  const k = altura / 1080;
  const margemPx = estilo.pip.margem * k;
  const margemX = margemPx / largura;
  const margemY = margemPx / altura;

  const larg = escala;
  // mantém 16:9 do quadradinho independente do formato do quadro
  const alt = (escala * largura) / (altura * (16 / 9));

  const ehDireita = cfg.canto.includes("direito");
  const ehBaixo = cfg.canto.includes("inferior");

  const x = ehDireita ? 1 - larg - margemX : margemX;
  const y = ehBaixo ? 1 - alt - margemY : margemY;

  const circulo = cfg.formato === "circulo";
  const reto = cfg.formato === "reto";

  return {
    x,
    y,
    largura: larg,
    altura: circulo ? larg * (largura / altura) : alt,
    raio: circulo ? 9999 : reto ? 0 : estilo.pip.raio * k,
    opacidade: 1,
    sombra: estilo.pip.sombra,
    borda: estilo.pip.borda * k,
  };
}

/**
 * A geometria de uma cena. Puro: mesma cena => mesma geometria.
 */
export function geometriaDaCena(
  cena: Cena,
  estilo: Estilo,
  largura: number,
  altura: number,
): Geometria {
  switch (cena.layout) {
    case "camera":
      return { camera: CHEIO(), tela: ESCONDIDO, camera_na_frente: true };

    case "tela":
      return { camera: ESCONDIDO, tela: CHEIO(), camera_na_frente: false };

    case "pip":
      return {
        camera: retanguloPip(cena, estilo, largura, altura),
        tela: CHEIO(),
        camera_na_frente: true,
      };

    case "pip_grande":
      return {
        camera: retanguloPip(cena, estilo, largura, altura, (cena.pip?.escala ?? 0.26) * 1.55),
        tela: CHEIO(),
        camera_na_frente: true,
      };

    case "pip_invertido": {
      const pequeno = retanguloPip(cena, estilo, largura, altura);
      return { camera: CHEIO(), tela: pequeno, camera_na_frente: false };
    }

    case "split": {
      const meio: Retangulo = {
        x: 0,
        y: 0,
        largura: 0.5,
        altura: 1,
        raio: 0,
        opacidade: 1,
        sombra: false,
        borda: 0,
      };
      return {
        camera: { ...meio, x: 0 },
        tela: { ...meio, x: 0.5 },
        camera_na_frente: false,
      };
    }

    case "split_diagonal": {
      // visualmente o mesmo split; o corte diagonal é feito por clip-path na camada
      const meio: Retangulo = {
        x: 0,
        y: 0,
        largura: 0.56,
        altura: 1,
        raio: 0,
        opacidade: 1,
        sombra: false,
        borda: 0,
      };
      return {
        camera: { ...meio, x: 0 },
        tela: { ...meio, x: 0.44 },
        camera_na_frente: true,
      };
    }

    default:
      return { camera: CHEIO(), tela: ESCONDIDO, camera_na_frente: true };
  }
}

/** Interpola dois retângulos. p = 0 (a) até 1 (b). */
export function misturarRetangulo(a: Retangulo, b: Retangulo, p: number): Retangulo {
  const m = (x: number, y: number) => x + (y - x) * p;
  return {
    x: m(a.x, b.x),
    y: m(a.y, b.y),
    largura: m(a.largura, b.largura),
    altura: m(a.altura, b.altura),
    raio: m(a.raio, b.raio),
    opacidade: m(a.opacidade, b.opacidade),
    sombra: p < 0.5 ? a.sombra : b.sombra,
    borda: m(a.borda, b.borda),
  };
}

export function misturarGeometria(a: Geometria, b: Geometria, p: number): Geometria {
  return {
    camera: misturarRetangulo(a.camera, b.camera, p),
    tela: misturarRetangulo(a.tela, b.tela, p),
    camera_na_frente: p < 0.5 ? a.camera_na_frente : b.camera_na_frente,
  };
}
