import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveFrontendPort() {
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL || "http://localhost:5173");
    return Number(frontendUrl.port || 5173);
  } catch {
    return 5173;
  }
}

export default defineConfig({
  logLevel: "error",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: resolveFrontendPort(),
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
