import { useEffect, useState } from 'react'
import { Check, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { getClientProfile, updateClientProfile } from './api.js'

const fields = [
  { key: 'name', label: 'Nombre completo', type: 'text', maxLength: 80, placeholder: 'Tu nombre y apellidos', autoComplete: 'name' },
  { key: 'phone', label: 'Teléfono de contacto', type: 'tel', maxLength: 20, placeholder: '8888 1234', autoComplete: 'tel' },
  { key: 'email', label: 'Correo de contacto', type: 'email', maxLength: 120, placeholder: 'tu@correo.com', autoComplete: 'email' },
  { key: 'address', label: 'Dirección o punto de referencia', type: 'text', maxLength: 200, placeholder: 'Cantón, distrito y referencia', autoComplete: 'street-address' },
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

  const header = <PageHeader eyebrow="TUS DATOS PERSONALES" title="Mi perfil" description="Mantén tus datos actualizados para tus solicitudes de servicio." />

  if (loadError) return <Page>{header}<EmptyState title="No se pudo cargar tu perfil" description={loadError} error /></Page>
  if (!form) return <Page>{header}<EmptyState title="Cargando perfil..." loading /></Page>

  return (
    <Page>
      {header}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <AnimatedItem className="min-w-0">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Información de contacto</CardTitle>
              <CardDescription>Estos datos se mantienen privados hasta que la solicitud esté aceptada.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={save} noValidate aria-busy={saving}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {fields.map((field) => {
                    const error = (touched[field.key] || submitted) && errors[field.key]
                    return (
                      <div className={`space-y-2 ${field.key === 'address' ? 'sm:col-span-2' : ''}`} key={field.key}>
                        <Label htmlFor={`client-${field.key}`}>{field.label} <span className="text-destructive" aria-hidden="true">*</span></Label>
                        <Input
                          id={`client-${field.key}`}
                          type={field.type}
                          autoComplete={field.autoComplete}
                          maxLength={field.maxLength}
                          placeholder={field.placeholder}
                          value={form[field.key]}
                          required
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `client-${field.key}-error` : undefined}
                          onBlur={() => setTouched((current) => ({ ...current, [field.key]: true }))}
                          onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                        />
                        {error && <p className="text-xs text-destructive" id={`client-${field.key}-error`} aria-live="polite">{error}</p>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
                  {actionError && <p className="w-full rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{actionError}</p>}
                  <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={!dirty || saving} onClick={() => { setForm(saved); setTouched({}); setSubmitted(false); setActionError('') }}>Descartar cambios</Button>
                  <Button type="submit" className="flex-1 sm:flex-none" disabled={!dirty || saving}>
                    {saving ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                    {saving ? 'Guardando...' : 'Guardar perfil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </AnimatedItem>

        <AnimatedItem>
          <aside className="rounded-2xl border border-primary/15 bg-secondary p-6">
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-sm"><ShieldCheck className="size-5" aria-hidden="true" /></span>
            <h2 className="font-heading text-base font-bold text-secondary-foreground">Tu privacidad primero</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">El proveedor recibe tus datos de contacto solo cuando la solicitud está aceptada. Antes de eso verá únicamente tu nombre y la necesidad descrita.</p>
          </aside>
        </AnimatedItem>
      </div>
      <PageFooter />
    </Page>
  )
}

export default ClientProfile
