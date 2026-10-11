import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const cookieName = 'hogar_session'
const sessionLifetimeSeconds = 8 * 60 * 60
const sessions = new Map()

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    role: user.role,
  }
}

function cookieToken(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  return cookie?.slice(cookieName.length + 1) || null
}

export function sessionUser(request, database) {
  const token = cookieToken(request)
  const session = token && sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return database.users.find((user) => user.id === session.userId) || null
}

export function verifyCredentials(database, identifier, password) {
  const normalized = identifier.toLowerCase()
  const user = database.users.find((item) =>
    item.email?.toLowerCase() === normalized || item.username?.toLowerCase() === normalized)
  const parts = user?.passwordHash?.split(':') || []
  const validHash = parts.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2])
  const salt = validHash ? parts[1] : '00000000000000000000000000000000'
  const expected = Buffer.from(validHash ? parts[2] : '00'.repeat(64), 'hex')
  const calculated = scryptSync(password, salt, 64)
  return user && timingSafeEqual(expected, calculated) ? user : null
}

export function createSession(request, response, user) {
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + sessionLifetimeSeconds * 1000 })
  const secure = request.socket.encrypted ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`)
}

export function clearSession(request, response) {
  const token = cookieToken(request)
  if (token) sessions.delete(token)
  const secure = request.socket.encrypted ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`)
}
