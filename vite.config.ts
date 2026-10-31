import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": { target: env.DEV_API_PROXY || "http://localhost:8000", changeOrigin: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            map: ["maplibre-gl"],
            deck: ["@deck.gl/core", "@deck.gl/layers", "@deck.gl/mapbox"],
          },
        },
      },
    },
  };
});
