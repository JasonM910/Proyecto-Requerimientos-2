import { useEffect, useState } from 'react'
import { Check, Eye, LoaderCircle, LockKeyhole, MapPin, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { getProfile, updateProfile } from './api.js'

// RF-08: los campos privados solo se cargan en la vista del proveedor autenticado.
const PRIVATE_FIELDS = [
  { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'nombre@correo.com', autoComplete: 'email' },
  { key: 'phone', label: 'Teléfono', type: 'tel', placeholder: '8888 0000', autoComplete: 'tel' },
  { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Barrio, distrito o referencia', autoComplete: 'street-address' },
  { key: 'legalId', label: 'Identificación legal', type: 'text', placeholder: 'Número de identificación', maxLength: 60 },
  { key: 'verificationDocuments', label: 'Documento de verificación', type: 'text', placeholder: 'Referencia interna del documento', maxLength: 200 },
  { key: 'bankAccount', label: 'Cuenta bancaria', type: 'text', placeholder: 'Cuenta para pagos', maxLength: 120 },
]
const MAX_ZONES = 10

const initialsOf = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '—'
const toForm = (profile) => ({
  name: profile.name || '',
  headline: profile.headline || '',
  about: profile.about || '',
  experienceYears: String(profile.experienceYears ?? ''),
  experience: profile.experience || '',
  zones: profile.zones || [],
  email: profile.email || '',
  phone: profile.phone || '',
  address: profile.address || '',
  legalId: profile.legalId || '',
  verificationDocuments: profile.verificationDocuments || '',
  bankAccount: profile.bankAccount || '',
})

function validate(form) {
  const years = form.experienceYears.trim()
  if (!form.name.trim()) return 'Escribe tu nombre o el de tu negocio.'
  if (years !== '' && (!/^\d+$/.test(years) || Number(years) > 60)) return 'Los años de experiencia deben ser un número entre 0 y 60.'
  if (!form.zones.length) return 'Agrega al menos una zona de atención.'
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Revisa el formato del correo electrónico.'
  return ''
}

// La vista previa utiliza únicamente los campos públicos del formulario.
function PublicCard({ data }) {
  const years = data.experienceYears.trim()

  return (
    <Card className="overflow-hidden rounded-2xl py-0 shadow-sm" aria-label="Vista pública del perfil">
      <div className="h-2 bg-primary/75" />
      <CardContent className="space-y-6 p-6 pt-0">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-mint font-heading text-lg font-bold text-mint-foreground">
            {initialsOf(data.name)}
          </span>
          <div className="min-w-0">
            <h3 className="break-words font-heading text-lg font-bold tracking-tight">{data.name.trim() || 'Tu nombre'}</h3>
            <p className="mt-1 break-words text-sm text-muted-foreground">{data.headline.trim() || 'Tu especialidad'}</p>
          </div>
        </div>

        {data.about.trim() && (
          <div className="space-y-2 border-t pt-5">
            <h4 className="font-heading text-sm font-bold">Sobre mí</h4>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{data.about.trim()}</p>
          </div>
        )}

        <div className="space-y-2 border-t pt-5">
          <h4 className="font-heading text-sm font-bold">
            Experiencia{years !== '' && ` · ${years} ${Number(years) === 1 ? 'año' : 'años'}`}
          </h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {data.experience.trim() || 'Aún no has descrito tu experiencia.'}
          </p>
        </div>

        <div className="space-y-3 border-t pt-5">
          <h4 className="flex items-center gap-2 font-heading text-sm font-bold"><MapPin className="size-4 text-primary" aria-hidden="true" />Zonas de atención</h4>
          {data.zones.length ? (
            <div className="flex flex-wrap gap-2">
              {data.zones.map((zone) => <Badge variant="secondary" className="max-w-full whitespace-normal break-words rounded-full px-3 py-1" key={zone}>{zone}</Badge>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">Aún no has agregado zonas.</p>}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-secondary p-3.5 text-xs leading-relaxed text-secondary-foreground">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Tus datos de contacto, identificación y cuenta bancaria no aparecen en esta vista.</p>
        </div>
      </CardContent>
    </Card>
  )
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
    if (form.zones.some((current) => current.toLowerCase() === zone.toLowerCase())) { setZoneDraft(''); return }
    if (form.zones.length >= MAX_ZONES) { setActionError(`Puedes agregar hasta ${MAX_ZONES} zonas.`); return }
    setActionError('')
    setForm({ ...form, zones: [...form.zones, zone] })
    setZoneDraft('')
  }

  const removeZone = (zone) => setForm({ ...form, zones: form.zones.filter((current) => current !== zone) })

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
        legalId: form.legalId.trim(), verificationDocuments: form.verificationDocuments.trim(), bankAccount: form.bankAccount.trim(),
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

  const header = <PageHeader eyebrow="INFORMACIÓN DEL PROVEEDOR" title="Mi perfil" description="Así te conocen los clientes antes de contratarte." />

  if (loadError) return <Page>{header}<EmptyState title="No se pudo cargar tu perfil" description={loadError} error><Button variant="outline" onClick={() => window.location.reload()}>Volver a intentar</Button></EmptyState></Page>
  if (!form) return <Page>{header}<EmptyState title="Cargando perfil..." loading /></Page>

  return (
    <Page>
      {header}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <form className="min-w-0 space-y-5" onSubmit={save} noValidate aria-busy={saving}>
          <AnimatedItem>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2.5">
                  <CardTitle className="font-heading text-lg">Perfil público</CardTitle>
                  <Badge className="gap-1.5 rounded-full border-0 bg-mint text-mint-foreground"><Eye className="size-3" aria-hidden="true" />Lo ve el cliente</Badge>
                </div>
                <CardDescription>Esta información aparece cuando alguien consulta tus servicios.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pf-name">Nombre o negocio <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Input id="pf-name" maxLength={60} placeholder="Ej. Carlos Mora" value={form.name} onChange={set('name')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-headline">Especialidad</Label>
                  <Input id="pf-headline" maxLength={80} placeholder="Ej. Plomero residencial" value={form.headline} onChange={set('headline')} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pf-about">Sobre mí</Label>
                  <Textarea id="pf-about" className="min-h-28 resize-y" rows={3} maxLength={600} placeholder="Cuenta cómo trabajas y qué te distingue." value={form.about} onChange={set('about')} aria-describedby="pf-about-count" />
                  <p id="pf-about-count" className="text-right text-xs text-muted-foreground">{form.about.length}/600</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-years">Años de experiencia</Label>
                  <Input id="pf-years" inputMode="numeric" maxLength={2} placeholder="Ej. 8" value={form.experienceYears} onChange={set('experienceYears')} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pf-exp">Descripción de la experiencia</Label>
                  <Textarea id="pf-exp" className="min-h-28 resize-y" rows={3} maxLength={600} placeholder="Trabajos realizados, tipos de clientes, certificaciones..." value={form.experience} onChange={set('experience')} aria-describedby="pf-exp-count" />
                  <p id="pf-exp-count" className="text-right text-xs text-muted-foreground">{form.experience.length}/600</p>
                </div>
                <div className="space-y-3 sm:col-span-2">
                  <Label htmlFor="pf-zone">Zonas de atención <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <div className="flex gap-2">
                    <Input id="pf-zone" className="min-w-0 flex-1" maxLength={40} placeholder="Ej. Quesada" value={zoneDraft} onChange={(event) => setZoneDraft(event.target.value)} aria-describedby="pf-zone-help" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addZone() } }} />
                    <Button type="button" variant="outline" onClick={addZone}><Plus className="size-4" aria-hidden="true" />Agregar</Button>
                  </div>
                  <p id="pf-zone-help" className="text-xs leading-relaxed text-muted-foreground">Presiona Enter o “Agregar” para sumar cada zona (máximo {MAX_ZONES}).</p>
                  {form.zones.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label="Zonas de atención seleccionadas">
                      {form.zones.map((zone) => (
                        <li key={zone} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 bg-secondary py-1 pl-3 pr-1 text-xs font-semibold text-secondary-foreground">
                          <span className="min-w-0 break-words">{zone}</span>
                          <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive" aria-label={`Quitar ${zone}`} onClick={() => removeZone(zone)}><X className="size-3.5" aria-hidden="true" /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </AnimatedItem>

          <AnimatedItem>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2.5">
                  <CardTitle className="font-heading text-lg">Datos privados</CardTitle>
                  <Badge className="gap-1.5 rounded-full border-0 bg-apricot text-apricot-foreground"><LockKeyhole className="size-3" aria-hidden="true" />Solo tú</Badge>
                </div>
                <CardDescription>No se muestran en tu perfil público ni en el catálogo de búsqueda.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                {PRIVATE_FIELDS.map((field) => (
                  <div className={`space-y-2 ${field.key === 'address' || field.key === 'verificationDocuments' ? 'sm:col-span-2' : ''}`} key={field.key}>
                    <Label htmlFor={`pf-${field.key}`}>{field.label}</Label>
                    <Input id={`pf-${field.key}`} type={field.type} autoComplete={field.autoComplete} maxLength={field.maxLength || 120} placeholder={field.placeholder} value={form[field.key]} onChange={set(field.key)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </AnimatedItem>

          <div className="flex flex-wrap justify-end gap-3">
            {actionError && <p className="w-full rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{actionError}</p>}
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => { setForm(saved); setZoneDraft(''); setActionError('') }} disabled={!dirty || saving}>Descartar cambios</Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={!dirty || saving}>
              {saving ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </Button>
          </div>
        </form>

        <aside className="min-w-0 xl:sticky xl:top-6" aria-label="Vista previa">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Eye className="size-4" aria-hidden="true" />Así te ve un cliente</p>
          <AnimatedItem><PublicCard data={form} /></AnimatedItem>
        </aside>
      </div>
      <PageFooter />
    </Page>
  )
}

export default Profile
