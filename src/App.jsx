import { lazy, Suspense, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import Auth from './Auth.jsx'
import { Notice } from '@/components/page'
import { getSession, logout, touchSession } from './api.js'

const sessionIdleMs = 30 * 60 * 1000
const expiredMessage = 'Tu sesión terminó después de 30 minutos sin actividad. Inicia sesión de nuevo.'

const ProviderApp = lazy(() => import('./ProviderApp.jsx'))
const ClientApp = lazy(() => import('./ClientApp.jsx'))
const AdminApp = lazy(() => import('./AdminApp.jsx'))

function LoadingScreen() {
  return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground" role="status"><span className="flex items-center gap-3"><LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />Cargando Hogar+...</span></div>
}

function App() {
  const [session, setSession] = useState(undefined)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let active = true
    getSession().then(({ user }) => { if (active) setSession(user) })
      .catch(() => { if (active) setSession(null) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const expire = () => {
      setSession(null)
      setLogoutError(expiredMessage)
    }
    window.addEventListener('hogar:session-expired', expire)
    return () => window.removeEventListener('hogar:session-expired', expire)
  }, [])

  useEffect(() => {
    if (!session) return undefined
    let lastActivity = Date.now()
    let lastTouch = 0
    let timer
    const checkIdle = () => {
      clearTimeout(timer)
      const remaining = sessionIdleMs - (Date.now() - lastActivity)
      if (remaining <= 0) {
        setSession(null)
        setLogoutError(expiredMessage)
        logout().catch(() => {})
        return
      }
      timer = setTimeout(checkIdle, remaining)
    }
    const recordActivity = () => {
      if (Date.now() - lastActivity >= sessionIdleMs) return checkIdle()
      lastActivity = Date.now()
      if (lastActivity - lastTouch >= 60_000) {
        lastTouch = lastActivity
        touchSession().catch(() => {})
      }
      checkIdle()
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    document.addEventListener('visibilitychange', checkIdle)
    checkIdle()
    return () => {
      clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, recordActivity))
      document.removeEventListener('visibilitychange', checkIdle)
    }
  }, [session])

  async function signOut() {
    try {
      await logout()
      setSession(null)
      setLogoutError('')
    } catch (error) {
      setLogoutError(error.message)
    }
  }

  if (session === undefined) return <LoadingScreen />
  if (!session) return <Auth onLogin={(user) => { setLogoutError(''); setSession(user) }} notice={logoutError} />
  return <>
    <Suspense fallback={<LoadingScreen />}>
    {session.role === 'Proveedor' ? <ProviderApp key={session.id} initialUser={session} onLogout={signOut} /> : session.role === 'Cliente' ? <ClientApp key={session.id} initialUser={session} onLogout={signOut} /> : <AdminApp key={session.id} initialUser={session} onLogout={signOut} />}
    </Suspense>
    <Notice message={logoutError} error />
  </>
}

export default App
