/**
 * SupremoCut — deixar a cadeia de fontes VÁLIDA antes de entregar ao CSS.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * `estilo.fonte.familia` é uma cadeia de CSS escrita por gente e por máquina:
 *
 *     Tusker Grotesk 1500, Inter, 'Segoe UI', Arial, sans-serif
 *
 * Essa linha é INVÁLIDA. Um nome de família sem aspas é lido pelo CSS como uma
 * sequência de identificadores, e identificador não pode começar com dígito —
 * `1500` invalida a declaração inteira. O navegador então descarta o
 * `font-family` por completo: sem erro no console, sem aviso, sem fallback
 * parcial. O texto simplesmente continua na fonte que já estava.
 *
 * Foi assim que o editor conseguiu mentir com convicção: o seletor mostrava
 * "Tusker Grotesk 1500" desenhado na própria Tusker (lá o nome ia entre aspas,
 * por acaso) enquanto o vídeo ao lado seguia em Inter. Dois pedaços da mesma
 * tela discordando, e nenhum dos dois quebrado o bastante pra reclamar.
 *
 * Metade das fontes de display cai nessa armadilha: número no nome, acento,
 * hífen solto. Por isso a correção não pode ser só "passar a salvar com aspas"
 * — os estilos que JÁ estão gravados errado continuariam errados pra sempre.
 * Este arquivo é o conserto na leitura; a gravação com aspas é o conserto na
 * escrita. Os dois juntos fecham o caso.
 */

/**
 * Um `<custom-ident>` do CSS: começa com letra, `_`, `-` ou caractere
 * não-ASCII; segue com esses mais dígitos. É a regra que `1500` viola.
 *
 * Os intervalos vão escritos como `\u….` de propósito: com o caractere
 * literal, um espaço perdido dentro dos colchetes vira um INTERVALO de
 * espaço até o fim da tabela — que engole os dígitos e faz esta peneira
 * aprovar exatamente o nome que ela existe pra reprovar.
 */
const IDENTIFICADOR = /^-?[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\-\u0080-\uFFFF]*$/;

/** Um nome só precisa de aspas se alguma das suas palavras não for identificador. */
const precisaDeAspas = (nome: string): boolean =>
  !nome.split(/\s+/).every((palavra) => IDENTIFICADOR.test(palavra));

/**
 * Devolve a mesma cadeia, com aspas em quem precisa.
 *
 * Não mexe em quem já veio citado nem nas palavras-chave genéricas do CSS
 * (`sans-serif`, `monospace`…), que são identificadores válidos e por isso
 * passam pela peneira sem tratamento especial — citá-las, aliás, mudaria o
 * sentido: entre aspas viram o nome de uma família chamada "sans-serif".
 */
export const familiaSegura = (familia: string): string =>
  familia
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((nome) => {
      if (/^["']/.test(nome)) return nome;
      return precisaDeAspas(nome) ? `"${nome.replace(/"/g, '\\"')}"` : nome;
    })
    .join(", ");
