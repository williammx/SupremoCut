/**
 * Verificação do corte automático.
 *
 * O editor decide onde cortar lendo a forma de onda — instantâneo, dá pra ver
 * a linha se mexer enquanto se arrasta o controle. O FFmpeg decide lendo o
 * arquivo amostra por amostra. Se os dois discordarem muito, o que o usuário vê
 * na tela não é o que ele vai ouvir no vídeo.
 *
 * Este teste também trava a álgebra de faixas: complemento, normalização e
 * reescrita de blocos. É onde um erro de sinal apaga o vídeo inteiro em
 * silêncio.
 *
 * Rodar:  node testes/cortes.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");

// ---------------------------------------------------------------------------
// As funções sob teste, transpiladas na hora (o arquivo é TypeScript).
// ---------------------------------------------------------------------------

const esbuild = await import("esbuild");

/**
 * Empacota num arquivo só antes de importar.
 *
 * Transpilar sem empacotar não serve: o módulo importa `./animacao` e um
 * `data:` URL não tem como resolver caminho relativo. Empacotar também garante
 * que o teste exercita exatamente o código que o editor carrega, importações
 * incluídas — e não uma versão recortada dele.
 */
const carregar = async (rel) => {
  const tmp = path.join(AQUI, `.tmp-${path.basename(rel, ".ts")}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ, rel)],
    outfile: tmp,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  try {
    return await import(`file://${tmp.replace(/\\/g, "/")}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
};

const cortes = await carregar("src/cortes.ts");

let passou = 0;
const teste = (nome, fn) => {
  try {
    fn();
    passou++;
    console.log(`  ok   ${nome}`);
  } catch (e) {
    console.log(`  FALHOU ${nome}`);
    console.log(`         ${e.message}`);
    process.exitCode = 1;
  }
};

console.log("\nÁlgebra de faixas\n");

teste("normalizar funde o que se toca e descarta o vazio", () => {
  const r = cortes.normalizar([
    { a: 5, b: 7 },
    { a: 0, b: 2 },
    { a: 2, b: 3 },
    { a: 9, b: 9 },
  ]);
  assert.deepEqual(r, [
    { a: 0, b: 3 },
    { a: 5, b: 7 },
  ]);
});

teste("normalizar com folga costura pausas curtas", () => {
  const r = cortes.normalizar(
    [
      { a: 0, b: 1 },
      { a: 1.2, b: 2 },
    ],
    0.35,
  );
  assert.deepEqual(r, [{ a: 0, b: 2 }]);
});

teste("complemento tira um buraco no meio", () => {
  const r = cortes.complemento([{ a: 3, b: 5 }], [{ a: 0, b: 10 }]);
  assert.deepEqual(r, [
    { a: 0, b: 3 },
    { a: 5, b: 10 },
  ]);
});

teste("complemento com remoção que cobre tudo devolve vazio", () => {
  assert.deepEqual(cortes.complemento([{ a: -1, b: 11 }], [{ a: 0, b: 10 }]), []);
});

teste("complemento não inventa tempo fora do universo", () => {
  const r = cortes.complemento([{ a: 20, b: 30 }], [{ a: 0, b: 10 }]);
  assert.deepEqual(r, [{ a: 0, b: 10 }]);
});

teste("complemento com remoções sobrepostas não duplica", () => {
  const r = cortes.complemento(
    [
      { a: 2, b: 5 },
      { a: 4, b: 6 },
    ],
    [{ a: 0, b: 10 }],
  );
  assert.deepEqual(r, [
    { a: 0, b: 2 },
    { a: 6, b: 10 },
  ]);
});

console.log("\nReescrita de blocos\n");

const cena = (id, fonte_inicio, duracao, extra = {}) => ({
  id,
  fonte_inicio,
  duracao,
  layout: "camera",
  entrada: { tipo: "corte" },
  ...extra,
});

teste("manter tudo não muda nada", () => {
  const cs = [cena("a", 0, 5), cena("b", 10, 5)];
  const r = cortes.manterApenas(cs, [{ a: 0, b: 100 }], 30);
  assert.equal(r.cenas.length, 2);
  assert.equal(r.removido, 0);
  assert.equal(r.cenas[0].fonte_inicio, 0);
  assert.equal(r.cenas[1].duracao, 5);
});

teste("o primeiro pedaço herda o id (senão a trilha de áudio se solta)", () => {
  const cs = [cena("a", 0, 10)];
  const r = cortes.manterApenas(
    cs,
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  assert.equal(r.cenas.length, 2);
  assert.equal(r.cenas[0].id, "a", "o primeiro pedaço tem que manter o id original");
  assert.notEqual(r.cenas[1].id, "a", "o segundo precisa de id próprio");
});

teste("o buraco do meio some da duração total", () => {
  const r = cortes.manterApenas(
    [cena("a", 0, 10)],
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  const total = r.cenas.reduce((s, c) => s + c.duracao, 0);
  assert.ok(Math.abs(total - 6) < 0.05, `esperava ~6s, veio ${total}`);
  assert.ok(Math.abs(r.removido - 4) < 0.05, `esperava ~4s removidos, veio ${r.removido}`);
});

teste("velocidade: o bloco consome mais fonte do que dura", () => {
  // 5s de duração final a 2x = 10s de material bruto
  const r = cortes.manterApenas([cena("a", 0, 5, { velocidade: 2 })], [{ a: 0, b: 10 }], 30);
  assert.equal(r.cenas.length, 1);
  assert.ok(Math.abs(r.cenas[0].duracao - 5) < 0.05);
});

teste("pedaço menor que dois quadros é descartado", () => {
  const r = cortes.manterApenas([cena("a", 0, 10)], [{ a: 0, b: 0.02 }], 30);
  assert.equal(r.cenas.length, 0);
});

teste("tudo cai em quadro inteiro", () => {
  const fps = 30;
  const r = cortes.manterApenas([cena("a", 0, 10)], [{ a: 1.3717, b: 6.9931 }], fps);
  for (const c of r.cenas) {
    const q = c.duracao * fps;
    assert.ok(Math.abs(q - Math.round(q)) < 1e-6, `duração ${c.duracao} não é quadro inteiro`);
    const qi = c.fonte_inicio * fps;
    assert.ok(Math.abs(qi - Math.round(qi)) < 1e-6, `início ${c.fonte_inicio} não é quadro inteiro`);
  }
});

teste("só o primeiro pedaço mantém a transição de entrada", () => {
  const cs = [cena("a", 0, 10, { entrada: { tipo: "fade", duracao: 0.5 } })];
  const r = cortes.manterApenas(
    cs,
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  assert.equal(r.cenas[0].entrada.tipo, "fade");
  assert.equal(r.cenas[1].entrada.tipo, "corte", "pedaço do meio da fala não pode ter transição");
});

teste("congelar acompanha o pedaço em que o instante caiu", () => {
  // Congelado no segundo 8. Mantendo [0,3] e [7,10], o instante 8 está DENTRO
  // do segundo pedaço, a 1s do começo dele.
  const r = cortes.manterApenas(
    [cena("a", 0, 10, { congelar: 8 })],
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  assert.equal(r.cenas[0].congelar, null, "o instante 8 não está no pedaço [0,3]");
  assert.ok(
    Math.abs(r.cenas[1].congelar - 1) < 0.05,
    `esperava congelar ~1s no segundo pedaço, veio ${r.cenas[1].congelar}`,
  );
});

teste("congelar some quando o instante foi cortado fora", () => {
  // Congelado no segundo 5, que está exatamente no buraco removido.
  const r = cortes.manterApenas(
    [cena("a", 0, 10, { congelar: 5 })],
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  assert.equal(r.cenas[0].congelar, null);
  assert.equal(r.cenas[1].congelar, null, "congelar num trecho apagado tem que sumir");
});

teste("animação feita à mão é deslocada, não regerada", () => {
  const cs = [
    cena("a", 0, 10, {
      animacoes: [
        {
          propriedade: "zoom",
          chaves: [
            { t: 1, valor: 1 },
            { t: 8, valor: 1.5 },
          ],
        },
      ],
    }),
  ];
  const r = cortes.manterApenas(
    cs,
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  // No pedaço 2 (começa em 7), a chave do segundo 8 vira o segundo 1.
  const ch = r.cenas[1].animacoes[0].chaves;
  assert.ok(
    ch.some((k) => Math.abs(k.t - 1) < 0.05),
    `esperava uma chave perto de 1s, veio ${JSON.stringify(ch)}`,
  );
  // A do segundo 1 fica longe demais do começo do pedaço 2 e é descartada.
  assert.ok(!ch.some((k) => k.t < -0.5));
});

teste("animação de preset é regerada com a duração nova", () => {
  const r = cortes.manterApenas(
    [cena("a", 0, 10, { preset_animacao: "aparecer" })],
    [
      { a: 0, b: 3 },
      { a: 7, b: 10 },
    ],
    30,
  );
  for (const c of r.cenas) {
    const ultima = c.animacoes[0].chaves.at(-1);
    assert.ok(
      ultima.t <= c.duracao + 1e-6,
      `a entrada de ${ultima.t}s não cabe num pedaço de ${c.duracao}s`,
    );
  }
});

console.log("\nCurvas de animação\n");

const animacao = await carregar("src/animacao.ts");

teste("a mola sai de 0 e chega em 1", () => {
  // A primeira versão usava cosseno e dava mola(0) = 1: a animação já nascia
  // no destino e depois afundava.
  const chaves = [
    { t: 0, valor: 0 },
    { t: 1, valor: 100, curva: "mola" },
  ];
  assert.equal(animacao.valorEm(chaves, 0, 0), 0, "no instante 0 tem que estar no começo");
  assert.equal(animacao.valorEm(chaves, 1, 0), 100, "no fim tem que estar no destino");
  // e no meio ela realmente passa do ponto, senão não é mola
  const meio = Math.max(
    ...[0.3, 0.4, 0.5, 0.6, 0.7].map((t) => animacao.valorEm(chaves, t, 0)),
  );
  assert.ok(meio > 100, `a mola tem que passar de 100 em algum momento, máximo foi ${meio}`);
});

teste("todas as curvas respeitam as pontas", () => {
  for (const curva of ["reta", "suave", "mola", "degrau"]) {
    const chaves = [
      { t: 0, valor: 10 },
      { t: 2, valor: 20, curva },
    ];
    assert.equal(animacao.valorEm(chaves, 0, 0), 10, `${curva} errou o começo`);
    assert.equal(animacao.valorEm(chaves, 2, 0), 20, `${curva} errou o fim`);
  }
});

teste("fora do intervalo SEGURA, nunca extrapola", () => {
  const chaves = [
    { t: 1, valor: 5 },
    { t: 2, valor: 9 },
  ];
  assert.equal(animacao.valorEm(chaves, -50, 0), 5);
  assert.equal(animacao.valorEm(chaves, 999, 0), 9);
});

teste("sem chave nenhuma vale o padrão", () => {
  assert.equal(animacao.valorEm([], 3, 7), 7);
});

teste("duas chaves no mesmo instante não dividem por zero", () => {
  const v = animacao.valorEm(
    [
      { t: 0, valor: 0 },
      { t: 1, valor: 5 },
      { t: 1, valor: 9 },
      { t: 2, valor: 9 },
    ],
    1,
    0,
  );
  assert.ok(Number.isFinite(v), `veio ${v}`);
});

teste("chaves fora de ordem são ordenadas antes de interpolar", () => {
  const v = animacao.valorEm(
    [
      { t: 2, valor: 20 },
      { t: 0, valor: 0 },
    ],
    1,
    0,
    );
  assert.ok(v > 0 && v < 20, `esperava algo entre 0 e 20, veio ${v}`);
});

teste("todo preset cabe na duração do bloco", () => {
  for (const p of animacao.PRESETS) {
    for (const d of [0.5, 2, 8, 30]) {
      for (const an of p.gerar(d)) {
        assert.ok(an.chaves.length > 0, `${p.id} gerou uma propriedade sem chave`);
        for (const k of an.chaves) {
          assert.ok(
            k.t >= 0 && k.t <= d + 1e-6,
            `${p.id} em bloco de ${d}s pôs chave em ${k.t}s`,
          );
          assert.ok(Number.isFinite(k.valor), `${p.id} gerou valor não numérico`);
        }
        // ordem crescente, senão a interpolação salta pra trás
        for (let i = 1; i < an.chaves.length; i++) {
          assert.ok(
            an.chaves[i].t >= an.chaves[i - 1].t,
            `${p.id} gerou chaves fora de ordem`,
          );
        }
      }
    }
  }
});

teste("ajustes neutros não geram filtro CSS", () => {
  // Um `filter` presente, ainda que neutro, cria camada de composição no
  // Chrome e derruba a fluidez do preview sem mudar um pixel.
  assert.equal(animacao.filtroCss(animacao.ESTADO_NEUTRO.ajustes), "");
  assert.equal(animacao.camadaTemperatura(animacao.ESTADO_NEUTRO.ajustes), null);
  assert.equal(animacao.vinhetaCss(animacao.ESTADO_NEUTRO.ajustes), null);
});

console.log("\nDetecção de fala\n");

teste("silêncio puro não vira fala", () => {
  const dados = { por_segundo: 50, duracao: 10, picos: new Array(500).fill(0) };
  assert.deepEqual(cortes.detectarFala(dados, cortes.SILENCIO_PADRAO), []);
});

teste("sinal cheio vira um trecho só", () => {
  const dados = { por_segundo: 50, duracao: 10, picos: new Array(500).fill(255) };
  const r = cortes.detectarFala(dados, cortes.SILENCIO_PADRAO);
  assert.equal(r.length, 1);
  assert.equal(r[0].a, 0);
});

teste("um vale largo separa dois trechos", () => {
  // 2s alto, 2s mudo, 2s alto
  const picos = [
    ...new Array(100).fill(255),
    ...new Array(100).fill(0),
    ...new Array(100).fill(255),
  ];
  const r = cortes.detectarFala(
    { por_segundo: 50, duracao: 6, picos },
    { ...cortes.SILENCIO_PADRAO, margem: 0 },
  );
  assert.equal(r.length, 2, `esperava 2 trechos, veio ${r.length}`);
  assert.ok(Math.abs(r[0].b - 2) < 0.1);
  assert.ok(Math.abs(r[1].a - 4) < 0.1);
});

teste("um vale curto NÃO separa (é respiração, não pausa)", () => {
  // 2s alto, 0.2s mudo, 2s alto — abaixo do silencio_minimo de 0.35s
  const picos = [
    ...new Array(100).fill(255),
    ...new Array(10).fill(0),
    ...new Array(100).fill(255),
  ];
  const r = cortes.detectarFala({ por_segundo: 50, duracao: 4.2, picos }, cortes.SILENCIO_PADRAO);
  assert.equal(r.length, 1, "respiração curta não pode virar corte");
});

teste("a margem não deixa o trecho começar antes do zero", () => {
  const picos = [...new Array(100).fill(255), ...new Array(100).fill(0)];
  const r = cortes.detectarFala({ por_segundo: 50, duracao: 4, picos }, cortes.SILENCIO_PADRAO);
  assert.ok(r[0].a >= 0, "não existe tempo negativo no arquivo");
});

teste("a conversão de pico desfaz a raiz que ondas.py aplicou", () => {
  // ondas.py grava sqrt(amplitude)*255. Um pico de 128 é ~0.25 de amplitude,
  // não 0.5 — errar isso põe o limiar em dB no lugar errado.
  const amp = cortes.amplitudeDoPico(128);
  assert.ok(Math.abs(amp - 0.252) < 0.01, `esperava ~0.25, veio ${amp}`);
});

teste("-34 dB vira a amplitude certa", () => {
  assert.ok(Math.abs(cortes.dbParaAmplitude(-34) - 0.02) < 0.002);
  assert.equal(cortes.dbParaAmplitude(0), 1);
});

// ---------------------------------------------------------------------------
// Confronto com o FFmpeg, se houver material real por perto
// ---------------------------------------------------------------------------

console.log("\nConfronto com o FFmpeg\n");

const acharProjeto = () => {
  const pub = path.join(RAIZ, "public");
  if (!fs.existsSync(pub)) return null;
  for (const nome of fs.readdirSync(pub)) {
    const dir = path.join(pub, nome);
    if (!fs.statSync(dir).isDirectory()) continue;
    const picos = path.join(dir, "picos.json");
    const wav = fs
      .readdirSync(dir)
      .find((f) => f.endsWith(".wav") || f.endsWith(".m4a"));
    if (fs.existsSync(picos) && wav) return { picos, audio: path.join(dir, wav), nome };
  }
  return null;
};

const alvo = acharProjeto();

if (!alvo) {
  console.log("  (pulado: nenhum projeto com picos.json + áudio na pasta public)");
} else {
  const dados = JSON.parse(fs.readFileSync(alvo.picos, "utf-8"));
  const op = { ...cortes.SILENCIO_PADRAO, margem: 0 };
  const fala = cortes.detectarFala(dados, op);

  const ff = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-nostats",
      "-i", alvo.audio,
      "-af", `silencedetect=noise=${op.limiar_db}dB:d=${op.silencio_minimo}`,
      "-f", "null", "-",
    ],
    { encoding: "utf-8" },
  );

  const pares = [...(ff.stderr || "").matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)];
  const silencios = [];
  let ini = null;
  for (const [, tipo, v] of pares) {
    if (tipo === "start") ini = Number(v);
    else if (ini !== null) {
      silencios.push([ini, Number(v)]);
      ini = null;
    }
  }

  const mudoFF = silencios.reduce((s, [a, b]) => s + (b - a), 0);
  const falaMinha = fala.reduce((s, f) => s + (f.b - f.a), 0);
  const mudoMeu = (dados.duracao || 0) - falaMinha;

  console.log(`  projeto:     ${alvo.nome}`);
  console.log(`  duração:     ${dados.duracao.toFixed(1)}s`);
  console.log(`  ffmpeg:      ${silencios.length} pausas, ${mudoFF.toFixed(1)}s de silêncio`);
  console.log(`  forma de onda: ${fala.length} falas, ${mudoMeu.toFixed(1)}s de silêncio`);

  teste("os dois métodos concordam no total de silêncio (±35%)", () => {
    if (mudoFF < 1) {
      console.log("         (o ffmpeg quase não achou silêncio; comparação sem valor)");
      return;
    }
    const razao = mudoMeu / mudoFF;
    assert.ok(
      razao > 0.65 && razao < 1.35,
      `a onda diz ${mudoMeu.toFixed(1)}s e o ffmpeg diz ${mudoFF.toFixed(1)}s ` +
        `(razão ${razao.toFixed(2)}) — o que você vê não é o que vai ouvir`,
    );
  });
}

console.log(`\n${passou} verificações passaram.\n`);
