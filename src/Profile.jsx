import { useEffect, useState } from 'react'
import { getProfile, updateProfile } from './api.js'

// RF-05: qué datos son públicos y cuáles privados todavía se valida con el cliente.
// Para cambiar la clasificación, edita estas dos listas (y PRIVATE_FIELDS en el servidor).
const PRIVATE_FIELDS = [
  { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'nombre@correo.com' },
  { key: 'phone', label: 'Teléfono', type: 'tel', placeholder: '8888 0000' },
  { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Barrio, distrito o referencia' },
]
const MAX_ZONES = 10

function Icon({ name, size = 16 }) {
  const shapes = {
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

const initialsOf = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'
const toForm = (p) => ({ name: p.name || '', headline: p.headline || '', about: p.about || '', experienceYears: String(p.experienceYears ?? ''), experience: p.experience || '', zones: p.zones || [], email: p.email || '', phone: p.phone || '', address: p.address || '' })

function validate(form) {
  const years = form.experienceYears.trim()
  if (!form.name.trim()) return 'Escribe tu nombre o el de tu negocio.'
  if (years !== '' && (!/^\d+$/.test(years) || Number(years) > 60)) return 'Los años de experiencia deben ser un número entre 0 y 60.'
  if (!form.zones.length) return 'Agrega al menos una zona de atención.'
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Revisa el formato del correo electrónico.'
  return ''
}

// Lo que ve el cliente: solo campos públicos. El servidor aplica el mismo filtro en /api/profile/public.
function PublicCard({ data }) {
  const years = data.experienceYears.trim()
  return <article className="public-card" aria-label="Vista pública del perfil">
    <div className="public-head">
      <span className="avatar">{initialsOf(data.name)}</span>
      <div><h3>{data.name.trim() || 'Tu nombre'}</h3><p>{data.headline.trim() || 'Tu especialidad'}</p></div>
    </div>
    {data.about.trim() && <div className="public-block"><h4>Sobre mí</h4><p>{data.about.trim()}</p></div>}
    <div className="public-block">
      <h4>Experiencia{years !== '' && ` · ${years} ${Number(years) === 1 ? 'año' : 'años'}`}</h4>
      {data.experience.trim() ? <p>{data.experience.trim()}</p> : <p className="muted">Aún no has descrito tu experiencia.</p>}
    </div>
    <div className="public-block">
      <h4>Zonas de atención</h4>
      {data.zones.length ? <div className="chips" style={{ marginTop: 0 }}>{data.zones.map((z) => <span className="chip static" key={z}>{z}</span>)}</div> : <p className="muted">Aún no has agregado zonas.</p>}
    </div>
    <div className="public-note"><Icon name="lock" size={14} /><span>Tu correo, teléfono y dirección no aparecen en esta vista.</span></div>
  </article>
}

function Profile({ onNotice, onSaved }) {
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [zoneDraft, setZoneDraft] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    getProfile().then((data) => {
      if (!active) return
      setSaved(toForm(data))
      setForm(toForm(data))
    }).catch((error) => { if (active) setLoadError(error.message) })
    return () => { active = false }
  }, [])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved)

  function addZone() {
    const zone = zoneDraft.trim().replace(/\s+/g, ' ')
    if (!zone) return
    if (form.zones.some((z) => z.toLowerCase() === zone.toLowerCase())) { setZoneDraft(''); return }
    if (form.zones.length >= MAX_ZONES) { setActionError(`Puedes agregar hasta ${MAX_ZONES} zonas.`); return }
    setActionError('')
    setForm({ ...form, zones: [...form.zones, zone] })
    setZoneDraft('')
  }
  const removeZone = (zone) => setForm({ ...form, zones: form.zones.filter((z) => z !== zone) })

  async function save(event) {
    event.preventDefault()
    const problem = validate(form)
    if (problem) { setActionError(problem); return }
    setSaving(true)
    setActionError('')
    try {
      const years = form.experienceYears.trim()
      const updated = await updateProfile({
        name: form.name.trim(), headline: form.headline.trim(), about: form.about.trim(), experience: form.experience.trim(),
        experienceYears: years === '' ? null : Number(years), zones: form.zones,
        email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(),
      })
      setSaved(toForm(updated))
      setForm(toForm(updated))
      onSaved?.(updated)
      onNotice?.('Perfil actualizado correctamente')
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const header = <div className="page-title"><div><div className="eyebrow">INFORMACIÓN DEL PROVEEDOR</div><h1>Mi perfil<span>.</span></h1><p>Así te conocen los clientes antes de contratarte.</p></div></div>

  if (loadError) return <main>{header}<div className="empty" role="alert"><h3>No se pudo cargar tu perfil</h3><p>{loadError}</p><button className="button secondary" onClick={() => window.location.reload()}>Volver a intentar</button></div></main>
  if (!form) return <main>{header}<div className="empty" role="status"><h3>Cargando perfil...</h3></div></main>

  return <main>
    {header}
    <div className="profile-layout">
      <form onSubmit={save} noValidate>
        <section className="pf-card">
          <h2>Perfil público <span className="pf-badge public"><Icon name="eye" size={12} /> Lo ve el cliente</span></h2>
          <p>Esta información aparece cuando alguien consulta tus servicios.</p>
          <div className="pf-grid">
            <div className="pf-field"><label htmlFor="pf-name">Nombre o negocio <span>*</span></label><input id="pf-name" maxLength={60} placeholder="Ej. Carlos Mora" value={form.name} onChange={set('name')} /></div>
            <div className="pf-field"><label htmlFor="pf-headline">Especialidad</label><input id="pf-headline" maxLength={80} placeholder="Ej. Plomero residencial" value={form.headline} onChange={set('headline')} /></div>
            <div className="pf-field wide"><label htmlFor="pf-about">Sobre mí</label><textarea id="pf-about" rows={3} maxLength={600} placeholder="Cuenta cómo trabajas y qué te distingue." value={form.about} onChange={set('about')} /><small>{form.about.length}/600</small></div>
            <div className="pf-field"><label htmlFor="pf-years">Años de experiencia</label><input id="pf-years" inputMode="numeric" maxLength={2} placeholder="Ej. 8" value={form.experienceYears} onChange={set('experienceYears')} /></div>
            <div className="pf-field wide"><label htmlFor="pf-exp">Descripción de la experiencia</label><textarea id="pf-exp" rows={3} maxLength={600} placeholder="Trabajos realizados, tipos de clientes, certificaciones..." value={form.experience} onChange={set('experience')} /><small>{form.experience.length}/600</small></div>
            <div className="pf-field wide">
              <label htmlFor="pf-zone">Zonas de atención <span>*</span></label>
              <div className="zone-input">
                <input id="pf-zone" maxLength={40} placeholder="Ej. Quesada" value={zoneDraft} onChange={(event) => setZoneDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addZone() } }} />
                <button type="button" className="button secondary" onClick={addZone}><Icon name="plus" /> Agregar</button>
              </div>
              <small>Presiona Enter o “Agregar” para sumar cada zona (máximo {MAX_ZONES}).</small>
              {form.zones.length > 0 && <ul className="chips" style={{ listStyle: 'none', padding: 0, marginBottom: 0 }}>{form.zones.map((zone) => <li className="chip" key={zone}>{zone}<button type="button" aria-label={`Quitar ${zone}`} onClick={() => removeZone(zone)}><Icon name="close" size={12} /></button></li>)}</ul>}
            </div>
          </div>
        </section>

        <section className="pf-card">
          <h2>Datos privados <span className="pf-badge private"><Icon name="lock" size={12} /> Solo tú</span></h2>
          <p>No se muestran en tu perfil público.</p>
          <div className="pf-grid">
            {PRIVATE_FIELDS.map((field) => <div className={field.key === 'address' ? 'pf-field wide' : 'pf-field'} key={field.key}><label htmlFor={`pf-${field.key}`}>{field.label}</label><input id={`pf-${field.key}`} type={field.type} maxLength={120} placeholder={field.placeholder} value={form[field.key]} onChange={set(field.key)} /></div>)}
          </div>
        </section>

        <div className="pf-actions">
          {actionError && <p className="action-error" role="alert">{actionError}</p>}
          <button type="button" className="button secondary" onClick={() => { setForm(saved); setZoneDraft(''); setActionError('') }} disabled={!dirty || saving}>Descartar cambios</button>
          <button type="submit" className="button primary" disabled={!dirty || saving}><Icon name="check" size={18} /> Guardar perfil</button>
        </div>
      </form>

      <aside className="pf-preview" aria-label="Vista previa">
        <p className="pf-preview-label"><Icon name="eye" size={14} /> Así te ve un cliente</p>
        <PublicCard data={form} />
      </aside>
    </div>
    <footer>Hogar+ · Tu espacio de servicios</footer>
  </main>
}

export default Profile