import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { jsonApi } from './server/jsonApi.js'

export default defineConfig({
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/data/**'],
    },
  },
  plugins: [
    react(),
    {
      name: 'json-database-api',
      configureServer(server) { server.middlewares.use(jsonApi) },
      configurePreviewServer(server) { server.middlewares.use(jsonApi) },
    },
  ],
})
