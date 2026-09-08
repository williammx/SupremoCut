/**
 * SupremoCut — Movimento e cor
 *
 * Dois painéis que servem tanto a um bloco de vídeo quanto a uma imagem, porque
 * os dois usam o mesmo motor. "Deslizar da direita" significa a mesma coisa nos
 * dois lugares, e o usuário aprende uma vez só.
 *
 * A regra de ouro da tela: quem escolhe um preset NUNCA vê a palavra "chave",
 * "keyframe" ou "curva". Quem quiser mexer no detalhe abre a lista de pontos —
 * mas ninguém é obrigado a passar por ali pra ter movimento no vídeo.
 */

import React, { useState } from "react";
import {
  ArrowDownToLine,
  Blend,
  Crop,
  LogIn,
  LogOut,
  Move,
  Palette,
  RotateCcw,
  Sparkles,
  Sparkle,
  X,
} from "lucide-react";
import type { Animacao, Ajustes, Mascara, Mesclagem } from "../../src/tipos";
import { AJUSTES_NEUTROS, MASCARA_PADRAO } from "../../src/tipos";
import {
  aplicarPreset,
  PRESETS,
  PRESET_POR_ID,
  ROTULO_GRUPO,
  ROTULO_MESCLAGEM,
  ROTULO_PROPRIEDADE,
  temAjuste,
} from "../../src/animacao";
import { Deslizante, Dica, Grupo, Opcoes, Subtitulo } from "./controles";

const GRUPOS = ["entrada", "movimento", "enfase", "saida"] as const;

/** Um ícone por família de movimento — o olho separa antes de ler. */
const ICONE_GRUPO: Record<(typeof GRUPOS)[number], React.ReactNode> = {
  entrada: <LogIn size={12} className="lucide" />,
  movimento: <Move size={12} className="lucide" />,
  enfase: <Sparkle size={12} className="lucide" />,
  saida: <LogOut size={12} className="lucide" />,
};

// ---------------------------------------------------------------------------

export const PainelMovimento: React.FC<{
  animacoes: Animacao[] | undefined;
  presetAtual: string | null | undefined;
  duracao: number;
  aoMudar: (m: { animacoes?: Animacao[]; preset_animacao?: string | null }) => void;
}> = ({ animacoes, presetAtual, duracao, aoMudar }) => {
  const [detalhe, setDetalhe] = useState(false);
  const tem = (animacoes?.length ?? 0) > 0;

  const escolher = (id: string) => {
    if (presetAtual === id) {
      aoMudar({ animacoes: [], preset_animacao: null });
      return;
    }
    aoMudar({ animacoes: aplicarPreset(id, duracao), preset_animacao: id });
  };

  return (
    <Grupo
      titulo="Movimento"
      icone={<Sparkles size={13} className="lucide" />}
      aberto={tem}
    >
      <Dica>Escolha um jeito de se mexer. Clicar no que já está escolhido desliga.</Dica>

      {GRUPOS.map((g) => {
        const doGrupo = PRESETS.filter((p) => p.grupo === g);
        return (
          <div key={g} style={{ marginBottom: 12 }}>
            <div
              className="rotulo-mini"
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}
            >
              {ICONE_GRUPO[g]}
              {ROTULO_GRUPO[g]}
            </div>
            <div className="opcoes">
              {doGrupo.map((p) => (
                <button
                  key={p.id}
                  className={`opcao ${presetAtual === p.id ? "ativa" : ""}`}
                  onClick={() => escolher(p.id)}
                  title={p.descricao}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {presetAtual && PRESET_POR_ID.has(presetAtual) ? (
        <Dica>{PRESET_POR_ID.get(presetAtual)!.descricao}</Dica>
      ) : null}

      {tem ? (
        <>
          <button
            className="opcao cheio"
            style={{ marginTop: 10 }}
            onClick={() => {
              // Regerar com a duração de agora: um preset que termina no fim do
              // bloco fica curto ou sobra quando o bloco é aparado depois.
              if (presetAtual) aoMudar({ animacoes: aplicarPreset(presetAtual, duracao) });
            }}
            disabled={!presetAtual}
            title="refaz a animação usando o tamanho atual do bloco"
          >
            <RotateCcw size={13} className="lucide" />
            Reajustar ao tamanho atual
          </button>

          <button
            className="btn sutil cheio"
            style={{ marginTop: 6 }}
            onClick={() => setDetalhe((v) => !v)}
          >
            {detalhe ? "esconder os pontos" : "ver os pontos do movimento"}
          </button>
        </>
      ) : null}

      {detalhe && tem ? (
        <div style={{ marginTop: 8 }}>
          {animacoes!.map((a, ia) => (
            <div className="cartao" key={`${a.propriedade}-${ia}`}>
              <div className="cartao-topo">
                <strong>{ROTULO_PROPRIEDADE[a.propriedade] ?? a.propriedade}</strong>
                <button
                  className="apagar"
                  title="remover esta parte do movimento"
                  onClick={() => {
                    const nova = animacoes!.filter((_, j) => j !== ia);
                    // Mexeu na mão: o preset deixa de descrever o que está aqui.
                    aoMudar({ animacoes: nova, preset_animacao: null });
                  }}
                  aria-label="remover"
                >
                  <X size={14} className="lucide" />
                </button>
              </div>
              {a.chaves.map((c, ic) => (
                <div className="linha" key={ic}>
                  <label style={{ fontVariantNumeric: "tabular-nums" }}>
                    {c.t.toFixed(2)}s
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={c.valor}
                    onChange={(e) => {
                      const nova = animacoes!.map((x, j) =>
                        j !== ia
                          ? x
                          : {
                              ...x,
                              chaves: x.chaves.map((y, k) =>
                                k !== ic ? y : { ...y, valor: Number(e.target.value) },
                              ),
                            },
                      );
                      aoMudar({ animacoes: nova, preset_animacao: null });
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
          <Dica>
            O tempo é contado do começo deste pedaço. Aproximação 1 = tamanho normal;
            transparência 1 = totalmente visível; posição é fração da tela.
          </Dica>
        </div>
      ) : null}
    </Grupo>
  );
};

// ---------------------------------------------------------------------------

/**
 * Recorte de região.
 *
 * O leigo não precisa saber o que é "máscara" — ele precisa saber que dá pra
 * borrar um rosto, apagar a marca de outro vendedor, ou escurecer tudo menos o
 * produto. Os rótulos falam disso; a palavra técnica não aparece em lugar
 * nenhum da tela.
 */
export const PainelMascara: React.FC<{
  mascara: Mascara | null | undefined;
  aoMudar: (m: { mascara?: Mascara | null }) => void;
}> = ({ mascara, aoMudar }) => {
  const tem = !!mascara;
  const m = mascara ?? MASCARA_PADRAO;
  const set = (troca: Partial<Mascara>) => aoMudar({ mascara: { ...m, ...troca } });

  return (
    <Grupo titulo="Recorte" icone={<Crop size={13} className="lucide" />} aberto={tem}>
      {!tem ? (
        <>
          <Dica>
            Escolha um pedaço do quadro e faça uma coisa só com ele: borrar um rosto, apagar
            a marca de outro vendedor, ou escurecer tudo menos o produto.
          </Dica>
          <button
            className="opcao cheio"
            onClick={() => aoMudar({ mascara: { ...MASCARA_PADRAO } })}
          >
            <Crop size={13} className="lucide" />
            Adicionar recorte
          </button>
        </>
      ) : (
        <>
          <Subtitulo>O que fazer</Subtitulo>
          <Opcoes
            colunas={3}
            valores={[
              ["desfocar", "Borrar"],
              ["escurecer", "Escurecer"],
              ["recortar", "Só isso"],
            ]}
            valor={m.efeito}
            aoMudar={(v) => set({ efeito: v as Mascara["efeito"] })}
          />
          <Dica>
            {m.efeito === "desfocar" && "Borra a área escolhida. Serve pra rosto, placa, marca."}
            {m.efeito === "escurecer" && "Escurece a área. Com o inverso ligado, vira holofote no produto."}
            {m.efeito === "recortar" && "Só a área escolhida aparece; o resto some."}
          </Dica>

          <Subtitulo>Formato</Subtitulo>
          <Opcoes
            colunas={3}
            valores={[
              ["elipse", "Oval"],
              ["circulo", "Círculo"],
              ["retangulo", "Retângulo"],
            ]}
            valor={m.forma}
            aoMudar={(v) => set({ forma: v as Mascara["forma"] })}
          />

          <Subtitulo>Onde e quão grande</Subtitulo>
          <Deslizante
            rotulo="Esquerda ↔"
            valor={m.x}
            min={0}
            max={1}
            aoMudar={(v) => set({ x: v })}
          />
          <Deslizante rotulo="Topo ↕" valor={m.y} min={0} max={1} aoMudar={(v) => set({ y: v })} />
          <Deslizante
            rotulo="Largura"
            valor={m.largura}
            min={0.02}
            max={1.5}
            aoMudar={(v) => set({ largura: v })}
          />
          {m.forma !== "circulo" && (
            <Deslizante
              rotulo="Altura"
              valor={m.altura}
              min={0.02}
              max={1.5}
              aoMudar={(v) => set({ altura: v })}
            />
          )}
          <Deslizante
            rotulo="Giro"
            valor={m.rotacao}
            min={-90}
            max={90}
            passo={1}
            casas={0}
            sufixo="°"
            aoMudar={(v) => set({ rotacao: v })}
          />

          <Subtitulo>Acabamento</Subtitulo>
          <Deslizante
            rotulo="Borda macia"
            valor={m.pena}
            min={0}
            max={120}
            passo={1}
            casas={0}
            sufixo="px"
            aoMudar={(v) => set({ pena: v })}
          />
          {m.efeito !== "recortar" && (
            <Deslizante
              rotulo={m.efeito === "desfocar" ? "Quanto borra" : "Quanto escurece"}
              valor={m.forca}
              min={m.efeito === "desfocar" ? 0 : 0}
              max={m.efeito === "desfocar" ? 60 : 1}
              passo={m.efeito === "desfocar" ? 1 : 0.01}
              casas={m.efeito === "desfocar" ? 0 : 2}
              aoMudar={(v) => set({ forca: v })}
            />
          )}
          <div className="linha">
            <label>Inverter</label>
            <button
              className={`chave ${m.inverter ? "ativa" : ""}`}
              onClick={() => set({ inverter: !m.inverter })}
              role="switch"
              aria-checked={m.inverter}
              aria-label="Inverter o recorte"
            />
          </div>
          <Dica>
            Desligado, o efeito vale <strong>dentro</strong> da forma. Ligado, vale{" "}
            <strong>fora</strong> — é assim que se escurece tudo menos o produto.
          </Dica>

          <button
            className="btn sutil cheio"
            style={{ marginTop: 10 }}
            onClick={() => aoMudar({ mascara: null })}
          >
            <X size={13} className="lucide" />
            Tirar o recorte
          </button>
        </>
      )}
    </Grupo>
  );
};

export const PainelCor: React.FC<{
  ajustes: Ajustes | null | undefined;
  mesclagem?: Mesclagem | null;
  aoMudar: (m: { ajustes?: Ajustes | null; mesclagem?: Mesclagem | null }) => void;
}> = ({ ajustes, mesclagem, aoMudar }) => {
  const a = ajustes ?? AJUSTES_NEUTROS;
  const mexido = temAjuste(a) || (mesclagem != null && mesclagem !== "normal");

  const set = (m: Partial<Ajustes>) => aoMudar({ ajustes: { ...a, ...m } });

  return (
    <Grupo titulo="Cor e imagem" icone={<Palette size={13} className="lucide" />} aberto={mexido}>
      <Deslizante
        rotulo="Brilho"
        valor={a.brilho}
        min={-0.8}
        max={0.8}
        passo={0.01}
        aoMudar={(v) => set({ brilho: v })}
      />
      <Deslizante
        rotulo="Contraste"
        valor={a.contraste}
        min={-0.8}
        max={1}
        passo={0.01}
        aoMudar={(v) => set({ contraste: v })}
      />
      <Deslizante
        rotulo="Saturação"
        valor={a.saturacao}
        min={-1}
        max={1}
        passo={0.01}
        aoMudar={(v) => set({ saturacao: v })}
      />
      <Deslizante
        rotulo="Temperatura"
        valor={a.temperatura}
        min={-1}
        max={1}
        passo={0.01}
        aoMudar={(v) => set({ temperatura: v })}
      />
      <Deslizante
        rotulo="Desfoque"
        valor={a.desfoque}
        min={0}
        max={24}
        passo={0.5}
        casas={1}
        sufixo="px"
        aoMudar={(v) => set({ desfoque: v })}
      />
      <Deslizante
        rotulo="Vinheta"
        valor={a.vinheta}
        min={0}
        max={1}
        passo={0.01}
        aoMudar={(v) => set({ vinheta: v })}
      />

      <Dica>
        Temperatura pra <strong>esquerda</strong> esfria (azul), pra <strong>direita</strong>{" "}
        esquenta (laranja). Saturação no mínimo deixa preto e branco.
      </Dica>

      {mesclagem !== undefined ? (
        <>
          <Subtitulo>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Blend size={12} className="lucide" />
              Mistura com o fundo
            </span>
          </Subtitulo>
          <Opcoes
            valores={
              (["normal", "multiply", "screen", "overlay", "soft-light"] as Mesclagem[]).map(
                (m) => [m, ROTULO_MESCLAGEM[m]] as [Mesclagem, string],
              )
            }
            valor={mesclagem ?? "normal"}
            aoMudar={(v) => aoMudar({ mesclagem: v === "normal" ? null : v })}
          />
        </>
      ) : null}

      <button
        className="btn sutil cheio"
        style={{ marginTop: 12 }}
        disabled={!mexido}
        onClick={() => aoMudar({ ajustes: null, mesclagem: null })}
      >
        <ArrowDownToLine size={13} className="lucide" />
        Voltar ao natural
      </button>
    </Grupo>
  );
};
