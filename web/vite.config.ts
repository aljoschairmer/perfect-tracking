import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "node:path";

const UPSTREAM = "https://race.perfect-tracking.com";

// The tracking API sends no CORS headers, so the browser can't call it directly.
// Proxying under the app's own origin in dev keeps the client's `baseUrl` a
// plain relative "/api/" — the same thing the real site does.
const egressProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: UPSTREAM,
        changeOrigin: true,
        ...(egressProxy ? { agent: new HttpsProxyAgent(egressProxy) } : {}),
      },
    },
  },
});
