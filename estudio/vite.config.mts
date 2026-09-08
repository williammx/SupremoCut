import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

/**
 * Editor visual do SupremoCut.
 *
 * root  = pasta editor/           (onde vive a interface)
 * public= ../public               (as midias dos projetos, servidas na raiz)
 * /api  = servidor Node (servidor.mjs) que le e grava os JSON
 */
export default defineConfig({
  plugins: [react()],
  root: "editor",
  publicDir: "../public",
  server: {
    // IPv4 explicito: sem isso o Vite sobe em ::1 e o servidor de dados
    // em 127.0.0.1, e a duvida entre os dois so gera dor de cabeca.
    host: "127.0.0.1",
    port: 5188,
    strictPort: false,
    open: true,
    proxy: {
      // Regex, e nao prefixo solto: "/api" tambem casaria com o nosso
      // proprio arquivo /api.ts, que ia parar no Express e voltar 404.
      "^/api/": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
    fs: {
      // precisa enxergar ../src (componentes do Remotion)
      allow: [".."],
    },
  },
  build: {
    outDir: "../editor-build",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
