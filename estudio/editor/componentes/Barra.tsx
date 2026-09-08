import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Captions,
  Camera,
  Check,
  Clapperboard,
  FilePlus2,
  Frame,
  Keyboard,
  Loader2,
  Redo2,
  Save,
  Scissors,
  Undo2,
} from "lucide-react";
import { api } from "../api";

type Props = {
  projetos: string[];
  projeto: string;
  aoTrocarProjeto: (p: string) => void;
  sujo: boolean;
  aoSalvar: () => void;
  aoDesfazer: () => void;
  aoRefazer: () => void;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  aoVerAtalhos: () => void;
  aoProcessar: () => void;
  aoLegenda: () => void;
  aoQuadro: () => void;
  zonaSegura: boolean;
  aoZonaSegura: () => void;
  /**
   * Formato que o seletor abre marcado.
   *
   * Vem da proporção do próprio roteiro. Antes era sempre "Principal", o que
   * num projeto 1080x1920 é um pedido de erro: o botão dizia 16:9 enquanto a
   * tela mostrava um vídeo em pé, e quem clicasse Renderizar sem olhar levava
   * o corte deitado.
   */
  formatoPadrao?: string;
};

const FORMATOS = ["Principal", "Vertical", "Quadrado"] as const;

const ROTULO: Record<string, string> = {
  Principal: "16:9",
  Vertical: "9:16",
  Quadrado: "1:1",
};

export const Barra: React.FC<Props> = ({
  projetos,
  projeto,
  aoTrocarProjeto,
  sujo,
  aoSalvar,
  aoDesfazer,
  aoRefazer,
  podeDesfazer,
  podeRefazer,
  aoVerAtalhos,
  aoProcessar,
  aoLegenda,
  aoQuadro,
  zonaSegura,
  aoZonaSegura,
  formatoPadrao = "Principal",
}) => {
  const [formato, setFormato] = useState<string>(formatoPadrao);
  // trocou de projeto: reabre no formato do projeto novo, não no do anterior
  useEffect(() => setFormato(formatoPadrao), [formatoPadrao, projeto]);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.statusRender>> | null>(
    null,
  );

  const rodando = status?.estado === "rodando";

  // enquanto renderiza, pergunta o progresso de tempos em tempos
  useEffect(() => {
    const buscar = () => api.statusRender().then(setStatus).catch(() => {});
    buscar();
    const t = setInterval(buscar, rodando ? 1200 : 5000);
    return () => clearInterval(t);
  }, [rodando]);

  const renderizar = async (formatos: string[]) => {
    if (sujo) await aoSalvar();
    try {
      await api.renderizar(projeto, formatos);
      setStatus({ estado: "rodando", feito: 0, total: 0, mensagem: "iniciando" });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const pct =
    status?.total && status.total > 0 ? Math.round(((status.feito ?? 0) / status.total) * 100) : 0;

  return (
    <div className="barra">
      <div className="marca">
        <Scissors size={16} className="lucide" />
        {/* Uma caixa só para as duas palavras: o `gap` do flex vale entre
            IRMÃOS, e "Supremo" solto ao lado de <span>Cut</span> virava
            "Supremo Cut" com um espaço no meio do nome. */}
        <span className="marca-nome">
          Supremo<span>Cut</span>
        </span>
      </div>

      <select
        className="selecao"
        value={projeto}
        title="projeto aberto"
        onChange={(e) => {
          if (sujo && !confirm("Tem mudança não salva. Trocar de projeto mesmo assim?")) return;
          aoTrocarProjeto(e.target.value);
        }}
      >
        {projetos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <div className="divisor" />

      <button
        className="btn sutil icone"
        onClick={aoDesfazer}
        disabled={!podeDesfazer}
        title="Desfazer (Ctrl+Z)"
        aria-label="Desfazer"
      >
        <Undo2 size={16} className="lucide" />
      </button>
      <button
        className="btn sutil icone"
        onClick={aoRefazer}
        disabled={!podeRefazer}
        title="Refazer (Ctrl+Y)"
        aria-label="Refazer"
      >
        <Redo2 size={16} className="lucide" />
      </button>

      {/* O botão vira confirmação quando não há o que salvar: o estado do
          trabalho fica legível sem precisar procurar outro indicador. */}
      <button className="btn" onClick={aoSalvar} disabled={!sujo} title="Ctrl+S">
        {sujo ? <Save size={15} className="lucide" /> : <Check size={15} className="lucide" />}
        {sujo ? "Salvar" : "Salvo"}
      </button>
      {sujo && <span className="aviso-salvar">não salvo</span>}

      <div className="espaco" />

      {status && status.estado !== "parado" && (
        <div className="progresso">
          {rodando ? (
            <>
              <div className="barrinha">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span>
                {pct}% · {status.mensagem}
              </span>
            </>
          ) : status.estado === "pronto" ? (
            <span style={{ color: "var(--ok)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Check size={14} className="lucide" />
              {status.mensagem}
            </span>
          ) : (
            <span style={{ color: "var(--perigo)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={14} className="lucide" />
              {status.mensagem}
            </span>
          )}
        </div>
      )}

      <button
        className={`btn sutil icone ${zonaSegura ? "ligado" : ""}`}
        onClick={aoZonaSegura}
        title="Zona segura — mostra onde a interface do TikTok e do Reels cobre o vídeo"
        aria-label="Zona segura"
        aria-pressed={zonaSegura}
      >
        <Frame size={16} className="lucide" />
      </button>
      <button
        className="btn sutil icone"
        onClick={aoProcessar}
        title="Novo vídeo — processa material bruto"
        aria-label="Novo vídeo"
      >
        <FilePlus2 size={16} className="lucide" />
      </button>
      <button
        className="btn sutil icone"
        onClick={aoLegenda}
        title="Exportar legenda .srt para a pasta saida/"
        aria-label="Exportar legenda"
      >
        <Captions size={16} className="lucide" />
      </button>
      <button
        className="btn sutil icone"
        onClick={aoQuadro}
        title="Salvar o quadro atual como PNG"
        aria-label="Salvar quadro"
      >
        <Camera size={16} className="lucide" />
      </button>
      <button
        className="btn sutil icone"
        onClick={aoVerAtalhos}
        title="Atalhos de teclado (?)"
        aria-label="Atalhos"
      >
        <Keyboard size={16} className="lucide" />
      </button>

      <div className="divisor" />

      <select
        className="selecao"
        value={formato}
        title="formato do vídeo final"
        onChange={(e) => setFormato(e.target.value)}
      >
        {FORMATOS.map((f) => (
          <option key={f} value={f}>
            {ROTULO[f]}
          </option>
        ))}
        <option value="TODOS">os 3 formatos</option>
      </select>

      <button
        className="btn principal"
        onClick={() => renderizar(formato === "TODOS" ? [...FORMATOS] : [formato])}
        disabled={rodando}
      >
        {rodando ? (
          <Loader2 size={15} className="lucide" style={{ animation: "gira 1.1s linear infinite" }} />
        ) : (
          <Clapperboard size={15} className="lucide" />
        )}
        {rodando
          ? status?.fila && status.fila.length > 1
            ? `${(status.naFila ?? 0) + 1}/${status.fila.length}…`
            : "Renderizando…"
          : "Renderizar"}
      </button>
    </div>
  );
};
