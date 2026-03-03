import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api/ws': {
        target: 'ws://localhost:13390',
        ws: true
      },
      '/api': 'http://localhost:13390'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
