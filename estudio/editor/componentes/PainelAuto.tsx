/**
 * SupremoCut — Automático
 *
 * O painel que faz a máquina trabalhar no lugar de você.
 *
 * Duas ferramentas que parecem diferentes e são a mesma por dentro — as duas
 * respondem "quais trechos do bruto ficam?" e as duas terminam em
 * `manterApenas()`:
 *
 *   - Tirar os silêncios: decide pela forma de onda.
 *   - Editar pelo texto: decide pelo que você apagou da transcrição.
 *
 * REGRA DE RELÓGIO (é onde este projeto já se machucou antes): a onda e as
 * palavras vivem no relógio do arquivo de ÁUDIO. As cenas vivem no relógio do
 * VÍDEO. Os dois diferem por `roteiro.audio.offset`. Toda conversão está
 * marcada com um comentário — nenhuma acontece por acaso.
 */

import React, { useMemo, useState } from "react";
import type { Palavra, Roteiro } from "../../src/tipos";
import {
  complemento,
  detectarFala,
  faixasDasCenas,
  manterApenas,
  normalizar,
  SILENCIO_PADRAO,
  type Faixa,
  type OpcoesSilencio,
} from "../../src/cortes";
import { aplicarPreset } from "../../src/animacao";
import {
  AlertTriangle,
  Eraser,
  FileText,
  Scissors,
  Sparkles,
  Volume1,
  Zap,
  ZoomIn,
} from "lucide-react";
import type { Picos } from "../picos";
import { Alerta, Deslizante, Dica, Grupo } from "./controles";

/** Palavras que não dizem nada e todo mundo fala sem perceber. */
const VICIOS = [
  "é", "eh", "ah", "ahn", "hum", "hmm", "tipo", "né", "ne", "então", "entao",
  "assim", "sabe", "cara", "tá", "ta", "ok", "uh", "um", "hã", "ha",
];

const limpar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\wà-ÿ%$]/gi, "");

const VICIOS_LIMPOS = new Set(VICIOS.map(limpar));

type Props = {
  roteiro: Roteiro;
  pasta: string;
  /** A forma de onda, já carregada pelo Editor — a mesma que a timeline desenha. */
  picos: Picos | null;
  aoMudarRoteiro: (r: Roteiro) => void;
};

const PainelAutoInterno: React.FC<Props> = ({ roteiro, picos: dados, aoMudarRoteiro }) => {
  const [op, setOp] = useState<OpcoesSilencio>(SILENCIO_PADRAO);
  const [removidas, setRemovidas] = useState<Set<number>>(new Set());

  const fps = roteiro.fps;
  const offset = roteiro.audio?.offset ?? 0;
  const palavras: Palavra[] = roteiro.legendas?.palavras ?? [];

  // Clipes de áudio soltos não seguem o corte das cenas. Num projeto de
  // dublagem a narração é justamente um clipe solto — cortar o vídeo por baixo
  // dela a dessincroniza inteira. Melhor avisar do que consertar depois.
  const soltos = (roteiro.trilha_audio ?? []).filter((c) => !c.vinculado_a).length;

  // ---- silêncio -----------------------------------------------------------

  /** Onde tem fala, no relógio do ÁUDIO. */
  const fala = useMemo(
    () => (dados ? detectarFala(dados, op) : []),
    [dados, op],
  );

  /** As mesmas faixas, no relógio do VÍDEO — que é onde as cenas vivem. */
  const falaNoVideo = useMemo<Faixa[]>(
    () => fala.map((f) => ({ a: f.a - offset, b: f.b - offset })),
    [fala, offset],
  );

  const previaSilencio = useMemo(() => {
    if (falaNoVideo.length === 0) return null;
    const r = manterApenas(roteiro.cenas, falaNoVideo, fps);
    return { removido: r.removido, blocos: r.cenas.length };
  }, [falaNoVideo, roteiro.cenas, fps]);

  const totalAtual = roteiro.cenas.reduce((s, c) => s + c.duracao, 0);

  const cortarSilencio = () => {
    if (falaNoVideo.length === 0) return;
    const r = manterApenas(roteiro.cenas, falaNoVideo, fps);
    if (r.cenas.length === 0) {
      alert(
        "Com essa sensibilidade não sobrou nada do vídeo. Arraste a sensibilidade para a esquerda e tente de novo.",
      );
      return;
    }
    aoMudarRoteiro({ ...roteiro, cenas: r.cenas });
  };

  // ---- edição por texto ---------------------------------------------------

  const alternar = (i: number) => {
    setRemovidas((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const marcarVicios = () => {
    const n = new Set<number>();
    palavras.forEach((p, i) => {
      if (VICIOS_LIMPOS.has(limpar(p.texto))) n.add(i);
    });
    setRemovidas(n);
  };

  const aplicarTexto = () => {
    if (removidas.size === 0) return;

    // As palavras estão no relógio do ÁUDIO; as cenas, no do VÍDEO.
    // Subtrair o offset traz as duas pra mesma régua antes de qualquer conta.
    const tirar: Faixa[] = [...removidas]
      .map((i) => palavras[i])
      .filter(Boolean)
      .map((p) => ({ a: p.t - offset, b: p.fim - offset }));

    // Folga de um quadro pra não deixar meio quadro da palavra apagada.
    const folga = 1 / fps;
    const alargado = tirar.map((f) => ({ a: f.a - folga, b: f.b + folga }));

    const manter = complemento(alargado, faixasDasCenas(roteiro.cenas));
    const r = manterApenas(roteiro.cenas, manter, fps);
    if (r.cenas.length === 0) {
      alert("Isso apagaria o vídeo inteiro. Desmarque algumas palavras.");
      return;
    }

    // O texto também sai: deixar a palavra apagada na legenda de um trecho que
    // não existe mais é mostrar na tela o que ninguém vai ouvir.
    const sobrando = palavras.filter((_, i) => !removidas.has(i));

    aoMudarRoteiro({
      ...roteiro,
      cenas: r.cenas,
      legendas: { ...roteiro.legendas, palavras: sobrando },
    });
    setRemovidas(new Set());
  };

  // ---- zoom automático na ênfase -----------------------------------------

  /**
   * Dá um "soco" de zoom nos blocos que começam junto de uma palavra
   * enfatizada. É retenção barata: o dado já estava no disco desde a
   * transcrição, só ninguém tinha usado.
   */
  const zoomNaEnfase = () => {
    const fortes = palavras.filter((p) => p.enfase);
    if (fortes.length === 0) {
      alert(
        "Nenhuma palavra está marcada como destaque. Marque no painel de legenda (ou use a lista de palavras que saltam) e volte aqui.",
      );
      return;
    }

    const janela = 0.45; // quão perto do começo do bloco a palavra precisa cair
    let mexidos = 0;

    const cenas = roteiro.cenas.map((c) => {
      // relógio do VÍDEO → relógio do ÁUDIO, pra comparar com as palavras
      const inicioNoAudio = c.fonte_inicio + offset;
      const perto = fortes.some(
        (p) => p.t >= inicioNoAudio - janela && p.t <= inicioNoAudio + janela,
      );
      // Bloco que já tem movimento fica como está — de preset OU feito à mão.
      // Checar só o preset deixava passar por cima de chaves ajustadas na mão,
      // que é justamente o trabalho mais caro de refazer.
      if (!perto || c.preset_animacao || c.animacoes?.length) return c;
      mexidos++;
      return {
        ...c,
        preset_animacao: "soco",
        animacoes: aplicarPreset("soco", c.duracao),
      };
    });

    if (mexidos === 0) {
      alert(
        "Nenhum bloco começa perto de uma palavra em destaque — ou eles já têm movimento. Nada foi mudado.",
      );
      return;
    }
    aoMudarRoteiro({ ...roteiro, cenas });
  };

  // ---- tela ---------------------------------------------------------------

  const marcadas = removidas.size;

  return (
    <>
      <Grupo titulo="Tirar os silêncios" icone={<Volume1 size={13} className="lucide" />}>
        {!dados ? (
          <Dica>
            Este projeto ainda não tem a forma de onda calculada. Processe o vídeo de novo
            pelo botão <strong>novo vídeo</strong> da barra de cima pra gerar.
          </Dica>
        ) : (
          <>
            <Dica>
              Encontra as pausas e tira. Arraste a sensibilidade e veja embaixo quanto
              sairia — nada muda até você clicar em aplicar.
            </Dica>

            <Deslizante
              rotulo="Sensibilidade"
              valor={op.limiar_db}
              min={-60}
              max={-12}
              passo={1}
              casas={0}
              sufixo=" dB"
              aoMudar={(v) => setOp({ ...op, limiar_db: v })}
            />
            <Deslizante
              rotulo="Respiro"
              valor={op.margem}
              min={0}
              max={0.5}
              passo={0.01}
              sufixo="s"
              aoMudar={(v) => setOp({ ...op, margem: v })}
            />
            <Deslizante
              rotulo="Pausa mínima"
              valor={op.silencio_minimo}
              min={0.1}
              max={2}
              passo={0.05}
              sufixo="s"
              aoMudar={(v) => setOp({ ...op, silencio_minimo: v })}
            />

            <Dica>
              Sensibilidade pra <strong>esquerda</strong> corta menos (só o silêncio de
              verdade), pra <strong>direita</strong> corta mais. Respiro é o pedacinho de ar
              mantido nas pontas — sem ele o corte engole o começo da palavra. Pausa mínima
              ignora as respiradas curtas dentro da frase.
            </Dica>

            {previaSilencio ? (
              <div
                className="cartao"
                style={{ borderColor: previaSilencio.removido > 0 ? "var(--destaque)" : undefined }}
              >
                <div className="cartao-topo">
                  <strong>
                    {previaSilencio.removido > 0
                      ? `Sairiam ${previaSilencio.removido.toFixed(1)}s`
                      : "Nada a cortar"}
                  </strong>
                  <span style={{ color: "var(--texto-fraco)", fontSize: 11 }}>
                    {(totalAtual - previaSilencio.removido).toFixed(1)}s no fim
                  </span>
                </div>
                <p className="dica" style={{ margin: 0 }}>
                  {roteiro.cenas.length} {roteiro.cenas.length === 1 ? "bloco" : "blocos"} viram{" "}
                  {previaSilencio.blocos}.
                </p>
              </div>
            ) : null}

            {soltos > 0 ? (
              <Alerta icone={<AlertTriangle size={14} className="lucide" />}>
                Este projeto tem {soltos} {soltos === 1 ? "áudio solto" : "áudios soltos"} na
                trilha (narração dublada, por exemplo). Eles <strong>não</strong> acompanham o
                corte — o vídeo encurta por baixo deles e a sincronia se perde.{" "}
                <strong>Em projeto dublado, não use isto.</strong>
              </Alerta>
            ) : null}

            <button
              className="btn cheio"
              style={{ marginTop: 6 }}
              onClick={cortarSilencio}
              disabled={!previaSilencio || previaSilencio.removido <= 0}
            >
              <Scissors size={14} className="lucide" />
              Aplicar o corte
            </button>
          </>
        )}
      </Grupo>

      <Grupo titulo="Editar pelo texto" icone={<FileText size={13} className="lucide" />}>
        {palavras.length === 0 ? (
          <Dica>
            Este projeto não tem transcrição. Processe o vídeo com legenda pra poder editar
            por aqui.
          </Dica>
        ) : (
          <>
            <Dica>
              Clique numa palavra pra marcá-la. Ao aplicar, o pedaço de vídeo em que ela é
              dita sai junto — é edição sem mexer na linha do tempo.
            </Dica>

            <button className="opcao cheio" onClick={marcarVicios}>
              <Eraser size={13} className="lucide" />
              Marcar os vícios de linguagem
            </button>
            <p className="dica" style={{ margin: "7px 0 10px" }}>
              "é", "tipo", "né", "então", "sabe"… Confira antes de aplicar: às vezes o "é" é
              o verbo.
            </p>

            <div className="nuvem-palavras">
              {palavras.map((p, i) => (
                <button
                  key={i}
                  className={`ficha ${removidas.has(i) ? "fora" : ""}`}
                  onClick={() => alternar(i)}
                  title={`${p.t.toFixed(2)}s`}
                >
                  {p.texto}
                </button>
              ))}
            </div>

            <button
              className="btn cheio"
              style={{ marginTop: 10 }}
              onClick={aplicarTexto}
              disabled={marcadas === 0}
            >
              {marcadas > 0 ? <Scissors size={14} className="lucide" /> : null}
              {marcadas === 0
                ? "Nenhuma palavra marcada"
                : `Apagar ${marcadas} ${marcadas === 1 ? "palavra" : "palavras"} do vídeo`}
            </button>
            {marcadas > 0 ? (
              <button
                className="btn sutil cheio"
                style={{ marginTop: 6 }}
                onClick={() => setRemovidas(new Set())}
              >
                desmarcar todas
              </button>
            ) : null}
          </>
        )}
      </Grupo>

      <Grupo titulo="Zoom nas palavras fortes" icone={<ZoomIn size={13} className="lucide" />}>
        <Dica>
          Dá um tranco de aproximação nos blocos que começam numa palavra em destaque. É o
          truque de retenção mais usado em anúncio vertical, e o dado pra isso já estava
          aqui desde a transcrição.
        </Dica>
        <button className="opcao cheio" onClick={zoomNaEnfase}>
          <Zap size={13} className="lucide" />
          Aplicar nos blocos em destaque
        </button>
      </Grupo>
    </>
  );
};

export const PainelAuto = React.memo(PainelAutoInterno);
PainelAuto.displayName = "PainelAuto";

/** Reexportado só pra Timeline poder desenhar a mesma linha de corte. */
export { normalizar };
