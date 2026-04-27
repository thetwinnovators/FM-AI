import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
    proxy: {
      '/api/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
      },
      '/api/hn': {
        target: 'https://hn.algolia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hn/, ''),
      },
    },
  },
  preview: {
    port: process.env.PORT ? Number(process.env.PORT) : 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
  },
})
