import { useEffect, useState } from 'react'
import ClientProfile from './ClientProfile.jsx'
import Requests from './Requests.jsx'
import Search from './Search.jsx'

function Icon({ name }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function ClientApp({ initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser)
  const [view, setView] = useState('solicitudes')
  const [notice, setNotice] = useState('')
  const title = { solicitudes: 'Mis solicitudes', buscar: 'Buscar servicios', perfil: 'Mi perfil' }[view]

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Icon name="home" /></span><span><strong>hogar<span>+</span></strong><small>ESPACIO DEL CLIENTE</small></span></div>
      <div className="nav-label">MENÚ PRINCIPAL</div>
      <nav aria-label="Navegación del cliente">
        <button className={view === 'solicitudes' ? 'nav-link active' : 'nav-link'} onClick={() => setView('solicitudes')}><Icon name="list" /> Mis solicitudes</button>
        <button className={view === 'buscar' ? 'nav-link active' : 'nav-link'} onClick={() => setView('buscar')}><Icon name="search" /> Buscar servicios</button>
        <button className={view === 'perfil' ? 'nav-link active' : 'nav-link'} onClick={() => setView('perfil')}><Icon name="user" /> Mi perfil</button>
      </nav>
      <div className="sidebar-bottom"><div className="profile"><span className="avatar">{user.initials}</span><span><strong>{user.name}</strong><small>Cliente</small></span></div><button className="logout-button" onClick={onLogout}>Cerrar sesión</button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Mi espacio <span>/</span> <strong>{title}</strong></div><div className="scope-pill"><span /> Servicios del hogar</div><button className="mobile-logout" onClick={onLogout}>Cerrar sesión</button></header>
      {view === 'solicitudes' ? <Requests role="Cliente" /> : view === 'buscar' ? <Search /> : <ClientProfile onNotice={setNotice} onSaved={(profile) => setUser((current) => ({ ...current, name: profile.name, initials: profile.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }))} />}
    </div>
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

export default ClientApp
