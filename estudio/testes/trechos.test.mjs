/**
 * Prova a álgebra das faixas coloridas.
 *
 * A parte perigosa não é pintar — é o que acontece DEPOIS: pintar por cima do
 * que já estava pintado, e editar o texto embaixo de uma faixa já posta. Os
 * dois erram calados: a cor vai parar num caractere vizinho e ninguém vê até o
 * vídeo estar pronto. Metade dos casos aqui é sobre isso.
 *
 *   node --test estudio/testes/trechos.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");

// mesmo caminho de `cortes.test.mjs`: transpila o .ts e importa o de verdade
const esbuild = await import("esbuild");
const tmp = path.join(AQUI, ".tmp-trechos.mjs");
await esbuild.build({
  entryPoints: [path.join(RAIZ, "src/trechos.ts")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { aplicar, normalizar, pintar, remapear } = await import(
  `file://${tmp.replace(/\\/g, "/")}`
);
fs.rmSync(tmp, { force: true });

const FRASE = "ESTRUTURA QUE SUSTENTA GRANDES OPERACOES";
const G = FRASE.indexOf("GRANDES");
const TEAL = "#0FB5A6";

// ---------------------------------------------------------------------------
// pintar — o corte em pedaços
// ---------------------------------------------------------------------------

test("sem faixa nenhuma, sai UM pedaço com a frase inteira", () => {
  assert.deepEqual(pintar(FRASE, "#FFFFFF", undefined), [{ texto: FRASE, cor: "#FFFFFF" }]);
  assert.deepEqual(pintar(FRASE, "#FFFFFF", []), [{ texto: FRASE, cor: "#FFFFFF" }]);
});

test("uma palavra pintada vira três pedaços, na ordem", () => {
  const r = pintar(FRASE, "#FFFFFF", [{ inicio: G, fim: G + 7, cor: TEAL }]);
  assert.deepEqual(r, [
    { texto: "ESTRUTURA QUE SUSTENTA ", cor: "#FFFFFF" },
    { texto: "GRANDES", cor: TEAL },
    { texto: " OPERACOES", cor: "#FFFFFF" },
  ]);
});

test("os pedaços sempre remontam o texto original", () => {
  const r = pintar(FRASE, "#FFFFFF", [
    { inicio: 0, fim: 9, cor: TEAL },
    { inicio: G, fim: G + 7, cor: "#FF0000" },
  ]);
  assert.equal(r.map((p) => p.texto).join(""), FRASE);
});

test("faixa colada no começo não gera pedaço vazio na frente", () => {
  const r = pintar(FRASE, "#FFFFFF", [{ inicio: 0, fim: 9, cor: TEAL }]);
  assert.equal(r[0].texto, "ESTRUTURA");
  assert.equal(r.length, 2);
});

// ---------------------------------------------------------------------------
// aplicar — pintar por cima
// ---------------------------------------------------------------------------

test("pintar por cima de faixa existente RECORTA a antiga", () => {
  const antes = [{ inicio: 0, fim: 20, cor: TEAL }];
  const r = aplicar(antes, 5, 10, "#FF0000", FRASE.length);
  assert.deepEqual(r, [
    { inicio: 0, fim: 5, cor: TEAL },
    { inicio: 5, fim: 10, cor: "#FF0000" },
    { inicio: 10, fim: 20, cor: TEAL },
  ]);
});

test("pintar da mesma cor duas faixas vizinhas junta numa só", () => {
  let r = aplicar([], 0, 9, TEAL, FRASE.length);
  r = aplicar(r, 9, 13, TEAL, FRASE.length);
  assert.deepEqual(r, [{ inicio: 0, fim: 13, cor: TEAL }]);
});

test("tirar a cor devolve o pedaço ao branco da camada", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const r = aplicar(antes, G, G + 7, null, FRASE.length);
  assert.deepEqual(r, []);
  assert.deepEqual(pintar(FRASE, "#FFFFFF", r), [{ texto: FRASE, cor: "#FFFFFF" }]);
});

test("tirar a cor do MEIO de uma faixa deixa as duas pontas", () => {
  const r = aplicar([{ inicio: 0, fim: 20, cor: TEAL }], 5, 10, null, FRASE.length);
  assert.deepEqual(r, [
    { inicio: 0, fim: 5, cor: TEAL },
    { inicio: 10, fim: 20, cor: TEAL },
  ]);
});

test("seleção invertida (arrastou pra trás) vale igual", () => {
  const r = aplicar([], 10, 5, TEAL, FRASE.length);
  assert.deepEqual(r, [{ inicio: 5, fim: 10, cor: TEAL }]);
});

test("seleção vazia não cria faixa", () => {
  assert.deepEqual(aplicar([], 7, 7, TEAL, FRASE.length), []);
});

// ---------------------------------------------------------------------------
// normalizar — o que não pode passar
// ---------------------------------------------------------------------------

test("faixa que passa do fim do texto é cortada no fim", () => {
  assert.deepEqual(normalizar([{ inicio: 30, fim: 999, cor: TEAL }], FRASE.length), [
    { inicio: 30, fim: FRASE.length, cor: TEAL },
  ]);
});

test("faixa inteiramente fora do texto some", () => {
  assert.deepEqual(normalizar([{ inicio: 200, fim: 300, cor: TEAL }], FRASE.length), []);
});

// ---------------------------------------------------------------------------
// remapear — a edição do texto
// ---------------------------------------------------------------------------

test("digitar no COMEÇO empurra a faixa junto", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = "A " + FRASE;
  const r = remapear(antes, FRASE, novo);
  assert.equal(novo.slice(r[0].inicio, r[0].fim), "GRANDES");
});

test("apagar no começo puxa a faixa junto", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE.slice(4); // tira "ESTR"
  const r = remapear(antes, FRASE, novo);
  assert.equal(novo.slice(r[0].inicio, r[0].fim), "GRANDES");
});

test("digitar DEPOIS da faixa não mexe nela", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE + " HOJE";
  const r = remapear(antes, FRASE, novo);
  assert.deepEqual(r, antes);
});

test("trocar a palavra pintada leva a cor pra palavra NOVA", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE.replace("GRANDES", "TODAS AS");
  const r = remapear(antes, FRASE, novo);
  assert.equal(r.length, 1);
  // pode sobrar um espaço na borda (espaço não tem tinta); o que não pode é
  // a cor escorregar pra outra palavra
  assert.equal(novo.slice(r[0].inicio, r[0].fim).trim(), "TODAS AS");
});

test("corrigir uma letra DENTRO da palavra pintada não perde a pintura", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE.replace("GRANDES", "GRANDIS");
  const r = remapear(antes, FRASE, novo);
  assert.equal(novo.slice(r[0].inicio, r[0].fim), "GRANDIS");
});

test("digitar COLADO no fim da palavra pintada não estende a cor", () => {
  // a letra nova fica de fora: a faixa nunca cresce pra texto que ninguém
  // selecionou. Quem quiser a letra pintada seleciona de novo e pinta.
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE.replace("GRANDES", "GRANDESS");
  const r = remapear(antes, FRASE, novo);
  assert.equal(novo.slice(r[0].inicio, r[0].fim), "GRANDES");
});

test("editar palavra VIZINHA não move a cor pra ela", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  const novo = FRASE.replace("SUSTENTA", "SEGURA");
  const r = remapear(antes, FRASE, novo);
  assert.equal(novo.slice(r[0].inicio, r[0].fim), "GRANDES");
});

test("texto igual não mexe em nada", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  assert.deepEqual(remapear(antes, FRASE, FRASE), antes);
});

test("apagar o texto inteiro leva as faixas embora", () => {
  const antes = [{ inicio: G, fim: G + 7, cor: TEAL }];
  assert.deepEqual(remapear(antes, FRASE, ""), []);
});

test("sem faixa, remapear devolve lista vazia sem reclamar", () => {
  assert.deepEqual(remapear(undefined, FRASE, "outro"), []);
});
