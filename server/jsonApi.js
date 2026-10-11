import { randomUUID } from 'node:crypto'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clearSession, createSession, publicUser, sessionUser, verifyCredentials } from './auth.js'

const databasePath = process.env.HOGAR_DB_PATH
  ? resolve(process.env.HOGAR_DB_PATH)
  : fileURLToPath(new URL('../data/db.json', import.meta.url))
const demoUserId = 'proveedor-demo'
const maxBodyBytes = 16_384
let mutationQueue = Promise.resolve()

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readDatabase() {
  const database = JSON.parse(await readFile(databasePath, 'utf8'))
  if (!Array.isArray(database.users) || !Array.isArray(database.categories) || !Array.isArray(database.services) || !Array.isArray(database.profiles) || !Array.isArray(database.clientProfiles) || !Array.isArray(database.requests)) {
    throw new Error('La estructura de data/db.json no es válida.')
  }
  return database
}

async function writeDatabase(database) {
  const temporaryPath = `${databasePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, databasePath)
  } catch (error) {
    try { await unlink(temporaryPath) } catch { /* Nothing to clean up. */ }
    throw error
  }
}

function mutateDatabase(change) {
  const operation = mutationQueue.then(async () => {
    const database = await readDatabase()
    const result = change(database)
    await writeDatabase(database)
    return result
  })
  mutationQueue = operation.catch(() => {})
  return operation
}

function respond(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

async function readBody(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > maxBodyBytes) throw new ApiError(413, 'La solicitud es demasiado grande.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError(400, 'El contenido debe ser JSON válido.') }
}

function validateService(payload, database) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Datos del servicio no válidos.')
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const description = typeof payload.description === 'string' ? payload.description.trim() : ''
  const category = payload.category
  if (!title || title.length > 80) throw new ApiError(400, 'El título es obligatorio y debe tener como máximo 80 caracteres.')
  if (!description || description.length > 800) throw new ApiError(400, 'La descripción es obligatoria y debe tener como máximo 800 caracteres.')
  if (!database.categories.some((item) => item.name === category)) throw new ApiError(400, 'Selecciona una categoría válida.')
  return { title, description, category }
}

function cleanText(value, max, label) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ApiError(400, `${label} no es válido.`)
  const text = value.trim()
  if (text.length > max) throw new ApiError(400, `${label} debe tener como máximo ${max} caracteres.`)
  return text
}

function initialsOf(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function validateProfile(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Datos del perfil no válidos.')
  const name = cleanText(payload.name, 60, 'El nombre')
  if (!name) throw new ApiError(400, 'El nombre es obligatorio.')
  const years = payload.experienceYears ?? null
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) throw new ApiError(400, 'Los años de experiencia deben ser un número entre 0 y 60.')
  if (!Array.isArray(payload.zones)) throw new ApiError(400, 'Agrega al menos una zona de atención.')
  const zones = []
  for (const item of payload.zones) {
    const zone = cleanText(item, 40, 'Cada zona').replace(/\s+/g, ' ')
    if (zone && !zones.some((existing) => existing.toLowerCase() === zone.toLowerCase())) zones.push(zone)
  }
  if (!zones.length) throw new ApiError(400, 'Agrega al menos una zona de atención.')
  if (zones.length > 10) throw new ApiError(400, 'Puedes agregar hasta 10 zonas.')
  const email = cleanText(payload.email, 120, 'El correo electrónico')
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, 'El correo electrónico no es válido.')
  return {
    name,
    headline: cleanText(payload.headline, 80, 'La especialidad'),
    about: cleanText(payload.about, 600, 'La descripción personal'),
    experienceYears: years,
    experience: cleanText(payload.experience, 600, 'La descripción de la experiencia'),
    zones,
    email,
    phone: cleanText(payload.phone, 120, 'El teléfono'),
    address: cleanText(payload.address, 120, 'La dirección'),
    legalId: cleanText(payload.legalId, 60, 'La identificación legal'),
    verificationDocuments: cleanText(payload.verificationDocuments, 200, 'Los documentos de verificación'),
    bankAccount: cleanText(payload.bankAccount, 120, 'La cuenta bancaria'),
  }
}

function findProfile(database, providerId = demoUserId) {
  const existing = database.profiles?.find((item) => item.providerId === providerId)
  if (existing) return existing
  const user = database.users.find((item) => item.id === providerId)
  return { providerId, name: user?.name || '', headline: '', about: '', experienceYears: null, experience: '', zones: [], email: '', phone: '', address: '', legalId: '', verificationDocuments: '', bankAccount: '', updatedAt: null }
}

function toPublicProfile(profile) {
  const { providerId, name, headline, about, experienceYears, experience, zones } = profile
  return { providerId, name, headline, about, experienceYears, experience, zones }
}

function findClientProfile(database, clientId) {
  const existing = database.clientProfiles.find((item) => item.clientId === clientId)
  if (existing) return existing
  const user = database.users.find((item) => item.id === clientId)
  return { clientId, name: user?.name || '', phone: '', email: '', address: '', updatedAt: null }
}

function validateClientProfile(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Datos del cliente no válidos.')
  const name = cleanText(payload.name, 80, 'El nombre')
  const phone = cleanText(payload.phone, 20, 'El teléfono')
  const email = cleanText(payload.email, 120, 'El correo')
  const address = cleanText(payload.address, 200, 'La dirección')
  if (name.length < 2) throw new ApiError(400, 'Escribe tu nombre completo.')
  if (!/^[+\d\s-]+$/.test(phone) || phone.replace(/\D/g, '').length < 8) throw new ApiError(400, 'Escribe un teléfono válido de al menos 8 dígitos.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Escribe un correo válido.')
  if (address.length < 5) throw new ApiError(400, 'Escribe una dirección o punto de referencia.')
  return { name, phone, email, address }
}

const chronological = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
const contactAllowed = (status) => ['Aceptado', 'En proceso', 'Finalizado'].includes(status)

function requireRole(user, role) {
  if (user.role !== role) throw new ApiError(403, 'No tienes acceso a este módulo.')
}

// La búsqueda conserva solo la información pública del proveedor.
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function searchServices(database, params) {
  const terms = fold(params.get('q')).slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 8)
  const category = params.get('category') || ''
  const zone = fold(params.get('zone'))
  const zoneOptions = new Map()
  for (const profile of database.profiles ?? []) for (const item of profile.zones ?? []) zoneOptions.set(fold(item), zoneOptions.get(fold(item)) || item)

  const found = []
  for (const service of database.services) {
    if (category && service.category !== category) continue
    const profile = findProfile(database, service.providerId)
    if (zone && !(profile.zones ?? []).some((item) => fold(item) === zone)) continue

    const title = fold(service.title)
    const meta = fold(`${service.category} ${profile.name} ${profile.headline}`)
    const description = fold(service.description)
    let score = 0
    const matchesAll = terms.every((term) => {
      const inTitle = title.includes(term)
      const inMeta = meta.includes(term)
      const inDescription = description.includes(term)
      score += (inTitle ? 3 : 0) + (inMeta ? 2 : 0) + (inDescription ? 1 : 0)
      return inTitle || inMeta || inDescription
    })
    if (!matchesAll) continue

    found.push({
      score,
      service: {
        id: service.id,
        title: service.title,
        category: service.category,
        description: service.description,
        updatedAt: service.updatedAt,
        provider: { id: profile.providerId, name: profile.name, headline: profile.headline, about: profile.about, experienceYears: profile.experienceYears, experience: profile.experience, zones: profile.zones ?? [] },
      },
    })
  }
  found.sort((a, b) => b.score - a.score || new Date(b.service.updatedAt) - new Date(a.service.updatedAt))
  return {
    categories: database.categories,
    zones: [...zoneOptions.values()].sort((a, b) => a.localeCompare(b, 'es')),
    total: found.length,
    results: found.map((item) => item.service),
  }
}

export async function jsonApi(request, response, next) {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname.startsWith('/data/')) return respond(response, 404, { error: 'Ruta no encontrada.' })
  if (!pathname.startsWith('/api/')) return next()

  try {
    if (pathname === '/api/auth/session' && request.method === 'GET') {
      const database = await readDatabase()
      const user = sessionUser(request, database)
      return respond(response, 200, { user: user ? publicUser(user) : null })
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const payload = await readBody(request)
      const identifier = typeof payload?.identifier === 'string' ? payload.identifier.trim() : ''
      const password = payload?.password
      const validIdentifier = identifier.includes('@')
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
        : /^[a-z0-9._-]{3,30}$/i.test(identifier)
      if (!validIdentifier || identifier.length > 120 || typeof password !== 'string' || !password || password.length > 200) {
        throw new ApiError(400, 'Ingresa un correo o usuario válido y una contraseña.')
      }
      const user = verifyCredentials(await readDatabase(), identifier, password)
      if (!user) throw new ApiError(401, 'Credenciales incorrectas.')
      createSession(request, response, user)
      return respond(response, 200, { user: publicUser(user) })
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      clearSession(request, response)
      return respond(response, 200, { ok: true })
    }

    const database = await readDatabase()
    const user = sessionUser(request, database)
    if (!user) throw new ApiError(401, 'Inicia sesión para continuar.')

    if (pathname === '/api/dashboard' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      return respond(response, 200, { user: publicUser(user), categories: database.categories, services: database.services.filter((item) => item.providerId === user.id) })
    }

    if (pathname === '/api/search' && request.method === 'GET') {
      requireRole(user, 'Cliente')
      const params = new URL(request.url, 'http://localhost').searchParams
      return respond(response, 200, searchServices(database, params))
    }

    if (pathname === '/api/profile' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      return respond(response, 200, findProfile(database, user.id))
    }

    if (pathname === '/api/profile/public' && request.method === 'GET') {
      requireRole(user, 'Cliente')
      return respond(response, 200, toPublicProfile(findProfile(database)))
    }

    if (pathname === '/api/profile' && request.method === 'PUT') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request)
      const profile = await mutateDatabase((database) => {
        const fields = validateProfile(payload)
        let current = database.profiles.find((item) => item.providerId === user.id)
        if (!current) {
          current = { providerId: user.id }
          database.profiles.push(current)
        }
        Object.assign(current, fields, { updatedAt: new Date().toISOString() })
        const account = database.users.find((item) => item.id === user.id)
        if (account) Object.assign(account, { name: fields.name, initials: initialsOf(fields.name) })
        return current
      })
      return respond(response, 200, profile)
    }

    if (pathname === '/api/client/profile' && request.method === 'GET') {
      requireRole(user, 'Cliente')
      return respond(response, 200, findClientProfile(database, user.id))
    }

    if (pathname === '/api/client/profile' && request.method === 'PUT') {
      requireRole(user, 'Cliente')
      const payload = await readBody(request)
      const profile = await mutateDatabase((currentDatabase) => {
        const fields = validateClientProfile(payload)
        let current = currentDatabase.clientProfiles.find((item) => item.clientId === user.id)
        if (!current) {
          current = { clientId: user.id }
          currentDatabase.clientProfiles.push(current)
        }
        Object.assign(current, fields, { updatedAt: new Date().toISOString() })
        const account = currentDatabase.users.find((item) => item.id === user.id)
        if (account) Object.assign(account, { name: fields.name, initials: initialsOf(fields.name) })
        return current
      })
      return respond(response, 200, profile)
    }

    if (pathname === '/api/client/requests' && request.method === 'GET') {
      requireRole(user, 'Cliente')
      const requests = database.requests.filter((item) => item.clientId === user.id)
        .sort(chronological).map(({ id, serviceTitle, providerName, createdAt, status, need }) =>
          ({ id, serviceTitle, providerName, createdAt, status, need }))
      return respond(response, 200, { requests })
    }

    if (pathname === '/api/provider/requests' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      const requests = database.requests.filter((item) => item.providerId === user.id)
        .sort(chronological).map((item) => {
          const client = findClientProfile(database, item.clientId)
          return {
            id: item.id,
            serviceTitle: item.serviceTitle,
            createdAt: item.createdAt,
            status: item.status,
            need: item.need,
            clientName: client.name,
            clientContact: contactAllowed(item.status)
              ? { phone: client.phone, email: client.email, address: client.address }
              : null,
          }
        })
      return respond(response, 200, { requests })
    }

    if (pathname === '/api/services' && request.method === 'POST') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request)
      const service = await mutateDatabase((database) => {
        const fields = validateService(payload, database)
        const timestamp = new Date().toISOString()
        const created = { id: randomUUID(), providerId: user.id, ...fields, createdAt: timestamp, updatedAt: timestamp }
        database.services.unshift(created)
        return created
      })
      return respond(response, 201, service)
    }

    const match = pathname.match(/^\/api\/services\/([a-zA-Z0-9-]+)$/)
    if (match && request.method === 'PUT') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request)
      const service = await mutateDatabase((database) => {
        const current = database.services.find((item) => item.id === match[1] && item.providerId === user.id)
        if (!current) throw new ApiError(404, 'El servicio no existe.')
        Object.assign(current, validateService(payload, database), { updatedAt: new Date().toISOString() })
        return current
      })
      return respond(response, 200, service)
    }

    if (match && request.method === 'DELETE') {
      requireRole(user, 'Proveedor')
      await mutateDatabase((database) => {
        const index = database.services.findIndex((item) => item.id === match[1] && item.providerId === user.id)
        if (index === -1) throw new ApiError(404, 'El servicio no existe.')
        database.services.splice(index, 1)
      })
      return respond(response, 200, { ok: true })
    }

    return respond(response, 404, { error: 'Ruta no encontrada.' })
  } catch (error) {
    if (!(error instanceof ApiError)) console.error(error)
    return respond(response, error.status || 500, { error: error.status ? error.message : 'No se pudo acceder a los datos. Inténtalo de nuevo.' })
  }
}
