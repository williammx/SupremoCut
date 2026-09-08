/**
 * Painel de camadas.
 *
 * Substitui os painéis separados de Textos e Imagens. A diferença não é de
 * arrumação: antes um "lower third" era UM objeto que desenhava barra e dois
 * textos, e não havia onde clicar pra mexer só na barra. Aqui cada coisa na
 * tela é uma camada, e o painel edita a camada — ou VÁRIAS de uma vez, quando
 * mais de uma está selecionada.
 *
 * A EDIÇÃO EM LOTE
 *
 * Com duas camadas selecionadas, o painel mostra os campos que as duas têm em
 * comum e aplica a mudança nas duas. Um campo cujo valor difere entre elas
 * aparece vazio — mexer nele iguala as duas, o que é justamente o que se quer
 * quando se seleciona várias pra "deixar todas com o mesmo tamanho".
 */

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Plus,
  Square,
  Trash2,
  Type,
  Video as VideoIcon,
} from "lucide-react";
import type {
  Camada,
  CamadaForma,
  CamadaImagem,
  CamadaTexto,
  CamadaVideo,
  DegradeForma,
} from "../../src/camadas";
import { nomeDaCamada } from "../../src/camadas";
import type { Estilo } from "../../src/tipos";
import { Cor, Deslizante, Dica, Grupo, Interruptor, Numero, Vazio } from "./controles";
import { SeletorFonte, cadeiaDeFonte, familiaEscolhida } from "./PainelTextos";
import { TextoPintavel } from "./TextoPintavel";
import { remapear } from "../../src/trechos";

/** A opção "sem fonte própria" do seletor da camada. */
const HERDA = "— a do projeto —";
import { CaseSensitive } from "lucide-react";
import { api } from "../api";

type Props = {
  camadas: Camada[];
  estilo: Estilo;
  aoMudarEstilo: (e: Estilo) => void;
  selecao: string[];
  aoSelecionar: (ids: string[]) => void;
  aoMudar: (camadas: Camada[]) => void;
  tempoAtual: number;
  duracaoTotal: number;
  /** Arquivos disponíveis em <projeto>/imagens. */
  imagensDisponiveis: string[];
};

const ICONES: Record<Camada["tipo"], React.ReactNode> = {
  texto: <Type size={12} className="lucide" />,
  forma: <Square size={12} className="lucide" />,
  imagem: <ImageIcon size={12} className="lucide" />,
  video: <VideoIcon size={12} className="lucide" />,
};

/** Valor comum a todas as selecionadas, ou `undefined` quando divergem. */
function comum<T>(itens: Camada[], ler: (c: Camada) => T | undefined): T | undefined {
  const vals = itens.map(ler).filter((v) => v !== undefined);
  if (vals.length !== itens.length) return undefined;
  const primeiro = vals[0];
  return vals.every((v) => v === primeiro) ? primeiro : undefined;
}

export const PainelCamadas: React.FC<Props> = ({
  camadas,
  estilo,
  aoMudarEstilo,
  selecao,
  aoSelecionar,
  aoMudar,
  tempoAtual,
  duracaoTotal,
  imagensDisponiveis,
}) => {
  const escolhidas = camadas.filter((c) => selecao.includes(c.id));

  /** Aplica uma mudança em todas as selecionadas que aceitam aquele campo. */
  const mudar = (campos: Partial<Camada>) =>
    aoMudar(
      camadas.map((c) =>
        selecao.includes(c.id) ? ({ ...c, ...campos } as Camada) : c,
      ),
    );

  const novoId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const inserir = (novas: Camada[]) => {
    // entra no TOPO da pilha: o que você acabou de criar precisa estar visível,
    // e o topo é o único lugar onde isso é garantido
    aoMudar([...camadas, ...novas]);
    aoSelecionar(novas.map((n) => n.id));
  };

  const textoNovo = (extra: Partial<CamadaTexto> = {}): CamadaTexto => ({
    id: novoId("txt"),
    tipo: "texto",
    inicio: Number(tempoAtual.toFixed(2)),
    duracao: 4,
    texto: "Escreva aqui",
    x: 0.08,
    y: 0.72,
    largura: 0.84,
    tamanho: 62,
    peso: 800,
    cor: "#FFFFFF",
    alinhamento: "esquerda",
    caixa_alta: false,
    entrelinha: 1.02,
    contorno: 0,
    sombra: true,
    ...extra,
  });

  const formaNova = (extra: Partial<CamadaForma> = {}): CamadaForma => ({
    id: novoId("forma"),
    tipo: "forma",
    inicio: Number(tempoAtual.toFixed(2)),
    duracao: 4,
    x: 0.08,
    y: 0.7,
    largura: 0.36,
    altura: 0.006,
    cor: "#0FB5A6",
    raio: 999,
    ...extra,
  });

  /*
    Os atalhos.

    Cada um cria um ARRANJO de camadas já posicionadas — o que antes era um
    tipo composto. A diferença é que depois de criadas elas não têm mais
    vínculo: dá pra apagar a barra, mover só a segunda linha, trocar a cor de
    uma sem tocar na outra.
  */
  const atalhos: [string, string, () => void][] = [
    [
      "Lower third",
      "Barra + duas linhas de texto, como o do Reels.",
      () => {
        const y = 0.72;
        const t0 = Number(tempoAtual.toFixed(2));
        inserir([
          formaNova({ inicio: t0, y, entrada: { tipo: "abrir", duracao: 0.5 } }),
          textoNovo({
            inicio: t0,
            y: y + 0.017,
            texto: "Linha principal",
            tamanho: 62,
            peso: 800,
            entrelinha: 1.02,
            entrada: { tipo: "deslizar", duracao: 0.5 },
          }),
          textoNovo({
            inicio: t0,
            y: y + 0.13,
            texto: "linha de apoio",
            tamanho: 32,
            peso: 500,
            entrelinha: 1.15,
            opacidade: 0.82,
            entrada: { tipo: "deslizar", duracao: 0.5 },
          }),
        ]);
      },
    ],
    [
      "Título",
      "Texto grande centralizado. Bom pra abertura e pra fecho.",
      () =>
        inserir([
          textoNovo({
            texto: "TÍTULO",
            x: 0.1,
            y: 0.5,
            ancora: "centro",
            largura: 0.8,
            alinhamento: "centro",
            caixa_alta: true,
            entrelinha: 0,
            espacamento: -0.02,
            entrada: { tipo: "subir", duracao: 0.5 },
          }),
        ]),
    ],
    [
      "Tarja de cobertura",
      "Caixa opaca que tapa texto queimado no vídeo, com frase por cima.",
      () => {
        const t0 = Number(tempoAtual.toFixed(2));
        const y = 0.7;
        const alt = 0.13;
        inserir([
          formaNova({
            inicio: t0,
            duracao: 2,
            x: 0.02,
            y,
            largura: 0.96,
            altura: alt,
            cor: "#0B0B0D",
            raio: 10,
            // a cobertura não pisca nem esmaece: se sumir, não cobre
            entrada: { tipo: "nenhuma", duracao: 0 },
            saida: { tipo: "nenhuma", duracao: 0 },
          }),
          textoNovo({
            inicio: t0,
            duracao: 2,
            texto: "Texto da tarja",
            x: 0.02,
            y: y + alt / 2,
            ancora: "centro",
            largura: 0.96,
            tamanho: 46,
            alinhamento: "centro",
            sombra: false,
            entrelinha: 1.15,
            entrada: { tipo: "surgir", duracao: 0.15 },
            saida: { tipo: "sumir", duracao: 0.15 },
          }),
        ]);
      },
    ],
    [
      "Véu de leitura",
      "Sombra que sobe do rodapé até sumir. Escurece o fundo do texto sem tapar o vídeo.",
      () => {
        const t0 = Number(tempoAtual.toFixed(2));
        inserir([
          formaNova({
            inicio: t0,
            duracao: 4,
            x: 0,
            y: 0.58,
            largura: 1,
            altura: 0.42,
            cor: "#04241F",
            raio: 0,
            degrade: { sentido: "cima", opacidade: 0.8 },
            /*
              Entra e sai esmaecendo, não "abrindo".

              O `abrir` da barrinha varre a largura — num véu que ocupa a tela
              inteira isso vira uma cortina atravessando o quadro, que é
              exatamente o oposto de uma peça que existe pra não ser notada.
            */
            entrada: { tipo: "surgir", duracao: 0.4 },
            saida: { tipo: "sumir", duracao: 0.4 },
          }),
        ]);
      },
    ],
  ];

  const mover = (id: string, passo: number) => {
    const i = camadas.findIndex((c) => c.id === id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= camadas.length) return;
    const copia = [...camadas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    aoMudar(copia);
  };

  const apagar = () => {
    aoMudar(camadas.filter((c) => !selecao.includes(c.id)));
    aoSelecionar([]);
  };

  const duplicar = () => {
    const copias = escolhidas.map((c) => ({ ...c, id: novoId(c.tipo) }));
    aoMudar([...camadas, ...copias]);
    aoSelecionar(copias.map((c) => c.id));
  };

  const clicar = (e: React.MouseEvent, id: string) => {
    if (e.ctrlKey || e.metaKey) {
      aoSelecionar(
        selecao.includes(id) ? selecao.filter((s) => s !== id) : [...selecao, id],
      );
      return;
    }
    if (e.shiftKey && selecao.length) {
      // do último clicado até este, na ordem da pilha
      const ids = camadas.map((c) => c.id);
      const a = ids.indexOf(selecao[selecao.length - 1]);
      const b = ids.indexOf(id);
      const [de, ate] = a < b ? [a, b] : [b, a];
      aoSelecionar(ids.slice(de, ate + 1));
      return;
    }
    aoSelecionar([id]);
  };

  const soTexto = escolhidas.length > 0 && escolhidas.every((c) => c.tipo === "texto");
  const soForma = escolhidas.length > 0 && escolhidas.every((c) => c.tipo === "forma");
  const soImagem = escolhidas.length > 0 && escolhidas.every((c) => c.tipo === "imagem");
  const soVideo = escolhidas.length > 0 && escolhidas.every((c) => c.tipo === "video");

  const t = escolhidas as CamadaTexto[];
  const f = escolhidas as CamadaForma[];

  const [fontes, setFontes] = React.useState<string[]>([]);
  React.useEffect(() => {
    api.fontes().then(setFontes).catch(() => setFontes([]));
  }, []);

  /*
    A fonte que o seletor da CAMADA mostra.

    Vazio (nenhuma escolheu) e discordância (escolheram fontes diferentes) caem
    no mesmo lugar: HERDA. Não é preguiça — é o que já acontece com as outras
    propriedades em seleção múltipla, e clicar num nome ali aplica a todas, que
    é justamente como se resolve a discordância.
  */
  const fonteEmComum = comum(escolhidas, (c) => (c as CamadaTexto).fonte ?? "");
  const fonteDaSelecao = fonteEmComum ? familiaEscolhida(fonteEmComum) : HERDA;

  return (
    <>
      <Grupo titulo="Tipografia" icone={<CaseSensitive size={13} className="lucide" />} fixo>
        <SeletorFonte
          fontes={fontes}
          escolhida={familiaEscolhida(estilo.fonte.familia)}
          aoEscolher={(nome) =>
            aoMudarEstilo({
              ...estilo,
              fonte: { ...estilo.fonte, familia: cadeiaDeFonte(nome) },
            })
          }
        />
        <Dica>
          Vale pro vídeo inteiro. A lista é o que está instalado nesta máquina —
          o render usa exatamente as mesmas fontes.
        </Dica>
      </Grupo>

      <Grupo titulo="Adicionar" icone={<Plus size={13} className="lucide" />} fixo>
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          <button className="opcao" style={{ flex: 1 }} onClick={() => inserir([textoNovo()])}>
            <Type size={13} className="lucide" /> Texto
          </button>
          <button className="opcao" style={{ flex: 1 }} onClick={() => inserir([formaNova()])}>
            <Square size={13} className="lucide" /> Forma
          </button>
        </div>
        {atalhos.map(([nome, ajuda, fn]) => (
          <button
            key={nome}
            className="opcao"
            style={{ width: "100%", marginBottom: 5, textAlign: "left", padding: "9px 11px" }}
            onClick={fn}
          >
            <strong style={{ display: "block", marginBottom: 2 }}>+ {nome}</strong>
            <span style={{ color: "var(--texto-fraco)", fontSize: 11 }}>{ajuda}</span>
          </button>
        ))}
        <Dica>Entra no tempo onde a agulha está, no topo da pilha.</Dica>
      </Grupo>

      <Grupo
        titulo={`Pilha (${camadas.length})`}
        icone={<Layers size={13} className="lucide" />}
        fixo
      >
        {camadas.length === 0 ? (
          <Vazio icone={<Layers size={20} className="lucide" />}>
            Nenhuma camada ainda.
          </Vazio>
        ) : (
          <div className="pilha">
            {/* de cima pra baixo: o último da lista desenha por cima, então é
                ele que aparece primeiro aqui */}
            {[...camadas].reverse().map((c) => (
              <div
                key={c.id}
                className={`pilha-item ${selecao.includes(c.id) ? "ativa" : ""}`}
                onClick={(e) => clicar(e, c.id)}
              >
                <span className="pilha-icone">{ICONES[c.tipo]}</span>
                <span className="pilha-nome">{nomeDaCamada(c)}</span>
                <button
                  className="pilha-botao"
                  title={c.oculta ? "mostrar" : "esconder"}
                  onClick={(e) => {
                    e.stopPropagation();
                    aoMudar(
                      camadas.map((x) => (x.id === c.id ? { ...x, oculta: !x.oculta } : x)),
                    );
                  }}
                >
                  {c.oculta ? <EyeOff size={12} className="lucide" /> : <Eye size={12} className="lucide" />}
                </button>
                <button
                  className="pilha-botao"
                  title="subir na pilha"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(c.id, +1);
                  }}
                >
                  <ChevronUp size={12} className="lucide" />
                </button>
                <button
                  className="pilha-botao"
                  title="descer na pilha"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(c.id, -1);
                  }}
                >
                  <ChevronDown size={12} className="lucide" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Dica>Ctrl clica pra somar à seleção, Shift pra pegar um intervalo.</Dica>
      </Grupo>

      {escolhidas.length === 0 ? null : (
        <Grupo
          titulo={
            escolhidas.length === 1
              ? nomeDaCamada(escolhidas[0])
              : `${escolhidas.length} camadas selecionadas`
          }
          icone={ICONES[escolhidas[0].tipo]}
          fixo
        >
          <div style={{ display: "flex", gap: 5, marginBottom: 9 }}>
            <button className="opcao" style={{ flex: 1 }} onClick={duplicar}>
              <Copy size={13} className="lucide" /> Duplicar
            </button>
            <button className="opcao perigo" style={{ flex: 1 }} onClick={apagar}>
              <Trash2 size={13} className="lucide" /> Apagar
            </button>
          </div>

          <Numero
            rotulo="Entra em"
            valor={comum(escolhidas, (c) => c.inicio) ?? 0}
            passo={0.1}
            min={0}
            aoMudar={(v) => mudar({ inicio: Number(v.toFixed(2)) })}
          />
          <Numero
            rotulo="Fica"
            valor={comum(escolhidas, (c) => c.duracao) ?? 0}
            passo={0.1}
            min={0.1}
            aoMudar={(v) => mudar({ duracao: Number(Math.max(0.1, v).toFixed(2)) })}
          />
          <Deslizante
            rotulo="Opacidade"
            valor={comum(escolhidas, (c) => c.opacidade ?? 1) ?? 1}
            min={0}
            max={1}
            aoMudar={(v) => mudar({ opacidade: v })}
          />

          {soTexto && (
            <>
              {escolhidas.length === 1 && (
                <TextoPintavel
                  texto={t[0].texto}
                  cor={t[0].cor}
                  trechos={t[0].trechos}
                  destaque={estilo.cores.destaque}
                  /*
                    Texto e trechos mudam JUNTOS.

                    Se fossem duas chamadas, a primeira gravaria o texto novo
                    com os índices velhos — e entre uma e outra o vídeo
                    desenharia a cor no lugar errado. Num undo, pior: daria pra
                    voltar pro estado intermediário e ficar nele.
                  */
                  aoMudarTexto={(v) =>
                    mudar({
                      texto: v,
                      trechos: remapear(t[0].trechos, t[0].texto, v),
                    } as Partial<Camada>)
                  }
                  aoMudarTrechos={(tr) => mudar({ trechos: tr } as Partial<Camada>)}
                />
              )}
              {/*
                Fonte SÓ desta camada.

                Fica junto das outras propriedades do texto, e não lá em cima
                com a Tipografia do projeto, porque são coisas diferentes: a de
                cima troca a fonte do vídeo inteiro, esta troca a do que está
                selecionado. Misturar as duas no mesmo lugar foi o que fez a
                troca de fonte vazar pros outros projetos antes.
              */}
              <div className="linha">
                <label>Fonte</label>
                <SeletorFonte
                  fontes={[HERDA, ...fontes]}
                  escolhida={fonteDaSelecao}
                  aoEscolher={(nome) =>
                    mudar({
                      fonte: nome === HERDA ? undefined : cadeiaDeFonte(nome),
                    } as Partial<Camada>)
                  }
                />
              </div>
              <Numero
                rotulo="Tamanho"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).tamanho) ?? 0}
                passo={2}
                min={8}
                aoMudar={(v) => mudar({ tamanho: v } as Partial<Camada>)}
              />
              <Numero
                rotulo="Peso"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).peso) ?? 0}
                passo={100}
                min={100}
                aoMudar={(v) => mudar({ peso: v } as Partial<Camada>)}
              />
              <Cor
                rotulo="Cor"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).cor) ?? "#FFFFFF"}
                aoMudar={(v) => mudar({ cor: v } as Partial<Camada>)}
              />
              <Deslizante
                rotulo="Entrelinha"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).entrelinha) ?? 1.1}
                min={0}
                max={2}
                passo={0.01}
                aoMudar={(v) => mudar({ entrelinha: v } as Partial<Camada>)}
              />
              <Deslizante
                rotulo="Entre letras"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).espacamento ?? 0) ?? 0}
                min={-0.1}
                max={0.3}
                passo={0.005}
                casas={3}
                aoMudar={(v) => mudar({ espacamento: v } as Partial<Camada>)}
              />
              <Interruptor
                rotulo="CAIXA ALTA"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).caixa_alta) ?? false}
                aoMudar={(v) => mudar({ caixa_alta: v } as Partial<Camada>)}
              />
              <Interruptor
                rotulo="Sombra"
                valor={comum(escolhidas, (c) => (c as CamadaTexto).sombra) ?? false}
                aoMudar={(v) => mudar({ sombra: v } as Partial<Camada>)}
              />
            </>
          )}

          {soForma && (
            <>
              <Cor
                rotulo="Cor"
                valor={comum(escolhidas, (c) => (c as CamadaForma).cor) ?? "#FFFFFF"}
                aoMudar={(v) => mudar({ cor: v } as Partial<Camada>)}
              />
              <Deslizante
                rotulo="Altura"
                valor={comum(escolhidas, (c) => (c as CamadaForma).altura) ?? 0}
                min={0.002}
                max={1}
                passo={0.002}
                casas={3}
                aoMudar={(v) => mudar({ altura: v } as Partial<Camada>)}
              />
              <Numero
                rotulo="Cantos"
                valor={comum(escolhidas, (c) => (c as CamadaForma).raio) ?? 0}
                passo={2}
                min={0}
                aoMudar={(v) => mudar({ raio: v } as Partial<Camada>)}
              />
              <Interruptor
                rotulo="Degradê"
                valor={escolhidas.every((c) => !!(c as CamadaForma).degrade)}
                aoMudar={(v) =>
                  mudar({
                    degrade: v ? { sentido: "cima", opacidade: 0.8 } : undefined,
                  } as Partial<Camada>)
                }
              />
              {escolhidas.every((c) => !!(c as CamadaForma).degrade) && (
                <>
                  <div className="linha">
                    <label>Esmaece pra</label>
                    <select
                      value={
                        comum(escolhidas, (c) => (c as CamadaForma).degrade?.sentido) ?? "cima"
                      }
                      onChange={(e) =>
                        mudar({
                          degrade: {
                            sentido: e.target.value as DegradeForma["sentido"],
                            opacidade:
                              comum(escolhidas, (c) => (c as CamadaForma).degrade?.opacidade) ??
                              0.8,
                          },
                        } as Partial<Camada>)
                      }
                    >
                      <option value="cima">cima</option>
                      <option value="baixo">baixo</option>
                      <option value="esquerda">esquerda</option>
                      <option value="direita">direita</option>
                    </select>
                  </div>
                  <Deslizante
                    rotulo="Opacidade cheia"
                    valor={
                      comum(escolhidas, (c) => (c as CamadaForma).degrade?.opacidade) ?? 0.8
                    }
                    min={0}
                    max={1}
                    passo={0.05}
                    aoMudar={(v) =>
                      mudar({
                        degrade: {
                          sentido:
                            comum(escolhidas, (c) => (c as CamadaForma).degrade?.sentido) ??
                            "cima",
                          opacidade: v,
                        },
                      } as Partial<Camada>)
                    }
                  />
                </>
              )}
            </>
          )}

          {soImagem && escolhidas.length === 1 && (
            <div className="linha">
              <label>Arquivo</label>
              <select
                value={(escolhidas[0] as CamadaImagem).arquivo}
                onChange={(e) => mudar({ arquivo: e.target.value } as Partial<Camada>)}
              >
                {imagensDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {soVideo && (
            <Deslizante
              rotulo="Volume"
              valor={comum(escolhidas, (c) => (c as CamadaVideo).volume) ?? 1}
              min={0}
              max={1}
              aoMudar={(v) => mudar({ volume: v } as Partial<Camada>)}
            />
          )}

          <Deslizante
            rotulo="Esquerda"
            valor={comum(escolhidas, (c) => (c as CamadaTexto).x) ?? 0}
            min={-0.2}
            max={1}
            passo={0.005}
            casas={3}
            aoMudar={(v) => mudar({ x: v } as Partial<Camada>)}
          />
          <Deslizante
            rotulo="Topo"
            valor={comum(escolhidas, (c) => (c as CamadaTexto).y) ?? 0}
            min={-0.2}
            max={1.1}
            passo={0.005}
            casas={3}
            aoMudar={(v) => mudar({ y: v } as Partial<Camada>)}
          />
          {!soForma && (
            <Deslizante
              rotulo="Largura"
              valor={comum(escolhidas, (c) => (c as CamadaTexto).largura) ?? 0}
              min={0.05}
              max={1.2}
              passo={0.005}
              casas={3}
              aoMudar={(v) => mudar({ largura: v } as Partial<Camada>)}
            />
          )}
          {soForma && (
            <Deslizante
              rotulo="Largura"
              valor={comum(escolhidas, (c) => (c as CamadaForma).largura) ?? 0}
              min={0.01}
              max={1.2}
              passo={0.005}
              casas={3}
              aoMudar={(v) => mudar({ largura: v } as Partial<Camada>)}
            />
          )}

          {escolhidas.length > 1 && (
            <Dica>
              Campo em branco quer dizer que as selecionadas têm valores
              diferentes. Mexer nele iguala todas.
            </Dica>
          )}
          {duracaoTotal > 0 &&
            escolhidas.some((c) => c.inicio + c.duracao > duracaoTotal + 0.05) && (
              <Dica>Alguma camada termina depois do fim do vídeo.</Dica>
            )}
        </Grupo>
      )}
    </>
  );
};
