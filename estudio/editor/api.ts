import type { Estilo, Roteiro } from "../src/tipos";

async function pedir<T>(url: string, opcoes?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({ erro: r.statusText }));
    throw new Error(corpo.erro ?? `Erro ${r.status}`);
  }
  return r.json();
}

export const api = {
  projetos: () => pedir<string[]>("/api/projetos"),

  abrir: (nome: string) => pedir<{ roteiro: Roteiro; estilo: Estilo }>(`/api/projeto/${nome}`),

  salvarRoteiro: (nome: string, roteiro: Roteiro) =>
    pedir<{ ok: true }>(`/api/projeto/${nome}/roteiro`, {
      method: "PUT",
      body: JSON.stringify(roteiro),
    }),

  /** O estilo é do PROJETO: sem o nome, uma troca de fonte vazaria pros outros. */
  salvarEstilo: (nome: string, estilo: Estilo) =>
    pedir<{ ok: true }>(`/api/estilo/${nome}`, {
      method: "PUT",
      body: JSON.stringify(estilo),
    }),

  renderizar: (nome: string, formatos: string[]) =>
    pedir<{ ok: true; fila: string[] }>(`/api/render/${nome}`, {
      method: "POST",
      body: JSON.stringify({ formatos }),
    }),

  salvarLegenda: (nome: string, srt: string) =>
    pedir<{ ok: true; arquivo: string }>(`/api/legenda/${nome}`, {
      method: "POST",
      body: JSON.stringify({ srt }),
    }),

  salvarQuadro: (nome: string, frame: number, formato: string) =>
    pedir<{ ok: true; arquivo: string }>(`/api/quadro/${nome}`, {
      method: "POST",
      body: JSON.stringify({ frame, formato }),
    }),

  musicas: () => pedir<{ nome: string; mb: number }[]>("/api/musicas"),

  /** Famílias de fonte instaladas nesta máquina, já sem os sufixos de estilo. */
  fontes: () => pedir<string[]>("/api/fontes"),

  imagens: (nome: string) => pedir<string[]>(`/api/imagens/${nome}`),

  enviarImagem: (nome: string, arquivo: string, dados: string) =>
    pedir<{ arquivo: string }>(`/api/imagens/${nome}`, {
      method: "POST",
      body: JSON.stringify({ arquivo, dados }),
    }),

  projetosCrus: () => pedir<{ nome: string; arquivos: number }[]>("/api/projetos-crus"),

  preparar: (nome: string, opcoes?: { cortes?: string; modelo?: string }) =>
    pedir<{ ok: true }>(`/api/preparar/${nome}`, {
      method: "POST",
      body: JSON.stringify(opcoes ?? {}),
    }),

  statusPreparar: () =>
    pedir<{
      estado: "parado" | "rodando" | "pronto" | "erro";
      projeto?: string;
      mensagem?: string;
      linhas?: string[];
    }>("/api/preparar/status"),

  statusRender: () =>
    pedir<{
      estado: "parado" | "rodando" | "pronto" | "erro";
      feito?: number;
      total?: number;
      mensagem?: string;
      projeto?: string;
      formato?: string;
      fila?: string[];
      naFila?: number;
      prontos?: string[];
    }>("/api/render/status"),
};
