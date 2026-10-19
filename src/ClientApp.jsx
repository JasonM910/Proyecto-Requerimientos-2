import { useEffect, useState } from 'react'
import Billing from './Billing.jsx'
import ClientProfile from './ClientProfile.jsx'
import Requests from './Requests.jsx'
import Search from './Search.jsx'
import Security from './Security.jsx'
import AppShell from '@/components/AppShell'
import { Notice } from '@/components/page'

function ClientApp({ initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser)
  const [view, setView] = useState('solicitudes')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  function updateUser(profile) {
    setUser((current) => ({
      ...current,
      name: profile.name,
      initials: profile.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    }))
  }

  return (
    <AppShell user={user} view={view} onViewChange={setView} onLogout={onLogout}>
      {view === 'solicitudes' ? <Requests role="Cliente" onNotice={setNotice} /> : view === 'seguridad' ? <Security role="Cliente" onNotice={setNotice} /> : view === 'pagos' ? <Billing role="Cliente" onNotice={setNotice} /> : view === 'buscar' ? <Search onNotice={setNotice} onRequestCreated={() => { setNotice('Solicitud enviada al proveedor'); setView('solicitudes') }} /> : <ClientProfile onNotice={setNotice} onSaved={updateUser} />}
      <Notice message={notice} />
    </AppShell>
  )
}

export default ClientApp