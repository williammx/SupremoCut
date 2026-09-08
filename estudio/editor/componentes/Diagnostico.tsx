import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PlayerRef } from "@remotion/player";

/**
 * Medidor de reprodução — tecla D.
 *
 * Serve pra parar de adivinhar por que o play engasga: mostra a taxa real de
 * quadros, quantas vezes o tempo ANDOU PRA TRÁS (a "rebobinada"), e o estado
 * do áudio e do vídeo. Se travar, é só ler os números daqui.
 */
export const Diagnostico: React.FC<{
  player: React.RefObject<PlayerRef | null>;
  fps: number;
  aoFechar: () => void;
}> = ({ player, fps, aoFechar }) => {
  const [d, setD] = useState({
    fpsReal: 0,
    retrocessos: 0,
    maiorSalto: 0,
    audio: "—",
    audioBuffer: 0,
    video: "—",
    memoria: 0,
  });

  const ultimo = useRef({ frame: -1, t: performance.now(), quadros: 0, voltas: 0, salto: 0 });

  useEffect(() => {
    let vivo = true;

    const medir = () => {
      if (!vivo) return;
      const p = player.current;
      const agora = performance.now();
      const u = ultimo.current;

      if (p) {
        const f = p.getCurrentFrame();
        if (u.frame >= 0 && f < u.frame) {
          // o tempo andou pra trás: é exatamente o sintoma da rebobinada
          u.voltas += 1;
          u.salto = Math.max(u.salto, u.frame - f);
        }
        if (f !== u.frame) u.quadros += 1;
        u.frame = f;
      }

      const decorrido = agora - u.t;
      if (decorrido >= 1000) {
        const audio = document.querySelector<HTMLAudioElement>(".palco-caixa audio");
        const canvas = document.querySelector<HTMLCanvasElement>(".palco-caixa canvas");
        let buffer = 0;
        if (audio && audio.buffered.length > 0) {
          buffer = audio.buffered.end(audio.buffered.length - 1) - audio.currentTime;
        }
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;

        setD({
          fpsReal: Math.round((u.quadros / decorrido) * 1000),
          retrocessos: u.voltas,
          maiorSalto: u.salto,
          audio: audio ? ["nada", "metadados", "atual", "futuro", "completo"][audio.readyState] : "sem áudio",
          audioBuffer: Number(buffer.toFixed(1)),
          video: canvas ? `${canvas.width}×${canvas.height}` : "sem canvas",
          memoria: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
        });
        u.quadros = 0;
        u.t = agora;
      }
      requestAnimationFrame(medir);
    };

    const id = requestAnimationFrame(medir);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [player]);

  const saudavel = d.fpsReal >= fps * 0.8 && d.retrocessos === 0;

  return (
    <div className="diag">
      <div className="diag-topo">
        <strong>Medidor</strong>
        <button className="apagar" onClick={aoFechar}>
                <X size={14} className="lucide" />
              </button>
      </div>
      <div className="diag-linha">
        <span>Quadros por segundo</span>
        <b style={{ color: d.fpsReal >= fps * 0.8 ? "var(--ok)" : "var(--aviso)" }}>
          {d.fpsReal} / {fps}
        </b>
      </div>
      <div className="diag-linha">
        <span>Rebobinadas</span>
        <b style={{ color: d.retrocessos === 0 ? "var(--ok)" : "#ff5c5c" }}>{d.retrocessos}</b>
      </div>
      <div className="diag-linha">
        <span>Maior retrocesso</span>
        <b>{d.maiorSalto} quadros</b>
      </div>
      <div className="diag-linha">
        <span>Áudio</span>
        <b>{d.audio}</b>
      </div>
      <div className="diag-linha">
        <span>Áudio à frente</span>
        <b>{d.audioBuffer}s</b>
      </div>
      <div className="diag-linha">
        <span>Vídeo</span>
        <b>{d.video}</b>
      </div>
      <div className="diag-linha">
        <span>Memória</span>
        <b>{d.memoria} MB</b>
      </div>
      <p className="diag-nota">
        {saudavel
          ? "Reprodução saudável."
          : "Se as rebobinadas subirem enquanto toca, me mande estes números."}
      </p>
    </div>
  );
};
