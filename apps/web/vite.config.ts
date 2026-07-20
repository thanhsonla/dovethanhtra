import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1100,
  },
  envDir: '../..',
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
})
