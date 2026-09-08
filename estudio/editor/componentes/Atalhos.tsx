import React from "react";

const LISTA: [string, string][] = [
  ["Espaço", "Toca / pausa"],
  ["← →", "Anda um quadro"],
  ["Shift + ← →", "Anda um segundo"],
  ["Home / End", "Vai pro começo / fim"],
  ["S ou T", "Divide o bloco no cursor"],
  ["Delete", "Apaga o bloco selecionado"],
  ["Ctrl + C", "Copia o bloco"],
  ["Ctrl + V", "Cola o bloco copiado"],
  ["Ctrl + D", "Duplica o bloco"],
  ["Ctrl + Z", "Desfaz"],
  ["Ctrl + Y", "Refaz (ou Ctrl+Shift+Z)"],
  ["Ctrl + S", "Salva (mas ele já salva sozinho)"],
  ["Alt (arrastando)", "Solta o ímã só durante aquele arraste"],
  ["Botão do ímã na timeline", "Liga e desliga o ímã de vez"],
  ["Ctrl + roda do mouse", "Zoom na linha do tempo"],
  ["Arrastar a agulha", "Navega pelo vídeo"],
  ["Arrastar a borda do bloco", "Apara o começo ou o fim"],
  ["Duplo clique no vídeo", "Tela cheia"],
  ["M", "Marca (ou desmarca) o instante atual"],
  ["Clique direito no marcador", "Apaga o marcador"],
  ["D", "Abre o medidor de reprodução"],
  ["?", "Abre e fecha esta lista"],
];

export const Atalhos: React.FC<{ aoFechar: () => void }> = ({ aoFechar }) => (
  <div className="atalhos" onClick={aoFechar}>
    <div className="atalhos-caixa" onClick={(e) => e.stopPropagation()}>
      <h3>Atalhos</h3>
      {LISTA.map(([tecla, oque]) => (
        <div className="atalhos-linha" key={tecla}>
          <span>{oque}</span>
          <kbd>{tecla}</kbd>
        </div>
      ))}
      <button className="btn" style={{ width: "100%", marginTop: 18 }} onClick={aoFechar}>
        Fechar
      </button>
    </div>
  </div>
);
