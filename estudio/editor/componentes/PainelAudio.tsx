import React, { useEffect, useState } from "react";
import type { ClipeAudio, Musica, Roteiro } from "../../src/tipos";
import { MUSICA_PADRAO } from "../../src/musica";
import { api } from "../api";
import {
  AudioLines,
  AudioWaveform,
  Link2,
  Music,
  Unlink,
  Volume2,
} from "lucide-react";
import { Deslizante, Dica, Grupo, Numero, Vazio } from "./controles";

type Props = {
  roteiro: Roteiro;
  aoMudar: (r: Roteiro) => void;
  clipeSelecionado: string | null;
  aoMudarClipe: (id: string, m: Partial<ClipeAudio>, soltar?: boolean) => void;
};

const PainelAudioInterno: React.FC<Props> = ({
  roteiro,
  aoMudar,
  clipeSelecionado,
  aoMudarClipe,
}) => {
  const clipe = (roteiro.trilha_audio ?? []).find((c) => c.id === clipeSelecionado);
  const [musicas, setMusicas] = useState<{ nome: string; mb: number }[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = () =>
    api
      .musicas()
      .then(setMusicas)
      .catch((e) => setErro(e.message));

  useEffect(() => {
    carregar();
  }, []);

  const m = roteiro.musica ?? null;

  const mudarMusica = (mudanca: Partial<Musica>) => {
    if (!m) return;
    aoMudar({ ...roteiro, musica: { ...m, ...mudanca } });
  };

  const escolher = (arquivo: string) =>
    aoMudar({ ...roteiro, musica: { arquivo, ...MUSICA_PADRAO } });

  return (
    <>
      {clipe ? (
        <Grupo titulo="Clipe de áudio selecionado" icone={<AudioLines size={13} className="lucide" />}>
          <div className="linha">
            <label>Vínculo</label>
            <button
              className={`opcao ${clipe.vinculado_a ? "ativa" : ""}`}
              style={{ flex: 1 }}
              onClick={() =>
                // religar não é trivial: o clipe voltaria de onde saiu.
                // Por isso só oferecemos SOLTAR, que é a operação segura.
                aoMudarClipe(clipe.id, {}, true)
              }
              disabled={!clipe.vinculado_a}
            >
              {clipe.vinculado_a ? <Link2 size={13} className="lucide" /> : <Unlink size={13} className="lucide" />}
            {clipe.vinculado_a ? "preso à cena — soltar" : "solto do vídeo"}
            </button>
          </div>
          <Dica>
            {clipe.vinculado_a
              ? "Segue os cortes do vídeo. Arrastar o clipe solta o vínculo."
              : "Anda sozinho: cortar o vídeo não move mais este áudio."}
          </Dica>

          <Numero
            rotulo="Entra em"
            valor={clipe.inicio}
            min={0}
            aoMudar={(v) => aoMudarClipe(clipe.id, { inicio: Math.max(0, v) })}
          />
          <Numero
            rotulo="Dura"
            valor={clipe.duracao}
            min={0.1}
            aoMudar={(v) => aoMudarClipe(clipe.id, { duracao: Math.max(0.1, v) })}
          />
          {/*
            O `false` no fim destes três é o que impede uma perda silenciosa:
            mexer num clipe SOLTA o vínculo com a cena por padrão, e faz sentido
            para posição — arrastar o som pra fora do bloco é justamente dizer
            "ele não segue mais o vídeo". Mas volume e fades não têm nada a ver
            com posição. Abaixar o volume desprendia o áudio do vídeo sem avisar,
            e o próximo corte já deixava a fala em cima da imagem errada.
          */}
          <Deslizante
            rotulo="Volume"
            valor={clipe.volume ?? 1}
            min={0}
            max={2}
            passo={0.01}
            aoMudar={(v) => aoMudarClipe(clipe.id, { volume: v }, false)}
          />
          <Deslizante
            rotulo="Sobe em"
            valor={clipe.fade_entrada ?? 0}
            min={0}
            max={3}
            passo={0.05}
            casas={2}
            sufixo="s"
            aoMudar={(v) => aoMudarClipe(clipe.id, { fade_entrada: v }, false)}
          />
          <Deslizante
            rotulo="Desce em"
            valor={clipe.fade_saida ?? 0}
            min={0}
            max={3}
            passo={0.05}
            casas={2}
            sufixo="s"
            aoMudar={(v) => aoMudarClipe(clipe.id, { fade_saida: v }, false)}
          />
        </Grupo>
      ) : (
        <Grupo titulo="Trilha de áudio" icone={<AudioLines size={13} className="lucide" />} fixo>
          <p style={{ color: "var(--texto-fraco)", fontSize: 12, lineHeight: 1.6 }}>
            {(roteiro.trilha_audio?.length ?? 0)} clipe(s) na pista verde, embaixo do
            vídeo. Clique num deles pra ajustar volume, posição e fades.
            <br />
            <br />
            Arrastar o meio desliza no tempo; arrastar a ponta apara. Qualquer um dos
            dois solta o vínculo com a cena.
          </p>
        </Grupo>
      )}

      <Grupo titulo="Música de fundo" icone={<Music size={13} className="lucide" />}>
        <p style={{ color: "var(--texto-fraco)", fontSize: 11.5, marginBottom: 9, lineHeight: 1.5 }}>
          Coloque seus arquivos em <code>assets\musica</code> e eles aparecem aqui. A música
          abaixa sozinha quando você fala e volta nas pausas.
        </p>

        {erro && <p style={{ color: "var(--perigo)", fontSize: 12 }}>{erro}</p>}

        {musicas.length === 0 ? (
          <Vazio icone={<Music size={26} className="lucide" />}>
            Nenhuma música na pasta ainda.
            <div>
              <button className="btn sutil" style={{ marginTop: 10 }} onClick={carregar}>
                procurar de novo
              </button>
            </div>
          </Vazio>
        ) : (
          <>
            <div className="linha">
              <label>Faixa</label>
              <select
                value={m?.arquivo ?? ""}
                onChange={(e) =>
                  e.target.value
                    ? escolher(e.target.value)
                    : aoMudar({ ...roteiro, musica: null })
                }
              >
                <option value="">— sem música —</option>
                {musicas.map((x) => (
                  <option key={x.nome} value={x.nome}>
                    {x.nome} ({x.mb} MB)
                  </option>
                ))}
              </select>
            </div>
            <button className="btn sutil cheio" onClick={carregar}>
              atualizar lista
            </button>
          </>
        )}
      </Grupo>

      {m && (
        <>
          <Grupo titulo="Volume" icone={<Volume2 size={13} className="lucide" />}>
            <Deslizante
              rotulo="Música"
              valor={m.volume}
              min={0}
              max={1}
              passo={0.01}
              aoMudar={(v) => mudarMusica({ volume: v })}
            />
            <Deslizante
              rotulo="Abaixa pra"
              valor={m.abaixar}
              min={0}
              max={1}
              passo={0.01}
              aoMudar={(v) => mudarMusica({ abaixar: v })}
            />
            <p style={{ color: "var(--texto-fraco)", fontSize: 11, lineHeight: 1.5 }}>
              Quando você fala, a música cai pra{" "}
              <b style={{ color: "var(--texto)" }}>{Math.round(m.abaixar * 100)}%</b> do volume
              dela. Mais baixo = fala mais limpa.
            </p>
          </Grupo>

          <Grupo titulo="Entrada e saída" icone={<AudioWaveform size={13} className="lucide" />}>
            <Deslizante
              rotulo="Sobe em"
              valor={m.fade_entrada}
              min={0}
              max={8}
              passo={0.1}
              casas={1}
              sufixo="s"
              aoMudar={(v) => mudarMusica({ fade_entrada: v })}
            />
            <Deslizante
              rotulo="Desce em"
              valor={m.fade_saida}
              min={0}
              max={10}
              passo={0.1}
              casas={1}
              sufixo="s"
              aoMudar={(v) => mudarMusica({ fade_saida: v })}
            />
            <Numero
              rotulo="Começa em"
              valor={m.inicio}
              min={0}
              aoMudar={(v) => mudarMusica({ inicio: Math.max(0, v) })}
            />
          </Grupo>

          <button
            className="btn sutil"
            style={{ width: "100%", color: "#ff5c5c" }}
            onClick={() => aoMudar({ ...roteiro, musica: null })}
          >
            Remover a música
          </button>
        </>
      )}
    </>
  );
};

export const PainelAudio = React.memo(PainelAudioInterno);
PainelAudio.displayName = "PainelAudio";
