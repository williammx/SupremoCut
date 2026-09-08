/**
 * O campo de texto que também pinta pedaço.
 *
 * COMO SE USA
 *
 * Seleciona a palavra dentro do campo, escolhe a cor. Só o selecionado muda.
 * "Tirar" devolve o pedaço à cor da camada.
 *
 * POR QUE A SELEÇÃO FICA GUARDADA NUM ESTADO
 *
 * Clicar num botão tira o foco do campo. Ler `selectionStart` na hora do clique
 * funciona no Chrome e não é garantido em todo lugar — e o modo como ele falha
 * é o pior possível: a faixa volta `0,0` e a cor vai parar no começo da frase,
 * silenciosamente. Guardar a seleção assim que ela acontece tira o resultado da
 * mão do navegador.
 */

import React from "react";
import { aplicar, type PedacoPintado } from "../../src/trechos";
import { pintar } from "../../src/trechos";
import type { TrechoTexto } from "../../src/camadas";

type Props = {
  texto: string;
  cor: string;
  trechos: TrechoTexto[] | undefined;
  /** Cor de destaque do projeto — o atalho de um clique. */
  destaque: string;
  aoMudarTexto: (v: string) => void;
  aoMudarTrechos: (t: TrechoTexto[]) => void;
};

export const TextoPintavel: React.FC<Props> = ({
  texto,
  cor,
  trechos,
  destaque,
  aoMudarTexto,
  aoMudarTrechos,
}) => {
  const [faixa, setFaixa] = React.useState<[number, number] | null>(null);
  const campo = React.useRef<HTMLTextAreaElement>(null);

  const anotarSelecao = () => {
    const el = campo.current;
    if (!el) return;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    setFaixa(b > a ? [a, b] : null);
  };

  /*
    A seleção morre quando o texto muda de tamanho: os índices anotados
    passariam a apontar pra outro pedaço. Zerar é mais honesto do que adivinhar.
  */
  React.useEffect(() => setFaixa(null), [texto]);

  const selecionado = faixa ? texto.slice(faixa[0], faixa[1]) : "";

  const pintarFaixa = (nova: string | null) => {
    if (!faixa) return;
    aoMudarTrechos(aplicar(trechos ?? [], faixa[0], faixa[1], nova, texto.length));
    // devolve o foco e a seleção, pra dar pra pintar de novo sem re-selecionar
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(faixa[0], faixa[1]);
    });
  };

  const pedacos: PedacoPintado[] = pintar(texto, cor, trechos);
  const temPintura = pedacos.length > 1;

  return (
    <>
      <div className="linha">
        <label>Texto</label>
        {/*
          Textarea, não input.

          O `<input type="text">` não aceita Enter — e o vídeo agora respeita a
          quebra digitada. Sem um campo de várias linhas, a quebra existiria no
          motor e não teria como ser escrita aqui. `selectionStart/End` funciona
          igual nos dois, então pintar trecho continua valendo.
        */}
        <textarea
          ref={campo}
          rows={2}
          value={texto}
          onChange={(e) => aoMudarTexto(e.target.value)}
          onSelect={anotarSelecao}
          onKeyUp={anotarSelecao}
          onMouseUp={anotarSelecao}
        />
      </div>

      <div className="linha">
        <label>Pintar</label>
        <div className="pintar-trecho">
          <input
            type="color"
            value={faixa ? corDaFaixa(pedacos, texto, faixa, cor) : cor}
            disabled={!faixa}
            onChange={(e) => pintarFaixa(e.target.value)}
            title={faixa ? `Cor de "${selecionado}"` : "Selecione um pedaço do texto"}
          />
          <button
            className="chip"
            disabled={!faixa}
            style={{ background: destaque }}
            onClick={() => pintarFaixa(destaque)}
            title="Cor de destaque do projeto"
          />
          <button className="chip-texto" disabled={!faixa} onClick={() => pintarFaixa(null)}>
            tirar
          </button>
        </div>
      </div>

      <p className="dica" style={{ margin: "2px 0 0" }}>
        {faixa
          ? `Vai pintar “${selecionado}”.`
          : temPintura
            ? "Selecione um pedaço do texto no campo acima pra trocar a cor dele."
            : "Selecione um pedaço do texto no campo acima e escolha a cor só dele."}
      </p>
    </>
  );
};

/** A cor que a faixa selecionada já tem — pra o seletor abrir no valor certo. */
const corDaFaixa = (
  pedacos: PedacoPintado[],
  texto: string,
  faixa: [number, number],
  corBase: string,
): string => {
  let i = 0;
  for (const p of pedacos) {
    const fim = i + p.texto.length;
    if (faixa[0] >= i && faixa[0] < fim) return p.cor;
    i = fim;
  }
  return corBase;
};
