import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Layers3, LayoutGrid, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import Profile from './Profile.jsx'
import Billing from './Billing.jsx'
import Requests from './Requests.jsx'
import Security from './Security.jsx'
import AppShell from '@/components/AppShell'
import { AnimatedItem, EmptyState, Notice, Page, PageFooter, PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { categoryStyle } from '@/lib/category-styles'
import { groupCategories } from '@/lib/categories'
import { cn } from '@/lib/utils'
import { ImageGallery, ImagePicker } from '@/components/ImagePicker'
import { FieldError, ValidatedForm } from '@/components/InlineValidation'
import { createService, getDashboard, getProviderRequests, removeService, updateService } from './api.js'

const blankForm = { title: '', category: '', description: '', images: [] }

function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function Stat({ icon: Icon, tone, label, value, description }) {
  return <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-primary/5">
    <CardContent className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}><Icon className="size-5" aria-hidden="true" /></span>
      </div>
      <strong className="block font-heading text-2xl font-extrabold tracking-tight text-brand">{value}</strong>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
}

function ProviderApp({ initialUser, onLogout }) {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [user, setUser] = useState(initialUser)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('servicios')
  const [pendingCount, setPendingCount] = useState(0)
  const dialogTrigger = useRef(null)
  const createTrigger = useRef(null)

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
    let active = true
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      getProviderRequests().then((data) => {
        if (active) setPendingCount(data.requests.filter((item) => item.status === 'Pendiente').length)
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  const activeCategories = categories.filter((item) => services.some((service) => service.category === item.name))
  const visibleServices = category === 'Todas' ? services : services.filter((service) => service.category === category)
  const latest = services.reduce((value, service) => !value || new Date(service.updatedAt) > new Date(value) ? service.updatedAt : value, null)
  const selected = dialog?.id ? services.find((service) => service.id === dialog.id) : null
  const styleOf = (name) => categories.find((item) => item.name === name) || { icon: '▦', color: 'gray' }

  function openCreate(event) {
    dialogTrigger.current = event?.currentTarget || createTrigger.current
    setForm(blankForm)
    setActionError('')
    setDialog({ type: 'form', id: null })
  }

  function editService(service, event) {
    if (event) dialogTrigger.current = event.currentTarget
    setForm({ title: service.title, category: service.category, description: service.description, images: service.images ?? [] })
    setActionError('')
    setDialog({ type: 'form', id: service.id })
  }

  function restoreFocus(event) {
    event.preventDefault()
    const target = dialogTrigger.current?.isConnected ? dialogTrigger.current : createTrigger.current
    target?.focus()
  }

  async function saveService(event) {
    event.preventDefault()
    const title = form.title.trim()
    const description = form.description.trim()
    if (!categories.some((item) => item.name === form.category)) {
      setActionError('Selecciona una categoría.')
      document.getElementById('category')?.focus()
      return
    }
    setSaving(true)
    setActionError('')
    try {
      if (dialog.id) {
        const updated = await updateService(dialog.id, { title, description, category: form.category, images: form.images })
        setServices((current) => current.map((service) => service.id === updated.id ? updated : service))
        if (category !== 'Todas') setCategory(updated.category)
        setNotice('Servicio actualizado correctamente')
      } else {
        const created = await createService({ title, description, category: form.category, images: form.images })
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

  async function deleteService(event) {
    event.preventDefault()
    setSaving(true)
    setActionError('')
    try {
      await removeService(dialog.id)
      setServices((current) => current.filter((service) => service.id !== dialog.id))
      if (!services.some((service) => service.id !== dialog.id && service.category === category)) setCategory('Todas')
      setNotice('Servicio eliminado')
      setDialog(null)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <AppShell user={user} view={view} onViewChange={setView} onLogout={onLogout} alerts={pendingCount}>
    {view === 'pagos' ? <Billing role="Proveedor" onNotice={setNotice} /> : view === 'seguridad' ? <Security role="Proveedor" onNotice={setNotice} /> : view === 'solicitudes' ? <Requests role="Proveedor" onNotice={setNotice} onUpdated={() => getProviderRequests().then((data) => setPendingCount(data.requests.filter((item) => item.status === 'Pendiente').length)).catch(() => {})} /> : view === 'perfil' ? <Profile onNotice={setNotice} onSaved={(profile) => setUser((current) => ({ ...current, name: profile.name, initials: profile.name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }))} /> : <Page id="servicios">
      <PageHeader eyebrow="GESTIONA TUS PUBLICACIONES" title="Mis servicios" description="Publica lo que haces y mantén tu oferta siempre al día."
        action={<Button ref={createTrigger} size="lg" onClick={openCreate} disabled={loading || !!loadError} className="shadow-sm shadow-primary/20"><Plus aria-hidden="true" />Nuevo servicio</Button>} />
      <section className="mb-10 grid gap-4 sm:grid-cols-3" aria-label="Resumen de publicaciones">
        <Stat icon={Layers3} tone="bg-mint text-mint-foreground" label="Servicios publicados" value={String(services.length).padStart(2, '0')} description="Tu catálogo actual" />
        <Stat icon={LayoutGrid} tone="bg-apricot text-apricot-foreground" label="Categorías activas" value={String(activeCategories.length).padStart(2, '0')} description="Áreas en las que trabajas" />
        <Stat icon={CalendarDays} tone="bg-lilac text-lilac-foreground" label="Última actualización" value={latest ? dateLabel(latest) : '—'} description="Actividad reciente" />
      </section>
      <section aria-labelledby="catalog-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-primary">TU CATÁLOGO</p><h2 id="catalog-title" className="flex items-center gap-3 text-xl font-bold tracking-tight text-brand">Servicios publicados <Badge variant="secondary" className="rounded-full bg-accent text-primary">{services.length}</Badge></h2></div>
          <p className="text-xs text-muted-foreground">Administra tus publicaciones en cualquier momento.</p>
        </div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar servicios por categoría">
          <Button size="sm" variant={category === 'Todas' ? 'default' : 'outline'} className="rounded-full text-xs" aria-pressed={category === 'Todas'} onClick={() => setCategory('Todas')}>Todas <span className="opacity-70">{services.length}</span></Button>
          {activeCategories.map((item) => <Button key={item.name} size="sm" variant={category === item.name ? 'default' : 'outline'} className="rounded-full text-xs" aria-pressed={category === item.name} onClick={() => setCategory(item.name)}>{item.name}<span className="opacity-70">{services.filter((service) => service.category === item.name).length}</span></Button>)}
        </div>
        {loading ? <EmptyState loading title="Cargando servicios..." /> : loadError ? <EmptyState error title="No se pudieron cargar los servicios" description={loadError}><Button variant="outline" onClick={() => window.location.reload()}>Volver a intentar</Button></EmptyState> : visibleServices.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => {
            const item = styleOf(service.category)
            return <AnimatedItem key={service.id} className="min-w-0">
              <Card className="h-full gap-0 overflow-hidden rounded-2xl py-0 shadow-sm shadow-primary/5 transition-shadow hover:shadow-md hover:shadow-primary/10">
                {service.images?.length > 0 && <img src={service.images[0].dataUrl} alt={`Muestra de ${service.title}`} className="aspect-[16/9] w-full object-cover" />}
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className={cn('grid size-11 place-items-center rounded-xl text-xl', categoryStyle(item.color))} aria-hidden="true">{item.icon}</span>
                    <Badge variant="secondary" className="gap-1.5 rounded-full bg-mint text-[10px] text-mint-foreground"><span className="size-1.5 rounded-full bg-primary/60" />Publicado</Badge>
                  </div>
                  <p className="mb-2 text-[10px] font-bold tracking-wider text-primary">{service.category.toUpperCase()}</p>
                  <h3 className="mb-3 text-base font-bold leading-snug text-brand wrap-anywhere">{service.title}</h3>
                  <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-muted-foreground wrap-anywhere">{service.description}</p>
                  <Button variant="link" className="mt-auto h-auto justify-start self-start p-0 text-xs" onClick={(event) => { dialogTrigger.current = event.currentTarget; setDialog({ type: 'detail', id: service.id }) }}>Ver detalles<ArrowRight aria-hidden="true" /></Button>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
                  <span className="text-[10px] text-muted-foreground">Actualizado {dateLabel(service.updatedAt)}</span>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar ${service.title}`} title="Editar servicio" onClick={(event) => editService(service, event)}><Pencil className="size-4" aria-hidden="true" /></Button>
                    <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${service.title}`} title="Eliminar servicio" onClick={(event) => { dialogTrigger.current = event.currentTarget; setActionError(''); setDialog({ type: 'delete', id: service.id }) }}><Trash2 className="size-4" aria-hidden="true" /></Button>
                  </div>
                </CardFooter>
              </Card>
            </AnimatedItem>
          })}
        </div> : <EmptyState title={services.length ? 'No hay servicios en esta categoría' : 'Tu catálogo está listo para comenzar'} description={services.length ? 'Selecciona otra categoría para ver tus publicaciones.' : 'Crea tu primer servicio y empieza a mostrar lo que haces.'}>{!services.length && <Button onClick={openCreate}><Plus aria-hidden="true" />Publicar mi primer servicio</Button>}</EmptyState>}
      </section>
      <PageFooter />
    </Page>}

    <Dialog open={dialog?.type === 'form' || dialog?.type === 'detail'} onOpenChange={(open) => { if (!open && !saving) setDialog(null) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl" showCloseButton={!saving} onCloseAutoFocus={restoreFocus}>
        {dialog?.type === 'form' ? <>
          <DialogHeader className="pr-6 text-left">
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary">PUBLICACIÓN DE SERVICIOS</p>
            <DialogTitle className="font-heading text-2xl font-bold text-brand">{dialog.id ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
            <DialogDescription>{dialog.id ? 'Actualiza la información de tu publicación.' : 'Cuéntanos qué servicio ofreces.'}</DialogDescription>
          </DialogHeader>
          <ValidatedForm onSubmit={saveService} className="space-y-5" aria-busy={saving}>
            <div className="space-y-2">
              <Label htmlFor="title">Título del servicio <span className="text-destructive">*</span></Label>
              <Input id="title" autoFocus required maxLength={80} disabled={saving} placeholder="Ej. Reparación de tuberías" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} aria-describedby="title-hint" />
              <FieldError id="title" />
              <p id="title-hint" className="text-xs text-muted-foreground">Un nombre claro ayuda a reconocer tu servicio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(value) => { setForm({ ...form, category: value }); setActionError('') }} disabled={saving}>
                <SelectTrigger id="category" className="w-full" aria-invalid={actionError === 'Selecciona una categoría.'} aria-describedby={actionError === 'Selecciona una categoría.' ? 'category-error' : undefined}><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>{groupCategories(categories).map((group) => <SelectGroup key={group.name}>
                  <SelectLabel>{group.name}</SelectLabel>
                  {group.categories.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
                </SelectGroup>)}</SelectContent>
              </Select>
              {actionError === 'Selecciona una categoría.' && <p id="category-error" role="alert" className="text-xs font-medium text-destructive">{actionError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción detallada <span className="text-destructive">*</span></Label>
              <Textarea id="description" rows={6} required maxLength={800} disabled={saving} placeholder="Describe qué incluye el servicio, cómo trabajas y qué puede esperar el cliente..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-36 resize-y" aria-describedby="description-hint" />
              <FieldError id="description" />
              <div id="description-hint" className="flex justify-between gap-4 text-xs text-muted-foreground"><span>Explica lo que incluye tu servicio.</span><span>{form.description.length}/800</span></div>
            </div>
            <ImagePicker id="service-images" label="Fotos de trabajos anteriores" images={form.images} onChange={(images) => setForm((current) => ({ ...current, images }))} disabled={saving} />
            {actionError && actionError !== 'Selecciona una categoría.' && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{actionError}</p>}
            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{saving ? 'Guardando...' : dialog.id ? 'Guardar cambios' : 'Publicar servicio'}</Button>
            </DialogFooter>
          </ValidatedForm>
        </> : selected && <>
          <DialogHeader className="pr-6 text-left">
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary">DETALLE DEL SERVICIO</p>
            <DialogTitle className="font-heading text-2xl font-bold leading-snug text-brand wrap-anywhere">{selected.title}</DialogTitle>
            <DialogDescription>Información de tu publicación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Badge variant="secondary" className={cn('gap-2 px-3 py-1.5', categoryStyle(styleOf(selected.category).color))}>{styleOf(selected.category).icon} {selected.category}</Badge>
            <h3 className="text-sm font-bold">Descripción</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground wrap-anywhere">{selected.description}</p>
            <ImageGallery images={selected.images} label="Fotos del servicio" altPrefix="Foto del servicio" />
            <p className="text-xs text-muted-foreground">Publicado · Actualizado {dateLabel(selected.updatedAt)}</p>
          </div>
          <DialogFooter className="border-t pt-4"><Button variant="outline" onClick={() => setDialog(null)}>Cerrar</Button><Button onClick={() => editService(selected)}><Pencil aria-hidden="true" />Editar servicio</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>

    <AlertDialog open={dialog?.type === 'delete'} onOpenChange={(open) => { if (!open && !saving) setDialog(null) }}>
      <AlertDialogContent className="rounded-2xl" onCloseAutoFocus={restoreFocus}>
        <AlertDialogHeader>
          <span className="mb-3 grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive"><Trash2 className="size-5" aria-hidden="true" /></span>
          <AlertDialogTitle className="font-heading text-xl font-bold text-brand">¿Eliminar este servicio?</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed wrap-anywhere">“{selected?.title}” dejará de aparecer en tu catálogo y en las búsquedas. Las solicitudes anteriores conservarán su información. Esta acción no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        {actionError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{actionError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={deleteService} disabled={saving}>{saving ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{saving ? 'Eliminando...' : 'Eliminar servicio'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Notice message={notice} />
  </AppShell>
}

export default ProviderApp
