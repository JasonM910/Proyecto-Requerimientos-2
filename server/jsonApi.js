import { randomUUID } from 'node:crypto'
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { clearSession, createSession, publicUser, sessionUser, verifyCredentials } from './auth.js'

const databasePath = process.env.HOGAR_DB_PATH
  ? resolve(process.env.HOGAR_DB_PATH)
  : fileURLToPath(new URL('../data/db.json', import.meta.url))
const demoUserId = 'proveedor-demo'
const maxBodyBytes = 16_384
const maxImageBytes = 3 * 1024 * 1024
const maxImageBodyBytes = 13 * 1024 * 1024
const maxImages = 3
let mutationQueue = Promise.resolve()
let databaseCache = null
let databaseLoad = null

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readDatabase() {
  const info = await stat(databasePath, { bigint: true })
  const stamp = `${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`
  if (databaseCache?.stamp === stamp) return databaseCache.database
  if (databaseLoad?.stamp === stamp) return databaseLoad.promise
  const promise = readFile(databasePath, 'utf8').then((contents) => {
    const database = JSON.parse(contents)
    if (!Array.isArray(database.users) || !Array.isArray(database.categories) || !Array.isArray(database.services) || !Array.isArray(database.profiles) || !Array.isArray(database.clientProfiles) || !Array.isArray(database.requests)) {
      throw new Error('La estructura de data/db.json no es válida.')
    }
    databaseCache = { stamp, database }
    return database
  })
  databaseLoad = { stamp, promise }
  try { return await promise } finally { if (databaseLoad?.promise === promise) databaseLoad = null }
}

async function writeDatabase(database) {
  const temporaryPath = `${databasePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, databasePath)
    databaseCache = null
  } catch (error) {
    try { await unlink(temporaryPath) } catch { /* Nothing to clean up. */ }
    throw error
  }
}

function mutateDatabase(change) {
  const operation = mutationQueue.then(async () => {
    const database = structuredClone(await readDatabase())
    const result = await change(database)
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

async function readBody(request, limit = maxBodyBytes) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > limit) throw new ApiError(413, 'La solicitud es demasiado grande.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError(400, 'El contenido debe ser JSON válido.') }
}

async function validateImages(value, fallback = [], { maxCount = maxImages, maxDimension = 1600 } = {}) {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.length > maxCount) throw new ApiError(400, `Puedes adjuntar hasta ${maxCount} imágenes.`)
  return Promise.all(value.map(async (image) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw new ApiError(400, 'La imagen no es válida.')
    const name = cleanText(image.name, 100, 'El nombre de la imagen')
    if (!name) throw new ApiError(400, 'La imagen debe tener un nombre.')
    const stored = fallback.find((item) => item.name === name && item.dataUrl === image.dataUrl)
    if (stored) return stored
    if (typeof image.dataUrl !== 'string') throw new ApiError(400, 'La imagen no es válida.')
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl)
    if (!match) throw new ApiError(400, 'Adjunta únicamente imágenes JPG o PNG.')
    const bytes = Buffer.from(match[2], 'base64')
    if (!bytes.length || bytes.length > maxImageBytes || bytes.toString('base64') !== match[2]) {
      throw new ApiError(400, 'Cada imagen debe ser válida y pesar menos de 3 MB.')
    }
    try {
      const source = sharp(bytes, { limitInputPixels: 16_000_000 })
      const metadata = await source.metadata()
      if (metadata.format !== match[1] || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
        throw new ApiError(400, 'El contenido de la imagen no coincide con su formato JPG o PNG.')
      }
      const pipeline = source.autoOrient().resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      const optimized = await (match[1] === 'jpeg'
        ? pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
        : pipeline.png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer())
      if (!optimized.length || optimized.length > maxImageBytes) throw new ApiError(400, 'La imagen optimizada supera el límite de 3 MB.')
      return { name, dataUrl: `data:image/${match[1]};base64,${optimized.toString('base64')}` }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(400, 'La imagen no se pudo procesar. Usa un archivo JPG o PNG válido.')
    }
  }))
}

async function validateService(payload, database, existingImages = []) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Datos del servicio no válidos.')
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const description = typeof payload.description === 'string' ? payload.description.trim() : ''
  const category = payload.category
  if (!title || title.length > 80) throw new ApiError(400, 'El título es obligatorio y debe tener como máximo 80 caracteres.')
  if (!description || description.length > 800) throw new ApiError(400, 'La descripción es obligatoria y debe tener como máximo 800 caracteres.')
  if (!database.categories.some((item) => item.name === category)) throw new ApiError(400, 'Selecciona una categoría válida.')
  return { title: protectPublicText(title), description: protectPublicText(description), category, images: await validateImages(payload.images, existingImages) }
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

async function validateProfile(payload, existingImages = []) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Datos del perfil no válidos.')
  const name = cleanText(payload.name, 60, 'El nombre')
  if (!name) throw new ApiError(400, 'El nombre es obligatorio.')
  const years = payload.experienceYears ?? null
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) throw new ApiError(400, 'Los años de experiencia deben ser un número entre 0 y 60.')
  if (!Array.isArray(payload.zones)) throw new ApiError(400, 'Agrega al menos una zona de atención.')
  const zones = []
  for (const item of payload.zones) {
    const zone = cleanText(item, 40, 'Cada zona').replace(/\s+/g, ' ')
    if (zone && !zones.some((existing) => existing.toLowerCase() === zone.toLowerCase())) zones.push(protectPublicText(zone))
  }
  if (!zones.length) throw new ApiError(400, 'Agrega al menos una zona de atención.')
  if (zones.length > 10) throw new ApiError(400, 'Puedes agregar hasta 10 zonas.')
  const email = cleanText(payload.email, 120, 'El correo electrónico')
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, 'El correo electrónico no es válido.')
  return {
    name: protectPublicText(name),
    headline: protectPublicText(cleanText(payload.headline, 80, 'La especialidad')),
    about: protectPublicText(cleanText(payload.about, 600, 'La descripción personal')),
    experienceYears: years,
    experience: protectPublicText(cleanText(payload.experience, 600, 'La descripción de la experiencia')),
    zones,
    images: await validateImages(payload.images, existingImages, { maxCount: 1, maxDimension: 512 }),
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
  return { providerId, name: user?.name || '', headline: '', about: '', experienceYears: null, experience: '', zones: [], images: [], email: '', phone: '', address: '', legalId: '', verificationDocuments: '', bankAccount: '', updatedAt: null }
}

function toPublicProfile(profile) {
  const { providerId, name, headline, about, experienceYears, experience, zones, images = [] } = profile
  return { providerId, name, headline, about, experienceYears, experience, zones, images, verified: isVerified(profile) }
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
  return { name: protectPublicText(name), phone, email, address }
}

const chronological = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
const contactAllowed = (status) => ['Aceptado', 'En proceso', 'Finalizado'].includes(status)
const requestUrgencies = ['Flexible', 'Próximos días', 'Urgente']

function requiredText(value, min, max, label) {
  const text = cleanText(value, max, label)
  if (text.length < min) throw new ApiError(400, `${label} debe tener al menos ${min} caracteres.`)
  return text
}

function safeReportText(value, min, max, label) {
  const text = requiredText(value, min, max, label)
  const forbiddenControl = [...text].some((character) => {
    const code = character.codePointAt(0)
    return (code < 32 && character !== '\n' && character !== '\t') || code === 127
  })
  if (/[<>]|javascript:|data:text\/html/i.test(text) || forbiddenControl) {
    throw new ApiError(400, `${label} contiene caracteres o código no permitido.`)
  }
  return text
}

// Teléfonos de 8 dígitos (con o sin separador), con prefijo opcional, o en pares; correos y enlaces.
// No bloquea montos como "1 500 000".
const contactPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|cr|io|me)\b|\+?\d{3}[\s-]?\d{4}[\s-]?\d{4}|\d{4}[\s-]?\d{4}|\d{2}[\s-]\d{2}[\s-]\d{2}[\s-]\d{2}/i
const privateLocationPattern = /\b(?:calle|avenida|av\.?|casa|apartamento|apto\.?|lote|edificio)\s*(?:(?:n[uú]mero|n[º°.]?|#)\s*)?\d{1,5}\b/i

function protectOpenMessage(text) {
  if (contactPattern.test(text) || privateLocationPattern.test(text)) {
    throw new ApiError(400, 'No incluyas teléfonos, correos, enlaces ni direcciones exactas antes de aceptar la solicitud. Usa el campo de indicaciones privadas.')
  }
  return text
}

// Para textos que ve cualquier cliente (perfil y publicaciones).
function protectPublicText(text) {
  if (contactPattern.test(text) || privateLocationPattern.test(text)) {
    throw new ApiError(400, 'No incluyas teléfonos, correos, enlaces ni direcciones exactas en textos públicos. Usa los campos privados.')
  }
  return text
}

function requestHistory(item) {
  return Array.isArray(item.history) && item.history.length
    ? item.history
    : [{ status: item.status, at: item.createdAt, actor: 'Sistema', action: 'demo' }]
}

function requestView(item, database, role) {
  const base = {
    id: item.id, serviceId: item.serviceId, serviceTitle: item.serviceTitle,
    providerName: item.providerName, createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt, status: item.status,
    need: item.need, urgency: item.urgency || null, location: item.location || null,
    estimate: item.estimate ?? null, history: requestHistory(item), images: item.images ?? [],
    ...financeView(item),
  }
  if (role === 'Cliente') {
    const provider = findProfile(database, item.providerId)
    return {
      ...base,
      providerVerified: isVerified(provider), directions: item.directions || '',
      providerContact: contactAllowed(item.status) ? { phone: provider.phone, email: provider.email } : null,
    }
  }
  const client = findClientProfile(database, item.clientId)
  return {
    ...base, clientName: client.name,
    ...(contactAllowed(item.status) ? { directions: item.directions || '' } : {}),
    clientContact: contactAllowed(item.status)
      ? { phone: client.phone, email: client.email, address: client.address }
      : null,
  }
}

function appendRequestEvent(item, status, actor, action, note = '', amount = null) {
  const at = new Date().toISOString()
  item.history = [...requestHistory(item), { status, at, actor, action, ...(note ? { note } : {}), ...(amount !== null ? { amount } : {}) }]
  item.status = status
  item.updatedAt = at
}

const quoteItemTypes = ['Mano de obra', 'Materiales', 'Transporte', 'Otro']
const taxRates = [0, 13]
const paymentMethods = ['SINPE Móvil', 'Transferencia', 'Tarjeta (simulado)', 'Efectivo']
const paidStatuses = ['Aceptado', 'En proceso', 'Finalizado']
const maxTotalCents = 10_000_000_000
function decimalCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) return null
  const result = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  return Number.isSafeInteger(result) ? result : null
}
function cents(value) {
  const result = decimalCents(value)
  if (result === null) throw new ApiError(500, 'Se encontró un monto inválido en los datos guardados.')
  return result
}
const isMoney = (value, max) => decimalCents(value) !== null && value > 0 && value <= max
const roundRatio = (numerator, denominator) => Number((BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator))

// Los cálculos se hacen en céntimos enteros para evitar errores de redondeo.
function validateQuoteItems(payload) {
  if (!Array.isArray(payload.items) || !payload.items.length) throw new ApiError(400, 'Agrega al menos un concepto a la cotización.')
  if (payload.items.length > 10) throw new ApiError(400, 'Puedes agregar hasta 10 conceptos.')
  const taxRate = payload.taxRate ?? 0
  if (!taxRates.includes(taxRate)) throw new ApiError(400, 'Selecciona un impuesto válido (0 % o 13 %).')
  const items = payload.items.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new ApiError(400, 'Concepto de cotización no válido.')
    const description = protectOpenMessage(requiredText(entry.description, 3, 80, 'La descripción del concepto'))
    const type = entry.type ?? 'Otro'
    if (!quoteItemTypes.includes(type)) throw new ApiError(400, 'Selecciona un tipo de concepto válido.')
    if (!isMoney(entry.quantity, 1000)) throw new ApiError(400, 'La cantidad debe ser mayor que cero y tener hasta dos decimales.')
    if (!isMoney(entry.unitPrice, 100_000_000)) throw new ApiError(400, 'El precio unitario debe ser mayor que cero y tener hasta dos decimales.')
    return { description, type, quantity: entry.quantity, unitPrice: entry.unitPrice, lineCents: roundRatio(BigInt(cents(entry.quantity)) * BigInt(cents(entry.unitPrice)), 100) }
  })
  const subtotalCents = items.reduce((sum, entry) => sum + entry.lineCents, 0)
  const taxCents = roundRatio(BigInt(subtotalCents) * BigInt(taxRate), 100)
  const totalCents = subtotalCents + taxCents
  if (totalCents > maxTotalCents) throw new ApiError(400, 'El total no puede superar ₡100 000 000.')
  return {
    items: items.map(({ lineCents, ...entry }) => ({ ...entry, lineTotal: lineCents / 100 })),
    taxRate, subtotal: subtotalCents / 100, tax: taxCents / 100, total: totalCents / 100,
  }
}

function buildQuote(item, payload, actor) {
  // Se mantiene la cotización simple por monto: se convierte en un único concepto.
  const body = payload.items === undefined && payload.amount !== undefined
    ? { items: [{ description: 'Estimación general del trabajo', type: 'Otro', quantity: 1, unitPrice: payload.amount }], taxRate: 0 }
    : payload
  const detail = validateQuoteItems(body)
  const version = (item.quotes?.length ?? 0) + 1
  const quote = { version, by: actor, at: new Date().toISOString(), ...detail }
  item.quotes = [...(item.quotes ?? []), quote]
  item.estimate = quote.total
  return quote
}

const currentQuote = (item) => item.quotes?.length ? item.quotes[item.quotes.length - 1] : null
const agreedTotal = (item) => item.agreement?.total ?? null
const paidTotal = (item) => (item.payments ?? []).reduce((sum, payment) => sum + cents(payment.amount), 0) / 100

function nextInvoiceNumber(database) {
  const year = new Date().getFullYear()
  const used = database.requests.filter((entry) => entry.invoice?.number?.startsWith(`HOG-${year}-`)).length
  return `HOG-${year}-${String(used + 1).padStart(4, '0')}`
}

function financeView(item) {
  const quote = currentQuote(item)
  const total = agreedTotal(item)
  const paid = paidTotal(item)
  return {
    quote, quotes: item.quotes ?? [], counter: item.counter ?? null,
    agreement: item.agreement ?? null, payments: item.payments ?? [], invoice: item.invoice ?? null,
    paid, balance: total === null ? null : (cents(total) - cents(paid)) / 100,
  }
}

// Verificación, reportes y protección de datos.
const verificationRetryStates = ['Sin verificar', 'Rechazado']
const reportCategories = ['Conducta inapropiada', 'Incumplimiento del servicio', 'Cobro o pago irregular', 'Datos personales o contacto externo', 'Perfil o publicación falsa', 'Otra anomalía']

const verificationOf = (profile) => ({ status: 'Sin verificar', requestedAt: null, reviewedAt: null, note: '', ...(profile.verification || {}) })
const isVerified = (profile) => verificationOf(profile).status === 'Verificado'

function verificationChecks(profile) {
  const filled = (value) => typeof value === 'string' && value.trim() !== ''
  return [
    { key: 'identity', label: 'Identificación legal registrada', met: filled(profile.legalId) },
    { key: 'document', label: 'Documento de verificación indicado', met: filled(profile.verificationDocuments) },
    { key: 'contact', label: 'Correo y teléfono de contacto', met: filled(profile.email) && filled(profile.phone) },
    { key: 'experience', label: 'Experiencia y zonas de atención descritas', met: filled(profile.experience) && (profile.zones ?? []).length > 0 },
  ]
}

function verificationView(profile) {
  const state = verificationOf(profile)
  const checks = verificationChecks(profile)
  return { ...state, checks, canRequest: verificationRetryStates.includes(state.status) && checks.every((check) => check.met) }
}

function reportView(report) {
  const { id, category, description, targetName, requestId, requestTitle, status, createdAt, updatedAt, history } = report
  return { id, category, description, targetName, requestId, requestTitle, status, createdAt, updatedAt, history }
}

function requireRole(user, role) {
  if (user.role !== role) throw new ApiError(403, 'No tienes acceso a este módulo.')
}

// La búsqueda conserva solo la información pública del proveedor.
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const activeService = (service) => service.status !== 'inactive'
const searchIndexCache = new WeakMap()
function trigrams(value) {
  const grams = new Set()
  for (let index = 0; index <= value.length - 3; index += 1) grams.add(value.slice(index, index + 3))
  return grams
}

function indexedCatalog(database) {
  const cached = searchIndexCache.get(database)
  if (cached) return cached
  const profiles = new Map(database.profiles.map((profile) => [profile.providerId, profile]))
  const categoryGroups = new Map()
  for (const category of database.categories) {
    const group = category.group || 'Otros servicios'
    if (!categoryGroups.has(group)) categoryGroups.set(group, new Set())
    categoryGroups.get(group).add(category.name)
  }
  const zoneOptions = new Map()
  for (const profile of profiles.values()) for (const zone of profile.zones ?? []) zoneOptions.set(fold(zone), zoneOptions.get(fold(zone)) || zone)
  const records = database.services.filter(activeService).map((service) => {
    const profile = profiles.get(service.providerId) || findProfile(database, service.providerId)
    return {
      service, profile, title: fold(service.title), description: fold(service.description),
      meta: fold(`${service.category} ${profile.name} ${profile.headline}`),
      zones: new Set((profile.zones ?? []).map(fold)), updatedAt: Date.parse(service.updatedAt) || 0,
    }
  })
  const textIndex = new Map()
  records.forEach((record, position) => {
    for (const gram of trigrams(`${record.title} ${record.description} ${record.meta}`)) {
      if (!textIndex.has(gram)) textIndex.set(gram, new Set())
      textIndex.get(gram).add(position)
    }
  })
  const index = { records, profiles, textIndex, categoryGroups, zones: [...zoneOptions.values()].sort((a, b) => a.localeCompare(b, 'es')) }
  searchIndexCache.set(database, index)
  return index
}

function searchServices(database, params) {
  const index = indexedCatalog(database)
  const terms = fold(params.get('q')).slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 8)
  const category = params.get('category') || ''
  const group = params.get('group') || ''
  const groupCategories = index.categoryGroups.get(group)
  const zone = fold(params.get('zone'))

  let candidates = null
  for (const term of terms.filter((value) => value.length >= 3)) {
    for (const gram of trigrams(term)) {
      const positions = index.textIndex.get(gram)
      if (!positions) return { categories: database.categories, zones: index.zones, total: 0, results: [] }
      candidates = candidates === null ? new Set(positions) : new Set([...candidates].filter((position) => positions.has(position)))
      if (!candidates.size) return { categories: database.categories, zones: index.zones, total: 0, results: [] }
    }
  }

  const found = []
  for (const position of candidates ?? index.records.keys()) {
    const record = index.records[position]
    const { service, profile } = record
    if (group && !groupCategories?.has(service.category)) continue
    if (category && service.category !== category) continue
    if (zone && !record.zones.has(zone)) continue

    let score = 0
    const matchesAll = terms.every((term) => {
      const inTitle = record.title.includes(term)
      const inMeta = record.meta.includes(term)
      const inDescription = record.description.includes(term)
      score += (inTitle ? 3 : 0) + (inMeta ? 2 : 0) + (inDescription ? 1 : 0)
      return inTitle || inMeta || inDescription
    })
    if (!matchesAll) continue

    found.push({
      score, updatedAt: record.updatedAt,
      service: {
        id: service.id,
        title: service.title,
        category: service.category,
        description: service.description,
        images: service.images ?? [],
        updatedAt: service.updatedAt,
        provider: { id: profile.providerId, name: profile.name, headline: profile.headline, about: profile.about, experienceYears: profile.experienceYears, experience: profile.experience, zones: profile.zones ?? [], images: profile.images ?? [], verified: isVerified(profile) },
      },
    })
  }
  found.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
  return {
    categories: database.categories,
    zones: index.zones,
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
      const user = sessionUser(request, response, database)
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
      const user = await verifyCredentials(await readDatabase(), identifier, password)
      if (!user) throw new ApiError(401, 'Credenciales incorrectas.')
      createSession(request, response, user)
      return respond(response, 200, { user: publicUser(user) })
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      clearSession(request, response)
      return respond(response, 200, { ok: true })
    }

    const database = await readDatabase()
    const user = sessionUser(request, response, database)
    if (!user) throw new ApiError(401, 'Inicia sesión para continuar.')

    if (pathname === '/api/dashboard' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      return respond(response, 200, { user: publicUser(user), categories: database.categories, services: database.services.filter((item) => item.providerId === user.id && activeService(item)) })
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
      const providerId = new URL(request.url, 'http://localhost').searchParams.get('providerId') || demoUserId
      const provider = database.users.find((item) => item.id === providerId && item.role === 'Proveedor')
      if (!provider) throw new ApiError(404, 'Proveedor no encontrado.')
      return respond(response, 200, toPublicProfile(indexedCatalog(database).profiles.get(providerId) || findProfile(database, providerId)))
    }

    if (pathname === '/api/profile' && request.method === 'PUT') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request, maxImageBodyBytes)
      const profile = await mutateDatabase(async (database) => {
        const fields = await validateProfile(payload, database.profiles.find((item) => item.providerId === user.id)?.images ?? [])
        let current = database.profiles.find((item) => item.providerId === user.id)
        if (!current) {
          current = { providerId: user.id }
          database.profiles.push(current)
        }
        const identityBefore = `${current.legalId || ''}|${current.verificationDocuments || ''}`
        Object.assign(current, fields, { updatedAt: new Date().toISOString() })
        if (identityBefore !== `${fields.legalId}|${fields.verificationDocuments}` && ['Verificado', 'En revisión'].includes(verificationOf(current).status)) {
          current.verification = { status: 'Sin verificar', requestedAt: null, reviewedAt: null, note: 'Cambiaste tus datos de identidad: solicita una nueva verificación.' }
        }
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
        .sort(chronological).map((item) => requestView(item, database, 'Cliente'))
      return respond(response, 200, { requests })
    }

    if (pathname === '/api/client/requests' && request.method === 'POST') {
      requireRole(user, 'Cliente')
      const payload = await readBody(request, maxImageBodyBytes)
      const created = await mutateDatabase(async (currentDatabase) => {
        const service = currentDatabase.services.find((item) => item.id === payload?.serviceId && activeService(item))
        if (!service) throw new ApiError(404, 'El servicio ya no está disponible.')
        if (!currentDatabase.users.some((item) => item.id === service.providerId && item.role === 'Proveedor')) {
          throw new ApiError(404, 'El proveedor no está disponible.')
        }
        const need = protectOpenMessage(requiredText(payload.need, 10, 1000, 'La descripción del trabajo'))
        const location = requiredText(payload.location, 3, 120, 'La zona general')
        const providerProfile = findProfile(currentDatabase, service.providerId)
        if (!(providerProfile.zones ?? []).some((zone) => fold(zone) === fold(location))) {
          throw new ApiError(400, 'Selecciona una zona de atención del proveedor.')
        }
        const directions = cleanText(payload.directions, 300, 'Las indicaciones privadas')
        const images = await validateImages(payload.images)
        if (!requestUrgencies.includes(payload.urgency)) throw new ApiError(400, 'Selecciona una urgencia válida.')
        const at = new Date().toISOString()
        const item = {
          id: randomUUID(), clientId: user.id, providerId: service.providerId,
          serviceId: service.id, serviceTitle: service.title,
          providerName: providerProfile.name,
          need, urgency: payload.urgency, location, directions, images, createdAt: at, updatedAt: at,
          status: 'Pendiente', history: [{ status: 'Pendiente', at, actor: 'Cliente', action: 'created' }],
        }
        currentDatabase.requests.unshift(item)
        return requestView(item, currentDatabase, 'Cliente')
      })
      return respond(response, 201, { request: created })
    }

    if (pathname === '/api/provider/requests' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      const requests = database.requests.filter((item) => item.providerId === user.id)
        .sort(chronological).map((item) => requestView(item, database, 'Proveedor'))
      return respond(response, 200, { requests })
    }

    if (pathname === '/api/billing' && request.method === 'GET') {
      const isProvider = user.role === 'Proveedor'
      const params = new URL(request.url, 'http://localhost').searchParams
      const period = ['month', 'year'].includes(params.get('period')) ? params.get('period') : 'all'
      const now = new Date()
      const inPeriod = (value) => {
        if (period === 'all') return true
        const date = new Date(value)
        return date.getFullYear() === now.getFullYear() && (period === 'year' || date.getMonth() === now.getMonth())
      }
      const owned = database.requests.filter((item) => (isProvider ? item.providerId : item.clientId) === user.id)
      const mine = owned.filter((item) => item.agreement && inPeriod(item.agreement.at || item.createdAt))
        .sort((a, b) => new Date(b.agreement.at || b.createdAt) - new Date(a.agreement.at || a.createdAt))
      const records = mine.map((item) => {
        const view = requestView(item, database, user.role)
        return { ...view, counterpart: isProvider ? view.clientName : view.providerName }
      })
      const active = records.filter((item) => item.status !== 'Cancelado')
      const sum = (list, pick) => list.reduce((total, item) => total + cents(pick(item)), 0)
      const agreed = sum(active, (item) => item.agreement.total)
      const paid = sum(active, (item) => item.paid)
      const closed = sum(active.filter((item) => item.invoice), (item) => item.agreement.total)
      const quoted = owned.reduce((total, item) => {
        const quote = currentQuote(item)
        return quote && inPeriod(quote.at) ? total + cents(quote.total) : total
      }, 0)
      return respond(response, 200, {
        period,
        records,
        totals: { quoted: quoted / 100, agreed: agreed / 100, paid: paid / 100, balance: (agreed - paid) / 100, closed: closed / 100 },
      })
    }

    const clientRequestMatch = pathname.match(/^\/api\/client\/requests\/([a-zA-Z0-9-]+)$/)
    if (clientRequestMatch && request.method === 'PATCH') {
      requireRole(user, 'Cliente')
      const payload = await readBody(request)
      const updated = await mutateDatabase((currentDatabase) => {
        const item = currentDatabase.requests.find((entry) => entry.id === clientRequestMatch[1] && entry.clientId === user.id)
        if (!item) throw new ApiError(404, 'Solicitud no encontrada.')
        if (payload?.action === 'reply' && item.status === 'Aclaración solicitada') {
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'La respuesta'))
          appendRequestEvent(item, 'Pendiente', 'Cliente', 'reply', note)
        } else if (payload?.action === 'accept' && ['Cotizado', 'Propuesta recibida'].includes(item.status)) {
          const quote = currentQuote(item)
          const at = new Date().toISOString()
          if (quote) item.agreement = { total: quote.total, quoteVersion: quote.version, via: 'Presupuesto aprobado por el cliente', at }
          appendRequestEvent(item, 'Aceptado', 'Cliente', 'accept', '', quote ? quote.total : null)
        } else if (payload?.action === 'counter' && item.status === 'Cotizado') {
          const quote = currentQuote(item)
          if (!quote) throw new ApiError(409, 'Esta solicitud aún no tiene un presupuesto detallado para negociar.')
          if (item.quotes.length >= 4) throw new ApiError(409, 'Se alcanzó el límite de negociaciones. Acepta el presupuesto o conversa con el proveedor por otro medio.')
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'El mensaje de la contraoferta'))
          const amount = payload.amount
          if (!isMoney(amount, quote.total) || cents(amount) >= cents(quote.total)) {
            throw new ApiError(400, 'La contraoferta debe ser un monto positivo, menor que el presupuesto actual y con hasta dos decimales.')
          }
          item.counter = { amount, message: note, quoteVersion: quote.version, at: new Date().toISOString() }
          appendRequestEvent(item, 'Contraoferta', 'Cliente', 'counter', note, amount)
        } else if (payload?.action === 'pay' && paidStatuses.includes(item.status)) {
          const total = agreedTotal(item)
          if (total === null) throw new ApiError(409, 'Aún no hay un monto acordado para registrar pagos.')
          const balance = cents(total) - cents(paidTotal(item))
          if (balance <= 0) throw new ApiError(409, 'Este servicio ya está pagado por completo.')
          if (!paymentMethods.includes(payload.method)) throw new ApiError(400, 'Selecciona un método de pago válido.')
          if (!isMoney(payload.amount, balance / 100)) throw new ApiError(400, 'El monto debe ser positivo, no superar el saldo pendiente y tener hasta dos decimales.')
          const at = new Date().toISOString()
          const sequence = (item.payments?.length ?? 0) + 1
          item.payments = [...(item.payments ?? []), { id: randomUUID(), reference: `PAGO-${item.id.slice(0, 6).toUpperCase()}-${sequence}`, amount: payload.amount, method: payload.method, simulated: true, at }]
          if (cents(total) - cents(paidTotal(item)) === 0 && !item.invoice) {
            item.invoice = { number: nextInvoiceNumber(currentDatabase), issuedAt: at, total }
          }
          appendRequestEvent(item, item.status, 'Cliente', 'pay', '', payload.amount)
        } else if (payload?.action === 'adjust' && item.status === 'Cotizado') {
          if (!currentQuote(item)) throw new ApiError(409, 'Esta solicitud aún no tiene un presupuesto detallado.')
          if (item.quotes.length >= 4) throw new ApiError(409, 'Se alcanzó el límite de negociaciones. Acepta o rechaza el presupuesto.')
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'El mensaje de ajustes'))
          appendRequestEvent(item, 'Ajustes solicitados', 'Cliente', 'adjust', note)
        } else if (payload?.action === 'reject' && ['Cotizado', 'Propuesta recibida', 'Contraoferta'].includes(item.status)) {
          const note = protectOpenMessage(cleanText(payload.message, 600, 'El mensaje'))
          item.counter = null
          appendRequestEvent(item, 'Rechazada', 'Cliente', 'reject', note)
        } else if (payload?.action === 'cancel' && item.status === 'Aceptado') {
          if (paidTotal(item) > 0) throw new ApiError(409, 'No se puede cancelar un acuerdo que ya tiene pagos registrados.')
          appendRequestEvent(item, 'Cancelado', 'Cliente', 'cancel')
        } else throw new ApiError(409, 'Esta acción no corresponde al estado actual de la solicitud.')
        return requestView(item, currentDatabase, 'Cliente')
      })
      return respond(response, 200, { request: updated })
    }

    const providerRequestMatch = pathname.match(/^\/api\/provider\/requests\/([a-zA-Z0-9-]+)$/)
    if (providerRequestMatch && request.method === 'PATCH') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request)
      const updated = await mutateDatabase((currentDatabase) => {
        const item = currentDatabase.requests.find((entry) => entry.id === providerRequestMatch[1] && entry.providerId === user.id)
        if (!item) throw new ApiError(404, 'Solicitud no encontrada.')
        const action = payload?.action
        if (['clarify', 'offer'].includes(action) && item.status === 'Pendiente') {
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'La respuesta'))
          appendRequestEvent(item, action === 'clarify' ? 'Aclaración solicitada' : 'Propuesta recibida', 'Proveedor', action, note)
        } else if (action === 'quote' && ['Pendiente', 'Propuesta recibida'].includes(item.status)) {
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'La respuesta'))
          const quote = buildQuote(item, payload, 'Proveedor')
          appendRequestEvent(item, 'Cotizado', 'Proveedor', action, note, quote.total)
        } else if (action === 'revise' && ['Contraoferta', 'Ajustes solicitados'].includes(item.status)) {
          const note = protectOpenMessage(requiredText(payload.message, 5, 600, 'La respuesta'))
          const quote = buildQuote(item, payload, 'Proveedor')
          item.counter = null
          appendRequestEvent(item, 'Cotizado', 'Proveedor', action, note, quote.total)
        } else if (action === 'agree' && item.status === 'Contraoferta') {
          const note = cleanText(payload.message, 600, 'El mensaje')
          const quote = currentQuote(item)
          const at = new Date().toISOString()
          item.agreement = { total: item.counter.amount, quoteVersion: quote.version, adjustment: (cents(item.counter.amount) - cents(quote.total)) / 100, via: 'Contraoferta aceptada por el proveedor', at }
          item.estimate = item.counter.amount
          const agreed = item.counter.amount
          item.counter = null
          appendRequestEvent(item, 'Aceptado', 'Proveedor', action, note, agreed)
        } else if (action === 'start' && item.status === 'Aceptado') {
          appendRequestEvent(item, 'En proceso', 'Proveedor', action)
        } else if (action === 'finish' && item.status === 'En proceso') {
          appendRequestEvent(item, 'Finalizado', 'Proveedor', action)
          if (item.agreement && !item.invoice) item.invoice = { number: nextInvoiceNumber(currentDatabase), issuedAt: item.updatedAt, total: item.agreement.total }
        } else if (action === 'cancel' && item.status === 'Aceptado') {
          if (paidTotal(item) > 0) throw new ApiError(409, 'No se puede cancelar un acuerdo que ya tiene pagos registrados.')
          appendRequestEvent(item, 'Cancelado', 'Proveedor', 'cancel')
        } else throw new ApiError(409, 'Esta acción no corresponde al estado actual de la solicitud.')
        return requestView(item, currentDatabase, 'Proveedor')
      })
      return respond(response, 200, { request: updated })
    }

    if (pathname === '/api/provider/verification' && request.method === 'GET') {
      requireRole(user, 'Proveedor')
      return respond(response, 200, verificationView(findProfile(database, user.id)))
    }

    if (pathname === '/api/provider/verification' && request.method === 'PATCH') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request)
      const view = await mutateDatabase((currentDatabase) => {
        const current = currentDatabase.profiles.find((item) => item.providerId === user.id)
        if (!current) throw new ApiError(404, 'Completa primero tu perfil.')
        const state = verificationOf(current)
        const at = new Date().toISOString()
        if (payload?.action === 'request') {
          if (!verificationRetryStates.includes(state.status)) throw new ApiError(409, 'Tu verificación ya está en curso o completada.')
          if (!verificationChecks(current).every((check) => check.met)) throw new ApiError(400, 'Completa los datos requeridos de tu perfil antes de solicitar la verificación.')
          current.verification = { status: 'En revisión', requestedAt: at, reviewedAt: null, note: '' }
        } else throw new ApiError(409, 'Esta acción no corresponde al estado actual de la verificación.')
        return verificationView(current)
      })
      return respond(response, 200, view)
    }

    if (pathname === '/api/admin/verifications' && request.method === 'GET') {
      requireRole(user, 'Administrador')
      const verifications = database.profiles.map((profile) => ({
        providerId: profile.providerId, name: profile.name,
        legalId: profile.legalId || '', documentReference: profile.verificationDocuments || '',
        email: profile.email || '', phone: profile.phone || '',
        experience: profile.experience || '', zones: profile.zones || [],
        ...verificationView(profile),
      })).sort((a, b) => Number(b.status === 'En revisión') - Number(a.status === 'En revisión') || a.name.localeCompare(b.name, 'es'))
      return respond(response, 200, { verifications })
    }

    const verificationMatch = pathname.match(/^\/api\/admin\/verifications\/([a-zA-Z0-9-]+)$/)
    if (verificationMatch && request.method === 'PATCH') {
      requireRole(user, 'Administrador')
      const payload = await readBody(request)
      const updated = await mutateDatabase((currentDatabase) => {
        const profile = currentDatabase.profiles.find((item) => item.providerId === verificationMatch[1])
        if (!profile) throw new ApiError(404, 'Proveedor no encontrado.')
        if (verificationOf(profile).status !== 'En revisión') throw new ApiError(409, 'Este perfil no está pendiente de revisión.')
        if (!['approve', 'reject'].includes(payload?.action)) throw new ApiError(400, 'Acción de revisión no válida.')
        if (payload.action === 'approve' && !verificationChecks(profile).every((check) => check.met)) {
          throw new ApiError(409, 'El perfil ya no cumple todos los criterios de verificación.')
        }
        const note = payload.action === 'reject'
          ? requiredText(payload.note, 5, 200, 'El motivo del rechazo')
          : cleanText(payload.note, 200, 'La observación')
        const at = new Date().toISOString()
        profile.verification = {
          ...verificationOf(profile), status: payload.action === 'approve' ? 'Verificado' : 'Rechazado',
          reviewedAt: at, reviewedBy: user.id, note,
        }
        return { providerId: profile.providerId, ...verificationView(profile) }
      })
      return respond(response, 200, { verification: updated })
    }

    if (pathname === '/api/admin/reports' && request.method === 'GET') {
      requireRole(user, 'Administrador')
      const reports = (database.reports ?? []).slice().sort(chronological).map((report) => ({
        ...reportView(report), reporterName: database.users.find((item) => item.id === report.reporterId)?.name || 'Usuario',
        reporterRole: report.reporterRole,
      }))
      return respond(response, 200, { reports })
    }

    const adminReportMatch = pathname.match(/^\/api\/admin\/reports\/([a-zA-Z0-9-]+)$/)
    if (adminReportMatch && request.method === 'PATCH') {
      requireRole(user, 'Administrador')
      const payload = await readBody(request)
      const updated = await mutateDatabase((currentDatabase) => {
        const report = (currentDatabase.reports ?? []).find((item) => item.id === adminReportMatch[1])
        if (!report) throw new ApiError(404, 'Reporte no encontrado.')
        const next = payload?.action === 'review' && report.status === 'Recibido' ? 'En revisión'
          : payload?.action === 'resolve' && report.status === 'En revisión' ? 'Resuelto' : null
        if (!next) throw new ApiError(409, 'Esta acción no corresponde al estado actual del reporte.')
        const note = safeReportText(payload.note, 5, 500, 'La respuesta del equipo')
        const at = new Date().toISOString()
        report.status = next
        report.updatedAt = at
        report.history.push({ status: next, at, note, reviewedBy: user.id })
        return { ...reportView(report), reporterName: currentDatabase.users.find((item) => item.id === report.reporterId)?.name || 'Usuario', reporterRole: report.reporterRole }
      })
      return respond(response, 200, { report: updated })
    }

    if (pathname === '/api/reports' && request.method === 'GET') {
      const reports = (database.reports ?? []).filter((item) => item.reporterId === user.id).sort(chronological).map(reportView)
      return respond(response, 200, { reports })
    }

    if (pathname === '/api/reports' && request.method === 'POST') {
      const payload = await readBody(request)
      const created = await mutateDatabase((currentDatabase) => {
        if (!reportCategories.includes(payload?.category)) throw new ApiError(400, 'Selecciona una categoría para el reporte.')
        const description = safeReportText(payload.description, 10, 800, 'La descripción del reporte')
        currentDatabase.reports ??= []
        const today = currentDatabase.reports.filter((item) => item.reporterId === user.id && Date.now() - new Date(item.createdAt) < 86_400_000)
        if (today.length >= 10) throw new ApiError(429, 'Alcanzaste el límite de reportes por día.')
        let targetName = ''
        let requestId = null
        let requestTitle = ''
        if (payload.requestId) {
          const related = currentDatabase.requests.find((item) => item.id === payload.requestId && (item.clientId === user.id || item.providerId === user.id))
          if (!related) throw new ApiError(404, 'La solicitud no existe.')
          requestId = related.id
          requestTitle = related.serviceTitle
          targetName = user.role === 'Cliente' ? related.providerName : findClientProfile(currentDatabase, related.clientId).name
        } else if (payload.providerId) {
          if (user.role !== 'Cliente') throw new ApiError(403, 'Solo los clientes pueden reportar el perfil de un proveedor.')
          const provider = currentDatabase.users.find((item) => item.id === payload.providerId && item.role === 'Proveedor')
          if (!provider) throw new ApiError(404, 'El proveedor no está disponible.')
          targetName = findProfile(currentDatabase, provider.id).name || provider.name
        }
        const at = new Date().toISOString()
        const report = {
          id: randomUUID(), reporterId: user.id, reporterRole: user.role, category: payload.category, description,
          targetName, requestId, requestTitle, status: 'Recibido', createdAt: at, updatedAt: at,
          history: [{ status: 'Recibido', at, note: 'Reporte enviado al equipo de Hogar+.' }],
        }
        currentDatabase.reports.unshift(report)
        return report
      })
      return respond(response, 201, { report: reportView(created) })
    }

    if (pathname === '/api/services' && request.method === 'POST') {
      requireRole(user, 'Proveedor')
      const payload = await readBody(request, maxImageBodyBytes)
      const service = await mutateDatabase(async (database) => {
        const fields = await validateService(payload, database)
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
      const payload = await readBody(request, maxImageBodyBytes)
      const service = await mutateDatabase(async (database) => {
        const current = database.services.find((item) => item.id === match[1] && item.providerId === user.id && activeService(item))
        if (!current) throw new ApiError(404, 'El servicio no existe.')
        Object.assign(current, await validateService(payload, database, current.images ?? []), { updatedAt: new Date().toISOString() })
        return current
      })
      return respond(response, 200, service)
    }

    if (match && request.method === 'DELETE') {
      requireRole(user, 'Proveedor')
      await mutateDatabase((database) => {
        const service = database.services.find((item) => item.id === match[1] && item.providerId === user.id && activeService(item))
        if (!service) throw new ApiError(404, 'El servicio no existe.')
        const at = new Date().toISOString()
        Object.assign(service, { status: 'inactive', deletedAt: at, updatedAt: at })
      })
      return respond(response, 200, { ok: true })
    }

    return respond(response, 404, { error: 'Ruta no encontrada.' })
  } catch (error) {
    if (!(error instanceof ApiError)) console.error(error)
    return respond(response, error.status || 500, { error: error.status ? error.message : 'No se pudo acceder a los datos. Inténtalo de nuevo.' })
  }
}
