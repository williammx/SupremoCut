/**
 * Os picos da forma de onda, carregados uma vez e compartilhados.
 *
 * A onda desenhada na timeline e o corte automático de silêncio leem o MESMO
 * arquivo. Deixar cada um buscar o seu abriria a porta pro pior tipo de bug:
 * a linha de corte marcando um lugar e a onda mostrando outro.
 *
 * IMPORTANTE — o relógio: estes picos estão no relógio do arquivo de ÁUDIO.
 * Quando o projeto tem duas fontes, ele está deslocado do relógio do VÍDEO por
 * `roteiro.audio.offset`. Converter é responsabilidade de quem usa.
 */

import { useEffect, useState } from "react";

export type Picos = { por_segundo: number; duracao: number; picos: number[] };

export const usePicos = (
  arquivo: string | null | undefined,
  pasta: string,
): Picos | null => {
  const [dados, setDados] = useState<Picos | null>(null);

  useEffect(() => {
    if (!arquivo) {
      setDados(null);
      return;
    }
    let vivo = true;
    fetch(`/${pasta}/${arquivo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        // Um JSON truncado ou de outro formato viraria NaN silencioso lá na
        // frente. Melhor tratar como "não tem onda" do que como "tem onda de
        // valor indefinido".
        setDados(d && Array.isArray(d.picos) && d.por_segundo > 0 ? d : null);
      })
      .catch(() => vivo && setDados(null));
    return () => {
      vivo = false;
    };
  }, [arquivo, pasta]);

  return dados;
};
