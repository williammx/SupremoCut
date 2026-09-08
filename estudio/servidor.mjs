/**
 * SupremoCut - servidor do editor.
 *
 * Um Express pequeno que:
 *   - lista os projetos
 *   - le e grava roteiro.json e estilo.json
 *   - dispara o render e reporta o progresso
 *
 * Nao serve a interface: disso o Vite cuida. Aqui e so o vaivem dos dados.
 */

import express from "express";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capturar, encerrar as encerrarCaptura } from "./captura.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const PROJETOS = path.join(RAIZ, "projetos");
const CONFIG = path.join(RAIZ, "config");
const PYTHON = path.join(RAIZ, ".venv", "Scripts", "python.exe");

const app = express();
app.use(express.json({ limit: "200mb" }));

// ---------------------------------------------------------------- utilidades

/**
 * Valida um nome de projeto vindo da URL.
 *
 * Sem isto, `/api/projeto/..%2F..%2Fconfig` LIA E ESCREVIA fora de projetos/:
 * o Express 5 decodifica o parâmetro depois de casar a rota, então `%2F` vira
 * barra e a travessia passa. Lista branca de caracteres é a única defesa que
 * não depende de eu lembrar de todos os truques de codificação.
 */
const nomeValido = (nome) =>
  typeof nome === "string" &&
  nome.length > 0 &&
  nome.length <= 80 &&
  /^[A-Za-z0-9_.-]+$/.test(nome) &&
  !nome.startsWith(".") &&
  nome !== "." &&
  nome !== "..";

/** Recusa a requisição se o nome não for seguro. Devolve true se barrou. */
const barrouNome = (req, res) => {
  if (!nomeValido(req.params.nome)) {
    res.status(400).json({ erro: "Nome de projeto inválido." });
    return true;
  }
  return false;
};

const lerJson = async (p) => JSON.parse(await fs.readFile(p, "utf-8"));

/**
 * Grava um JSON de forma atômica e serializada.
 *
 * O temporário tinha nome FIXO: duas gravações simultâneas do mesmo arquivo
 * disputavam o mesmo `.tmp` e a segunda renomeava um arquivo que já não
 * existia (ENOENT → 500, e o conteúdo perdido). Agora cada gravação tem seu
 * temporário único, e uma fila por caminho garante ordem.
 */
const filaDeGravacao = new Map();

const gravarJson = (p, dados) => {
  const anterior = filaDeGravacao.get(p) ?? Promise.resolve();
  const atual = anterior
    .catch(() => {})
    .then(async () => {
      const tmp = `${p}.${process.pid}.${Date.now()}.${Math.random()
        .toString(36)
        .slice(2, 8)}.tmp`;
      try {
        await fs.writeFile(tmp, JSON.stringify(dados, null, 2), "utf-8");
        await fs.rename(tmp, p);
      } catch (e) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        throw e;
      }
    });

  filaDeGravacao.set(p, atual);
  /*
    O `.catch` aqui NÃO é decoração. `.finally()` cria uma promessa DERIVADA, e
    o handler dá await na `atual`, não nela. Sem este catch, um erro de rename
    (antivírus segurando o arquivo, por exemplo) virava unhandledRejection e
    DERRUBAVA o servidor — trocaria um 500 recuperável por perder o processo.
  */
  atual
    .catch(() => {})
    .finally(() => {
      if (filaDeGravacao.get(p) === atual) filaDeGravacao.delete(p);
    });
  return atual;
};

/** Remove as chaves de comentario (_dica, _leia_me) antes de mandar pro editor. */
const semComentarios = (o) => {
  if (Array.isArray(o)) return o.map(semComentarios);
  if (o && typeof o === "object") {
    return Object.fromEntries(
      Object.entries(o)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => [k, semComentarios(v)]),
    );
  }
  return o;
};

const erro = (res, e) => {
  console.error(e);
  res.status(500).json({ erro: String(e?.message ?? e) });
};

// ---------------------------------------------------------------- projetos

app.get("/api/projetos", async (_req, res) => {
  try {
    const itens = await fs.readdir(PROJETOS, { withFileTypes: true });
    const achados = [];
    for (const it of itens) {
      if (!it.isDirectory()) continue;
      try {
        const info = await fs.stat(path.join(PROJETOS, it.name, "roteiro.json"));
        achados.push({ nome: it.name, quando: info.mtimeMs });
      } catch {
        /* projeto sem roteiro ainda: ignora */
      }
    }
    // mais recente primeiro: e quase sempre o que a pessoa quer abrir
    achados.sort((a, b) => b.quando - a.quando);
    res.json(achados.map((a) => a.nome));
  } catch (e) {
    erro(res, e);
  }
});

/*
  O ESTILO É DO PROJETO, NÃO DO APP

  Durante muito tempo esta rota devolvia `config/estilo.json` — um arquivo só,
  compartilhado por todos os projetos. Parecia inofensivo e não era:

    - o Reels da Super San tinha estilo próprio (Inter, teal, título 62) que o
      editor nunca chegava a carregar: ele abria com Montserrat, rosa e 130,
      e o título estourava a tela;
    - trocar a fonte num projeto trocava em TODOS, sem aviso;
    - o render usava o estilo do projeto e o editor usava o global, então o
      preview mostrava uma coisa e o arquivo final saía outra.

  Agora cada projeto tem o seu. Quem não tiver ainda herda o global na primeira
  abertura — e a partir daí segue a própria vida.
*/
const caminhoEstilo = (nome) => path.join(PROJETOS, nome, "estilo.json");

const lerEstiloDoProjeto = async (nome) => {
  try {
    return semComentarios(await lerJson(caminhoEstilo(nome)));
  } catch {
    return semComentarios(await lerJson(path.join(CONFIG, "estilo.json")));
  }
};

app.get("/api/projeto/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  try {
    const roteiro = await lerJson(path.join(PROJETOS, req.params.nome, "roteiro.json"));
    const estilo = await lerEstiloDoProjeto(req.params.nome);
    res.json({ roteiro, estilo });
  } catch (e) {
    erro(res, e);
  }
});

app.put("/api/projeto/:nome/roteiro", async (req, res) => {
  if (barrouNome(req, res)) return;
  // um roteiro precisa de cenas; sem isto um corpo vazio zerava o arquivo
  const corpo = req.body;
  if (!corpo || !Array.isArray(corpo.cenas) || corpo.cenas.length === 0) {
    return res.status(400).json({ erro: "Roteiro inválido: sem cenas." });
  }
  if (corpo.projeto !== req.params.nome) {
    return res.status(409).json({
      erro: `Este roteiro é do projeto "${corpo.projeto}", não de "${req.params.nome}".`,
    });
  }
  try {
    await gravarJson(path.join(PROJETOS, req.params.nome, "roteiro.json"), corpo);
    // mantem o estudio do Remotion em dia tambem
    await gravarJson(path.join(AQUI, "src", "roteiro-atual.json"), req.body);
    res.json({ ok: true });
  } catch (e) {
    erro(res, e);
  }
});

app.put("/api/estilo/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  try {
    // parte do que o projeto já tem; se for o primeiro, herda o global
    const atual = await lerEstiloDoProjeto(req.params.nome);
    const mesclar = (velho, novo) => {
      const saida = { ...velho };
      for (const [k, v] of Object.entries(novo)) {
        saida[k] =
          v && typeof v === "object" && !Array.isArray(v) && velho[k]
            ? mesclar(velho[k], v)
            : v;
      }
      return saida;
    };
    const final = mesclar(atual, req.body);
    await gravarJson(caminhoEstilo(req.params.nome), final);
    // o estúdio do Remotion lê um arquivo fixo: mantém em dia o do projeto aberto
    await gravarJson(path.join(AQUI, "src", "estilo-atual.json"), semComentarios(final));
    res.json({ ok: true });
  } catch (e) {
    erro(res, e);
  }
});

// ---------------------------------------------------------------- musica

const EXT_AUDIO = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac"]);

app.get("/api/musicas", async (_req, res) => {
  try {
    const dir = path.join(RAIZ, "assets", "musica");
    await fs.mkdir(dir, { recursive: true });
    const itens = await fs.readdir(dir, { withFileTypes: true });
    const arquivos = [];
    for (const it of itens) {
      if (!it.isFile()) continue;
      if (!EXT_AUDIO.has(path.extname(it.name).toLowerCase())) continue;
      const info = await fs.stat(path.join(dir, it.name));
      arquivos.push({ nome: it.name, mb: Number((info.size / 1048576).toFixed(1)) });
    }
    res.json(arquivos.sort((a, b) => a.nome.localeCompare(b.nome)));
  } catch (e) {
    erro(res, e);
  }
});

// ---------------------------------------------------------------- fontes

/*
  AS FONTES INSTALADAS NA MÁQUINA

  Por que ler do sistema em vez de uma lista escrita à mão: a lista à mão tem
  duas maneiras de estar errada e as duas são silenciosas. Se ela cita uma fonte
  que não está instalada, o navegador cai no fallback sem avisar e o vídeo sai
  com outra letra. Se ela deixa de fora uma fonte que existe, some uma opção
  legítima sem ninguém saber.

  O Windows guarda as fontes em duas chaves de registro: as do sistema, em
  HKLM, e as instaladas só pro usuário, em HKCU. As duas importam — fonte
  baixada e instalada com um duplo clique costuma cair na segunda.

  O QUE PRECISA SER LIMPO

  O registro guarda o nome de cada ARQUIVO, não da família:

      "Montserrat SemiBold Italic (TrueType)"

  e o CSS quer a família, "Montserrat". Então o sufixo do formato sai, os
  tokens de peso e inclinação saem do fim pra trás, e o que sobra é a família.
  Tirar do fim pra trás importa: "Black Ops One" é uma família cujo nome COMEÇA
  com um token de peso, e varrer a string inteira a destruiria.
*/
const ESTILOS_FONTE = new Set([
  "thin", "extralight", "ultralight", "light", "regular", "book", "normal",
  "medium", "semibold", "demibold", "bold", "extrabold", "ultrabold", "black",
  "heavy", "italic", "oblique", "condensed", "semicondensed", "extracondensed",
  "narrow", "expanded", "wide",
]);

const familiaDaFonte = (bruto) => {
  // qualquer parêntese no fim: "(TrueType)", "(All res)", "(120)"
  let nome = bruto.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // entradas com "&" listam várias famílias no mesmo arquivo; a primeira serve
  nome = (nome.split("&")[0] ?? "").trim();
  /*
    Alguns arquivos começam com um símbolo pra furar a fila da lista de fontes
    do Windows — o Gilroy desta máquina está gravado como "☞Gilroy-Light".
    Sem tirar isso, a família virava "☞Gilroy" e nenhum CSS acharia.
  */
  nome = nome.replace(/^[^\p{L}\p{N}]+/u, "");
  /*
    Separa por espaço E por hífen: metade das fontes escreve o estilo como
    "Gilroy-Bold" e a outra metade como "Gilroy Bold". Famílias com hífen no
    nome de verdade são raríssimas, e o prejuízo de errar nelas é menor que o de
    deixar quatro "Gilroy-alguma-coisa" poluindo a lista.
  */
  const partes = nome.split(/[\s-]+/).filter(Boolean);
  while (partes.length > 1) {
    const ultima = partes[partes.length - 1].toLowerCase().replace(/[^a-z]/g, "");
    if (!ESTILOS_FONTE.has(ultima)) break;
    partes.pop();
  }
  return partes.join(" ").trim();
};

/** Lido uma vez por processo: 670 fontes não mudam durante uma sessão. */
let cacheFontes = null;

app.get("/api/fontes", async (_req, res) => {
  try {
    if (cacheFontes) return res.json(cacheFontes);
    if (process.platform !== "win32") return res.json([]);

    const ps = [
      "$c=@();",
      "foreach($k in 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',",
      "'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'){",
      "$p=Get-ItemProperty $k -ErrorAction SilentlyContinue;",
      "if($p){$c+=($p.PSObject.Properties|Where-Object{$_.Name -notlike 'PS*'}|ForEach-Object{$_.Name})}}",
      "$c -join [char]10",
    ].join("");

    const saida = await new Promise((ok, falha) => {
      const p = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], {
        windowsHide: true,
      });
      let txt = "";
      p.stdout.on("data", (d) => (txt += d.toString("utf8")));
      p.on("error", falha);
      p.on("close", () => ok(txt));
    });

    const familias = new Set();
    for (const linha of saida.split("\n")) {
      const f = familiaDaFonte(linha.trim());
      // nome de uma letra só costuma ser lixo de parsing, não fonte
      if (f.length > 1) familias.add(f);
    }
    cacheFontes = [...familias].sort((a, b) => a.localeCompare(b, "pt"));
    res.json(cacheFontes);
  } catch (e) {
    erro(res, e);
  }
});

// ---------------------------------------------------------------- imagens

const EXT_IMAGEM = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

/**
 * A pasta de imagens de um projeto, dentro do public que o Vite serve.
 *
 * AQUI, nao RAIZ. O `publicDir` do vite.config.mts e `../public` a partir de
 * `editor/`, ou seja `estudio/public` — e este arquivo mora em `estudio/`.
 * Usar RAIZ gravava um andar acima, num `F:\SupremoCut\public` que o Vite nao
 * serve e o render nao acha: o upload dava "ok" e a imagem nunca aparecia.
 */
const pastaImagens = (nome) => path.join(AQUI, "public", nome, "imagens");

app.get("/api/imagens/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  try {
    const dir = pastaImagens(req.params.nome);
    await fs.mkdir(dir, { recursive: true });
    const itens = await fs.readdir(dir, { withFileTypes: true });
    const arquivos = itens
      .filter((it) => it.isFile() && EXT_IMAGEM.has(path.extname(it.name).toLowerCase()))
      .map((it) => it.name)
      .sort((a, b) => a.localeCompare(b));
    res.json(arquivos);
  } catch (e) {
    erro(res, e);
  }
});

/**
 * Recebe uma imagem como data URL.
 *
 * Sem multer de propósito: o `express.json` já aceita 200 MB e uma dependência
 * a menos é uma dependência a menos. O custo é o inchaço de ~33% do base64,
 * irrelevante numa conexão que não sai da própria máquina.
 *
 * O nome do arquivo é RECONSTRUÍDO a partir do que o cliente mandou, nunca
 * usado como veio: `path.basename` mais a mesma lista branca dos projetos.
 * Aceitar o nome cru aqui seria abrir a travessia de caminho pela porta dos
 * fundos, depois de ela ter sido fechada na porta da frente.
 */
app.post("/api/imagens/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  try {
    const { arquivo, dados } = req.body ?? {};
    if (typeof arquivo !== "string" || typeof dados !== "string") {
      return res.status(400).json({ erro: "Faltou o arquivo ou o conteúdo." });
    }

    const base = path.basename(arquivo);
    const ext = path.extname(base).toLowerCase();
    if (!EXT_IMAGEM.has(ext)) {
      return res.status(400).json({ erro: `Formato não aceito: ${ext || "sem extensão"}` });
    }

    const limpo = base
      .slice(0, base.length - ext.length)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const seguro = `${limpo || "imagem"}${ext}`;

    const virgula = dados.indexOf(",");
    const bruto = dados.startsWith("data:") && virgula > 0 ? dados.slice(virgula + 1) : dados;
    const buffer = Buffer.from(bruto, "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ erro: "A imagem chegou vazia." });
    }

    const dir = pastaImagens(req.params.nome);
    await fs.mkdir(dir, { recursive: true });

    // Não sobrescreve o que já está lá: um logo trocado por engano some sem
    // aviso e ninguém entende por que o vídeo mudou.
    let destino = seguro;
    for (let n = 2; n < 200; n++) {
      try {
        await fs.access(path.join(dir, destino));
        destino = `${limpo || "imagem"}-${n}${ext}`;
      } catch {
        break;
      }
    }

    await fs.writeFile(path.join(dir, destino), buffer);
    res.json({ arquivo: destino });
  } catch (e) {
    erro(res, e);
  }
});

// ------------------------------------------------- projetos ainda sem roteiro

app.get("/api/projetos-crus", async (_req, res) => {
  try {
    const itens = await fs.readdir(PROJETOS, { withFileTypes: true });
    const crus = [];
    for (const it of itens) {
      if (!it.isDirectory()) continue;
      try {
        await fs.access(path.join(PROJETOS, it.name, "roteiro.json"));
      } catch {
        // tem pasta bruto com arquivo? então está esperando ser processado
        try {
          const brutos = await fs.readdir(path.join(PROJETOS, it.name, "bruto"));
          if (brutos.length > 0) crus.push({ nome: it.name, arquivos: brutos.length });
        } catch {
          /* sem pasta bruto */
        }
      }
    }
    res.json(crus);
  } catch (e) {
    erro(res, e);
  }
});

// ---------------------------------------------------------------- pipeline

let preparo = null; // { projeto, estado, mensagem, linhas: [] }

app.post("/api/preparar/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  if (preparo?.estado === "rodando") {
    return res.status(409).json({ erro: "Já tem um processamento rodando." });
  }
  const nome = req.params.nome;
  const args = ["motor/supremo.py", "preparar", nome];
  if (req.body?.cortes) args.push("--cortes", String(req.body.cortes));
  if (req.body?.modelo) args.push("--modelo", String(req.body.modelo));

  preparo = { projeto: nome, estado: "rodando", mensagem: "começando", linhas: [] };

  const proc = spawn(PYTHON, args, { cwd: RAIZ });
  // sem on("error") o Node CAI se o python.exe da venv nao estiver la
  proc.on("error", (e) => {
    preparo.estado = "erro";
    preparo.mensagem = `nao consegui rodar o Python: ${e.message}`;
  });
  const ler = (buf) => {
    for (const linha of buf.toString().split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa) continue;
      preparo.linhas.push(limpa);
      if (preparo.linhas.length > 60) preparo.linhas.shift();
      if (limpa.startsWith(">>")) preparo.mensagem = limpa.replace(/^>+\s*/, "");
    }
  };
  proc.stdout.on("data", ler);
  proc.stderr.on("data", ler);
  proc.on("close", (codigo) => {
    preparo.estado = codigo === 0 ? "pronto" : "erro";
    if (codigo !== 0) preparo.mensagem = "falhou — veja o detalhe";
  });

  res.json({ ok: true });
});

app.get("/api/preparar/status", (_req, res) => res.json(preparo ?? { estado: "parado" }));

// ---------------------------------------------------------------- entregaveis

const SAIDA = path.join(RAIZ, "saida");

/** Grava a legenda .srt que o editor montou (ele já tem os tempos dos cortes). */
app.post("/api/legenda/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  const conteudo = req.body?.srt;
  if (typeof conteudo !== "string" || conteudo.length === 0) {
    return res.status(400).json({ erro: "Nada pra gravar." });
  }
  try {
    await fs.mkdir(SAIDA, { recursive: true });
    const arquivo = path.join(SAIDA, `${req.params.nome}.srt`);
    await fs.writeFile(arquivo, conteudo, "utf-8");
    res.json({ ok: true, arquivo: `saida/${req.params.nome}.srt` });
  } catch (e) {
    erro(res, e);
  }
});

/**
 * Captura rápida — um quadro em 1 a 2 segundos, sem reempacotar.
 *
 * Existe ao lado do `/api/quadro` de propósito, e não no lugar dele:
 *   - `/api/quadro` é o botão da barra. Grava PNG em saida/, é o entregável.
 *   - `/api/capturar` é pra CONFERIR. Devolve JPEG pequeno, some depois, e
 *     serve tanto pra uma prévia na tela quanto pra IA olhar o que editou.
 *
 * O ganho vem de reaproveitar pacote e navegador (ver captura.mjs). Também
 * aceita o roteiro no corpo: assim dá pra ver um quadro do que está na TELA,
 * ainda não salvo — que é justamente quando conferir importa.
 */
app.post("/api/capturar/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  try {
    const frame = Number(req.body?.frame ?? 0);
    const formato = String(req.body?.formato ?? "Vertical");
    if (!Number.isFinite(frame) || frame < 0) {
      return res.status(400).json({ erro: "Quadro inválido." });
    }
    if (!FORMATOS.includes(formato)) {
      return res.status(400).json({ erro: "Formato inválido." });
    }

    // roteiro do corpo (o que está na tela) ou, na falta dele, o do disco
    const roteiro =
      req.body?.roteiro ??
      (await lerJson(path.join(PROJETOS, req.params.nome, "roteiro.json")));
    const estilo =
      req.body?.estilo ?? semComentarios(await lerJson(path.join(CONFIG, "estilo.json")));

    const dir = path.join(RAIZ, "trabalho", "capturas");
    const destino = path.join(dir, `${req.params.nome}-${formato}-${Math.round(frame)}.jpg`);

    const t0 = Date.now();
    const r = await capturar({
      roteiro,
      estilo,
      pasta: req.params.nome,
      frame,
      formato,
      destino,
    });

    res.json({
      ok: true,
      arquivo: r.arquivo,
      frame: r.frame,
      formato: r.formato,
      ms: Date.now() - t0,
    });
  } catch (e) {
    erro(res, e);
  }
});

/** Salva o quadro onde a agulha está, em PNG — pra capa e miniatura. */
app.post("/api/quadro/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  const frame = Number(req.body?.frame);
  const formato = String(req.body?.formato ?? "Principal");
  if (!Number.isInteger(frame) || frame < 0) {
    return res.status(400).json({ erro: "Quadro inválido." });
  }
  if (!["Principal", "Vertical", "Quadrado"].includes(formato)) {
    return res.status(400).json({ erro: "Formato inválido." });
  }

  const cli = path.join(AQUI, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const destino = path.join(SAIDA, `${req.params.nome}-quadro-${frame}.png`);

  try {
    await fs.mkdir(SAIDA, { recursive: true });

    /*
      O `still` lê o roteiro do disco (src/roteiro-atual.json), não da tela.
      Sem sincronizar aqui, o PNG saía com o nome de um projeto e o conteúdo
      de outro — bastava abrir um projeto sem editar nada, porque só um GET
      não atualiza esse arquivo.
    */
    const roteiro = await lerJson(
      path.join(PROJETOS, req.params.nome, "roteiro.json"),
    );
    const estilo = semComentarios(await lerJson(path.join(CONFIG, "estilo.json")));
    await gravarJson(path.join(AQUI, "src", "roteiro-atual.json"), roteiro);
    await gravarJson(path.join(AQUI, "src", "estilo-atual.json"), estilo);

    const proc = spawn(
      process.execPath,
      [cli, "still", formato, destino, `--frame=${frame}`],
      { cwd: AQUI },
    );

    let respondeu = false;
    const responder = (fn) => {
      if (respondeu) return;
      respondeu = true;
      fn();
    };

    let erroTexto = "";
    proc.stderr.on("data", (b) => (erroTexto += b.toString()));
    // sem isto, um executável faltando pendurava a requisição pra sempre
    proc.on("error", (e) =>
      responder(() => res.status(500).json({ erro: `não consegui rodar: ${e.message}` })),
    );
    proc.on("close", (codigo) => {
      responder(() =>
        codigo === 0
          ? res.json({ ok: true, arquivo: `saida/${path.basename(destino)}` })
          : res
              .status(500)
              .json({ erro: erroTexto.slice(-400) || "falhou ao gerar o quadro" }),
      );
    });
  } catch (e) {
    erro(res, e);
  }
});

// ---------------------------------------------------------------- render

let trabalho = null; // { projeto, formato, feito, total, estado, mensagem }

const FORMATOS = ["Principal", "Vertical", "Quadrado"];

app.post("/api/render/:nome", async (req, res) => {
  if (barrouNome(req, res)) return;
  if (trabalho?.estado === "rodando") {
    return res.status(409).json({ erro: "Ja tem um render rodando." });
  }

  // Aceita um formato ou uma fila deles: renderizar horizontal, vertical e
  // quadrado numa tacada só é o caso comum de quem publica em vários lugares.
  const pedidos = (
    Array.isArray(req.body?.formatos) ? req.body.formatos : [req.body?.formato ?? "Principal"]
  ).filter((f) => FORMATOS.includes(f));

  if (pedidos.length === 0) {
    return res.status(400).json({ erro: "Nenhum formato válido." });
  }

  const nome = req.params.nome;
  trabalho = {
    projeto: nome,
    formato: pedidos[0],
    fila: pedidos,
    naFila: 0,
    feito: 0,
    total: 0,
    estado: "rodando",
    mensagem: "iniciando",
    prontos: [],
  };

  const ler = (buf) => {
    const m = [...buf.toString().matchAll(/(Rendered|Encoded)\s+(\d+)\/(\d+)/g)].pop();
    if (m) {
      trabalho.feito = Number(m[2]);
      trabalho.total = Number(m[3]);
      trabalho.mensagem = m[1] === "Rendered" ? "desenhando quadros" : "montando o video";
    }
  };

  const rodarUm = (i) => {
    if (i >= pedidos.length) {
      trabalho.estado = "pronto";
      trabalho.mensagem = trabalho.prontos.join(" · ");
      return;
    }
    const formato = pedidos[i];
    trabalho.formato = formato;
    trabalho.naFila = i;
    trabalho.feito = 0;
    trabalho.total = 0;
    trabalho.mensagem = `${formato}: iniciando`;

    const proc = spawn(PYTHON, ["motor/supremo.py", "render", nome, "--formato", formato], {
      cwd: RAIZ,
    });
    proc.stdout.on("data", ler);
    proc.stderr.on("data", ler);
    // idem: falha ao lançar o processo não pode derrubar o servidor
    proc.on("error", (e) => {
      trabalho.estado = "erro";
      trabalho.mensagem = `não consegui rodar o Python: ${e.message}`;
    });
    proc.on("close", (codigo) => {
      if (trabalho.estado === "erro") return;
      if (codigo !== 0) {
        trabalho.estado = "erro";
        trabalho.mensagem = `${formato} falhou — veja o terminal`;
        return; // fila para: não adianta seguir se um formato quebrou
      }
      trabalho.prontos.push(`${nome}-${formato.toLowerCase()}.mp4`);
      rodarUm(i + 1);
    });
  };

  rodarUm(0);
  res.json({ ok: true, fila: pedidos });
});

app.get("/api/render/status", (_req, res) => res.json(trabalho ?? { estado: "parado" }));

// ----------------------------------------------------------------

const PORTA = 8788;
app.listen(PORTA, "127.0.0.1", () => {
  console.log(`[SupremoCut] servidor de dados em http://127.0.0.1:${PORTA}`);
});

/*
  A captura mantém um navegador Chrome aberto pra não pagar a inicialização a
  cada quadro. Sem esta despedida ele fica órfão quando o servidor cai — e
  depois de algumas sessões há meia dúzia de Chrome invisíveis comendo memória.
*/
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, async () => {
    await encerrarCaptura().catch(() => {});
    process.exit(0);
  });
}
