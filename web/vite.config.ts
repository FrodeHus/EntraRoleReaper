import { defineConfig } from 'vite'
// vite config
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  // default resolve
  server: {
    port: 5173,
  },
  // If served from a subpath behind a reverse proxy, set base via VITE_BASE_URL
  // and ensure VITE_REDIRECT_URI matches the externally visible redirect URL
});
