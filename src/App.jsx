import { lazy, Suspense, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import Auth from './Auth.jsx'
import { Notice } from '@/components/page'
import { getSession, logout } from './api.js'

const ProviderApp = lazy(() => import('./ProviderApp.jsx'))
const ClientApp = lazy(() => import('./ClientApp.jsx'))

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
  if (!session) return <Auth onLogin={setSession} />
  return <>
    <Suspense fallback={<LoadingScreen />}>
    {session.role === 'Proveedor' ? <ProviderApp key={session.id} initialUser={session} onLogout={signOut} /> : <ClientApp key={session.id} initialUser={session} onLogout={signOut} />}
    </Suspense>
    <Notice message={logoutError} error />
  </>
}

export default App
