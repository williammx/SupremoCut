import React from "react";
import { TARJA_PADRAO, type Caixa, type Estilo, type Overlay } from "../../src/tipos";
import { CaseSensitive, Check, ChevronDown, Layers, Search, Trash2, Type } from "lucide-react";
import { api } from "../api";
import {
  Cor,
  Deslizante,
  Dica,
  Grupo,
  Interruptor,
  Numero,
  Opcoes,
  Texto,
  Vazio,
} from "./controles";

type Props = {
  overlays: Overlay[];
  aoMudar: (o: Overlay[]) => void;
  estilo: Estilo;
  aoMudarEstilo: (e: Estilo) => void;
  tempoAtual: number;
  duracaoTotal: number;
};

/**
 * As fontes vêm do SISTEMA, lidas pelo servidor no registro do Windows.
 *
 * Uma versão anterior trazia nove escolhidas a dedo. Funcionava, mas escondia
 * as outras seiscentas e tantas que existem nesta máquina — e uma lista fixa
 * tem duas maneiras silenciosas de estar errada: citar fonte que não está
 * instalada (o navegador cai no fallback sem avisar e o vídeo sai com outra
 * letra) ou omitir fonte que está.
 *
 * Estas aqui ficam só como atalho no topo, porque são as que servem pra vídeo
 * vertical. O resto vem pela busca.
 */
export const RESERVA = "Inter, 'Segoe UI', Arial, sans-serif";

/** Só o primeiro nome da cadeia — é o que o seletor mostra como escolhido. */
export const familiaEscolhida = (familia: string): string =>
  (familia.split(",")[0] ?? "").replace(/['"]/g, "").trim();

/**
 * A cadeia de fontes que vai pro CSS, com o nome escolhido ENTRE ASPAS.
 *
 * As aspas não são enfeite. Sem elas, o CSS lê o nome como uma sequência de
 * identificadores, e identificador não pode começar com dígito. "Tusker Grotesk
 * 1500" tem `1500` como terceira palavra: a declaração inteira é considerada
 * inválida e o navegador DESCARTA o font-family — sem erro, sem aviso, o texto
 * simplesmente continua na fonte anterior.
 *
 * Foi exatamente esse o defeito: o seletor mostrava a fonte certa (lá o nome ia
 * entre aspas) enquanto o vídeo seguia em Inter. O mesmo vale pra qualquer nome
 * com acento, hífen solto ou número — que é metade das fontes de display.
 */
export const cadeiaDeFonte = (nome: string): string => `"${nome}", ${RESERVA}`;

/**
 * Dropdown de fonte.
 *
 * Fechado, mostra a fonte atual escrita nela mesma. Aberto, mostra TODAS as
 * famílias instaladas na máquina, com um campo de busca no topo pra filtrar.
 *
 * A versão anterior era só o campo de busca com uma lista curta embaixo: quem
 * não sabia o nome de cor não tinha como descobrir o que existia. Um dropdown
 * responde "o que eu tenho?" antes de exigir que você já saiba.
 *
 * Cada linha é desenhada NA PRÓPRIA FONTE — é o único jeito de escolher tipo
 * sem abrir outro programa.
 */
export const SeletorFonte: React.FC<{
  fontes: string[];
  escolhida: string;
  aoEscolher: (nome: string) => void;
}> = ({ fontes, escolhida, aoEscolher }) => {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const caixa = React.useRef<HTMLDivElement>(null);
  const campo = React.useRef<HTMLInputElement>(null);

  // fechar clicando fora e no Esc: sem isso o painel fica aberto por cima do
  // resto e o único jeito de sair é escolher alguma coisa
  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  React.useEffect(() => {
    if (aberto) campo.current?.focus();
    else setBusca("");
  }, [aberto]);

  const termo = busca.trim().toLowerCase();
  const lista = termo ? fontes.filter((f) => f.toLowerCase().includes(termo)) : fontes;

  return (
    <div className="seletor-fonte" ref={caixa}>
      <button
        className="seletor-fonte-botao"
        onClick={() => setAberto((v) => !v)}
        title="Escolher a fonte do vídeo"
      >
        <span style={{ fontFamily: `"${escolhida}", ${RESERVA}`, fontSize: 17 }}>
          {escolhida || "—"}
        </span>
        <ChevronDown size={14} className="lucide" />
      </button>

      {aberto && (
        <div className="seletor-fonte-lista">
          <div className="seletor-fonte-busca">
            <Search size={13} className="lucide" />
            <input
              ref={campo}
              className="campo"
              placeholder={`Buscar entre ${fontes.length} fontes…`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="seletor-fonte-rolagem">
            {lista.map((nome) => (
              <button
                key={nome}
                className={`seletor-fonte-item ${nome === escolhida ? "ativa" : ""}`}
                onClick={() => {
                  aoEscolher(nome);
                  setAberto(false);
                }}
                title={nome}
              >
                <span style={{ fontFamily: `"${nome}", ${RESERVA}` }}>{nome}</span>
                {nome === escolhida && <Check size={13} className="lucide" />}
              </button>
            ))}
            {lista.length === 0 && (
              <p className="dica" style={{ margin: "8px 10px" }}>
                Nenhuma fonte com esse nome está instalada aqui.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Só o primeiro nome da cadeia — é o que o seletor mostra como escolhido. */
const familiaAtual = (familia: string): string =>
  (familia.split(",")[0] ?? "").replace(/['"]/g, "").trim();

const TIPOS: [Overlay["tipo"], string, string][] = [
  [
    "tarja",
    "Tarja de cobertura",
    "Cobre texto queimado no vídeo (legenda em outro idioma, preço) e escreve por cima.",
  ],
  ["titulo", "Título", "Texto grande no centro. Bom pra abertura."],
  ["lower_third", "Nome/cargo", "Aquela tarja com nome e função, embaixo à esquerda."],
  ["destaque", "Destaque", "Caixinha colorida no topo, pra chamar atenção."],
  ["marca", "Marca", "Assinatura discreta num canto, o vídeo todo."],
];

export const PainelTextos: React.FC<Props> = ({
  overlays,
  aoMudar,
  estilo,
  aoMudarEstilo,
  tempoAtual,
  duracaoTotal,
}) => {
  const adicionar = (tipo: Overlay["tipo"]) => {
    const novo: Overlay = {
      id: `o${Date.now().toString(36)}`,
      inicio: Number(tempoAtual.toFixed(2)),
      duracao: tipo === "marca" ? Number(duracaoTotal.toFixed(2)) : 4,
      tipo,
      texto:
        tipo === "tarja"
          ? "Texto em português"
          : tipo === "titulo"
            ? "Seu título aqui"
            : tipo === "lower_third"
              ? "Nome da pessoa"
              : tipo === "destaque"
                ? "Importante"
                : "Supremo",
      subtexto: tipo === "lower_third" ? "Cargo / empresa" : undefined,
    };
    if (tipo === "tarja") {
      // nasce onde a legenda queimada costuma ficar nesses anúncios verticais
      novo.posicao = { x: 0.08, y: 0.74 };
      novo.tamanho = { largura: 0.84, altura: 0.07 };
      novo.caixa = { ...TARJA_PADRAO };
      novo.duracao = 3;
    }
    aoMudar([...overlays, novo]);
  };

  const mudar = (id: string, m: Partial<Overlay>) =>
    aoMudar(overlays.map((o) => (o.id === id ? { ...o, ...m } : o)));

  const apagar = (id: string) => aoMudar(overlays.filter((o) => o.id !== id));

  const escolhida = familiaAtual(estilo.fonte.familia);

  const [fontes, setFontes] = React.useState<string[]>([]);

  React.useEffect(() => {
    api.fontes().then(setFontes).catch(() => setFontes([]));
  }, []);

  return (
    <>
      <Grupo titulo="Tipografia" icone={<CaseSensitive size={13} className="lucide" />} fixo>
        <SeletorFonte
          fontes={fontes}
          escolhida={escolhida}
          aoEscolher={(nome) =>
            aoMudarEstilo({
              ...estilo,
              fonte: { ...estilo.fonte, familia: cadeiaDeFonte(nome) },
            })
          }
        />
        <p className="dica" style={{ margin: "9px 0 0" }}>
          Vale pro vídeo inteiro. A lista é o que está instalado nesta máquina —
          o render usa exatamente as mesmas fontes.
        </p>
      </Grupo>

      <Grupo titulo="Adicionar" icone={<Type size={13} className="lucide" />} fixo>
        {TIPOS.map(([tipo, rotulo, ajuda]) => (
          <button
            key={tipo}
            className="opcao"
            style={{ width: "100%", marginBottom: 5, textAlign: "left", padding: "9px 11px" }}
            onClick={() => adicionar(tipo)}
          >
            <strong style={{ display: "block", marginBottom: 2 }}>+ {rotulo}</strong>
            <span style={{ color: "var(--texto-fraco)", fontSize: 11 }}>{ajuda}</span>
          </button>
        ))}
        <p className="dica" style={{ margin: "9px 0 0" }}>
          Entra no tempo onde a agulha está agora.
        </p>
      </Grupo>

      <Grupo
        titulo={`No vídeo (${overlays.length})`}
        icone={<Layers size={13} className="lucide" />}
        fixo
      >
        {overlays.length === 0 && (
          <Vazio icone={<Type size={26} className="lucide" />}>
            Nada por cima do vídeo ainda.
          </Vazio>
        )}

        {overlays.map((o) => (
          <div className="cartao" key={o.id}>
            <div className="cartao-topo">
              <strong>{TIPOS.find((t) => t[0] === o.tipo)?.[1] ?? o.tipo}</strong>
              <button
                className="apagar"
                onClick={() => apagar(o.id)}
                title="tirar do vídeo"
                aria-label="remover"
              >
                <Trash2 size={14} className="lucide" />
              </button>
            </div>

            <Texto rotulo="Texto" valor={o.texto} aoMudar={(v) => mudar(o.id, { texto: v })} />

            {(o.tipo === "lower_third" || o.tipo === "titulo") && (
              <Texto
                rotulo="Segunda linha"
                valor={o.subtexto ?? ""}
                aoMudar={(v) => mudar(o.id, { subtexto: v })}
              />
            )}

            <Numero
              rotulo="Entra em"
              valor={o.inicio}
              min={0}
              aoMudar={(v) => mudar(o.id, { inicio: Number(v.toFixed(2)) })}
            />
            <Numero
              rotulo="Fica"
              valor={o.duracao}
              min={0.3}
              aoMudar={(v) => mudar(o.id, { duracao: Number(Math.max(0.3, v).toFixed(2)) })}
            />

            {o.tipo === "tarja" && (
              <>
                <Deslizante
                  rotulo="Largura"
                  valor={o.tamanho?.largura ?? 0.84}
                  min={0.05}
                  max={1}
                  aoMudar={(v) =>
                    mudar(o.id, {
                      tamanho: { largura: v, altura: o.tamanho?.altura ?? 0.07 },
                    })
                  }
                />
                <Deslizante
                  rotulo="Altura"
                  valor={o.tamanho?.altura ?? 0.07}
                  min={0.02}
                  max={0.5}
                  aoMudar={(v) =>
                    mudar(o.id, {
                      tamanho: { largura: o.tamanho?.largura ?? 0.84, altura: v },
                    })
                  }
                />
                {(() => {
                  const c: Caixa = { ...TARJA_PADRAO, ...(o.caixa ?? {}) };
                  const mudarCaixa = (m: Partial<Caixa>) =>
                    mudar(o.id, { caixa: { ...c, ...m } });
                  return (
                    <>
                      <Cor
                        rotulo="Fundo"
                        valor={c.cor}
                        aoMudar={(v) => mudarCaixa({ cor: v })}
                      />
                      <Cor
                        rotulo="Texto"
                        valor={c.cor_texto}
                        aoMudar={(v) => mudarCaixa({ cor_texto: v })}
                      />
                      <Deslizante
                        rotulo="Tam. texto"
                        valor={c.tamanho_texto}
                        min={16}
                        max={140}
                        passo={1}
                        casas={0}
                        sufixo="px"
                        aoMudar={(v) => mudarCaixa({ tamanho_texto: v })}
                      />
                      <Deslizante
                        rotulo="Peso"
                        valor={c.peso}
                        min={300}
                        max={900}
                        passo={100}
                        casas={0}
                        aoMudar={(v) => mudarCaixa({ peso: v })}
                      />
                      <div className="linha">
                        <label>Alinha</label>
                        <div style={{ flex: 1 }}>
                          <Opcoes
                            colunas={3}
                            valores={[
                              ["esquerda", "◧"],
                              ["centro", "▣"],
                              ["direita", "◨"],
                            ]}
                            valor={c.alinhamento}
                            aoMudar={(v) => mudarCaixa({ alinhamento: v })}
                          />
                        </div>
                      </div>
                      <Cor
                        rotulo="Cor borda"
                        valor={c.cor_borda}
                        aoMudar={(v) => mudarCaixa({ cor_borda: v })}
                      />
                      <Deslizante
                        rotulo="Borda"
                        valor={c.borda}
                        min={0}
                        max={16}
                        passo={0.5}
                        casas={1}
                        sufixo="px"
                        aoMudar={(v) => mudarCaixa({ borda: v })}
                      />
                      <Deslizante
                        rotulo="Cantos"
                        valor={c.raio}
                        min={0}
                        max={60}
                        passo={1}
                        casas={0}
                        sufixo="px"
                        aoMudar={(v) => mudarCaixa({ raio: v })}
                      />
                      <Deslizante
                        rotulo="Contorno"
                        valor={c.contorno}
                        min={0}
                        max={8}
                        passo={0.5}
                        casas={1}
                        sufixo="px"
                        aoMudar={(v) => mudarCaixa({ contorno: v })}
                      />
                      <Interruptor
                        rotulo="Caixa alta"
                        valor={c.caixa_alta}
                        aoMudar={(v) => mudarCaixa({ caixa_alta: v })}
                      />
                    </>
                  );
                })()}
              </>
            )}

            {o.tipo !== "titulo" && (
              <>
                <Deslizante
                  rotulo="Horizontal"
                  valor={o.posicao?.x ?? (o.tipo === "marca" ? 0.04 : 0.07)}
                  min={0}
                  max={1}
                  aoMudar={(v) =>
                    mudar(o.id, { posicao: { x: v, y: o.posicao?.y ?? 0.76 } })
                  }
                />
                <Deslizante
                  rotulo="Vertical"
                  valor={o.posicao?.y ?? (o.tipo === "marca" ? 0.05 : 0.76)}
                  min={0}
                  max={1}
                  aoMudar={(v) =>
                    mudar(o.id, { posicao: { x: o.posicao?.x ?? 0.07, y: v } })
                  }
                />
              </>
            )}
          </div>
        ))}
      </Grupo>
    </>
  );
};
