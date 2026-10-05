import { useEffect, useState } from 'react'
import Profile from './Profile.jsx'
import Search from './Search.jsx'
import { createService, getDashboard, removeService, updateService } from './api.js'

const blankForm = { title: '', category: '', description: '' }

function Icon({ name, size = 18 }) {
  const shapes = {
    home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    layers: <><rect x="4" y="4" width="13" height="13" rx="2" /><path d="M8 20h11a2 2 0 0 0 2-2V7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    sparkle: <><path d="m12 2 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" /><path d="m19 18 1 1-1 1-1-1 1-1Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    edit: <><path d="M12 20h9M16 4l4 4L9 19l-5 1 1-5L16 4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m-11 0 1 15h12l1-15M10 10v7m4-7v7" /></>,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function App() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('servicios')

  useEffect(() => {
    let active = true
    getDashboard().then((data) => {
      if (!active) return
      setUser(data.user)
      setCategories(data.categories)
      setServices(data.services)
      setLoadError('')
    }).catch((error) => {
      if (active) setLoadError(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!dialog) return undefined
    function onKeyDown(event) { if (event.key === 'Escape' && !saving) setDialog(null) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, saving])

  const activeCategories = categories.filter((item) => services.some((service) => service.category === item.name))
  const visibleServices = category === 'Todas' ? services : services.filter((service) => service.category === category)
  const latest = services.reduce((value, service) => !value || new Date(service.updatedAt) > new Date(value) ? service.updatedAt : value, null)
  const selected = dialog?.id ? services.find((service) => service.id === dialog.id) : null

  function openCreate() { setForm(blankForm); setActionError(''); setDialog({ type: 'form', id: null }) }
  function editService(service) { setForm({ title: service.title, category: service.category, description: service.description }); setActionError(''); setDialog({ type: 'form', id: service.id }) }
  async function saveService(event) {
    event.preventDefault()
    const title = form.title.trim()
    const description = form.description.trim()
    if (!title || !description || !categories.some((item) => item.name === form.category)) {
      setActionError('Completa el título, la descripción y una categoría válida.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      if (dialog.id) {
        const updated = await updateService(dialog.id, { title, description, category: form.category })
        setServices((current) => current.map((service) => service.id === updated.id ? updated : service))
        setNotice('Servicio actualizado correctamente')
      } else {
        const created = await createService({ title, description, category: form.category })
        setServices((current) => [created, ...current])
        setCategory('Todas')
        setNotice('Servicio publicado correctamente')
      }
      setDialog(null)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSaving(false)
    }
  }
  async function deleteService() {
    setSaving(true)
    setActionError('')
    try {
      await removeService(dialog.id)
      setServices((current) => current.filter((service) => service.id !== dialog.id))
      setNotice('Servicio eliminado')
      setDialog(null)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Icon name="home" size={21} /></span><span><strong>hogar<span>+</span></strong><small>ESPACIO DEL PROVEEDOR</small></span></div>
      <div className="nav-label">MENÚ PRINCIPAL</div>
      <nav aria-label="Navegación principal"><button className={view === 'servicios' ? 'nav-link active' : 'nav-link'} onClick={() => setView('servicios')}><Icon name="grid" /> Mis servicios</button><button className={view === 'perfil' ? 'nav-link active' : 'nav-link'} onClick={() => setView('perfil')}><Icon name="user" /> Mi perfil</button>{view === 'servicios' && <a className="nav-link" href="#categorias"><Icon name="layers" /> Categorías</a>}</nav><div className="nav-label">PARA CLIENTES</div><nav aria-label="Navegación de clientes"><button className={view === 'buscar' ? 'nav-link active' : 'nav-link'} onClick={() => setView('buscar')}><Icon name="search" /> Buscar servicios</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><Icon name="sparkle" size={20} /><strong>Tu trabajo merece verse.</strong><p>Describe bien cada servicio para que las personas conozcan lo que ofreces.</p></div><div className="profile"><span className="avatar">{user?.initials || '—'}</span><span><strong>{user?.name || 'Cargando...'}</strong><small>{user?.role || 'Mi espacio'}</small></span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">{view === 'buscar' ? 'Explorar' : 'Mi espacio'} <span>/</span> <strong>{view === 'perfil' ? 'Mi perfil' : view === 'buscar' ? 'Buscar servicios' : 'Mis servicios'}</strong></div><div className="scope-pill"><span /> Servicios del hogar</div></header>
      {view === 'buscar' ? <Search /> : view === 'perfil' ? <Profile onNotice={setNotice} onSaved={(p) => setUser((u) => ({ ...u, name: p.name, initials: p.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() }))} /> : <main id="servicios">
        <div className="page-title"><div><div className="eyebrow">GESTIONA TUS PUBLICACIONES</div><h1>Mis servicios<span>.</span></h1><p>Publica lo que haces y mantén tu oferta siempre al día.</p></div><button className="button primary" onClick={openCreate} disabled={loading || !!loadError}><Icon name="plus" /> Nuevo servicio</button></div>
        <section className="stats" aria-label="Resumen de publicaciones">
          <div className="stat"><span className="stat-icon mint"><Icon name="layers" size={22} /></span><span className="stat-label">Servicios publicados</span><strong>{String(services.length).padStart(2, '0')}</strong><small>Tu catálogo actual</small></div>
          <div className="stat"><span className="stat-icon apricot"><Icon name="grid" size={22} /></span><span className="stat-label">Categorías activas</span><strong>{String(activeCategories.length).padStart(2, '0')}</strong><small>Áreas en las que trabajas</small></div>
          <div className="stat"><span className="stat-icon lilac"><Icon name="calendar" size={22} /></span><span className="stat-label">Última actualización</span><strong className="stat-date">{latest ? dateLabel(latest) : '—'}</strong><small>Actividad reciente</small></div>
        </section>
        <section className="catalog" aria-labelledby="catalog-title"><div className="section-heading"><div><div className="eyebrow">TU CATÁLOGO</div><h2 id="catalog-title">Servicios publicados <span>{services.length}</span></h2></div><p>Administra tus publicaciones en cualquier momento.</p></div>
          <div className="category-filters" id="categorias" aria-label="Filtrar servicios por categoría"><button className={category === 'Todas' ? 'filter active' : 'filter'} onClick={() => setCategory('Todas')}>Todas <span>{services.length}</span></button>{activeCategories.map((item) => <button key={item.name} className={category === item.name ? 'filter active' : 'filter'} onClick={() => setCategory(item.name)}>{item.name} <span>{services.filter((service) => service.category === item.name).length}</span></button>)}</div>
          {loading ? <div className="empty" role="status"><span className="empty-icon"><Icon name="layers" size={30} /></span><h3>Cargando servicios...</h3></div> : loadError ? <div className="empty" role="alert"><span className="empty-icon"><Icon name="layers" size={30} /></span><h3>No se pudieron cargar los servicios</h3><p>{loadError}</p><button className="button secondary" onClick={() => window.location.reload()}>Volver a intentar</button></div> : visibleServices.length ? <div className="cards">{visibleServices.map((service) => { const item = categories.find((entry) => entry.name === service.category) || { icon: '▦', color: 'gray' }; return <article className="card" key={service.id}><div className="card-top"><span className={`category-icon ${item.color}`}>{item.icon}</span><span className="published"><span /> Publicado</span></div><small className="card-category">{service.category.toUpperCase()}</small><h3>{service.title}</h3><p className="card-description">{service.description}</p><button className="text-button" onClick={() => setDialog({ type: 'detail', id: service.id })}>Ver detalles <Icon name="arrow" size={15} /></button><div className="card-footer"><span>Actualizado {dateLabel(service.updatedAt)}</span><div><button aria-label={`Editar ${service.title}`} title="Editar servicio" onClick={() => editService(service)}><Icon name="edit" /></button><button aria-label={`Eliminar ${service.title}`} title="Eliminar servicio" className="delete-action" onClick={() => { setActionError(''); setDialog({ type: 'delete', id: service.id }) }}><Icon name="trash" /></button></div></div></article> })}</div> : <div className="empty"><span className="empty-icon"><Icon name="layers" size={30} /></span><h3>{services.length ? 'No hay servicios en esta categoría' : 'Tu catálogo está listo para comenzar'}</h3><p>{services.length ? 'Selecciona otra categoría para ver tus publicaciones.' : 'Crea tu primer servicio y empieza a mostrar lo que haces.'}</p>{!services.length && <button className="button primary" onClick={openCreate}><Icon name="plus" /> Publicar mi primer servicio</button>}</div>}
        </section><footer>Hogar+ · Tu espacio de servicios</footer>
      </main>}
    </div>
    {dialog && <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null) }}>
      {dialog.type === 'form' && <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="dialog-heading"><div><div className="eyebrow">PUBLICACIÓN DE SERVICIOS</div><h2 id="form-title">{dialog.id ? 'Editar servicio' : 'Nuevo servicio'}</h2><p>{dialog.id ? 'Actualiza la información de tu publicación.' : 'Cuéntanos qué servicio ofreces.'}</p></div><button className="close" aria-label="Cerrar" onClick={() => setDialog(null)} disabled={saving}><Icon name="close" size={21} /></button></div><form onSubmit={saveService}><div className="form-fields"><label htmlFor="title">Título del servicio <span>*</span></label><input id="title" autoFocus required maxLength={80} placeholder="Ej. Reparación de tuberías" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><small>Un nombre claro ayuda a reconocer tu servicio.</small><label htmlFor="category">Categoría <span>*</span></label><select id="category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Selecciona una categoría</option>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select><label htmlFor="description">Descripción detallada <span>*</span></label><textarea id="description" rows={6} required maxLength={800} placeholder="Describe qué incluye el servicio, cómo trabajas y qué puede esperar el cliente..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="field-foot"><span>Explica lo que incluye tu servicio.</span><span>{form.description.length}/800</span></div></div><div className="dialog-actions">{actionError && <p className="action-error" role="alert">{actionError}</p>}<button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={saving}>Cancelar</button><button type="submit" className="button primary" disabled={saving}><Icon name="check" /> {dialog.id ? 'Guardar cambios' : 'Publicar servicio'}</button></div></form></div>}
      {dialog.type === 'detail' && selected && <div className="dialog detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="dialog-heading"><div><div className="eyebrow">DETALLE DEL SERVICIO</div><h2 id="detail-title">{selected.title}</h2></div><button className="close" aria-label="Cerrar" onClick={() => setDialog(null)} disabled={saving}><Icon name="close" size={21} /></button></div><div className="detail-content"><span className={`detail-category ${categories.find((item) => item.name === selected.category).color}`}>{categories.find((item) => item.name === selected.category).icon} {selected.category}</span><h3>Descripción</h3><p>{selected.description}</p><small>Publicado · Actualizado {dateLabel(selected.updatedAt)}</small></div><div className="dialog-actions"><button className="button secondary" onClick={() => setDialog(null)} disabled={saving}>Cerrar</button><button className="button primary" onClick={() => editService(selected)}><Icon name="edit" /> Editar servicio</button></div></div>}
      {dialog.type === 'delete' && selected && <div className="dialog delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><div className="dialog-heading"><span className="delete-icon"><Icon name="trash" size={23} /></span><button className="close" aria-label="Cerrar" onClick={() => setDialog(null)} disabled={saving}><Icon name="close" size={21} /></button></div><div className="delete-content"><h2 id="delete-title">¿Eliminar este servicio?</h2><p id="delete-description">“{selected.title}” dejará de aparecer en tu catálogo. Esta acción no se puede deshacer.</p></div><div className="dialog-actions">{actionError && <p className="action-error" role="alert">{actionError}</p>}<button className="button secondary" onClick={() => setDialog(null)} disabled={saving}>Cancelar</button><button className="button danger" onClick={deleteService} disabled={saving}><Icon name="trash" /> Eliminar servicio</button></div></div>}
    </div>}
    {notice && <div className="toast" role="status"><Icon name="check" /> {notice}</div>}
  </div>
}

export default App