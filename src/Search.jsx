import { useEffect, useState } from 'react'
import { searchServices } from './api.js'

function Icon({ name, size = 16 }) {
  const shapes = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

const initialsOf = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'
const yearsLabel = (n) => `${n} ${n === 1 ? 'año' : 'años'} de experiencia`

function Zones({ zones, max }) {
  const shown = max ? zones.slice(0, max) : zones
  const extra = zones.length - shown.length
  return <div className="chips" style={{ marginTop: 0 }}>
    {shown.map((zone) => <span className="chip static" key={zone}><Icon name="pin" size={11} />{zone}</span>)}
    {extra > 0 && <span className="chip static">+{extra}</span>}
  </div>
}

function Search() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Todas')
  const [zone, setZone] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      searchServices({ q: q.trim(), category: category === 'Todas' ? '' : category, zone })
        .then((result) => { if (active) { setData(result); setError('') } })
        .catch((err) => { if (active) setError(err.message) })
    }, q ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [q, category, zone])

  useEffect(() => {
    if (!detailId) return undefined
    function onKeyDown(event) { if (event.key === 'Escape') setDetailId(null) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [detailId])

  const categories = data?.categories ?? []
  const results = data?.results ?? []
  const filtered = q.trim() !== '' || category !== 'Todas' || zone !== ''
  const detail = detailId ? results.find((item) => item.id === detailId) : null
  const styleOf = (name) => categories.find((item) => item.name === name) || { icon: '▦', color: 'gray' }
  const clear = () => { setQ(''); setCategory('Todas'); setZone('') }

  return <main>
    <div className="page-title"><div><div className="eyebrow">ENCUENTRA UN PROFESIONAL</div><h1>Buscar servicios<span>.</span></h1><p>Busca por palabra clave, categoría o zona de atención.</p></div></div>

    <div className="search-bar" role="search">
      <label className="search-input"><Icon name="search" size={18} /><input type="search" aria-label="Buscar servicios" placeholder="Ej. fuga, closet, jardín..." maxLength={100} value={q} onChange={(event) => setQ(event.target.value)} /></label>
      <label className="search-zone"><Icon name="pin" size={16} /><select aria-label="Filtrar por zona de atención" value={zone} onChange={(event) => setZone(event.target.value)}><option value="">Todas las zonas</option>{(data?.zones ?? []).map((item) => <option key={item}>{item}</option>)}</select></label>
      {filtered && <button className="button secondary" onClick={clear}><Icon name="close" size={15} /> Limpiar</button>}
    </div>

    <div className="category-filters" aria-label="Filtrar por categoría">
      <button className={category === 'Todas' ? 'filter active' : 'filter'} onClick={() => setCategory('Todas')}>Todas</button>
      {categories.map((item) => <button key={item.name} className={category === item.name ? 'filter active' : 'filter'} onClick={() => setCategory(item.name)}>{item.name}</button>)}
    </div>

    {error ? <div className="empty" role="alert"><h3>No se pudo realizar la búsqueda</h3><p>{error}</p><button className="button secondary" onClick={() => window.location.reload()}>Volver a intentar</button></div>
      : !data ? <div className="empty" role="status"><h3>Cargando servicios...</h3></div>
      : <>
        <p className="results-count" role="status">{data.total === 0 ? 'Sin resultados' : `${data.total} ${data.total === 1 ? 'servicio encontrado' : 'servicios encontrados'}`}</p>
        {results.length ? <div className="results">
          {results.map((service) => { const style = styleOf(service.category); return <article className="result-card" key={service.id}>
            <div className="result-top"><span className={`category-icon ${style.color}`}>{style.icon}</span><small className="card-category">{service.category.toUpperCase()}</small></div>
            <h3>{service.title}</h3>
            <p className="result-description">{service.description}</p>
            <div className="result-provider"><span className="avatar">{initialsOf(service.provider.name)}</span><span><strong>{service.provider.name}</strong><small>{service.provider.headline || 'Proveedor de servicios'}</small></span></div>
            <Zones zones={service.provider.zones} max={3} />
            <button className="text-button" onClick={() => setDetailId(service.id)}>Ver detalles <Icon name="arrow" size={15} /></button>
          </article> })}
        </div> : <div className="empty"><h3>No encontramos servicios con esos filtros</h3><p>Prueba con otras palabras, otra categoría o todas las zonas.</p>{filtered && <button className="button secondary" onClick={clear}>Limpiar filtros</button>}</div>}
      </>}

    {detail && <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(null) }}>
      <div className="dialog detail-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="dialog-heading"><div><div className="eyebrow">DETALLE DEL SERVICIO</div><h2 id="result-title">{detail.title}</h2></div><button className="close" aria-label="Cerrar" onClick={() => setDetailId(null)}><Icon name="close" size={21} /></button></div>
        <div className="detail-content">
          <span className={`detail-category ${styleOf(detail.category).color}`}>{styleOf(detail.category).icon} {detail.category}</span>
          <h3>Descripción</h3>
          <p>{detail.description}</p>
          <div className="public-block">
            <div className="public-head"><span className="avatar">{initialsOf(detail.provider.name)}</span><div><h3>{detail.provider.name}</h3><p>{detail.provider.headline || 'Proveedor de servicios'}{detail.provider.experienceYears != null && ` · ${yearsLabel(detail.provider.experienceYears)}`}</p></div></div>
            {detail.provider.about && <p>{detail.provider.about}</p>}
            <h4 style={{ marginTop: 14 }}>Zonas de atención</h4>
            <Zones zones={detail.provider.zones} />
          </div>
          <div className="public-note"><Icon name="lock" size={14} /><span>Los datos de contacto del proveedor no se muestran en la búsqueda.</span></div>
        </div>
        <div className="dialog-actions"><button className="button secondary" onClick={() => setDetailId(null)}>Cerrar</button></div>
      </div>
    </div>}
    <footer>Hogar+ · Tu espacio de servicios</footer>
  </main>
}

export default Search