import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cena, ClipeAudio, Roteiro } from "../../src/tipos";
import { nomeDaCamada, type Camada } from "../../src/camadas";
import {
  ChevronsRightLeft,
  Flag,
  Image as ImageIcon,
  Link2,
  Magnet,
  Maximize2,
  Minus,
  MoveHorizontal,
  Plus,
  Split as SplitIcon,
  Square,
  Trash2,
  Type,
  Video as VideoIcon,
  VolumeX,
} from "lucide-react";
import { Onda } from "./Onda";

type Props = {
  roteiro: Roteiro;
  posicoes: number[];
  duracaoTotal: number;
  selecionado: string | null;
  frame: number;
  tocando: boolean;
  aoSelecionar: (id: string) => void;
  aoMudarCena: (id: string, mudancas: Partial<Cena>, encerrarGesto?: boolean) => void;
  aoMudarCenas: (mapa: Record<string, Partial<Cena>>, encerrarGesto?: boolean) => void;
  /** Tira o bloco de onde está e coloca na posição pedida. */
  aoReordenar: (id: string, destino: number) => void;
  /**
   * Duração do ARQUIVO DE ÁUDIO, em segundos.
   *
   * Vem da forma de onda, não das fontes de vídeo: são arquivos diferentes, e
   * aparar um clipe de som contra o limite do vídeo deixa passar do fim do
   * áudio num projeto de duas fontes.
   */
  duracaoAudio?: number;
  trilhaAudio: ClipeAudio[];
  clipeSelecionado: string | null;
  aoSelecionarClipe: (id: string | null) => void;
  aoMudarClipe: (id: string, mudancas: Partial<ClipeAudio>, soltar?: boolean) => void;
  aoIrPara: (segundos: number) => void;
  aoDividir: () => void;
  aoApagar: (id: string) => void;
  /** Já traduzidos: `tFonte` identifica o marcador, `tFinal` é onde desenhar. */
  /** A pilha inteira: texto, forma, imagem e vídeo flutuante. */
  camadas: Camada[];
  /** Ids em foco. Mais de um = edição em lote. */
  selecaoCamadas: string[];
  aoSelecionarCamadas: (ids: string[]) => void;
  aoMudarCamada: (
    id: string,
    mudancas: { inicio?: number; duracao?: number },
    soltar?: boolean,
  ) => void;

  marcadores: { tFonte: number; tFinal: number; texto: string }[];
  aoMarcar: () => void;
  aoApagarMarcador: (t: number) => void;
};

const DURACAO_MINIMA = 0.2;

export const relogio = (s: number) => {
  const neg = s < 0;
  s = Math.abs(s);
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${neg ? "-" : ""}${m}:${String(seg).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

const curto = (s: number) => {
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return m > 0 ? `${m}:${String(seg).padStart(2, "0")}` : `${seg}s`;
};

/** Intervalos "redondos" pra régua não ficar com números quebrados. */
const PASSOS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];

type Arraste =
  /**
   * A divisa entre dois blocos vizinhos. Arrastar move o PONTO DE CORTE:
   * o de trás encurta, o da frente alonga, e a duração total não muda.
   * É o que faz a borda seguir o mouse de verdade.
   */
  | {
      tipo: "corte";
      idA: string;
      idB: string;
      x0: number;
      fonteA0: number;
      durA0: number;
      fonteB0: number;
      durB0: number;
      inicioA: number;
    }
  /** Ponta solta do começo ou do fim do vídeo: aí sim muda a duração total. */
  | { tipo: "apara"; id: string; lado: "esq" | "dir"; x0: number; fonte0: number; dur0: number }
  /** Clipe de áudio deslizando na trilha, sem mexer no vídeo. */
  /**
   * Clipe de áudio deslizando na trilha, sem mexer no vídeo.
   *
   * `ativou` existe porque mover um clipe SOLTA o vínculo com a cena. Sem o
   * limiar de pixels, um clique de seleção com um tremor de mão de 1 px já
   * bastava pra desprender o som do vídeo — em silêncio, e sem jeito óbvio de
   * desfazer.
   */
  | { tipo: "clipe"; id: string; x0: number; inicio0: number; ativou: boolean }
  /** Ponta de um clipe de áudio. */
  | {
      tipo: "clipe-borda";
      id: string;
      lado: "esq" | "dir";
      x0: number;
      inicio0: number;
      dur0: number;
      fonte0: number;
    }
  /**
   * Bloco viajando pra outra posição na fila.
   *
   * Não mexe em nada enquanto arrasta — só calcula onde ele cairia e desenha a
   * marca. Reordenar de verdade a cada pixel faria os blocos pularem debaixo do
   * cursor e ninguém conseguiria mirar.
   */
  | { tipo: "reordenar"; id: string; x0: number; de: number; para: number; ativou: boolean }
  /**
   * Texto ou elemento deslizando na pista dele.
   *
   * Os dois compartilham o mesmo gesto porque compartilham a mesma forma:
   * `{id, inicio, duracao}` em relógio FINAL. Um lettering e um logo não
   * pertencem a bloco nenhum — flutuam por cima da montagem inteira —, então
   * mover qualquer um dos dois é a mesma conta.
   *
   * `pista` só existe pra saber a qual lista devolver a mudança.
   */
  | {
      tipo: "faixa";
      id: string;
      x0: number;
      inicio0: number;
      ativou: boolean;
    }
  /** Ponta de uma camada: muda quanto tempo ela fica na tela. */
  | {
      tipo: "faixa-borda";
      id: string;
      lado: "esq" | "dir";
      x0: number;
      inicio0: number;
      dur0: number;
    }
  | { tipo: "agulha" };

type NaLinha = { id: string; inicio: number; duracao: number };

/**
 * Distribui os itens no MENOR numero de linhas possivel.
 *
 * A regra e a de qualquer editor de video: quem nao se cruza no tempo divide a
 * mesma linha; quem se cruza sobe pra proxima. Nada de uma linha por objeto —
 * cinco letterings que nunca aparecem juntos ocupavam cinco linhas e enchiam a
 * tela de espaco vazio. E nada de todos na mesma — dois que se sobrepoem
 * desenhavam um por cima do outro e o de baixo ficava sem alvo de clique.
 *
 * O algoritmo e guloso e roda da esquerda pra direita: pra cada item, procura a
 * primeira linha cujo ultimo ocupante ja terminou. Guloso basta porque os itens
 * entram ordenados por inicio — nesse caso ele acha o minimo de linhas.
 */
const empacotar = <T extends NaLinha>(itens: T[]): T[][] => {
  const linhas: T[][] = [];
  for (const it of [...itens].sort((a, b) => a.inicio - b.inicio)) {
    const linha = linhas.find((l) => {
      const ultimo = l[l.length - 1];
      return it.inicio >= ultimo.inicio + ultimo.duracao;
    });
    if (linha) linha.push(it);
    else linhas.push([it]);
  }
  return linhas;
};

/** Quantos pixels o mouse precisa andar pra virar arraste em vez de clique. */
const LIMIAR_ARRASTE = 6;

/** O ícone diz o tipo antes de a pessoa ler o rótulo. */
const ICONE_CAMADA: Record<Camada["tipo"], React.ReactNode> = {
  texto: <Type size={11} className="lucide" />,
  forma: <Square size={11} className="lucide" />,
  imagem: <ImageIcon size={11} className="lucide" />,
  video: <VideoIcon size={11} className="lucide" />,
};

/**
 * Fecha um tempo no quadro mais próximo.
 *
 * Vale para o clipe de áudio tanto quanto para o bloco de vídeo: o `Video.tsx`
 * arredonda início, duração e busca na fonte SEPARADAMENTE, e três
 * arredondamentos independentes sobre valores fracionários podem cair em
 * quadros diferentes. Fechando aqui, os três concordam por construção.
 */
const quantizar = (v: number, fps: number) => Math.round(v * fps) / fps;

const TimelineInterna: React.FC<Props> = ({
  roteiro,
  posicoes,
  duracaoTotal,
  selecionado,
  frame,
  tocando,
  aoSelecionar,
  aoMudarCena,
  aoMudarCenas,
  aoReordenar,
  duracaoAudio,
  trilhaAudio,
  clipeSelecionado,
  aoSelecionarClipe,
  aoMudarClipe,
  camadas,
  selecaoCamadas,
  aoSelecionarCamadas,
  aoMudarCamada,
  aoIrPara,
  aoDividir,
  aoApagar,
  marcadores,
  aoMarcar,
  aoApagarMarcador,
}) => {
  /** Fecha no quadro deste projeto. */
  const emQuadros = useCallback(
    (v: number) => quantizar(v, roteiro.fps),
    [roteiro.fps],
  );

  const [escala, setEscala] = useState(14);
  const [arraste, setArraste] = useState<Arraste | null>(null);
  /** Mostra a linha guia quando a borda gruda, pra você VER que grudou. */
  const [grudou, setGrudou] = useState(false);

  /**
   * Dois jeitos de arrastar a borda — coisas diferentes, não é o ímã:
   *
   * "corte"  → move o PONTO DE CORTE entre dois blocos. Um encurta, o outro
   *            alonga, a duração total do vídeo não muda.
   * "aparar" → mexe SÓ neste bloco. Ele encurta ou alonga e todo o resto
   *            desliza junto, mudando a duração total.
   */
  const [modo, setModo] = useState<"corte" | "aparar">(() => {
    try {
      return localStorage.getItem("supremocut:modo") === "aparar" ? "aparar" : "corte";
    } catch {
      return "corte";
    }
  });

  const alternarModo = useCallback(() => {
    setModo((m) => {
      const novo = m === "corte" ? "aparar" : "corte";
      try {
        localStorage.setItem("supremocut:modo", novo);
      } catch {
        /* sem armazenamento: segue só na memória */
      }
      return novo;
    });
  }, []);

  /** Ímã ligado/desligado, lembrado entre sessões. */
  const [ima, setIma] = useState(() => {
    try {
      return localStorage.getItem("supremocut:ima") !== "0";
    } catch {
      return true;
    }
  });

  const alternarIma = useCallback(() => {
    setIma((v) => {
      try {
        localStorage.setItem("supremocut:ima", v ? "0" : "1");
      } catch {
        /* navegador sem armazenamento: segue só na memória */
      }
      return !v;
    });
  }, []);
  const rolagem = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const jaAjustou = useRef<string | null>(null);

  const tempoAtual = frame / roteiro.fps;
  const larguraTotal = Math.max(duracaoTotal * escala + 24, 200);

  /*
    As linhas da pilha, de cima pra baixo.

    `empacotar` junta na mesma linha quem não se cruza no tempo. O `reverse`
    depois é o que faz a leitura bater com o desenho: a camada que fica na
    FRENTE no vídeo é a última da lista, e tem que ser a PRIMEIRA linha aqui —
    é a convenção de qualquer editor, e sem ela mover uma camada pra cima na
    tela a mandaria pra baixo na timeline.
  */
  const linhasCamadas = useMemo(() => empacotar(camadas).reverse(), [camadas]);

  /** Clique na barra: simples troca a seleção, Ctrl soma, Shift pega intervalo. */
  const selecionarNaPilha = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.ctrlKey || e.metaKey) {
        aoSelecionarCamadas(
          selecaoCamadas.includes(id)
            ? selecaoCamadas.filter((s) => s !== id)
            : [...selecaoCamadas, id],
        );
        return;
      }
      if (e.shiftKey && selecaoCamadas.length) {
        const ids = camadas.map((c) => c.id);
        const a = ids.indexOf(selecaoCamadas[selecaoCamadas.length - 1]);
        const b = ids.indexOf(id);
        const [de, ate] = a < b ? [a, b] : [b, a];
        aoSelecionarCamadas(ids.slice(de, ate + 1));
        return;
      }
      if (!selecaoCamadas.includes(id)) aoSelecionarCamadas([id]);
    },
    [camadas, selecaoCamadas, aoSelecionarCamadas],
  );

  /**
   * Distância, em pixels, entre a borda da área de rolagem e o ponto onde o
   * tempo zero é desenhado. Medida do DOM em vez de chutada: assim a agulha,
   * os blocos e o clique nunca saem de sincronia se o CSS mudar.
   *
   * Declarada AQUI, antes de todos os efeitos que a usam.
   */
  const recuo = useCallback(() => {
    const c = conteudo.current;
    const r = rolagem.current;
    if (!c || !r) return 0;
    return c.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft;
  }, []);

  // ------------------------------------------------------------ encaixe inicial

  const encaixarTudo = useCallback(() => {
    const caixa = rolagem.current;
    if (!caixa || duracaoTotal <= 0) return;
    const util = caixa.clientWidth - 40;
    if (util > 60) setEscala(Math.max(0.4, Math.min(80, util / duracaoTotal)));
  }, [duracaoTotal]);

  useEffect(() => {
    const chave = `${roteiro.projeto}`;
    if (jaAjustou.current === chave || duracaoTotal <= 0) return;
    jaAjustou.current = chave;
    encaixarTudo();
  }, [roteiro.projeto, duracaoTotal, encaixarTudo]);

  // ------------------------------------------------------------ zoom no Ctrl+roda

  useEffect(() => {
    const caixa = rolagem.current;
    if (!caixa) return;

    const naRoda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // sem Ctrl é rolagem normal
      e.preventDefault();

      const r = caixa.getBoundingClientRect();
      const xNaCaixa = e.clientX - r.left;
      const desloc = recuo();
      const tempoSobOCursor = (caixa.scrollLeft + xNaCaixa - desloc) / escala;

      const fator = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const nova = Math.max(0.4, Math.min(200, escala * fator));
      setEscala(nova);

      // mantém sob o mouse o mesmo instante de vídeo
      requestAnimationFrame(() => {
        caixa.scrollLeft = tempoSobOCursor * nova + desloc - xNaCaixa;
      });
    };

    caixa.addEventListener("wheel", naRoda, { passive: false });
    return () => caixa.removeEventListener("wheel", naRoda);
  }, [escala]);

  // ------------------------------------------------------------ arraste

  const tempoDoEvento = useCallback(
    (clientX: number) => {
      const caixa = rolagem.current;
      if (!caixa) return 0;
      const r = caixa.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(duracaoTotal, (caixa.scrollLeft + clientX - r.left - recuo()) / escala),
      );
    },
    [escala, duracaoTotal, recuo],
  );

  useEffect(() => {
    if (!arraste) return;

    const mover = (e: MouseEvent) => {
      if (arraste.tipo === "agulha") {
        aoIrPara(tempoDoEvento(e.clientX));
        return;
      }
      // ---- bloco mudando de lugar na fila ----
      if (arraste.tipo === "reordenar") {
        const andou = Math.abs(e.clientX - arraste.x0);
        if (!arraste.ativou && andou < LIMIAR_ARRASTE) return;

        // Onde o cursor está, no relógio do vídeo. O destino é o bloco cujo
        // território cobre esse ponto — comparar com o CENTRO de cada bloco
        // faria a inserção piscar entre duas posições em blocos largos.
        const t = tempoDoEvento(e.clientX);
        let para = roteiro.cenas.length - 1;
        for (let k = 0; k < roteiro.cenas.length; k++) {
          if (t < posicoes[k] + roteiro.cenas[k].duracao) {
            para = k;
            break;
          }
        }
        if (para !== arraste.para || !arraste.ativou) {
          setArraste({ ...arraste, para, ativou: true });
        }
        return;
      }

      const delta = (e.clientX - arraste.x0) / escala;
      const fonte = roteiro.fontes.camera ?? roteiro.fontes.tela;
      const limiteFonte = fonte ? fonte.duracao - fonte.offset : Number.POSITIVE_INFINITY;

      // ---- texto ou elemento deslizando na pista dele ----
      if (arraste.tipo === "faixa") {
        if (!arraste.ativou) {
          if (Math.abs(e.clientX - arraste.x0) < LIMIAR_ARRASTE) return;
          setArraste({ ...arraste, ativou: true });
        }
        let novo = Math.max(0, arraste.inicio0 + delta);
        let colou = false;
        if (ima && !e.altKey) {
          const tol = 10 / escala;
          /*
            O ímã aqui gruda na AGULHA e nas EMENDAS DE VÍDEO, e é essa segunda
            parte que importa: um lettering que entra junto com o corte lê como
            decisão; entrando dois quadros depois, lê como erro de sincronia.
            Mirar isso à mão, num vídeo de 41 segundos numa timeline de 1800
            pixels, é mirar em menos de meio pixel por quadro.
          */
          for (const alvo of [tempoAtual, ...posicoes]) {
            if (Math.abs(novo - alvo) < tol) {
              novo = alvo;
              colou = true;
              break;
            }
          }
        }
        setGrudou(colou);
        aoMudarCamada(arraste.id, { inicio: emQuadros(novo) });
        return;
      }

      if (arraste.tipo === "faixa-borda") {
        if (arraste.lado === "esq") {
          // arrastar o começo anda o início e encurta na mesma medida, pra
          // ponta da direita ficar parada
          const maximo = arraste.dur0 - DURACAO_MINIMA;
          const minimo = -arraste.inicio0;
          const d = emQuadros(Math.max(minimo, Math.min(maximo, delta)));
          aoMudarCamada(arraste.id, {
            inicio: emQuadros(arraste.inicio0 + d),
            duracao: emQuadros(arraste.dur0 - d),
          });
        } else {
          const nova = Math.max(DURACAO_MINIMA, arraste.dur0 + delta);
          aoMudarCamada(arraste.id, { duracao: emQuadros(nova) });
        }
        return;
      }

      // ---- clipe de áudio deslizando na trilha ----
      if (arraste.tipo === "clipe") {
        // enquanto for tremor de mão, não é arraste — e o vínculo fica de pé
        if (!arraste.ativou) {
          if (Math.abs(e.clientX - arraste.x0) < LIMIAR_ARRASTE) return;
          setArraste({ ...arraste, ativou: true });
        }
        let novo = Math.max(0, arraste.inicio0 + delta);
        let colou = false;
        if (ima && !e.altKey) {
          const tol = 10 / escala;
          // gruda na agulha e nas emendas de vídeo — os dois pontos que
          // importam quando você está sincronizando fala com imagem
          const alvos = [tempoAtual, ...posicoes];
          for (const alvo of alvos) {
            if (Math.abs(novo - alvo) < tol) {
              novo = alvo;
              colou = true;
              break;
            }
          }
        }
        setGrudou(colou);
        aoMudarClipe(arraste.id, { inicio: emQuadros(novo) });
        return;
      }

      if (arraste.tipo === "clipe-borda") {
        /*
          RELÓGIO: o limite aqui é o do arquivo de ÁUDIO, não o do vídeo.
          `limiteFonte` acima vem de `fontes.camera/tela` — outro arquivo, com
          outra duração e outro offset. Num projeto de duas fontes isso deixava
          aparar o clipe até depois do fim do som, ou travava antes da hora.
        */
        const limiteAudio = duracaoAudio ?? Number.POSITIVE_INFINITY;

        if (arraste.lado === "esq") {
          // apara o começo: anda na fonte e encurta na mesma medida
          const maximo = arraste.dur0 - DURACAO_MINIMA;
          // `inicio` não pode ir abaixo de zero, e quando ele para, a fonte
          // também tem que parar — senão o som escorrega dentro do clipe e a
          // fala sai do lugar sem que nada se mexa na tela.
          const minimo = Math.max(-arraste.fonte0, -arraste.inicio0);
          const d = emQuadros(Math.max(minimo, Math.min(maximo, delta)));
          aoMudarClipe(arraste.id, {
            inicio: emQuadros(Math.max(0, arraste.inicio0 + d)),
            fonte_inicio: emQuadros(arraste.fonte0 + d),
            duracao: emQuadros(arraste.dur0 - d),
          });
        } else {
          const sobra = limiteAudio - arraste.fonte0;
          const nova = Math.max(DURACAO_MINIMA, Math.min(sobra, arraste.dur0 + delta));
          aoMudarClipe(arraste.id, { duracao: emQuadros(nova) });
        }
        return;
      }

      if (arraste.tipo === "corte") {
        // quanto a divisa pode andar sem quebrar nenhum dos dois lados
        const minimo = Math.max(
          DURACAO_MINIMA - arraste.durA0, // A não pode sumir
          -arraste.fonteB0, // B não pode começar antes do arquivo
        );
        const maximo = Math.min(
          arraste.durB0 - DURACAO_MINIMA, // B não pode sumir
          limiteFonte - arraste.fonteA0 - arraste.durA0, // A não pode passar do fim do arquivo
        );

        let d = Math.max(minimo, Math.min(maximo, delta));

        // ímã: a divisa gruda na agulha se chegar perto. Alt segura o ímã
        // enquanto pressionado, sem precisar desligar o botão.
        let colou = false;
        if (ima && !e.altKey) {
          const tolerancia = 10 / escala;
          const divisa = arraste.inicioA + arraste.durA0 + d;
          if (Math.abs(divisa - tempoAtual) < tolerancia) {
            d = Math.max(minimo, Math.min(maximo, tempoAtual - arraste.inicioA - arraste.durA0));
            colou = true;
          }
        }
        setGrudou(colou);

        aoMudarCenas({
          [arraste.idA]: { duracao: Number((arraste.durA0 + d).toFixed(3)) },
          [arraste.idB]: {
            fonte_inicio: Number((arraste.fonteB0 + d).toFixed(3)),
            duracao: Number((arraste.durB0 - d).toFixed(3)),
          },
        });
        return;
      }

      // ponta solta: começo do primeiro bloco ou fim do último
      const i = roteiro.cenas.findIndex((c) => c.id === arraste.id);
      const inicioNaLinha = i >= 0 ? posicoes[i] : 0;

      if (arraste.lado === "esq") {
        const maximo = arraste.dur0 - DURACAO_MINIMA;
        const d = Math.max(-arraste.fonte0, Math.min(maximo, delta));
        aoMudarCena(arraste.id, {
          fonte_inicio: Number((arraste.fonte0 + d).toFixed(3)),
          duracao: Number((arraste.dur0 - d).toFixed(3)),
        });
      } else {
        const sobra = limiteFonte - arraste.fonte0;
        let nova = Math.max(DURACAO_MINIMA, Math.min(sobra, arraste.dur0 + delta));
        let colou = false;
        if (ima && !e.altKey) {
          const tolerancia = 10 / escala;
          if (Math.abs(inicioNaLinha + nova - tempoAtual) < tolerancia) {
            nova = Math.max(DURACAO_MINIMA, Math.min(sobra, tempoAtual - inicioNaLinha));
            colou = true;
          }
        }
        setGrudou(colou);
        aoMudarCena(arraste.id, { duracao: Number(nova.toFixed(3)) });
      }
    };

    const soltar = () => {
      if (arraste.tipo === "reordenar") {
        // A mudança acontece AQUI, uma vez só. É por isso que o desfazer volta
        // o bloco pra posição de origem em vez de andar de uma em uma.
        if (arraste.ativou && arraste.para !== arraste.de) {
          aoReordenar(arraste.id, arraste.para);
        }
        setArraste(null);
        setGrudou(false);
        return;
      }
      // texto e elemento têm histórico próprio: fechar o gesto na lista deles
      if (arraste.tipo === "faixa" || arraste.tipo === "faixa-borda") {
        aoMudarCamada(arraste.id, {}, true);
        setArraste(null);
        setGrudou(false);
        return;
      }
      // fecha o gesto: o desfazer volta o arraste inteiro, não pixel a pixel
      if (arraste.tipo !== "agulha") aoMudarCenas({}, true);
      setArraste(null);
      setGrudou(false);
    };

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
  }, [
    arraste,
    escala,
    aoMudarCena,
    aoMudarCenas,
    aoMudarCamada,
    aoReordenar,
    duracaoAudio,
    emQuadros,
    aoIrPara,
    tempoDoEvento,
    roteiro.fontes,
    roteiro.cenas,
    posicoes,
    tempoAtual,
    ima,
    modo,
  ]);

  // ------------------------------------------------------------ rolagem acompanha

  useEffect(() => {
    const caixa = rolagem.current;
    if (!caixa || arraste) return;
    const x = tempoAtual * escala + recuo();
    const esq = caixa.scrollLeft;
    const dir = esq + caixa.clientWidth;
    if (x < esq + 60 || x > dir - 60) {
      caixa.scrollTo({
        left: Math.max(0, x - caixa.clientWidth / 2),
        behavior: tocando ? "auto" : "smooth",
      });
    }
  }, [tempoAtual, escala, tocando, arraste]);

  // ------------------------------------------------------------ régua

  const marcas = useMemo(() => {
    const passo = PASSOS.find((p) => p * escala >= 64) ?? PASSOS[PASSOS.length - 1];
    const saida: { t: number; rotulo: string }[] = [];
    for (let t = 0; t <= duracaoTotal + passo; t += passo) {
      saida.push({ t, rotulo: curto(t) });
    }
    return saida;
  }, [escala, duracaoTotal]);

  const cena = roteiro.cenas.find((c) => c.id === selecionado);
  const podeDividir = roteiro.cenas.some(
    (c, i) => tempoAtual > posicoes[i] + 0.05 && tempoAtual < posicoes[i] + c.duracao - 0.05,
  );

  return (
    <div className="linha-do-tempo">
      <div className="tl-barra">
        <span className="tl-tempo forte">{relogio(tempoAtual)}</span>
        <span className="tl-tempo">/ {relogio(duracaoTotal)}</span>

        <span className="tl-divisor" />

        <button
          className="btn sutil"
          onClick={aoDividir}
          disabled={!podeDividir}
          title="Divide o bloco no ponto da agulha"
        >
          <SplitIcon size={15} className="lucide" />
          Dividir <kbd>S</kbd>
        </button>
        <button
          className="btn sutil"
          onClick={() => cena && aoApagar(cena.id)}
          disabled={!cena || roteiro.cenas.length <= 1}
          title="Apaga o bloco selecionado"
        >
          <Trash2 size={15} className="lucide" />
          Apagar <kbd>Del</kbd>
        </button>
        <button className="btn sutil" onClick={aoMarcar} title="Marca o instante atual">
          <Flag size={15} className="lucide" />
          Marcar <kbd>M</kbd>
        </button>

        <div style={{ flex: 1 }} />

        <span className="tl-tempo">
          {roteiro.cenas.length} {roteiro.cenas.length === 1 ? "bloco" : "blocos"}
        </span>

        <span className="tl-divisor" />

        <button
          className="btn sutil"
          onClick={alternarModo}
          title={
            modo === "corte"
              ? "MOVER CORTE — arrastar a divisa troca tempo entre os dois blocos. A duração total do vídeo não muda. Clique pra trocar."
              : "APARAR — arrastar a borda mexe só neste bloco e o resto desliza junto. A duração total muda. Clique pra trocar."
          }
        >
          {modo === "corte" ? (
            <MoveHorizontal size={15} className="lucide" />
          ) : (
            <ChevronsRightLeft size={15} className="lucide" />
          )}
          {modo === "corte" ? "mover corte" : "aparar"}
        </button>
        <button
          className={`btn sutil ${ima ? "ligado" : ""}`}
          onClick={alternarIma}
          title={
            ima
              ? "Ímã LIGADO — a borda gruda na agulha. Segure Alt pra soltar num arraste."
              : "Ímã DESLIGADO — a borda anda livre."
          }
          aria-pressed={ima}
        >
          <Magnet size={15} className="lucide" />
          {ima ? "ímã" : "livre"}
        </button>

        <span className="tl-divisor" />

        <button
          className="btn sutil icone"
          onClick={encaixarTudo}
          title="Encaixar o vídeo inteiro na tela"
          aria-label="Encaixar tudo"
        >
          <Maximize2 size={15} className="lucide" />
        </button>
        <button
          className="btn sutil icone"
          onClick={() => setEscala((s) => Math.max(0.4, s / 1.5))}
          title="Afastar (Ctrl + roda do mouse)"
          aria-label="Afastar"
        >
          <Minus size={15} className="lucide" />
        </button>
        <button
          className="btn sutil icone"
          onClick={() => setEscala((s) => Math.min(200, s * 1.5))}
          title="Aproximar (Ctrl + roda do mouse)"
          aria-label="Aproximar"
        >
          <Plus size={15} className="lucide" />
        </button>
      </div>

      <div className="tl-rolagem" ref={rolagem}>
        <div className="tl-conteudo" ref={conteudo} style={{ width: larguraTotal }}>
          {/* régua */}
          <div
            className="tl-regua"
            onMouseDown={(e) => {
              e.preventDefault();
              aoIrPara(tempoDoEvento(e.clientX));
              setArraste({ tipo: "agulha" });
            }}
          >
            {marcas.map((m) => (
              <div key={m.t} className="tl-marca" style={{ left: m.t * escala }}>
                <span>{m.rotulo}</span>
              </div>
            ))}
          </div>

          {/* marcadores: bandeirinhas clicáveis */}
          {marcadores.map((m, i) => (
            <button
              // a chave inclui o índice: dois marcadores podem cair no mesmo
              // instante da timeline depois de uma edição
              key={`${m.tFonte}-${i}`}
              className="marcador"
              style={{ left: m.tFinal * escala }}
              title={`${relogio(m.tFinal)}${m.texto ? ` — ${m.texto}` : ""}\nclique: ir até aqui · clique direito: apagar`}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                aoIrPara(m.tFinal);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                aoApagarMarcador(m.tFonte);
              }}
            />
          ))}

          {/* blocos */}
          <div className="tl-pista">
            {/* onde o bloco arrastado vai cair */}
            {arraste?.tipo === "reordenar" && arraste.ativou && arraste.para !== arraste.de ? (
              <div
                className="marca-solta"
                style={{
                  left:
                    (arraste.para > arraste.de
                      ? posicoes[arraste.para] + roteiro.cenas[arraste.para].duracao
                      : posicoes[arraste.para]) * escala,
                }}
              />
            ) : null}
            {roteiro.cenas.map((c, i) => {
              const largura = c.duracao * escala;
              return (
                <div
                  key={c.id}
                  className={`bloco ${selecionado === c.id ? "ativa" : ""} ${
                    arraste?.tipo === "reordenar" && arraste.ativou && arraste.id === c.id
                      ? "viajando"
                      : ""
                  }`}
                  style={{ left: posicoes[i] * escala, width: Math.max(4, largura) }}
                  onMouseDown={(e) => {
                    // Só seleciona. A agulha NÃO se mexe: quem quer navegar
                    // usa a régua ou arrasta a agulha. Selecionar um bloco pra
                    // mudar layout não deveria custar o ponto onde você estava.
                    e.stopPropagation();
                    aoSelecionar(c.id);
                    // E já arma o arraste de reordenar. Ele só ACORDA depois de
                    // alguns pixels de movimento, então um clique seco continua
                    // sendo um clique seco e nada muda de lugar sem querer.
                    setArraste({
                      tipo: "reordenar",
                      id: c.id,
                      x0: e.clientX,
                      de: i,
                      para: i,
                      ativou: false,
                    });
                  }}
                  onDoubleClick={(e) => {
                    // duplo clique é o gesto explícito de "me leve até aqui"
                    e.stopPropagation();
                    aoIrPara(posicoes[i] + 0.03);
                  }}
                  title={c.nota || c.id}
                >
                  <div className="bloco-rotulo">
                    <b>
                      {i + 1}. {c.layout}
                    </b>
                    {largura > 70 && (
                      <>
                        <span>{relogio(c.duracao)}</span>
                        {largura > 150 && <span>{c.nota}</span>}
                      </>
                    )}
                  </div>
                  <div
                    className={`puxador esq ${
                      (arraste?.tipo === "corte" && arraste.idB === c.id) ||
                      (arraste?.tipo === "apara" &&
                        arraste.id === c.id &&
                        arraste.lado === "esq")
                        ? "arrastando"
                        : ""
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const ant = modo === "corte" ? roteiro.cenas[i - 1] : null;
                      if (ant) {
                        // divisa com o bloco anterior: move o ponto de corte
                        setArraste({
                          tipo: "corte",
                          idA: ant.id,
                          idB: c.id,
                          x0: e.clientX,
                          fonteA0: ant.fonte_inicio,
                          durA0: ant.duracao,
                          fonteB0: c.fonte_inicio,
                          durB0: c.duracao,
                          inicioA: posicoes[i - 1],
                        });
                      } else {
                        // primeiro bloco: não tem divisa, então apara mesmo
                        setArraste({
                          tipo: "apara",
                          id: c.id,
                          lado: "esq",
                          x0: e.clientX,
                          fonte0: c.fonte_inicio,
                          dur0: c.duracao,
                        });
                      }
                    }}
                    title={
                      modo === "corte" && i > 0
                        ? "move o corte entre os dois blocos (a duração total não muda)"
                        : "apara o começo deste bloco (o resto desliza junto)"
                    }
                  />
                  <div
                    className={`puxador dir ${
                      (arraste?.tipo === "corte" && arraste.idA === c.id) ||
                      (arraste?.tipo === "apara" &&
                        arraste.id === c.id &&
                        arraste.lado === "dir")
                        ? "arrastando"
                        : ""
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const prox = modo === "corte" ? roteiro.cenas[i + 1] : null;
                      if (prox) {
                        // divisa com o bloco seguinte: mesma coisa, do outro lado
                        setArraste({
                          tipo: "corte",
                          idA: c.id,
                          idB: prox.id,
                          x0: e.clientX,
                          fonteA0: c.fonte_inicio,
                          durA0: c.duracao,
                          fonteB0: prox.fonte_inicio,
                          durB0: prox.duracao,
                          inicioA: posicoes[i],
                        });
                      } else {
                        // último bloco: ponta solta do vídeo
                        setArraste({
                          tipo: "apara",
                          id: c.id,
                          lado: "dir",
                          x0: e.clientX,
                          fonte0: c.fonte_inicio,
                          dur0: c.duracao,
                        });
                      }
                    }}
                    title={
                      modo === "corte" && i < roteiro.cenas.length - 1
                        ? "move o corte entre os dois blocos (a duração total não muda)"
                        : "apara o fim deste bloco (o resto desliza junto)"
                    }
                  />
                </div>
              );
            })}
          </div>

          {/*
            TRILHA DE ÁUDIO — pista própria, abaixo do vídeo.

            Arrastar o meio desliza o clipe no tempo; arrastar a ponta apara.
            Qualquer um dos dois SOLTA o vínculo com a cena, porque a partir do
            momento em que você move o som à mão, seguir o corte automaticamente
            desfaria o seu ajuste.
          */}
          <div className="tl-pista-audio">
            {/* a onda pertence AQUI: ela desenha o som, e o som agora tem
                pista própria. Ficava sobre o vídeo por herança do modelo
                antigo, quando áudio e imagem eram o mesmo bloco. */}
            <Onda
              arquivo={roteiro.audio?.picos ?? null}
              pasta={roteiro.projeto}
              clipes={trilhaAudio}
              offsetAudio={roteiro.audio?.offset ?? 0}
              escala={escala}
              rolagem={rolagem}
              recuo={recuo}
              altura={46}
            />
            {trilhaAudio.map((c) => {
              const largura = Math.max(4, c.duracao * escala);
              const ativo = clipeSelecionado === c.id;
              const arrastando =
                (arraste?.tipo === "clipe" || arraste?.tipo === "clipe-borda") &&
                arraste.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`clipe ${ativo ? "ativa" : ""} ${arrastando ? "movendo" : ""} ${
                    c.vinculado_a ? "preso" : ""
                  }`}
                  style={{ left: c.inicio * escala, width: largura }}
                  title={
                    (c.vinculado_a
                      ? "preso à cena — mover solta o vínculo"
                      : "solto do vídeo") + `\n${relogio(c.inicio)} · ${relogio(c.duracao)}`
                  }
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    aoSelecionarClipe(c.id);
                    setArraste({
                      tipo: "clipe",
                      id: c.id,
                      x0: e.clientX,
                      inicio0: c.inicio,
                      ativou: false,
                    });
                  }}
                >
                  <div className="clipe-rotulo">
                    {c.vinculado_a ? <Link2 size={11} className="lucide" /> : null}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.nota || "áudio"}
                    </span>
                    {(c.volume ?? 1) === 0 ? <VolumeX size={11} className="lucide" /> : null}
                  </div>
                  <div
                    className="puxador esq"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      aoSelecionarClipe(c.id);
                      setArraste({
                        tipo: "clipe-borda",
                        id: c.id,
                        lado: "esq",
                        x0: e.clientX,
                        inicio0: c.inicio,
                        dur0: c.duracao,
                        fonte0: c.fonte_inicio,
                      });
                    }}
                    title="apara o começo do áudio"
                  />
                  <div
                    className="puxador dir"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      aoSelecionarClipe(c.id);
                      setArraste({
                        tipo: "clipe-borda",
                        id: c.id,
                        lado: "dir",
                        x0: e.clientX,
                        inicio0: c.inicio,
                        dur0: c.duracao,
                        fonte0: c.fonte_inicio,
                      });
                    }}
                    title="apara o fim do áudio"
                  />
                </div>
              );
            })}
          </div>

          {/*
            PISTA DE TEXTO e PISTA DE ELEMENTO

            Antes, lettering e logo só existiam nos painéis laterais: pra saber
            QUANDO um texto entrava era preciso ler dois campos numéricos e
            imaginar. Aqui eles viram barras na mesma régua do vídeo — dá pra
            ver de relance que o segundo lettering entra em cima de um corte, ou
            que dois se sobrepõem.

            As duas pistas são a mesma coisa desenhada duas vezes porque
            `Overlay` e `Imagem` compartilham `{id, inicio, duracao}` em relógio
            final. O que muda é só o rótulo e a cor.
          */}
          {linhasCamadas.map((linha, n) => (
            <div className="tl-pista-faixa" key={`pilha-${n}`}>
              {linha.map((item) => {
                const ativo = selecaoCamadas.includes(item.id);
                const movendo =
                  (arraste?.tipo === "faixa" || arraste?.tipo === "faixa-borda") &&
                  arraste.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`faixa ${item.tipo} ${ativo ? "ativa" : ""} ${
                      movendo ? "movendo" : ""
                    } ${item.oculta ? "oculta" : ""}`}
                    style={{
                      left: item.inicio * escala,
                      width: Math.max(4, item.duracao * escala),
                    }}
                    title={`${nomeDaCamada(item)}\n${relogio(item.inicio)} · ${relogio(
                      item.duracao,
                    )}`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      selecionarNaPilha(e, item.id);
                      setArraste({
                        tipo: "faixa",
                        id: item.id,
                        x0: e.clientX,
                        inicio0: item.inicio,
                        ativou: false,
                      });
                    }}
                  >
                    <div className="faixa-rotulo">
                      <div className="faixa-linha">
                        {ICONE_CAMADA[item.tipo]}
                        <span>{nomeDaCamada(item)}</span>
                      </div>
                    </div>
                    {(["esq", "dir"] as const).map((lado) => (
                      <div
                        key={lado}
                        className={`puxador ${lado}`}
                        title={lado === "esq" ? "quando entra" : "quando sai"}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          selecionarNaPilha(e, item.id);
                          setArraste({
                            tipo: "faixa-borda",
                            id: item.id,
                            lado,
                            x0: e.clientX,
                            inicio0: item.inicio,
                            dur0: item.duracao,
                          });
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* agulha */}
          <div
            className={`agulha ${arraste?.tipo === "agulha" ? "arrastando" : ""} ${
              grudou ? "grudado" : ""
            }`}
            style={{ left: tempoAtual * escala }}
          >
            <div
              className="agulha-cabeca"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setArraste({ tipo: "agulha" });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * A timeline re-renderiza a cada quadro, porque a agulha precisa andar.
 * O memo impede que essa re-renderização se espalhe pelo resto do editor.
 */
export const Timeline = React.memo(TimelineInterna);
Timeline.displayName = "Timeline";
