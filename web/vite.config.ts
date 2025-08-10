import { defineConfig } from 'vite'
// vite config
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // default resolve
  server: {
    port: 5173
  }
})
