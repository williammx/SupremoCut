/**
 * Prova que `familiaSegura` cita o que precisa e NÃO cita o que não precisa.
 *
 * Importa o arquivo .ts DE VERDADE (o Node 24 tira os tipos sozinho). A versão
 * anterior deste teste carregava uma cópia da regra colada aqui dentro — o que
 * testa a cópia, não o programa, e passa a mentir no dia em que uma das duas
 * mudar sem a outra.
 *
 * A metade que importa é a dos casos que NÃO devem ser citados: uma função que
 * bota aspas em tudo passaria num teste que só verificasse os que devem.
 *
 *   node --test estudio/testes/fonte.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");

/*
  Transpila o .ts na hora, como já faz `cortes.test.mjs`.

  Importar o .ts direto não funciona: o `estudio` é um pacote
  `"type": "commonjs"`, e o Node, que tira os tipos sozinho, tenta então
  carregá-lo como CommonJS e engasga no `export`.
*/
const esbuild = await import("esbuild");
const tmp = path.join(AQUI, ".tmp-fonte.mjs");
await esbuild.build({
  entryPoints: [path.join(RAIZ, "src/fonte.ts")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { familiaSegura } = await import(`file://${tmp.replace(/\\/g, "/")}`);
fs.rmSync(tmp, { force: true });

test("cita nome com número — o caso que quebrou o vídeo", () => {
  assert.equal(
    familiaSegura("Tusker Grotesk 1500, Inter, 'Segoe UI', Arial, sans-serif"),
    `"Tusker Grotesk 1500", Inter, 'Segoe UI', Arial, sans-serif`,
  );
});

test("cita nome que COMEÇA com dígito", () => {
  assert.equal(familiaSegura("04b 30, Arial"), `"04b 30", Arial`);
});

test("não mexe em nome simples de uma palavra", () => {
  assert.equal(familiaSegura("Inter"), "Inter");
});

test("não mexe em nome de várias palavras sem dígito", () => {
  assert.equal(familiaSegura("Bebas Neue, Arial"), "Bebas Neue, Arial");
});

test("não cita as palavras-chave genéricas do CSS", () => {
  // citá-las mudaria o sentido: viraria o nome de uma família chamada assim
  assert.equal(familiaSegura("Inter, sans-serif"), "Inter, sans-serif");
  assert.equal(familiaSegura("Consolas, monospace"), "Consolas, monospace");
});

test("respeita quem já veio citado, com aspas simples ou duplas", () => {
  assert.equal(familiaSegura(`'Segoe UI', "Noto Sans"`), `'Segoe UI', "Noto Sans"`);
});

test("acento não assusta — é caractere válido de identificador", () => {
  assert.equal(familiaSegura("Fontã, Arial"), "Fontã, Arial");
});

test("cita nome com pontuação que não é identificador", () => {
  assert.equal(familiaSegura("Font+Awesome, Arial"), `"Font+Awesome", Arial`);
});

test("espaço sobrando não vira família vazia", () => {
  assert.equal(familiaSegura("Inter ,  , Arial"), "Inter, Arial");
});
