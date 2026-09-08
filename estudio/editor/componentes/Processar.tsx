import React, { useEffect, useState } from "react";
import { api } from "../api";

/**
 * Processar material bruto sem sair do editor.
 *
 * Detecta pastas em projetos/ que já têm vídeo em bruto/ mas ainda não têm
 * roteiro, e roda o pipeline (sincronia, limpeza, transcrição, cortes) com
 * progresso na tela. Isso tira a linha de comando do caminho.
 */
export const Processar: React.FC<{
  aoFechar: () => void;
  aoTerminar: (nome: string) => void;
}> = ({ aoFechar, aoTerminar }) => {
  const [crus, setCrus] = useState<{ nome: string; arquivos: number }[]>([]);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.statusPreparar>> | null>(
    null,
  );
  const [cortes, setCortes] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const rodando = status?.estado === "rodando";

  useEffect(() => {
    api.projetosCrus().then(setCrus).catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    const buscar = () => api.statusPreparar().then(setStatus).catch(() => {});
    buscar();
    const t = setInterval(buscar, rodando ? 1500 : 6000);
    return () => clearInterval(t);
  }, [rodando]);

  // quando terminar, avisa o editor pra recarregar a lista de projetos
  useEffect(() => {
    if (status?.estado === "pronto" && status.projeto) {
      aoTerminar(status.projeto);
    }
  }, [status?.estado, status?.projeto, aoTerminar]);

  const processar = async (nome: string) => {
    try {
      await api.preparar(nome, cortes.trim() ? { cortes: cortes.trim() } : undefined);
      setStatus({ estado: "rodando", projeto: nome, mensagem: "começando" });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="atalhos" onClick={rodando ? undefined : aoFechar}>
      <div className="atalhos-caixa" onClick={(e) => e.stopPropagation()}>
        <h3>Processar material novo</h3>

        <p style={{ color: "var(--texto-fraco)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 16 }}>
          Crie uma pasta em <code>F:\SupremoCut\projetos\NOME\bruto</code> e jogue os vídeos
          lá dentro. Nomeie <code>camera.mp4</code> e <code>tela.mp4</code> se forem duas
          fontes — a sincronia é automática.
        </p>

        {erro && <p style={{ color: "#ff5c5c", fontSize: 12, marginBottom: 12 }}>{erro}</p>}

        {rodando ? (
          <>
            <div className="atalhos-linha">
              <span>Processando {status?.projeto}</span>
              <b style={{ color: "var(--destaque)" }}>{status?.mensagem}</b>
            </div>
            <pre className="log">
              {(status?.linhas ?? []).slice(-14).join("\n") || "aguardando…"}
            </pre>
            <p style={{ color: "var(--texto-fraco)", fontSize: 11.5, marginTop: 10 }}>
              A transcrição é a parte demorada — alguns minutos por hora de vídeo. Pode
              deixar rodando.
            </p>
          </>
        ) : (
          <>
            {status?.estado === "erro" && (
              <p style={{ color: "#ff5c5c", fontSize: 12, marginBottom: 10 }}>
                O último processamento falhou.
                <pre className="log">{(status.linhas ?? []).slice(-10).join("\n")}</pre>
              </p>
            )}

            <div className="linha" style={{ marginBottom: 14 }}>
              <label style={{ flex: "0 0 110px" }}>Cortes (opcional)</label>
              <input
                type="text"
                value={cortes}
                placeholder="4:41-5:53, 6:38-9:04"
                onChange={(e) => setCortes(e.target.value)}
              />
            </div>
            <p style={{ color: "var(--texto-fraco)", fontSize: 11.5, marginBottom: 16 }}>
              Deixe vazio pra ele cortar os silêncios sozinho, ou informe os trechos exatos
              que você quer manter.
            </p>

            {crus.length === 0 ? (
              <div className="vazio">
                Nenhuma pasta esperando processamento.
                <br />
                Todo projeto com vídeo em bruto já foi processado.
              </div>
            ) : (
              crus.map((p) => (
                <div className="atalhos-linha" key={p.nome}>
                  <span>
                    <b style={{ color: "var(--texto)" }}>{p.nome}</b> · {p.arquivos} arquivo
                    {p.arquivos > 1 ? "s" : ""}
                  </span>
                  <button className="btn principal" onClick={() => processar(p.nome)}>
                    Processar
                  </button>
                </div>
              ))
            )}

            <button className="btn" style={{ width: "100%", marginTop: 18 }} onClick={aoFechar}>
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
};
