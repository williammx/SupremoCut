import React from "react";
import type { Cena, Entrada, Layout, Roteiro } from "../../src/tipos";
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  LayoutGrid,
  MousePointerClick,
  PictureInPicture2,
  Scissors,
  Snowflake,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  ZoomIn,
} from "lucide-react";
import { Deslizante, Dica, Grupo, Numero, Opcoes, Texto, Vazio } from "./controles";
import { PainelCor, PainelMascara, PainelMovimento } from "./PainelMovimento";
import { relogio } from "./Timeline";

type Props = {
  cena: Cena | null;
  roteiro: Roteiro;
  aoMudar: (id: string, mudancas: Partial<Cena>) => void;
  aoApagar: (id: string) => void;
  aoMover: (id: string, direcao: -1 | 1) => void;
  aoEntradaEmTodos: (entrada: Entrada) => void;
};

const LAYOUTS: [Layout, string][] = [
  ["camera", "Câmera"],
  ["tela", "Tela"],
  ["pip", "PiP"],
  ["pip_grande", "PiP grande"],
  ["pip_invertido", "PiP invertido"],
  ["split", "Dividido"],
  ["split_diagonal", "Diagonal"],
];

const TRANSICOES: [Entrada["tipo"], string][] = [
  ["corte", "Corte"],
  ["morph", "Morph"],
  ["fade", "Fade"],
  ["deslize", "Deslize"],
  ["zoom_cruzado", "Zoom"],
  ["flash", "Flash"],
];

const CANTOS = [
  ["superior_esquerdo", { top: 5, left: 5 }],
  ["superior_direito", { top: 5, right: 5 }],
  ["inferior_esquerdo", { bottom: 5, left: 5 }],
  ["inferior_direito", { bottom: 5, right: 5 }],
] as const;

const PainelBlocoInterno: React.FC<Props> = ({
  cena,
  roteiro,
  aoMudar,
  aoApagar,
  aoMover,
  aoEntradaEmTodos,
}) => {
  if (!cena) {
    return (
      <Vazio icone={<MousePointerClick size={30} className="lucide" />}>
        Clique num bloco da linha do tempo pra editar.
      </Vazio>
    );
  }

  const temTela = !!roteiro.fontes.tela;
  const temPip = cena.layout.includes("pip");
  const i = roteiro.cenas.findIndex((c) => c.id === cena.id);

  const mudarEntrada = (mudanca: Partial<Entrada>) =>
    aoMudar(cena.id, { entrada: { ...cena.entrada, ...mudanca } as Entrada });

  const duracaoEntrada = "duracao" in cena.entrada ? cena.entrada.duracao : 0.55;

  return (
    <>
      <Grupo
        titulo={`Bloco ${i + 1} de ${roteiro.cenas.length}`}
        icone={<Scissors size={13} className="lucide" />}
        fixo
      >
        <div className="linha">
          <label>Corte</label>
          <span style={{ flex: 1, color: "var(--texto-medio)", fontSize: 12 }}>
            {relogio(cena.fonte_inicio)} → {relogio(cena.fonte_inicio + cena.duracao)}
          </span>
        </div>
        <Numero
          rotulo="Começa em"
          valor={cena.fonte_inicio}
          min={0}
          aoMudar={(v) => aoMudar(cena.id, { fonte_inicio: Number(v.toFixed(3)) })}
        />
        <Numero
          rotulo="Dura"
          valor={cena.duracao}
          min={0.2}
          aoMudar={(v) => aoMudar(cena.id, { duracao: Number(Math.max(0.2, v).toFixed(3)) })}
        />
        <div className="linha">
          <label>Ordem</label>
          <button
            className="opcao"
            onClick={() => aoMover(cena.id, -1)}
            disabled={i === 0}
            title="troca de lugar com o bloco anterior"
          >
            <ArrowLeft size={13} className="lucide" />
            antes
          </button>
          <button
            className="opcao"
            onClick={() => aoMover(cena.id, 1)}
            disabled={i === roteiro.cenas.length - 1}
            title="troca de lugar com o próximo bloco"
          >
            depois
            <ArrowRight size={13} className="lucide" />
          </button>
        </div>
        <Dica>Na linha do tempo dá pra arrastar o bloco direto pra outra posição.</Dica>
      </Grupo>

      <Grupo titulo="Layout" icone={<LayoutGrid size={13} className="lucide" />}>
        {!temTela && (
          <Dica>
            Este projeto tem só uma fonte de vídeo, então os layouts com tela ficam iguais à
            câmera.
          </Dica>
        )}
        <Opcoes
          valores={LAYOUTS}
          valor={cena.layout}
          aoMudar={(v) => aoMudar(cena.id, { layout: v })}
        />
      </Grupo>

      {temPip && (
        <Grupo titulo="Quadradinho" icone={<PictureInPicture2 size={13} className="lucide" />}>
          <div className="linha">
            <label>Canto</label>
            <div className="cantos">
              {CANTOS.map(([nome, pos]) => (
                <button
                  key={nome}
                  className={`canto ${cena.pip?.canto === nome ? "ativa" : ""}`}
                  onClick={() =>
                    aoMudar(cena.id, {
                      pip: {
                        canto: nome,
                        escala: cena.pip?.escala ?? 0.26,
                        formato: cena.pip?.formato ?? "arredondado",
                      },
                    })
                  }
                >
                  <i style={pos as React.CSSProperties} />
                </button>
              ))}
            </div>
          </div>

          <Deslizante
            rotulo="Tamanho"
            valor={cena.pip?.escala ?? 0.26}
            min={0.1}
            max={0.6}
            passo={0.01}
            aoMudar={(v) =>
              aoMudar(cena.id, {
                pip: {
                  canto: cena.pip?.canto ?? "inferior_direito",
                  escala: v,
                  formato: cena.pip?.formato ?? "arredondado",
                },
              })
            }
          />

          <div className="linha">
            <label>Formato</label>
            <div style={{ flex: 1 }}>
              <Opcoes
                colunas={3}
                valores={[
                  ["arredondado", "Arredondado"],
                  ["circulo", "Círculo"],
                  ["reto", "Reto"],
                ]}
                valor={cena.pip?.formato ?? "arredondado"}
                aoMudar={(v) =>
                  aoMudar(cena.id, {
                    pip: {
                      canto: cena.pip?.canto ?? "inferior_direito",
                      escala: cena.pip?.escala ?? 0.26,
                      formato: v,
                    },
                  })
                }
              />
            </div>
          </div>
        </Grupo>
      )}

      <Grupo titulo="Entrada" icone={<Sparkles size={13} className="lucide" />}>
        <Opcoes
          colunas={3}
          valores={TRANSICOES}
          valor={cena.entrada.tipo}
          aoMudar={(v) =>
            aoMudar(cena.id, {
              entrada: (v === "corte"
                ? { tipo: "corte" }
                : v === "deslize"
                  ? { tipo: v, duracao: duracaoEntrada, direcao: "dir" }
                  : { tipo: v, duracao: duracaoEntrada }) as Entrada,
            })
          }
        />
        {cena.entrada.tipo !== "corte" && (
          <div style={{ marginTop: 9 }}>
            <Deslizante
              rotulo="Duração"
              valor={duracaoEntrada}
              min={0.1}
              max={2}
              passo={0.05}
              sufixo="s"
              aoMudar={(v) => mudarEntrada({ duracao: v })}
            />
          </div>
        )}
        <div style={{ marginTop: 12, display: "grid", gap: 5 }}>
          <button
            className="opcao"
            onClick={() => aoEntradaEmTodos({ tipo: "corte" })}
            title="todos os blocos passam a emendar sem transição nenhuma"
          >
            <Scissors size={13} className="lucide" />
            Tudo corte seco
          </button>
          <button
            className="opcao"
            onClick={() => aoEntradaEmTodos(cena.entrada)}
            title="usa a entrada deste bloco em todos os outros"
          >
            Aplicar esta entrada a todos
          </button>
        </div>

        {cena.entrada.tipo === "deslize" && (
          <div style={{ marginTop: 6 }}>
            <Opcoes
              valores={[
                ["esq", "← Esquerda"],
                ["dir", "Direita →"],
                ["cima", "↑ Cima"],
                ["baixo", "↓ Baixo"],
              ]}
              valor={cena.entrada.direcao}
              aoMudar={(v) => mudarEntrada({ direcao: v } as Partial<Entrada>)}
            />
          </div>
        )}
      </Grupo>

      <Grupo titulo="Zoom / foco" icone={<ZoomIn size={13} className="lucide" />} aberto={!!cena.foco}>
        {cena.foco ? (
          <>
            <Deslizante
              rotulo="Aproximação"
              valor={cena.foco.zoom}
              min={1}
              max={3}
              passo={0.05}
              sufixo="x"
              aoMudar={(v) => aoMudar(cena.id, { foco: { ...cena.foco!, zoom: v } })}
            />
            <Deslizante
              rotulo="Horizontal"
              valor={cena.foco.x}
              min={0}
              max={1}
              aoMudar={(v) => aoMudar(cena.id, { foco: { ...cena.foco!, x: v } })}
            />
            <Deslizante
              rotulo="Vertical"
              valor={cena.foco.y}
              min={0}
              max={1}
              aoMudar={(v) => aoMudar(cena.id, { foco: { ...cena.foco!, y: v } })}
            />
            <button
              className="btn sutil"
              style={{ width: "100%", marginTop: 4 }}
              onClick={() => aoMudar(cena.id, { foco: null })}
            >
              Remover zoom
            </button>
          </>
        ) : (
          <button
            className="opcao"
            style={{ width: "100%" }}
            onClick={() =>
              aoMudar(cena.id, { foco: { x: 0.5, y: 0.5, zoom: 1.4, suavidade: 0.8 } })
            }
          >
            + Adicionar zoom
          </button>
        )}
      </Grupo>

      <PainelMovimento
        animacoes={cena.animacoes}
        presetAtual={cena.preset_animacao}
        duracao={cena.duracao}
        aoMudar={(m) => aoMudar(cena.id, m)}
      />

      <PainelCor
        ajustes={cena.ajustes}
        mesclagem={cena.mesclagem}
        aoMudar={(m) => aoMudar(cena.id, m)}
      />

      <PainelMascara mascara={cena.mascara} aoMudar={(m) => aoMudar(cena.id, m)} />

      <Grupo
        titulo="Áudio deste bloco"
        icone={
          (cena.volume ?? 1) === 0 ? (
            <VolumeX size={13} className="lucide" />
          ) : (
            <Volume2 size={13} className="lucide" />
          )
        }
        aberto={(cena.volume ?? 1) !== 1}
      >
        <Deslizante
          rotulo="Volume"
          valor={cena.volume ?? 1}
          min={0}
          max={2}
          passo={0.01}
          aoMudar={(v) => aoMudar(cena.id, { volume: v })}
        />
        <div className="linha">
          <label>Silêncio</label>
          <button
            className={`opcao ${(cena.volume ?? 1) === 0 ? "ativa" : ""}`}
            style={{ flex: 1 }}
            onClick={() => aoMudar(cena.id, { volume: (cena.volume ?? 1) === 0 ? 1 : 0 })}
          >
            {(cena.volume ?? 1) === 0 ? (
              <VolumeX size={13} className="lucide" />
            ) : (
              <Volume2 size={13} className="lucide" />
            )}
            {(cena.volume ?? 1) === 0 ? "mudo" : "com som"}
          </button>
        </div>
        <Dica>Só o som deste bloco. Acima de 1 amplifica — cuidado pra não estourar.</Dica>
      </Grupo>

      <Grupo
        titulo="Congelar imagem"
        icone={<Snowflake size={13} className="lucide" />}
        aberto={typeof cena.congelar === "number"}
      >
        {typeof cena.congelar === "number" ? (
          <>
            <Deslizante
              rotulo="Congela em"
              valor={cena.congelar}
              min={0}
              max={Math.max(0.1, cena.duracao)}
              passo={0.05}
              casas={2}
              sufixo="s"
              aoMudar={(v) => aoMudar(cena.id, { congelar: v })}
            />
            <Dica>
              A imagem para nesse instante e fica ali até o fim do bloco. O áudio continua
              correndo normal.
            </Dica>
            <button
              className="btn sutil cheio"
              style={{ marginTop: 6 }}
              onClick={() => aoMudar(cena.id, { congelar: null })}
            >
              Descongelar
            </button>
          </>
        ) : (
          <button
            className="opcao cheio"
            onClick={() => aoMudar(cena.id, { congelar: 0 })}
          >
            <Snowflake size={13} className="lucide" />
            Congelar a imagem
          </button>
        )}
      </Grupo>

      <Grupo titulo="Outros" icone={<Gauge size={13} className="lucide" />} aberto={false}>
        <Deslizante
          rotulo="Velocidade"
          valor={cena.velocidade ?? 1}
          min={0.5}
          max={2.5}
          passo={0.05}
          sufixo="x"
          aoMudar={(v) => aoMudar(cena.id, { velocidade: v })}
        />
        <Texto
          rotulo="Anotação"
          valor={cena.nota ?? ""}
          aoMudar={(v) => aoMudar(cena.id, { nota: v })}
        />
        <button
          className="btn sutil cheio"
          style={{ marginTop: 8, color: "var(--perigo)" }}
          onClick={() => aoApagar(cena.id)}
          disabled={roteiro.cenas.length <= 1}
        >
          <Trash2 size={13} className="lucide" />
          Apagar este bloco
        </button>
      </Grupo>
    </>
  );
};

export const PainelBloco = React.memo(PainelBlocoInterno);
PainelBloco.displayName = "PainelBloco";
