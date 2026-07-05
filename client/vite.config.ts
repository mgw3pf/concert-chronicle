import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In development, API requests are proxied to the Express server so the
      // session cookie is first-party and no CORS configuration is needed.
      "/api": "http://localhost:3001",
    },
  },
});
