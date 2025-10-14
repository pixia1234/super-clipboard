import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendHost = process.env.BACKEND_HOST ?? "127.0.0.1";
const backendPort =
  Number.parseInt(process.env.BACKEND_PORT ?? "", 10) || 5174;
const backendTarget = `http://${backendHost}:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true
      },
      "/healthz": {
        target: backendTarget,
        changeOrigin: true
      },
      "/static": {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: true
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  }
});
