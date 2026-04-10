import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : '/rectran/',
  plugins: [react()],
  server: {
    port: 4200,
    strictPort: true, // Fail if port is already in use
    open: mode !== 'electron'  // Don't auto-open browser when Electron will load it
  },
  build: {
    outDir: 'static/rectran-ui'
  }
}))