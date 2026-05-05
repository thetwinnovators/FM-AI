import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import flowmapSync from './vite-plugin-flowmap-sync.js'
import elevenlabs from './vite-plugin-elevenlabs.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), flowmapSync(), elevenlabs()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
    watch: {
      // memory-index.* are written by the Vite endpoint itself. Without this
      // exclusion, every write triggers an HMR reload → app remounts → writes
      // again → infinite loop.
      ignored: ['**/memory-index.json', '**/memory-index.md'],
    },
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
      '/api/stackexchange': {
        target: 'https://api.stackexchange.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stackexchange/, ''),
      },
      '/api/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, ''),
      },
      // NOTE: 127.0.0.1 instead of `localhost` because Node's resolver on Windows
      // can pick ::1 (IPv6) first while Docker port mappings only bind on IPv4 →
      // Vite returns 502 to the client. Explicit IPv4 sidesteps that.
      // SearXNG broad-web metasearch. Defaults to a locally self-hosted instance —
      // public instances aggressively rate-limit programmatic JSON callers.
      // To run locally: `docker run -d -p 8888:8080 searxng/searxng`
      // To point elsewhere: change the target below and restart `vite dev`.
      '/api/searxng': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/searxng/, ''),
      },
      // Ollama local LLM — powers Phase 2 document summaries and Phase 3 chat.
      // To run locally: `docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama`
      // Then pull a model:  `docker exec -it ollama ollama pull llama3.2:3b`
      // To point elsewhere (different host/port): change the target and restart `vite dev`.
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      // Whisper speech-to-text — local container, replaces the browser's
      // Google-dependent Web Speech API. To run locally:
      //   docker run -d --name whisper --gpus all -p 9000:9000 \
      //     -e ASR_MODEL=base.en -e ASR_ENGINE=faster_whisper \
      //     onerahmet/openai-whisper-asr-webservice:latest-gpu
      '/api/stt': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stt/, ''),
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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/.claude/worktrees/**',
    ],
  },
})
