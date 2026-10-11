import { useEffect, useState } from 'react'
import { getClientProfile, updateClientProfile } from './api.js'

const fields = [
  { key: 'name', label: 'Nombre completo', type: 'text', maxLength: 80, placeholder: 'Tu nombre y apellidos' },
  { key: 'phone', label: 'Teléfono de contacto', type: 'tel', maxLength: 20, placeholder: '8888 1234' },
  { key: 'email', label: 'Correo de contacto', type: 'email', maxLength: 120, placeholder: 'tu@correo.com' },
  { key: 'address', label: 'Dirección o punto de referencia', type: 'text', maxLength: 200, placeholder: 'Cantón, distrito y referencia' },
]

function errorsFor(form) {
  const errors = {}
  if (form.name.trim().length < 2) errors.name = 'Escribe tu nombre completo.'
  if (!/^[+\d\s-]+$/.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Escribe al menos 8 dígitos.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Escribe un correo válido.'
  if (form.address.trim().length < 5) errors.address = 'Escribe una dirección o referencia.'
  return errors
}

function ClientProfile({ onNotice, onSaved }) {
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    getClientProfile().then((profile) => {
      if (!active) return
      const values = Object.fromEntries(fields.map((field) => [field.key, profile[field.key] || '']))
      setSaved(values)
      setForm(values)
    }).catch((error) => { if (active) setLoadError(error.message) })
    return () => { active = false }
  }, [])

  const errors = form ? errorsFor(form) : {}
  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved)

  async function save(event) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    setSaving(true)
    setActionError('')
    try {
      const updated = await updateClientProfile(form)
      const values = Object.fromEntries(fields.map((field) => [field.key, updated[field.key] || '']))
      setSaved(values)
      setForm(values)
      setTouched({})
      setSubmitted(false)
      onSaved?.(updated)
      onNotice?.('Perfil actualizado correctamente')
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const header = <div className="page-title"><div><div className="eyebrow">TUS DATOS PERSONALES</div><h1>Mi perfil<span>.</span></h1><p>Mantén tus datos actualizados para tus solicitudes de servicio.</p></div></div>

  if (loadError) return <main>{header}<div className="empty" role="alert"><h3>No se pudo cargar tu perfil</h3><p>{loadError}</p></div></main>
  if (!form) return <main>{header}<div className="empty" role="status"><h3>Cargando perfil...</h3></div></main>

  return <main>
    {header}
    <div className="client-profile-layout">
      <form className="pf-card" onSubmit={save} noValidate>
        <h2>Información de contacto</h2>
        <p>Estos datos se mantienen privados hasta que aceptes una solicitud.</p>
        <div className="pf-grid">
          {fields.map((field) => <div className={`pf-field ${field.key === 'address' ? 'wide' : ''}`} key={field.key}>
            <label htmlFor={`client-${field.key}`}>{field.label} <span>*</span></label>
            <input id={`client-${field.key}`} type={field.type} maxLength={field.maxLength} placeholder={field.placeholder} value={form[field.key]} aria-invalid={Boolean((touched[field.key] || submitted) && errors[field.key])} aria-describedby={errors[field.key] && (touched[field.key] || submitted) ? `client-${field.key}-error` : undefined} onBlur={() => setTouched((current) => ({ ...current, [field.key]: true }))} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
            {(touched[field.key] || submitted) && errors[field.key] && <small className="field-error" id={`client-${field.key}-error`}>{errors[field.key]}</small>}
          </div>)}
        </div>
        <div className="pf-actions">
          {actionError && <p className="action-error" role="alert">{actionError}</p>}
          <button type="button" className="button secondary" disabled={!dirty || saving} onClick={() => { setForm(saved); setTouched({}); setSubmitted(false); setActionError('') }}>Descartar cambios</button>
          <button type="submit" className="button primary" disabled={!dirty || saving}>{saving ? 'Guardando...' : 'Guardar perfil'}</button>
        </div>
      </form>
      <aside className="privacy-note"><strong>Tu privacidad primero</strong><p>El proveedor recibe tus datos de contacto solo cuando la solicitud está aceptada. Antes de eso verá únicamente tu nombre y la necesidad descrita.</p></aside>
    </div>
    <footer>Hogar+ · Tu espacio de servicios</footer>
  </main>
}

export default ClientProfile
