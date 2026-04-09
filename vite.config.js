import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/rectran/',
  plugins: [react()],
  server: {
    port: 4200,
    strictPort: true, // Fail if port is already in use
    open: true        // Auto-open browser
  },
  build: {
    outDir: 'static/rectran-ui'
  }
})