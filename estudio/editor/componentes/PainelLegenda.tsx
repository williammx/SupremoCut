import React from "react";
import type { Estilo, Legendas, Palavra, Roteiro } from "../../src/tipos";
import {
  Captions,
  Eye,
  Palette,
  Ruler,
  SpellCheck,
  Sparkles,
  Star,
  Type,
  X,
} from "lucide-react";
import { Cor, Deslizante, Dica, Grupo, Interruptor, Opcoes, Texto } from "./controles";
import { relogio } from "./Timeline";

type Props = {
  roteiro: Roteiro;
  estilo: Estilo;
  tempoAtual: number;
  aoMudarRoteiro: (r: Roteiro) => void;
  aoMudarEstilo: (e: Estilo) => void;
  aoIrPara: (s: number) => void;
};

const PainelLegendaInterno: React.FC<Props> = ({
  roteiro,
  estilo,
  tempoAtual,
  aoMudarRoteiro,
  aoMudarEstilo,
  aoIrPara,
}) => {
  const legendas = roteiro.legendas;

  const mudarLegendas = (m: Partial<Legendas>) =>
    aoMudarRoteiro({ ...roteiro, legendas: { ...legendas, ...m } });

  const mudarEstilo = (caminho: "legenda" | "fonte" | "cores", m: Record<string, unknown>) =>
    aoMudarEstilo({ ...estilo, [caminho]: { ...estilo[caminho], ...m } });

  const faixas = legendas.ligada_em ?? [];

  return (
    <>
      <Grupo titulo="Estilo" icone={<Captions size={13} className="lucide" />}>
        <Opcoes
          valores={[
            ["hormozi", "Hormozi"],
            ["caixa", "Caixa"],
            ["neon", "Neon"],
            ["pop", "Pop"],
            ["destaque", "Destaque"],
            ["karaoke", "Karaokê"],
            ["bloco", "Bloco"],
            ["nenhum", "Sem legenda"],
          ]}
          valor={legendas.estilo}
          aoMudar={(v) => mudarLegendas({ estilo: v })}
        />
        <p style={{ color: "var(--texto-fraco)", fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          {legendas.estilo === "hormozi" &&
            "Caixa alta pesada, e a palavra dita ganha um bloco sólido atrás. É o estilo que mais domina a tela — o padrão do anúncio vertical."}
          {legendas.estilo === "caixa" &&
            "Toda palavra com fundo sólido. Lê bem sobre qualquer imagem, inclusive fundo claro."}
          {legendas.estilo === "neon" &&
            "Brilho na cor de destaque. Funciona em vídeo escuro; some em fundo claro."}
          {legendas.estilo === "pop" &&
            "A palavra dita salta grande e as outras recuam. Puxa o olho para uma palavra por vez."}
          {legendas.estilo === "destaque" &&
            "A palavra que está sendo dita ganha a cor de destaque e um leve salto."}
          {legendas.estilo === "karaoke" &&
            "As palavras que ainda não foram ditas ficam apagadas."}
          {legendas.estilo === "bloco" && "Todas as palavras do grupo com o mesmo peso."}
          {legendas.estilo === "nenhum" && "Nenhuma legenda aparece no vídeo."}
        </p>
      </Grupo>

      {legendas.estilo !== "nenhum" && (
        <Grupo titulo="Palavras que saltam" icone={<Sparkles size={13} className="lucide" />}>
          <p style={{ color: "var(--texto-fraco)", fontSize: 11.5, marginBottom: 8, lineHeight: 1.5 }}>
            A oferta precisa saltar do bloco de texto. Estas palavras ganham a cor de
            destaque em qualquer lugar que apareçam. Separe por vírgula.
          </p>
          <input
            type="text"
            style={{ width: "100%" }}
            placeholder="grátis, desconto, hoje, metade, agora"
            value={(legendas.palavras_chave ?? []).join(", ")}
            onChange={(e) =>
              mudarLegendas({
                palavras_chave: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <button
            className="opcao"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              // A lista vira a fonte da verdade: o que bate fica marcado, o
              // resto é DESmarcado. Isso apaga as estrelas postas na mão uma a
              // uma logo abaixo — trabalho caro de refazer, então pergunta
              // antes em vez de descobrir depois.
              const naMao = legendas.palavras.filter((p) => p.enfase).length;
              if (
                naMao > 0 &&
                !confirm(
                  `Você tem ${naMao} palavra(s) marcada(s) como destaque. Aplicar a lista ` +
                    `desmarca as que não estiverem nela. Continuar?`,
                )
              ) {
                return;
              }
              const chaves = (legendas.palavras_chave ?? []).map((s) =>
                s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
              );
              const limpar = (s: string) =>
                s
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/g, "")
                  .replace(/[^\w%$]/g, "");
              mudarLegendas({
                palavras: legendas.palavras.map((p) => ({
                  ...p,
                  enfase: chaves.some((c) => limpar(p.texto) === limpar(c)),
                })),
              });
            }}
          >
            Aplicar às {legendas.palavras.length} palavras
          </button>
        </Grupo>
      )}

      {legendas.estilo !== "nenhum" && (
        <>
          <Grupo titulo="Cores" icone={<Palette size={13} className="lucide" />}>
            <Cor
              rotulo="Destaque"
              valor={estilo.cores.destaque}
              aoMudar={(v) => mudarEstilo("cores", { destaque: v })}
            />
            <Cor
              rotulo="Texto"
              valor={estilo.cores.texto}
              aoMudar={(v) => mudarEstilo("cores", { texto: v })}
            />
          </Grupo>

          <Grupo titulo="Posição e tamanho" icone={<Ruler size={13} className="lucide" />}>
            <Deslizante
              rotulo="Altura"
              valor={estilo.legenda.posicao_y}
              min={0.05}
              max={0.95}
              aoMudar={(v) => mudarEstilo("legenda", { posicao_y: v })}
            />
            <Deslizante
              rotulo="Tamanho"
              valor={estilo.fonte.tamanho_legenda}
              min={30}
              max={140}
              passo={1}
              casas={0}
              sufixo="px"
              aoMudar={(v) => mudarEstilo("fonte", { tamanho_legenda: v })}
            />
            <Deslizante
              rotulo="Palavras"
              valor={estilo.legenda.max_palavras}
              min={1}
              max={9}
              passo={1}
              casas={0}
              aoMudar={(v) => mudarEstilo("legenda", { max_palavras: v })}
            />
          </Grupo>

          <Grupo titulo="Aparência" icone={<Type size={13} className="lucide" />} aberto={false}>
            <Texto
              rotulo="Fonte"
              valor={estilo.fonte.familia}
              aoMudar={(v) => mudarEstilo("fonte", { familia: v })}
            />
            <Deslizante
              rotulo="Peso"
              valor={estilo.fonte.peso}
              min={300}
              max={900}
              passo={100}
              casas={0}
              aoMudar={(v) => mudarEstilo("fonte", { peso: v })}
            />
            <Interruptor
              rotulo="Caixa alta"
              valor={estilo.fonte.caixa_alta}
              aoMudar={(v) => mudarEstilo("fonte", { caixa_alta: v })}
            />
            <Deslizante
              rotulo="Contorno"
              valor={estilo.legenda.contorno}
              min={0}
              max={9}
              passo={0.5}
              casas={1}
              sufixo="px"
              aoMudar={(v) => mudarEstilo("legenda", { contorno: v })}
            />
            <Interruptor
              rotulo="Fundo escuro"
              valor={estilo.legenda.fundo}
              aoMudar={(v) => mudarEstilo("legenda", { fundo: v })}
            />
          </Grupo>

          <Grupo titulo="Onde aparece" icone={<Eye size={13} className="lucide" />} aberto={false}>
            {faixas.length === 0 ? (
              <p style={{ color: "var(--texto-fraco)", fontSize: 12, lineHeight: 1.5 }}>
                A legenda aparece no vídeo inteiro. Use as faixas se quiser escondê-la em
                trechos — por exemplo onde já tem crédito na tela.
              </p>
            ) : (
              faixas.map(([a, b], i) => (
                <div className="cartao" key={i}>
                  <div className="cartao-topo">
                    <strong>
                      {relogio(a)} → {relogio(b)}
                    </strong>
                    <button
                      className="apagar"
                      onClick={() =>
                        mudarLegendas({ ligada_em: faixas.filter((_, j) => j !== i) })
                      }
                      title="remover esta faixa"
                      aria-label="remover faixa"
                    >
                      <X size={14} className="lucide" />
                    </button>
                  </div>
                  <div className="linha">
                    <label>Início</label>
                    <input
                      type="number"
                      value={a}
                      step={0.5}
                      onChange={(e) => {
                        const nova = [...faixas];
                        nova[i] = [Number(e.target.value), b];
                        mudarLegendas({ ligada_em: nova });
                      }}
                    />
                  </div>
                  <div className="linha">
                    <label>Fim</label>
                    <input
                      type="number"
                      value={b}
                      step={0.5}
                      onChange={(e) => {
                        const nova = [...faixas];
                        nova[i] = [a, Number(e.target.value)];
                        mudarLegendas({ ligada_em: nova });
                      }}
                    />
                  </div>
                </div>
              ))
            )}
            <button
              className="opcao"
              style={{ width: "100%", marginTop: 6 }}
              onClick={() => {
                const total = roteiro.cenas.reduce((s, c) => s + c.duracao, 0);
                mudarLegendas({ ligada_em: [...faixas, [0, Number(total.toFixed(1))]] });
              }}
            >
              + Adicionar faixa
            </button>
          </Grupo>

          <Grupo
            titulo="Corrigir o texto"
            icone={<SpellCheck size={13} className="lucide" />}
            aberto={false}
          >
            <Dica>
              Palavras perto da agulha. Clique no tempo pra pular até ela, edite o texto
              direto, ou marque a estrela pra ela sair na cor de destaque.
            </Dica>
            {(() => {
              const perto = legendas.palavras
                .map((p, i) => ({ p, i }))
                .filter(({ p }) => p.fim > tempoAtual - 4 && p.t < tempoAtual + 8)
                .slice(0, 24);

              if (perto.length === 0) {
                return (
                  <p style={{ color: "var(--texto-fraco)", fontSize: 12 }}>
                    Nenhuma palavra por aqui. Mova a agulha.
                  </p>
                );
              }

              const trocar = (i: number, m: Partial<Palavra>) => {
                const palavras = [...legendas.palavras];
                palavras[i] = { ...palavras[i], ...m };
                mudarLegendas({ palavras });
              };

              return perto.map(({ p, i }) => {
                const ativa = tempoAtual >= p.t && tempoAtual <= p.fim;
                return (
                  <div
                    className="palavra-linha"
                    key={i}
                    style={ativa ? { borderColor: "var(--destaque)" } : undefined}
                  >
                    <button
                      className="palavra-tempo"
                      onClick={() => aoIrPara(p.t)}
                      title="pular pra este ponto do vídeo"
                    >
                      {/* p.t é tempo da FONTE; mostrar isso confundiria com o
                          relógio da timeline. O texto vira posição relativa. */}
                      {ativa ? "aqui" : `${p.t > tempoAtual ? "+" : "−"}${Math.abs(
                        p.t - tempoAtual,
                      ).toFixed(1)}s`}
                    </button>
                    <input
                      type="text"
                      value={p.texto}
                      onChange={(e) => trocar(i, { texto: e.target.value })}
                    />
                    <button
                      className={`palavra-enfase ${p.enfase ? "ativa" : ""}`}
                      onClick={() => trocar(i, { enfase: !p.enfase })}
                      title="cor de destaque"
                      aria-label="destacar palavra"
                    >
                      <Star
                        size={13}
                        className="lucide"
                        fill={p.enfase ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                );
              });
            })()}
            <p style={{ color: "var(--texto-fraco)", fontSize: 11, marginTop: 10 }}>
              {legendas.palavras.length} palavras no total.
            </p>
          </Grupo>
        </>
      )}
    </>
  );
};

export const PainelLegenda = React.memo(PainelLegendaInterno);
PainelLegenda.displayName = "PainelLegenda";
