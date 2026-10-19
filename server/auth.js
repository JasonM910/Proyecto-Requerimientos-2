import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt)
const cookieName = 'hogar_session'
export const sessionIdleMs = 30 * 60 * 1000
const sessions = new Map()
const currentScrypt = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
const legacyScrypt = { N: 2 ** 14, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }

export function publicUser(user) {
  return { id: user.id, name: user.name, initials: user.initials, role: user.role }
}

function cookieToken(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  return cookie?.slice(cookieName.length + 1) || null
}

function setSessionCookie(request, response, token, maxAge) {
  const secure = request.socket?.encrypted ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`)
}

export function sessionUser(request, response, database, now = Date.now()) {
  const token = cookieToken(request)
  const session = token && sessions.get(token)
  if (!session) {
    if (token) setSessionCookie(request, response, '', 0)
    return null
  }
  if (session.expiresAt <= now) {
    sessions.delete(token)
    setSessionCookie(request, response, '', 0)
    return null
  }
  const user = database.users.find((item) => item.id === session.userId)
  if (!user) {
    sessions.delete(token)
    setSessionCookie(request, response, '', 0)
    return null
  }
  if (request.headers['x-hogar-activity'] === '1') session.expiresAt = now + sessionIdleMs
  setSessionCookie(request, response, token, Math.ceil((session.expiresAt - now) / 1000))
  return user
}

function passwordParts(hash) {
  const parts = hash?.split(':') || []
  if (parts.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2])) {
    return { options: legacyScrypt, salt: parts[1], digest: parts[2] }
  }
  if (parts.length === 6 && parts[0] === 'scrypt' && Number(parts[1]) === currentScrypt.N && Number(parts[2]) === currentScrypt.r && Number(parts[3]) === currentScrypt.p && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5])) {
    return { options: currentScrypt, salt: parts[4], digest: parts[5] }
  }
  return null
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const digest = await deriveKey(password, salt, 64, currentScrypt)
  return `scrypt:${currentScrypt.N}:${currentScrypt.r}:${currentScrypt.p}:${salt}:${digest.toString('hex')}`
}

export async function verifyCredentials(database, identifier, password) {
  const normalized = identifier.toLowerCase()
  const user = database.users.find((item) => item.email?.toLowerCase() === normalized || item.username?.toLowerCase() === normalized)
  const saved = passwordParts(user?.passwordHash)
  const salt = saved?.salt || '00000000000000000000000000000000'
  const expected = Buffer.from(saved?.digest || '00'.repeat(64), 'hex')
  const calculated = await deriveKey(password, salt, 64, saved?.options || currentScrypt)
  return user && saved && timingSafeEqual(expected, calculated) ? user : null
}

export function createSession(request, response, user, now = Date.now()) {
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { userId: user.id, expiresAt: now + sessionIdleMs })
  setSessionCookie(request, response, token, Math.ceil(sessionIdleMs / 1000))
}

export function clearSession(request, response) {
  const token = cookieToken(request)
  if (token) sessions.delete(token)
  setSessionCookie(request, response, '', 0)
}
