/**
 * SupremoCut — Imagens e logos
 *
 * Logo do cliente, print de avaliação, selo de oferta, seta apontando o
 * produto. Tudo o que entra por cima do vídeo e não é texto.
 *
 * A imagem NÃO pertence a nenhum bloco: ela flutua sobre a montagem, com tempo
 * próprio no relógio do vídeo final — igual aos textos. Por isso cortar um
 * bloco não a leva junto, e isso é de propósito: um logo de canto tem que ficar
 * onde está enquanto a edição embaixo dele muda.
 */

import React, { useEffect, useRef, useState } from "react";
import type { Imagem, Roteiro } from "../../src/tipos";
import { api } from "../api";
import {
  AlertTriangle,
  ImageIcon,
  ImagePlus,
  Loader2,
  Settings2,
  Trash2,
} from "lucide-react";
import { Alerta, Deslizante, Dica, Grupo, Numero, Subtitulo, Vazio } from "./controles";
import { PainelMovimento } from "./PainelMovimento";
import { relogio } from "./Timeline";

/** Limite de tamanho por arquivo. Acima disso o base64 fica pesado à toa. */
const MB_MAXIMO = 25;

const novoId = () => `img_${Math.random().toString(36).slice(2, 9)}`;

type Props = {
  roteiro: Roteiro;
  tempoAtual: number;
  aoMudarRoteiro: (r: Roteiro) => void;
  aoIrPara: (s: number) => void;
};

const PainelImagensInterno: React.FC<Props> = ({
  roteiro,
  tempoAtual,
  aoMudarRoteiro,
  aoIrPara,
}) => {
  const [disponiveis, setDisponiveis] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const imagens = roteiro.imagens ?? [];
  const total = roteiro.cenas.reduce((s, c) => s + c.duracao, 0);

  const recarregar = () => {
    api
      .imagens(roteiro.projeto)
      .then(setDisponiveis)
      .catch(() => setDisponiveis([]));
  };

  useEffect(recarregar, [roteiro.projeto]);

  const mudar = (id: string, m: Partial<Imagem>) =>
    aoMudarRoteiro({
      ...roteiro,
      imagens: imagens.map((im) => (im.id === id ? { ...im, ...m } : im)),
    });

  const adicionar = (arquivo: string) => {
    const nova: Imagem = {
      id: novoId(),
      arquivo,
      // Entra onde a agulha está: é o gesto que o usuário espera de "adicionar".
      inicio: Number(Math.max(0, tempoAtual).toFixed(3)),
      duracao: Math.min(4, Math.max(1, total - tempoAtual)),
      x: 0.06,
      y: 0.08,
      largura: 0.26,
      opacidade: 1,
      rotacao: 0,
      raio: 0,
      sombra: true,
    };
    aoMudarRoteiro({ ...roteiro, imagens: [...imagens, nova] });
    setAberta(nova.id);
  };

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    setAviso(null);
    setEnviando(true);
    let ultima: string | null = null;

    try {
      for (const f of Array.from(arquivos)) {
        if (f.size > MB_MAXIMO * 1048576) {
          setAviso(`"${f.name}" tem mais de ${MB_MAXIMO} MB e foi pulada.`);
          continue;
        }
        const dados = await new Promise<string>((resolve, reject) => {
          const leitor = new FileReader();
          leitor.onload = () => resolve(String(leitor.result));
          leitor.onerror = () => reject(new Error("não deu pra ler o arquivo"));
          leitor.readAsDataURL(f);
        });
        const r = await api.enviarImagem(roteiro.projeto, f.name, dados);
        ultima = r.arquivo;
      }
      recarregar();
      // Já entra no vídeo: enviar e não ver nada acontecer confunde.
      if (ultima) adicionar(ultima);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <>
      <Grupo titulo="Adicionar imagem" icone={<ImagePlus size={13} className="lucide" />} fixo>
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => enviar(e.target.files)}
        />
        <button
          className="btn cheio"
          onClick={() => entrada.current?.click()}
          disabled={enviando}
        >
          {enviando ? <Loader2 size={14} className="lucide" style={{ animation: "gira 1.1s linear infinite" }} /> : <ImagePlus size={14} className="lucide" />}
          {enviando ? "enviando…" : "Escolher do computador"}
        </button>
        <p className="dica" style={{ margin: "9px 0 0" }}>
          PNG com fundo transparente é o melhor para logo e selo. Ela entra onde a agulha
          está agora.
        </p>
        {aviso ? (
          <div style={{ marginTop: 10 }}>
            <Alerta icone={<AlertTriangle size={14} className="lucide" />}>{aviso}</Alerta>
          </div>
        ) : null}

        {disponiveis.length > 0 ? (
          <>
            <Subtitulo>Já neste projeto</Subtitulo>
            <div className="grade-imagens">
              {disponiveis.map((a) => (
                <button
                  key={a}
                  className="mini-imagem"
                  onClick={() => adicionar(a)}
                  title={`usar ${a}`}
                >
                  <img src={`/${roteiro.projeto}/imagens/${a}`} alt={a} />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </Grupo>

      {imagens.length === 0 ? (
        <Vazio icone={<ImageIcon size={28} className="lucide" />}>
          Nenhuma imagem no vídeo ainda.
        </Vazio>
      ) : (
        imagens.map((im) => {
          const ativa = aberta === im.id;
          return (
            <div className="cartao" key={im.id}>
              <div className="cartao-topo">
                <button
                  className="palavra-tempo"
                  onClick={() => aoIrPara(im.inicio)}
                  title="pular pra onde ela entra"
                >
                  {relogio(im.inicio)}
                </button>
                <strong
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                  onClick={() => setAberta(ativa ? null : im.id)}
                >
                  {im.arquivo}
                </strong>
                <button
                  className="apagar"
                  title="tirar esta imagem do vídeo"
                  aria-label="remover imagem"
                  onClick={() =>
                    aoMudarRoteiro({
                      ...roteiro,
                      imagens: imagens.filter((o) => o.id !== im.id),
                    })
                  }
                >
                  <Trash2 size={14} className="lucide" />
                </button>
              </div>

              {!ativa ? (
                <button className="btn sutil cheio" onClick={() => setAberta(im.id)}>
                  <Settings2 size={13} className="lucide" />
                  ajustar
                </button>
              ) : (
                <>
                  <Numero
                    rotulo="Entra em"
                    valor={im.inicio}
                    min={0}
                    aoMudar={(v) => mudar(im.id, { inicio: Number(Math.max(0, v).toFixed(3)) })}
                  />
                  <Numero
                    rotulo="Dura"
                    valor={im.duracao}
                    min={0.1}
                    aoMudar={(v) => mudar(im.id, { duracao: Number(Math.max(0.1, v).toFixed(3)) })}
                  />
                  <Deslizante
                    rotulo="Esquerda"
                    valor={im.x}
                    min={-0.3}
                    max={1}
                    aoMudar={(v) => mudar(im.id, { x: v })}
                  />
                  <Deslizante
                    rotulo="Topo"
                    valor={im.y}
                    min={-0.3}
                    max={1}
                    aoMudar={(v) => mudar(im.id, { y: v })}
                  />
                  <Deslizante
                    rotulo="Tamanho"
                    valor={im.largura}
                    min={0.03}
                    max={1.4}
                    aoMudar={(v) => mudar(im.id, { largura: v })}
                  />
                  <Deslizante
                    rotulo="Opacidade"
                    valor={im.opacidade}
                    min={0}
                    max={1}
                    aoMudar={(v) => mudar(im.id, { opacidade: v })}
                  />
                  <Deslizante
                    rotulo="Giro"
                    valor={im.rotacao}
                    min={-180}
                    max={180}
                    passo={1}
                    casas={0}
                    sufixo="°"
                    aoMudar={(v) => mudar(im.id, { rotacao: v })}
                  />
                  <Deslizante
                    rotulo="Cantos"
                    valor={im.raio}
                    min={0}
                    max={120}
                    passo={1}
                    casas={0}
                    sufixo="px"
                    aoMudar={(v) => mudar(im.id, { raio: v })}
                  />
                  <div className="linha">
                    <label>Sombra</label>
                    <button
                      className={`opcao ${im.sombra ? "ativa" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => mudar(im.id, { sombra: !im.sombra })}
                    >
                      {im.sombra ? "com sombra" : "sem sombra"}
                    </button>
                  </div>

                  <PainelMovimento
                    animacoes={im.animacoes}
                    presetAtual={im.preset_animacao}
                    duracao={im.duracao}
                    aoMudar={(m) => mudar(im.id, m)}
                  />
                </>
              )}
            </div>
          );
        })
      )}
    </>
  );
};

export const PainelImagens = React.memo(PainelImagensInterno);
PainelImagens.displayName = "PainelImagens";
