import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  Image as ImageIcon,
  Layers,
  Loader2,
  Type,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import { duracaoEmFrames } from "../src/Video";
import { palavrasNaLinhaDoTempo } from "../src/legendas";
import { gerarSrt } from "../src/srt";
import type { Cena, ClipeAudio, Estilo, Overlay, Roteiro } from "../src/tipos";
import { casarComCenas, comTrilha, seguirCenas } from "../src/trilha";
import { api } from "./api";
import { Barra } from "./componentes/Barra";
import { Timeline } from "./componentes/Timeline";
import { PainelBloco } from "./componentes/PainelBloco";
import { PainelLegenda } from "./componentes/PainelLegenda";
import { PainelAudio } from "./componentes/PainelAudio";
import { PainelAuto } from "./componentes/PainelAuto";
import { Atalhos } from "./componentes/Atalhos";
import { Diagnostico } from "./componentes/Diagnostico";
import { Palco } from "./componentes/Palco";
import { Processar } from "./componentes/Processar";
import { usePicos } from "./picos";
import { camadasDoRoteiro } from "../src/migrar";
import { nomeDaCamada, type Camada } from "../src/camadas";
import { PainelCamadas } from "./componentes/PainelCamadas";

type Aba = "bloco" | "auto" | "legenda" | "camadas" | "audio";

/**
 * As abas do painel, com ícone.
 *
 * Ícone em cima e rótulo embaixo (ver `.aba` no CSS): seis abas lado a lado em
 * 344px cortariam palavra. Empilhado, cada uma vira um alvo largo e o ícone
 * carrega o reconhecimento antes da leitura.
 */
const ABAS: [Aba, string, LucideIcon][] = [
  ["bloco", "Bloco", Layers],
  ["auto", "Auto", Wand2],
  ["legenda", "Legenda", Captions],
  // Textos e Imagens viraram uma aba só: os dois eram listas do mesmo tipo de
  // coisa — algo que flutua por cima do vídeo — e separá-los obrigava a
  // adivinhar em qual aba estava o elemento que se quer mexer.
  ["camadas", "Camadas", Layers],
  ["audio", "Áudio", AudioLines],
];
type Instante = { roteiro: Roteiro; estilo: Estilo };
type Historico = { pilha: Instante[]; i: number };

/** Mudanças mais rápidas que isso viram um passo só no desfazer. */
const JANELA_AGRUPAMENTO = 450;
const LIMITE_HISTORICO = 120;

export const Editor: React.FC = () => {
  const [projetos, setProjetos] = useState<string[]>([]);
  const [projeto, setProjeto] = useState<string | null>(null);
  const [hist, setHist] = useState<Historico | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("bloco");
  /**
   * O QUE foi salvo, não em QUE índice do histórico.
   *
   * Antes eu guardava o índice. Como o agrupamento de 450ms SUBSTITUI o topo da
   * pilha mantendo o mesmo índice, digitar → Ctrl+S → digitar de novo em menos
   * de 450ms marcava a segunda edição como já salva: o autosave desistia, o
   * aviso de saída não aparecia, e o texto nunca chegava ao disco.
   * Comparando a referência do objeto, conteúdo diferente é sempre "não salvo".
   */
  const [salvo, setSalvo] = useState<Instante | null>(null);
  const [frame, setFrame] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Aviso passageiro. `erro: true` pinta de vermelho.
   *
   * Falha ao exportar um .srt é contratempo, não catástrofe: mandar isso pro
   * estado `erro` trocava o editor inteiro por uma tela morta e jogava fora o
   * histórico de desfazer do usuário.
   */
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [verAtalhos, setVerAtalhos] = useState(false);
  const [verMedidor, setVerMedidor] = useState(false);
  const [areaTransferencia, setAreaTransferencia] = useState<Cena | null>(null);
  const [clipeSelecionado, setClipeSelecionado] = useState<string | null>(null);
  const [zonaSegura, setZonaSegura] = useState(false);
  const [verProcessar, setVerProcessar] = useState(false);

  const player = useRef<PlayerRef>(null);
  const ultimaMudanca = useRef(0);

  const atual = hist ? hist.pilha[hist.i] : null;
  const roteiro = atual?.roteiro ?? null;
  const estilo = atual?.estilo ?? null;
  const sujo = !!atual && atual !== salvo;

  /**
   * A forma de onda do projeto.
   *
   * Carregada uma vez aqui e emprestada a quem precisa: o desenho na timeline,
   * o corte automático de silêncio e o limite de aparo dos clipes de áudio. Um
   * arquivo, uma leitura, uma verdade.
   *
   * Precisa vir DEPOIS de `roteiro`, e isso não é preciosismo de ordem: numa
   * versão anterior estava antes, e o `tsc` acusou TS2448 — a mesma classe de
   * erro que já deixou este editor com a tela em branco.
   */
  const picos = usePicos(roteiro?.audio?.picos, projeto ?? "");

  // ---------------------------------------------------------------- carregar

  useEffect(() => {
    api
      .projetos()
      .then((lista) => {
        setProjetos(lista);
        if (lista.length > 0) setProjeto(lista[0]);
      })
      .catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (!projeto) return;
    api
      .abrir(projeto)
      .then(({ roteiro, estilo }) => {
        /*
          Duas traduções acontecem na abertura, e as duas pela mesma razão: um
          projeto gravado num modelo antigo precisa virar o modelo atual ANTES
          de o usuário editar, senão a primeira edição escreveria um arquivo
          meio antigo e meio novo.

          `comTrilha` dá pista de áudio própria a quem tinha som soldado à cena.
          `camadasDoRoteiro` transforma overlays compostos em camadas soltas.
          Nenhuma das duas muda o que se vê — a segunda foi conferida quadro a
          quadro, por SSIM, contra o render anterior.
        */
        const comCamadas: Roteiro = {
          ...comTrilha(roteiro),
          camadas: camadasDoRoteiro(roteiro, estilo),
        };
        const inicial = { roteiro: comCamadas, estilo };
        setHist({ pilha: [inicial], i: 0 });
        setSalvo(inicial); // acabou de vir do disco: por definição, salvo
        setSelecionado(roteiro.cenas[0]?.id ?? null);
        setFrame(0);
        ultimaMudanca.current = 0;
      })
      .catch((e) => setErro(e.message));
  }, [projeto]);

  // ---------------------------------------------------------------- histórico

  const registrar = useCallback((novo: Instante) => {
    const agora = Date.now();
    const agrupar = agora - ultimaMudanca.current < JANELA_AGRUPAMENTO;
    ultimaMudanca.current = agora;

    setHist((h) => {
      if (!h) return h;
      const base = h.pilha.slice(0, h.i + 1);
      // agrupa gestos contínuos (arrastar borda, mexer slider) num passo só
      if (agrupar && base.length > 1) {
        base[base.length - 1] = novo;
        return { pilha: base, i: base.length - 1 };
      }
      const pilha = [...base, novo].slice(-LIMITE_HISTORICO);
      return { pilha, i: pilha.length - 1 };
    });
  }, []);

  /** Fecha o gesto: a próxima mudança começa um passo novo no desfazer. */
  const encerrarGesto = useCallback(() => {
    ultimaMudanca.current = 0;
  }, []);

  const desfazer = useCallback(() => {
    encerrarGesto();
    setHist((h) => (h && h.i > 0 ? { ...h, i: h.i - 1 } : h));
  }, [encerrarGesto]);

  const refazer = useCallback(() => {
    encerrarGesto();
    setHist((h) => (h && h.i < h.pilha.length - 1 ? { ...h, i: h.i + 1 } : h));
  }, [encerrarGesto]);

  const podeDesfazer = !!hist && hist.i > 0;
  const podeRefazer = !!hist && hist.i < hist.pilha.length - 1;

  // ---------------------------------------------------------------- mudanças

  const mudarRoteiro = useCallback(
    (novo: Roteiro) => atual && registrar({ roteiro: novo, estilo: atual.estilo }),
    [atual, registrar],
  );

  const mudarEstilo = useCallback(
    (novo: Estilo) => atual && registrar({ roteiro: atual.roteiro, estilo: novo }),
    [atual, registrar],
  );

  /**
   * Encaixa os tempos da cena em quadros inteiros.
   *
   * Sem isto, `fonte_inicio` e `duracao` viravam frações arbitrárias de segundo
   * e o arredondamento da busca e o da duração discordavam por um quadro em
   * cada emenda — 41 ms de áudio duplicados ou perdidos, dentro de fala
   * contínua. Trabalhando em quadros inteiros, o corte é exato por construção.
   */
  const emQuadros = useCallback(
    (c: Cena): Cena => {
      const f = roteiro?.fps ?? 30;
      const snap = (v: number) => Math.round(v * f) / f;
      return {
        ...c,
        fonte_inicio: Number(snap(Math.max(0, c.fonte_inicio)).toFixed(4)),
        duracao: Number(snap(Math.max(1 / f, c.duracao)).toFixed(4)),
      };
    },
    [roteiro?.fps],
  );

  const mudarCena = useCallback(
    (id: string, mudancas: Partial<Cena>, fecharGesto = false) => {
      if (fecharGesto) {
        encerrarGesto();
        if (Object.keys(mudancas).length === 0) return;
      }
      if (!roteiro) return;
      const novo = {
        ...roteiro,
        cenas: roteiro.cenas.map((c) =>
          c.id === id ? emQuadros({ ...c, ...mudancas }) : c,
        ),
      };
      // os clipes vinculados acompanham o corte; os soltos ficam onde estão
      mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) });
    },
    [roteiro, mudarRoteiro, encerrarGesto, emQuadros],
  );

  /**
   * Muda várias cenas de uma vez.
   *
   * Existe porque arrastar a divisa entre dois blocos mexe nos DOIS ao mesmo
   * tempo — um encurta, o outro alonga. Se fossem duas chamadas separadas, o
   * desfazer gravaria dois passos e o preview piscaria no meio.
   */
  const mudarCenas = useCallback(
    (mapa: Record<string, Partial<Cena>>, fecharGesto = false) => {
      if (fecharGesto) encerrarGesto();
      if (!roteiro || Object.keys(mapa).length === 0) return;
      const novo = {
        ...roteiro,
        cenas: roteiro.cenas.map((c) =>
          mapa[c.id] ? emQuadros({ ...c, ...mapa[c.id] }) : c,
        ),
      };
      mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) });
    },
    [roteiro, mudarRoteiro, encerrarGesto, emQuadros],
  );

  /** Muda um clipe de áudio. Mexer nele SOLTA o vínculo automaticamente. */
  const mudarClipe = useCallback(
    (id: string, mudancas: Partial<ClipeAudio>, soltarVinculo = true) => {
      if (!roteiro) return;
      mudarRoteiro({
        ...roteiro,
        trilha_audio: (roteiro.trilha_audio ?? []).map((c) =>
          c.id === id
            ? { ...c, ...mudancas, ...(soltarVinculo ? { vinculado_a: null } : {}) }
            : c,
        ),
      });
    },
    [roteiro, mudarRoteiro],
  );

  /**
   * A pilha de camadas.
   *
   * Uma lista só, ordenada: o último desenha por cima. Reordenar aqui muda o
   * empilhamento no vídeo — é a mesma lista que o renderizador lê.
   */
  const mudarCamadas = useCallback(
    (camadas: Camada[]) => roteiro && mudarRoteiro({ ...roteiro, camadas }),
    [roteiro, mudarRoteiro],
  );

  /** Ids das camadas em foco. Mais de um = edição em lote. */
  const [selecaoCamadas, setSelecaoCamadas] = useState<string[]>([]);

  /** Arquivos em <projeto>/imagens, pro seletor da camada de imagem. */
  const [imagensDoProjeto, setImagensDoProjeto] = useState<string[]>([]);
  useEffect(() => {
    if (!projeto) return;
    api.imagens(projeto).then(setImagensDoProjeto).catch(() => setImagensDoProjeto([]));
  }, [projeto]);

  /** Selecionar na linha do tempo leva pra aba onde se edita aquilo. */
  const selecionarCamadasNaLinha = useCallback((ids: string[]) => {
    setSelecaoCamadas(ids);
    if (ids.length) setAba("camadas");
  }, []);

  /**
   * Arrastar uma camada na pista.
   *
   * Mudança vazia com `soltar` fecha o gesto: o desfazer volta o arraste
   * inteiro de uma vez, e não pixel a pixel. Mesma lógica dos blocos de vídeo.
   */
  const mudarUmaCamada = useCallback(
    (id: string, mudancas: { inicio?: number; duracao?: number }, soltar = false) => {
      if (!roteiro) return;
      if (soltar) {
        encerrarGesto();
        return;
      }
      mudarRoteiro({
        ...roteiro,
        camadas: (roteiro.camadas ?? []).map((c) =>
          c.id === id ? ({ ...c, ...mudancas } as Camada) : c,
        ),
      });
    },
    [roteiro, mudarRoteiro, encerrarGesto],
  );

  const salvandoAgora = useRef(false);

  const salvar = useCallback(async () => {
    if (!atual || !projeto) return;
    // O roteiro carrega o nome do projeto dele. Se não bate com o projeto
    // aberto, estamos no meio de uma troca — gravar aqui escreveria o roteiro
    // ANTIGO por cima do NOVO. O servidor também recusa, mas errar duas vezes
    // é melhor que errar uma.
    if (atual.roteiro.projeto !== projeto) return;
    if (salvandoAgora.current) return; // evita dois PUTs se atropelando

    salvandoAgora.current = true;
    const instante = atual;
    try {
      await api.salvarRoteiro(projeto, instante.roteiro);
      await api.salvarEstilo(projeto, instante.estilo);
      setSalvo(instante);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      salvandoAgora.current = false;
    }
  }, [atual, projeto]);

  // ---------------------------------------------------------------- player

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const aoMover = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const aoTocar = () => setTocando(true);
    const aoPausar = () => setTocando(false);
    p.addEventListener("frameupdate", aoMover);
    p.addEventListener("play", aoTocar);
    p.addEventListener("pause", aoPausar);
    return () => {
      p.removeEventListener("frameupdate", aoMover);
      p.removeEventListener("play", aoTocar);
      p.removeEventListener("pause", aoPausar);
    };
  }, [roteiro?.projeto]);

  const posicoes = useMemo(() => {
    if (!roteiro) return [];
    let t = 0;
    return roteiro.cenas.map((c) => {
      const inicio = t;
      t += c.duracao;
      return inicio;
    });
  }, [roteiro]);

  const duracaoTotal = useMemo(
    () => (roteiro ? roteiro.cenas.reduce((a, c) => a + c.duracao, 0) : 0),
    [roteiro],
  );

  /**
   * Onde a agulha está no relógio da FONTE.
   *
   * As palavras da legenda passaram a viver em tempo de fonte. O painel que
   * lista "as palavras perto da agulha" precisa procurar nesse relógio, senão
   * mostraria o trecho errado assim que qualquer bloco fosse aparado.
   */
  const tempoNaFonte = useMemo(() => {
    if (!roteiro) return 0;
    const t = frame / roteiro.fps;
    for (let i = 0; i < roteiro.cenas.length; i++) {
      const c = roteiro.cenas[i];
      if (t >= posicoes[i] && t < posicoes[i] + c.duracao) {
        return (
          c.fonte_inicio +
          (roteiro.audio?.offset ?? 0) +
          (t - posicoes[i]) * (c.velocidade ?? 1)
        );
      }
    }
    const ultima = roteiro.cenas[roteiro.cenas.length - 1];
    return ultima ? ultima.fonte_inicio + (roteiro.audio?.offset ?? 0) : 0;
  }, [frame, roteiro, posicoes]);

  /**
   * Marca o instante atual, no relógio da FONTE.
   *
   * Assim a bandeirinha fica presa ao MOMENTO da gravação, não à posição na
   * timeline: aparar um bloco anterior não arrasta as marcas junto.
   *
   * Declarado AQUI, depois de `posicoes` e `tempoNaFonte`. Array de dependência
   * é avaliado durante a renderização — deixar isto acima delas quebrava o
   * editor inteiro com "cannot access before initialization".
   */
  const marcar = useCallback(() => {
    if (!roteiro) return;
    encerrarGesto();
    const t = Number(tempoNaFonte.toFixed(2));
    const atuais = roteiro.marcadores ?? [];
    // já tem marcador quase aqui? então o gesto vira "desmarcar"
    const perto = atuais.findIndex((m) => Math.abs(m.t - t) < 0.4);
    const marcadores =
      perto >= 0
        ? atuais.filter((_, i) => i !== perto)
        : [...atuais, { t, texto: "" }].sort((a, b) => a.t - b.t);
    mudarRoteiro({ ...roteiro, marcadores });
  }, [roteiro, tempoNaFonte, mudarRoteiro, encerrarGesto]);

  const apagarMarcador = useCallback(
    (t: number) => {
      if (!roteiro) return;
      encerrarGesto();
      // tolerância em vez de igualdade: comparar float por === é frágil
      mudarRoteiro({
        ...roteiro,
        marcadores: (roteiro.marcadores ?? []).filter((m) => Math.abs(m.t - t) > 0.001),
      });
    },
    [roteiro, mudarRoteiro, encerrarGesto],
  );

  /** Marcadores traduzidos pra posição na timeline. Os que caíram fora somem. */
  const marcadoresNaLinha = useMemo(() => {
    if (!roteiro) return [];
    const off = roteiro.audio?.offset ?? 0;
    const saida: { tFonte: number; tFinal: number; texto: string }[] = [];
    for (const m of roteiro.marcadores ?? []) {
      for (let i = 0; i < roteiro.cenas.length; i++) {
        const c = roteiro.cenas[i];
        const de = c.fonte_inicio + off;
        const ate = de + c.duracao * (c.velocidade ?? 1);
        if (m.t >= de && m.t < ate) {
          saida.push({
            tFonte: m.t,
            tFinal: posicoes[i] + (m.t - de) / (c.velocidade ?? 1),
            texto: m.texto,
          });
          break;
        }
      }
    }
    return saida;
  }, [roteiro, posicoes]);

  const irPara = useCallback(
    (segundos: number) => {
      if (!roteiro) return;
      const max = Math.max(0, duracaoEmFrames(roteiro) - 1);
      const f = Math.max(0, Math.min(max, Math.round(segundos * roteiro.fps)));
      player.current?.seekTo(f);
      setFrame(f);
    },
    [roteiro],
  );

  /**
   * Pula para um instante do ARQUIVO de origem.
   *
   * O painel de legenda lista palavras em tempo de fonte; mandar esse número
   * direto pro `irPara` (que espera tempo final) pulava para o lugar errado —
   * em um vídeo de 775s, clicar na primeira palavra ia para o segundo 281.
   * Aqui o tempo é traduzido procurando em qual bloco aquele trecho caiu.
   */
  const irParaFonte = useCallback(
    (segundosNaFonte: number) => {
      if (!roteiro) return;
      const off = roteiro.audio?.offset ?? 0;
      for (let i = 0; i < roteiro.cenas.length; i++) {
        const c = roteiro.cenas[i];
        const de = c.fonte_inicio + off;
        const ate = de + c.duracao * (c.velocidade ?? 1);
        if (segundosNaFonte >= de && segundosNaFonte < ate) {
          irPara(posicoes[i] + (segundosNaFonte - de) / (c.velocidade ?? 1));
          return;
        }
      }
      // aquele trecho foi aparado fora do vídeo: não há para onde pular
    },
    [roteiro, posicoes, irPara],
  );

  const andar = useCallback(
    (quadros: number) => {
      if (!roteiro) return;
      irPara((frame + quadros) / roteiro.fps);
    },
    [frame, roteiro, irPara],
  );

  // ---------------------------------------------------------------- edições

  /**
   * Grava um roteiro em que o CONJUNTO de cenas mudou de tamanho.
   *
   * Dividir, apagar, duplicar, reordenar e os cortes automáticos criam ou
   * destroem blocos. `seguirCenas()` só reposiciona o que já existe, então
   * sozinha ela deixava a metade nova muda e o clipe do bloco apagado tocando
   * órfão. Todo caminho que mexe na LISTA de cenas passa por aqui.
   */
  const mudarComTrilha = useCallback(
    (novo: Roteiro) => mudarRoteiro({ ...novo, trilha_audio: casarComCenas(novo) }),
    [mudarRoteiro],
  );

  const dividirNoCursor = useCallback(() => {
    if (!roteiro) return;
    const t = frame / roteiro.fps;
    const i = posicoes.findIndex(
      (p, idx) => t > p + 0.05 && t < p + roteiro.cenas[idx].duracao - 0.05,
    );
    if (i < 0) return;

    encerrarGesto();
    const c = roteiro.cenas[i];
    const antes = t - posicoes[i];
    // emQuadros também aqui: dividir era um dos caminhos que escapava e
    // reintroduzia tempos fracionários, trazendo de volta o erro de 1 quadro
    const a: Cena = emQuadros({ ...c, duracao: antes });
    const b: Cena = emQuadros({
      ...c,
      id: `${c.id}b${Date.now().toString(36).slice(-3)}`,
      fonte_inicio: c.fonte_inicio + a.duracao,
      duracao: c.duracao - a.duracao,
      entrada: { tipo: "corte" },
    });
    const cenas = [...roteiro.cenas];
    cenas.splice(i, 1, a, b);
    // A metade nova não tem clipe de áudio nenhum apontando pra ela. Sem
    // casarComCenas, dividir um bloco emudecia a segunda metade.
    mudarComTrilha({ ...roteiro, cenas });
    setSelecionado(b.id);
  }, [roteiro, frame, posicoes, mudarComTrilha, encerrarGesto, emQuadros]);

  const apagarCena = useCallback(
    (id: string) => {
      if (!roteiro || roteiro.cenas.length <= 1) return;
      encerrarGesto();
      const cenas = roteiro.cenas.filter((c) => c.id !== id);
      // O clipe vinculado morre com a cena. Antes ele virava órfão e seguia
      // tocando na posição antiga, agora por cima de outro bloco.
      mudarComTrilha({ ...roteiro, cenas });
      if (selecionado === id) setSelecionado(cenas[0]?.id ?? null);
    },
    [roteiro, selecionado, mudarComTrilha, encerrarGesto],
  );

  /** Aplica a mesma entrada a todos os blocos de uma vez. */
  const entradaEmTodos = useCallback(
    (entrada: Cena["entrada"]) => {
      if (!roteiro) return;
      encerrarGesto();
      mudarRoteiro({
        ...roteiro,
        // o primeiro bloco não tem de onde vir, então corte seco sempre
        cenas: roteiro.cenas.map((c, i) => ({
          ...c,
          entrada: i === 0 ? { tipo: "corte" } : entrada,
        })),
      });
    },
    [roteiro, mudarRoteiro, encerrarGesto],
  );

  /** Insere uma cópia de `base` logo depois do índice `depoisDe`. */
  const inserirCopia = useCallback(
    (base: Cena, depoisDe: number) => {
      if (!roteiro) return;
      encerrarGesto();
      const nova: Cena = emQuadros({
        ...base,
        id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      });
      const cenas = [...roteiro.cenas];
      cenas.splice(depoisDe + 1, 0, nova);
      // a cópia precisa do próprio som, senão o bloco duplicado sai mudo
      mudarComTrilha({ ...roteiro, cenas });
      setSelecionado(nova.id);
    },
    [roteiro, mudarComTrilha, encerrarGesto, emQuadros],
  );

  const copiar = useCallback(() => {
    const c = roteiro?.cenas.find((x) => x.id === selecionado);
    if (c) setAreaTransferencia(c);
  }, [roteiro, selecionado]);

  const colar = useCallback(() => {
    if (!roteiro || !areaTransferencia) return;
    const i = roteiro.cenas.findIndex((c) => c.id === selecionado);
    inserirCopia(areaTransferencia, i < 0 ? roteiro.cenas.length - 1 : i);
  }, [roteiro, areaTransferencia, selecionado, inserirCopia]);

  const duplicar = useCallback(() => {
    if (!roteiro) return;
    const i = roteiro.cenas.findIndex((c) => c.id === selecionado);
    if (i < 0) return;
    inserirCopia(roteiro.cenas[i], i);
  }, [roteiro, selecionado, inserirCopia]);

  const moverCena = useCallback(
    (id: string, direcao: -1 | 1) => {
      if (!roteiro) return;
      encerrarGesto();
      const i = roteiro.cenas.findIndex((c) => c.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= roteiro.cenas.length) return;
      const cenas = [...roteiro.cenas];
      [cenas[i], cenas[j]] = [cenas[j], cenas[i]];
      // Trocar a ordem muda o instante em que cada bloco começa, então os
      // clipes vinculados precisam ser reposicionados. Sem isto, reordenar
      // deixava a fala tocando debaixo da imagem errada.
      const novo = { ...roteiro, cenas };
      mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) });
    },
    [roteiro, mudarRoteiro, encerrarGesto],
  );

  /**
   * Tira o bloco de onde está e enfia na posição `destino`.
   *
   * É o que o arraste na linha do tempo chama. Diferente de `moverCena`, que
   * troca com o vizinho: aqui o bloco viaja e todos os outros fecham a fila,
   * que é o que se espera ao arrastar por cima de cinco blocos de uma vez.
   */
  const reordenarCena = useCallback(
    (id: string, destino: number) => {
      if (!roteiro) return;
      const i = roteiro.cenas.findIndex((c) => c.id === id);
      if (i < 0) return;
      const alvo = Math.max(0, Math.min(roteiro.cenas.length - 1, destino));
      if (alvo === i) return;
      encerrarGesto();
      const cenas = [...roteiro.cenas];
      const [movido] = cenas.splice(i, 1);
      cenas.splice(alvo, 0, movido);
      const novo = { ...roteiro, cenas };
      mudarRoteiro({ ...novo, trilha_audio: seguirCenas(novo) });
    },
    [roteiro, mudarRoteiro, encerrarGesto],
  );

  // ---------------------------------------------------------------- entregáveis

  const exportarLegenda = useCallback(async () => {
    if (!roteiro || !projeto) return;
    // as mesmas palavras que o vídeo usa, já no relógio do corte atual
    const palavras = palavrasNaLinhaDoTempo(
      roteiro.legendas?.palavras ?? [],
      roteiro.cenas,
      roteiro.audio?.offset ?? 0,
    );
    if (palavras.length === 0) {
      setRecado({ texto: "Não há palavras transcritas para exportar.", erro: true });
      return;
    }
    try {
      const r = await api.salvarLegenda(projeto, gerarSrt(palavras));
      setRecado({ texto: `Legenda gravada em ${r.arquivo}` });
    } catch (e) {
      setRecado({ texto: (e as Error).message, erro: true });
    }
  }, [roteiro, projeto]);

  const exportarQuadro = useCallback(async () => {
    if (!projeto) return;
    if (sujo) await salvar(); // o still lê do disco, não da tela
    setRecado({ texto: "Gerando o quadro…" });
    try {
      const r = await api.salvarQuadro(projeto, frame, "Principal");
      setRecado({ texto: `Quadro salvo em ${r.arquivo}` });
    } catch (e) {
      setRecado({ texto: (e as Error).message, erro: true });
    }
  }, [projeto, frame, sujo, salvar]);

  // ---------------------------------------------------------------- teclado

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.tagName === "SELECT" ||
          alvo.isContentEditable);

      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      // atalhos com Ctrl valem mesmo digitando
      if (ctrl && k === "s") {
        e.preventDefault();
        salvar();
        return;
      }
      if (ctrl && k === "z" && !e.shiftKey) {
        e.preventDefault();
        desfazer();
        return;
      }
      if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        refazer();
        return;
      }

      if (digitando) return;

      if (ctrl && k === "c") {
        e.preventDefault();
        copiar();
        return;
      }
      if (ctrl && k === "v") {
        e.preventDefault();
        colar();
        return;
      }
      if (ctrl && k === "d") {
        e.preventDefault();
        duplicar();
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        player.current?.toggle();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        andar(e.shiftKey ? Math.round(roteiro?.fps ?? 24) : 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        andar(e.shiftKey ? -Math.round(roteiro?.fps ?? 24) : -1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        irPara(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        irPara(duracaoTotal - 0.05);
        return;
      }
      // S ou T dividem — o CapCut usa T, e é o que a mão do Campelo já sabe
      if (k === "s" || k === "t") {
        e.preventDefault();
        dividirNoCursor();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selecionado) {
        e.preventDefault();
        apagarCena(selecionado);
        return;
      }
      if (k === "d") {
        e.preventDefault();
        setVerMedidor((v) => !v);
        return;
      }
      if (k === "m") {
        e.preventDefault();
        marcar();
        return;
      }
      if (k === "?" || (e.shiftKey && k === "/")) {
        e.preventDefault();
        setVerAtalhos((v) => !v);
        return;
      }
      if (e.key === "Escape") setVerAtalhos(false);
    };

    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [
    salvar,
    desfazer,
    refazer,
    andar,
    irPara,
    duracaoTotal,
    dividirNoCursor,
    apagarCena,
    selecionado,
    roteiro?.fps,
    copiar,
    colar,
    duplicar,
    marcar,
  ]);

  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => {
      if (sujo) e.preventDefault();
    };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [sujo]);

  // o recado de sucesso some sozinho: não é erro, não precisa de clique
  useEffect(() => {
    if (!recado) return;
    const t = setTimeout(() => setRecado(null), 5000);
    return () => clearTimeout(t);
  }, [recado]);

  /**
   * Salvamento automático: 3s depois da última mudança.
   * O relógio reinicia a cada alteração, então mexer num slider não dispara
   * uma gravação por movimento — só uma no fim.
   */
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => {
      salvar();
    }, 3000);
    return () => clearTimeout(t);
  }, [sujo, salvar]);

  // ---------------------------------------------------------------- render

  if (erro) {
    return (
      <div className="carregando">
        <strong>Deu ruim ao carregar</strong>
        <span style={{ color: "var(--texto-fraco)" }}>{erro}</span>
      </div>
    );
  }

  if (!roteiro || !estilo || !projeto) {
    return <div className="carregando">carregando…</div>;
  }

  const cenaAtual = roteiro.cenas.find((c) => c.id === selecionado) ?? null;

  return (
    <div className="app">
      <Barra
        projetos={projetos}
        projeto={projeto}
        aoTrocarProjeto={setProjeto}
        sujo={sujo}
        aoSalvar={salvar}
        aoDesfazer={desfazer}
        aoRefazer={refazer}
        podeDesfazer={podeDesfazer}
        podeRefazer={podeRefazer}
        aoVerAtalhos={() => setVerAtalhos(true)}
        aoProcessar={() => setVerProcessar(true)}
        aoLegenda={exportarLegenda}
        aoQuadro={exportarQuadro}
        zonaSegura={zonaSegura}
        aoZonaSegura={() => setZonaSegura((v) => !v)}
        formatoPadrao={
          roteiro
            ? roteiro.altura > roteiro.largura
              ? "Vertical"
              : roteiro.altura === roteiro.largura
                ? "Quadrado"
                : "Principal"
            : "Principal"
        }
      />

      <div className="miolo">
        <div className="palco">
          <div className="palco-caixa">
            <Palco
              player={player}
              roteiro={roteiro}
              estilo={estilo}
              zonaSegura={zonaSegura}
            />
          </div>
        </div>

        <div className="lateral">
          <div className="abas">
            {ABAS.map(([id, rotulo, Icone]) => (
              <button
                key={id}
                className={`aba ${aba === id ? "ativa" : ""}`}
                onClick={() => setAba(id)}
                title={rotulo}
              >
                <Icone size={16} className="lucide" />
                {rotulo}
              </button>
            ))}
          </div>

          <div className="painel-corpo">
            {aba === "bloco" && (
              <PainelBloco
                cena={cenaAtual}
                roteiro={roteiro}
                aoMudar={mudarCena}
                aoApagar={apagarCena}
                aoMover={moverCena}
                aoEntradaEmTodos={entradaEmTodos}
              />
            )}
            {aba === "auto" && (
              <PainelAuto
                roteiro={roteiro}
                pasta={roteiro.projeto}
                picos={picos}
                /* mudarComTrilha, não mudarRoteiro: cortar silêncio e apagar
                   palavras criam e destroem blocos, e a trilha de áudio precisa
                   ser refeita junto ou os pedaços novos saem mudos. */
                aoMudarRoteiro={mudarComTrilha}
              />
            )}
            {aba === "camadas" && (
              <PainelCamadas
                camadas={roteiro.camadas ?? []}
                estilo={estilo}
                aoMudarEstilo={mudarEstilo}
                selecao={selecaoCamadas}
                aoSelecionar={setSelecaoCamadas}
                aoMudar={mudarCamadas}
                tempoAtual={frame / roteiro.fps}
                duracaoTotal={duracaoTotal}
                imagensDisponiveis={imagensDoProjeto}
              />
            )}
            {aba === "legenda" && (
              <PainelLegenda
                roteiro={roteiro}
                estilo={estilo}
                tempoAtual={tempoNaFonte}
                aoMudarRoteiro={mudarRoteiro}
                aoMudarEstilo={mudarEstilo}
                aoIrPara={irParaFonte}
              />
            )}
            {aba === "audio" && (
              <PainelAudio
                roteiro={roteiro}
                aoMudar={mudarRoteiro}
                clipeSelecionado={clipeSelecionado}
                aoMudarClipe={mudarClipe}
              />
            )}
          </div>
        </div>
      </div>

      <Timeline
        roteiro={roteiro}
        posicoes={posicoes}
        duracaoTotal={duracaoTotal}
        selecionado={selecionado}
        frame={frame}
        tocando={tocando}
        aoSelecionar={setSelecionado}
        aoMudarCena={mudarCena}
        aoMudarCenas={mudarCenas}
        aoReordenar={reordenarCena}
        duracaoAudio={picos?.duracao}
        trilhaAudio={roteiro.trilha_audio ?? []}
        clipeSelecionado={clipeSelecionado}
        aoSelecionarClipe={setClipeSelecionado}
        aoMudarClipe={mudarClipe}
        camadas={roteiro.camadas ?? []}
        selecaoCamadas={selecaoCamadas}
        aoSelecionarCamadas={selecionarCamadasNaLinha}
        aoMudarCamada={mudarUmaCamada}
        aoIrPara={irPara}
        aoDividir={dividirNoCursor}
        aoApagar={apagarCena}
        marcadores={marcadoresNaLinha}
        aoMarcar={marcar}
        aoApagarMarcador={apagarMarcador}
      />

      {verProcessar && (
        <Processar
          aoFechar={() => setVerProcessar(false)}
          aoTerminar={(nome) => {
            api.projetos().then((lista) => {
              setProjetos(lista);
              if (lista.includes(nome)) setProjeto(nome);
            });
          }}
        />
      )}
      {recado && (
        <div className={`recado ${recado.erro ? "ruim" : ""}`}>{recado.texto}</div>
      )}
      {verAtalhos && <Atalhos aoFechar={() => setVerAtalhos(false)} />}
      {verMedidor && (
        <Diagnostico player={player} fps={roteiro.fps} aoFechar={() => setVerMedidor(false)} />
      )}
    </div>
  );
};
