import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Vite vigila la raíz del proyecto; sin esto intenta observar los artefactos
    // de cargo en src-tauri/target y el watcher falla con EBUSY en Windows
    // mientras el fichero está bloqueado por el compilador.
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "chrome110",
    sourcemap: false,
  },
});
