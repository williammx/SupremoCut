/**
 * SupremoCut — controles do painel
 *
 * As peças pequenas que aparecem em toda tela. Vale a pena tê-las aqui, e não
 * soltas: um deslizante que se comporta diferente do outro é a primeira coisa
 * que faz uma interface parecer remendada.
 */

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export const Deslizante: React.FC<{
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  sufixo?: string;
  casas?: number;
  aoMudar: (v: number) => void;
}> = ({ rotulo, valor, min, max, passo = 0.01, sufixo = "", casas = 2, aoMudar }) => (
  <div className="linha">
    <label>{rotulo}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={passo}
      value={valor}
      onChange={(e) => aoMudar(Number(e.target.value))}
    />
    <span className="valor">
      {valor.toFixed(casas)}
      {sufixo}
    </span>
  </div>
);

export const Numero: React.FC<{
  rotulo: string;
  valor: number;
  passo?: number;
  min?: number;
  aoMudar: (v: number) => void;
}> = ({ rotulo, valor, passo = 0.1, min, aoMudar }) => (
  <div className="linha">
    <label>{rotulo}</label>
    <input
      type="number"
      value={valor}
      step={passo}
      min={min}
      onChange={(e) => aoMudar(Number(e.target.value))}
    />
  </div>
);

export const Texto: React.FC<{
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
}> = ({ rotulo, valor, aoMudar }) => (
  <div className="linha">
    <label>{rotulo}</label>
    <input type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />
  </div>
);

export const Cor: React.FC<{
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
}> = ({ rotulo, valor, aoMudar }) => (
  <div className="linha">
    <label>{rotulo}</label>
    <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} />
    <input type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />
  </div>
);

/**
 * Chavinha em vez das palavras "ligado"/"desligado".
 *
 * O texto obrigava a ler pra saber o estado, e ocupava metade da linha. A
 * chave se lê de relance — e é o gesto que todo mundo já conhece do celular.
 */
export const Interruptor: React.FC<{
  rotulo: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}> = ({ rotulo, valor, aoMudar }) => (
  <div className="linha">
    <label>{rotulo}</label>
    <button
      className={`chave ${valor ? "ativa" : ""}`}
      onClick={() => aoMudar(!valor)}
      role="switch"
      aria-checked={valor}
      aria-label={rotulo}
      title={valor ? "ligado" : "desligado"}
    />
  </div>
);

export function Opcoes<T extends string>({
  valores,
  valor,
  aoMudar,
  colunas = 2,
}: {
  valores: [T, string][];
  valor: T;
  aoMudar: (v: T) => void;
  colunas?: 2 | 3;
}) {
  return (
    <div className={`opcoes ${colunas === 3 ? "tres" : ""}`}>
      {valores.map(([v, rotulo]) => (
        <button
          key={v}
          className={`opcao ${valor === v ? "ativa" : ""}`}
          onClick={() => aoMudar(v)}
          title={rotulo}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/**
 * Uma seção do painel, que abre e fecha.
 *
 * Recolher não é enfeite aqui: o painel de legenda passa de mil pixels com a
 * lista de palavras aberta, e o de bloco tem oito grupos. Poder fechar o que
 * não está em uso é a diferença entre rolar procurando e simplesmente achar.
 *
 * `aberto` define só o estado INICIAL — o que está em uso agora fica aberto, o
 * resto começa fechado. Depois disso quem manda é o clique.
 */
export const Grupo: React.FC<{
  titulo: string;
  children: React.ReactNode;
  /** Ícone à esquerda do título. */
  icone?: React.ReactNode;
  /** Começa aberto? Padrão sim. */
  aberto?: boolean;
  /** Grupo que não faz sentido fechar (o único do painel, por exemplo). */
  fixo?: boolean;
}> = ({ titulo, children, icone, aberto = true, fixo = false }) => {
  const [abertoAgora, setAberto] = useState(aberto);
  const mostra = fixo || abertoAgora;

  return (
    <div className={`grupo ${mostra ? "" : "fechado"}`}>
      {fixo ? (
        <div className="grupo-topo" style={{ cursor: "default" }}>
          {icone}
          {titulo}
        </div>
      ) : (
        <button
          className="grupo-topo"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={mostra}
        >
          {icone}
          {titulo}
          <ChevronDown size={14} className="lucide chevron" />
        </button>
      )}
      {mostra && <div className="grupo-corpo">{children}</div>}
    </div>
  );
};

/** Texto de apoio abaixo de um controle. */
export const Dica: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="dica">{children}</p>
);

/** Um aviso que o usuário precisa ler antes de agir. */
export const Alerta: React.FC<{
  children: React.ReactNode;
  icone?: React.ReactNode;
}> = ({ children, icone }) => (
  <div className="alerta">
    {icone}
    <div>{children}</div>
  </div>
);

/** Rótulo de subdivisão dentro de um grupo. */
export const Subtitulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rotulo-mini">{children}</div>
);

/** Estado vazio com ícone. */
export const Vazio: React.FC<{
  icone?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icone, children }) => (
  <div className="vazio">
    {icone}
    <div>{children}</div>
  </div>
);
