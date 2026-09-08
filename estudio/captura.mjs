/**
 * SupremoCut — captura de quadro sem reempacotar tudo.
 *
 * O PROBLEMA
 *
 * O botão "quadro" chama o Remotion pela linha de comando. Cada chamada
 * empacota o projeto inteiro, sobe um navegador, renderiza um PNG e joga tudo
 * fora — uns 40 segundos por quadro. Serve pra salvar uma capa de vez em
 * quando; não serve pra conferir o que se acabou de editar, que é justamente
 * quando olhar um quadro vale mais.
 *
 * A DIFERENÇA
 *
 * `bundle()` e `openBrowser()` uma vez só, guardados em memória. A partir daí
 * cada captura é um `renderStill()` contra o que já está de pé: sai em um a
 * dois segundos. O pacote é refeito só quando o CÓDIGO da composição muda —
 * mudar o roteiro não exige reempacotar, porque o roteiro entra como
 * `inputProps`, não como import.
 *
 * Foi essa troca — props em vez de import — que tornou o reaproveitamento
 * possível. Enquanto o roteiro era um `import` dentro do bundle, todo projeto
 * novo invalidava o pacote e a gente voltava aos 40 segundos.
 *
 * POR QUE ISTO EXISTE, ALÉM DA PRESSA
 *
 * Um editor movido a IA precisa que a IA VEJA o resultado. Sem isso, ela edita
 * no escuro e só descobre o erro quando alguém abre o vídeo. Esta é a peça que
 * fecha o laço: editar, capturar, olhar, corrigir.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  openBrowser,
  renderStill,
} from "@remotion/renderer";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTRADA = path.join(AQUI, "src", "index.ts");

/**
 * Onde o pacote é montado.
 *
 * Dentro de `trabalho/`, que é a pasta de rascunho do projeto e está no MESMO
 * disco dos vídeos — em vez do %TEMP% do C:, que é onde o Remotion põe por
 * padrão e onde ele acumula uma pasta por chamada.
 */
const PACOTE_EM = path.resolve(AQUI, "..", "trabalho", "pacote-render");

/** Estado vivo: pacote e navegador, reaproveitados entre capturas. */
let pacote = null;
let navegador = null;
let empacotando = null;
/** Assinatura do código no momento em que o pacote foi feito. */
let assinatura = null;

/**
 * Uma impressão digital do código da composição.
 *
 * Só o que entra no BUNDLE conta: os arquivos de `src/`. O roteiro e o estilo
 * viajam como props e mudam o tempo todo — se entrassem nesta conta, o pacote
 * seria refeito a cada edição e o ganho todo iria embora.
 */
async function assinarCodigo() {
  const dir = path.join(AQUI, "src");
  const partes = [];

  const varrer = async (p) => {
    for (const it of await fs.readdir(p, { withFileTypes: true })) {
      const cheio = path.join(p, it.name);
      if (it.isDirectory()) {
        await varrer(cheio);
      } else if (/\.(ts|tsx|css)$/.test(it.name)) {
        const s = await fs.stat(cheio);
        partes.push(`${cheio}:${s.mtimeMs}:${s.size}`);
      }
    }
  };

  await varrer(dir);
  partes.sort();
  return partes.join("|");
}

/** Garante pacote e navegador de pé, refazendo só quando o código mudou. */
async function preparar() {
  const agora = await assinarCodigo();

  if (pacote && assinatura === agora && navegador) return;

  // duas chamadas ao mesmo tempo não devem empacotar duas vezes
  if (empacotando) {
    await empacotando;
    if (pacote && assinatura === agora) return;
  }

  empacotando = (async () => {
    await ensureBrowser();

    if (navegador) {
      // o navegador não depende do código, mas se o pacote vai ser refeito
      // é hora de recolher qualquer aba pendurada
      await navegador.close(true).catch(() => {});
      navegador = null;
    }

    /*
      O PACOTE VAI PRA UMA PASTA FIXA, NO MESMO DISCO DO PROJETO.

      Sem `outDir`, cada chamada de `bundle()` cria uma pasta nova em %TEMP%
      (no C:) e copia o `public/` INTEIRO pra dentro — que aqui são os vídeos
      de 27 projetos. Nada limpa depois. Em um dia de trabalho isso virou 99
      pastas e 70 GB, e o C: chegou a 270 MB livres: o render passou a falhar
      com ENOSPC no meio de uma captura.

      Uma pasta fixa é REUSADA. O bundle é refeito quando o código muda — que é
      a mesma condição que `assinarCodigo` já usa pra decidir — e sobrescreve o
      que estava lá em vez de acumular ao lado.
    */
    pacote = await bundle({
      entryPoint: ENTRADA,
      outDir: PACOTE_EM,
      // `publicDir` fica no padrão: os projetos vivem em estudio/public
      onProgress: () => {},
    });
    assinatura = agora;
    navegador = await openBrowser("chrome");
  })();

  try {
    await empacotando;
  } finally {
    empacotando = null;
  }
}

/**
 * Captura um quadro.
 *
 * `roteiro` e `estilo` são os objetos JÁ CARREGADOS — nada é lido do disco
 * aqui. Isso é de propósito: o `still` da linha de comando lê
 * `src/roteiro-atual.json`, e esse arquivo virou fonte de corrida quando duas
 * coisas renderizavam ao mesmo tempo (um render em lote sobrescreveu o roteiro
 * debaixo de outro e o vídeo saiu com o conteúdo errado). Passando por
 * argumento, cada captura é independente.
 */
export async function capturar({
  roteiro,
  estilo,
  pasta,
  frame = 0,
  formato = "Vertical",
  destino,
  qualidade = 80,
}) {
  await preparar();

  const props = { roteiro, estilo, pasta };
  const comps = await getCompositions(pacote, {
    inputProps: props,
    puppeteerInstance: navegador,
  });

  const comp = comps.find((c) => c.id === formato);
  if (!comp) {
    throw new Error(
      `composição "${formato}" não existe. Tem: ${comps.map((c) => c.id).join(", ")}`,
    );
  }

  // um quadro além do fim devolveria erro do Remotion; preso na borda é o
  // comportamento útil — quem pede o "último quadro" quer o último quadro
  const quadro = Math.max(0, Math.min(Math.round(frame), comp.durationInFrames - 1));

  await fs.mkdir(path.dirname(destino), { recursive: true });

  /*
    `jpegQuality` só pode ir junto quando o formato É jpeg.

    O Remotion não ignora o parâmetro sobrando: ele LANÇA ERRO. Como isto aqui
    mandava a qualidade sempre, toda captura em .png morria — o botão de salvar
    quadro em PNG nunca funcionou, e ninguém tinha percebido porque o caminho
    usado no dia a dia era o .jpg.
  */
  const png = path.extname(destino).toLowerCase() === ".png";
  await renderStill({
    composition: comp,
    serveUrl: pacote,
    output: destino,
    frame: quadro,
    inputProps: props,
    puppeteerInstance: navegador,
    imageFormat: png ? "png" : "jpeg",
    ...(png ? {} : { jpegQuality: qualidade }),
    overwrite: true,
  });

  return { arquivo: destino, frame: quadro, formato };
}

/** Solta navegador e pacote. Chamado quando o servidor cai. */
export async function encerrar() {
  if (navegador) {
    await navegador.close(true).catch(() => {});
    navegador = null;
  }
  pacote = null;
  assinatura = null;
}
