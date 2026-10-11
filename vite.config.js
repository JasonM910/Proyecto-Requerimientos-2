import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { jsonApi } from './server/jsonApi.js'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/data/**'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'json-database-api',
      configureServer(server) { server.middlewares.use(jsonApi) },
      configurePreviewServer(server) { server.middlewares.use(jsonApi) },
    },
  ],
})
