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
});
