import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// Playwright invoca esta función y espera su limpieza al finalizar.
// Administrar Vite aquí evita depender de señales de procesos en Windows.
export default async function startTestServer() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const temporaryRoot = resolve(tmpdir())
  const temporaryDatabaseDirectory = await mkdtemp(join(temporaryRoot, 'hogar-plus-e2e-'))
  const previousDatabasePath = process.env.HOGAR_DB_PATH
  let server

  async function cleanup() {
    const target = resolve(temporaryDatabaseDirectory)
    if (dirname(target) !== temporaryRoot || !basename(target).startsWith('hogar-plus-e2e-')) {
      throw new Error('La carpeta temporal de pruebas está fuera del directorio esperado.')
    }
    try {
      await server?.close()
    } finally {
      await rm(target, { recursive: true, force: true })
      if (previousDatabasePath === undefined) delete process.env.HOGAR_DB_PATH
      else process.env.HOGAR_DB_PATH = previousDatabasePath
    }
  }

  try {
    const databasePath = join(temporaryDatabaseDirectory, 'db.json')
    await copyFile(join(root, 'data', 'db.json'), databasePath)
    process.env.HOGAR_DB_PATH = databasePath
    const { createServer } = await import('vite')
    server = await createServer({
      root,
      configFile: join(root, 'vite.config.js'),
      server: { host: '127.0.0.1', port: 4175, strictPort: true },
    })
    await server.listen()
    return cleanup
  } catch (error) {
    await cleanup()
    throw error
  }
}
