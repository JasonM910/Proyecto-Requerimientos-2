import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Flag, LockKeyhole, MapPin, Send, Search as SearchIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { categoryStyle } from '@/lib/category-styles'
import { groupCategories } from '@/lib/categories'
import { ReportDialog } from '@/components/ReportDialog'
import { VerifiedBadge } from '@/components/Trust'
import { ImageGallery, ImagePicker } from '@/components/ImagePicker'
import { createRequest, searchServices } from './api.js'

const initialsOf = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '—'
const yearsLabel = (years) => `${years} ${years === 1 ? 'año' : 'años'} de experiencia`
const allZones = '__all_zones__'
const allGroups = '__all_groups__'

function Zones({ zones, max }) {
  const shown = max ? zones.slice(0, max) : zones
  const extra = zones.length - shown.length
  return <div className="flex flex-wrap gap-1.5">
    {shown.map((zone) => <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1 text-[11px] font-medium" key={zone}>
      <MapPin className="size-3" aria-hidden="true" />{zone}
    </Badge>)}
    {extra > 0 && <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] font-medium">+{extra}</Badge>}
  </div>
}

function Search({ onRequestCreated, onNotice }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Todas')
  const [group, setGroup] = useState('')
  const [zone, setZone] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [requestService, setRequestService] = useState(null)
  const [reportProvider, setReportProvider] = useState(null)
  const [requestForm, setRequestForm] = useState({ need: '', urgency: 'Flexible', location: '', directions: '', images: [] })
  const [requestError, setRequestError] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const detailTrigger = useRef(null)
  const queryKey = JSON.stringify([q.trim(), category, group, zone])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      searchServices({ q: q.trim(), category: category === 'Todas' ? '' : category, group, zone })
        .then((result) => { if (active) { setData({ ...result, queryKey }); setError('') } })
        .catch((err) => { if (active) setError({ queryKey, message: err.message }) })
    }, q ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [q, category, group, zone, queryKey])

  const categories = data?.categories ?? []
  const groups = groupCategories(categories)
  const visibleCategories = group ? groups.find((item) => item.name === group)?.categories ?? [] : categories
  const loading = data?.queryKey !== queryKey
  const currentError = error?.queryKey === queryKey ? error.message : ''
  const results = data?.results ?? []
  const filtered = q.trim() !== '' || category !== 'Todas' || group !== '' || zone !== ''
  const detail = detailId ? results.find((item) => item.id === detailId) : null
  const styleOf = (name) => categories.find((item) => item.name === name) || { icon: '▦', color: 'gray' }
  const clear = () => { setQ(''); setCategory('Todas'); setGroup(''); setZone('') }
  const selectedGroup = group || categories.find((item) => item.name === category)?.group

  async function sendRequest(event) {
    event.preventDefault()
    setRequestBusy(true)
    setRequestError('')
    try {
      const result = await createRequest({ serviceId: requestService.id, ...requestForm })
      setRequestService(null)
      onRequestCreated?.(result.request)
    } catch (problem) {
      setRequestError(problem.message)
    } finally {
      setRequestBusy(false)
    }
  }

  return <Page>
    <PageHeader eyebrow="ENCUENTRA UN PROFESIONAL" title="Buscar servicios" description="Busca por palabra clave, categoría o zona de atención." />
    <Card className="mb-5 gap-0 rounded-2xl py-4 shadow-none">
      <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center" role="search" aria-label="Buscar y filtrar servicios">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Buscar servicios" placeholder="Ej. fuga, closet, jardín..." className="h-11 rounded-xl bg-background pl-10" maxLength={100} value={q} onChange={(event) => setQ(event.target.value)} />
        </div>
        <Select value={zone || allZones} onValueChange={(value) => setZone(value === allZones ? '' : value)}>
          <SelectTrigger className="h-11! w-full rounded-xl bg-background sm:w-56" aria-label="Filtrar por zona de atención">
            <span className="flex min-w-0 items-center gap-2"><MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><SelectValue placeholder="Todas las zonas" /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allZones}>Todas las zonas</SelectItem>
            {(data?.zones ?? []).map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtered && <Button variant="ghost" className="h-11 rounded-xl" onClick={clear}><X className="size-4" aria-hidden="true" />Limpiar</Button>}
      </CardContent>
    </Card>
    <section className="mb-7 space-y-4" aria-label="Explorar categorías">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={group || allGroups} onValueChange={(value) => { setGroup(value === allGroups ? '' : value); setCategory('Todas') }}>
          <SelectTrigger className="w-full rounded-xl sm:w-72" aria-label="Filtrar por área de servicio">
            <SelectValue placeholder="Todas las áreas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allGroups}>Todas las áreas</SelectItem>
            {groups.map((item) => <SelectItem value={item.name} key={item.name}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Explora un área y elige una categoría para precisar tu búsqueda.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        <Button variant={category === 'Todas' ? 'default' : 'outline'} size="sm" className="rounded-full px-4 shadow-none" aria-pressed={category === 'Todas'} onClick={() => setCategory('Todas')}>Todas</Button>
        {visibleCategories.map((item) => <Button key={item.name} variant={category === item.name ? 'default' : 'outline'} size="sm" className="rounded-full px-4 shadow-none" aria-pressed={category === item.name} onClick={() => setCategory(item.name)}>{item.name}</Button>)}
      </div>
      {selectedGroup && <nav aria-label="Ruta de categorías" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button className="underline underline-offset-4 hover:text-primary" onClick={() => { setGroup(''); setCategory('Todas') }}>Todas las áreas</button>
        <span aria-hidden="true">/</span>
        <button className="underline underline-offset-4 hover:text-primary" aria-current={category === 'Todas' ? 'location' : undefined} onClick={() => { setGroup(selectedGroup); setCategory('Todas') }}>{selectedGroup}</button>
        {category !== 'Todas' && <><span aria-hidden="true">/</span><span aria-current="location" className="font-medium text-foreground">{category}</span></>}
      </nav>}
    </section>
    {currentError ? <EmptyState error title="No se pudo realizar la búsqueda" description={currentError}>
      <Button variant="outline" onClick={() => window.location.reload()}>Volver a intentar</Button>
    </EmptyState>
      : loading ? <EmptyState loading title="Cargando servicios..." />
        : <>
          <p className="mb-4 text-sm text-muted-foreground"><span role="status">{data.total === 0 ? 'Sin resultados' : `${data.total} ${data.total === 1 ? 'servicio encontrado' : 'servicios encontrados'}`}</span>{data.total > 0 && q.trim() && <span> · Ordenados por relevancia</span>}</p>
          {results.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((service) => {
              const style = styleOf(service.category)
              return <AnimatedItem className="min-w-0" key={service.id}>
                <Card className="h-full gap-0 rounded-2xl py-0 shadow-none transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md motion-reduce:transition-none">
                  {service.images?.length > 0 && <img src={service.images[0].dataUrl} alt={`Muestra de ${service.title}`} className="aspect-[16/9] w-full object-cover" />}
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="mb-5 flex items-center gap-3">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${categoryStyle(style.color)}`} aria-hidden="true">{style.icon}</span>
                      <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{service.category}</span>
                    </div>
                    <h2 className="mb-2 font-heading text-lg leading-snug font-bold tracking-tight text-brand">{service.title}</h2>
                    <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                    <div className="mt-auto border-t border-border/70 pt-4">
                      <div className="mb-3 flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary" aria-hidden="true">{initialsOf(service.provider.name)}</span>
                        <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-semibold"><span className="truncate">{service.provider.name}</span>{service.provider.verified && <VerifiedBadge compact />}</p><p className="truncate text-xs text-muted-foreground">{service.provider.headline || 'Proveedor de servicios'}</p></div>
                      </div>
                      <Zones zones={service.provider.zones} max={3} />
                      <Button variant="ghost" className="mt-4 w-full justify-between rounded-lg px-2 text-primary hover:bg-accent hover:text-primary" aria-haspopup="dialog" onClick={(event) => { detailTrigger.current = event.currentTarget; setDetailId(service.id) }}>
                        Ver detalles <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedItem>
            })}
          </div> : <EmptyState title="No encontramos servicios con esos filtros" description="Prueba con otras palabras, otra categoría o todas las zonas.">
            {filtered && <Button variant="outline" onClick={clear}>Limpiar filtros</Button>}
          </EmptyState>}
        </>}
    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
      {detail && <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-2xl" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus() }}>
        <DialogHeader className="pr-6 text-left">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-primary">DETALLE DEL SERVICIO</p>
          <DialogTitle className="font-heading text-2xl leading-snug font-bold text-brand">{detail.title}</DialogTitle>
          <DialogDescription>Información del servicio y perfil público del profesional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <Badge variant="secondary" className={`gap-2 rounded-lg px-3 py-1.5 ${categoryStyle(styleOf(detail.category).color)}`}>
            <span aria-hidden="true">{styleOf(detail.category).icon}</span>{detail.category}
          </Badge>
          <section className="space-y-2">
            <h3 className="font-heading text-sm font-bold">Descripción</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{detail.description}</p>
          </section>
          <ImageGallery images={detail.images} label="Fotos del servicio" altPrefix="Foto del servicio" />
          <section className="space-y-4 rounded-xl border border-border bg-background p-4 sm:p-5" aria-label="Perfil público del proveedor">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary" aria-hidden="true">{initialsOf(detail.provider.name)}</span>
              <div><h3 className="flex flex-wrap items-center gap-2 font-heading font-bold text-brand">{detail.provider.name}{detail.provider.verified && <VerifiedBadge />}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail.provider.headline || 'Proveedor de servicios'}{detail.provider.experienceYears != null && ` · ${yearsLabel(detail.provider.experienceYears)}`}</p></div>
            </div>
            {detail.provider.about && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{detail.provider.about}</p>}
            {detail.provider.experience && <div className="space-y-2"><h4 className="text-sm font-semibold">Experiencia</h4><p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{detail.provider.experience}</p></div>}
            <div className="space-y-2.5"><h4 className="text-sm font-semibold">Zonas de atención</h4><Zones zones={detail.provider.zones} /></div>
          </section>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Los datos de contacto del proveedor no se muestran en la búsqueda.</p>
        </div>
        <DialogFooter className="border-t border-border pt-4"><Button variant="ghost" className="text-muted-foreground sm:mr-auto" onClick={() => { setReportProvider(detail); setDetailId(null) }}><Flag className="size-4" aria-hidden="true" />Reportar proveedor</Button><Button variant="outline" onClick={() => setDetailId(null)}>Cerrar</Button><Button onClick={() => { setRequestService(detail); setRequestForm({ need: '', urgency: 'Flexible', location: detail.provider.zones[0] || '', directions: '', images: [] }); setRequestError(''); setDetailId(null) }}><Send className="size-4" aria-hidden="true" />Solicitar servicio</Button></DialogFooter>
      </DialogContent>}
    </Dialog>
    <Dialog open={Boolean(requestService)} onOpenChange={(open) => { if (!open && !requestBusy) setRequestService(null) }}>
      {requestService && <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl" showCloseButton={!requestBusy}>
        <DialogHeader className="pr-6 text-left">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary">NUEVA SOLICITUD</p>
          <DialogTitle className="font-heading text-2xl text-brand">Solicitar servicio</DialogTitle>
          <DialogDescription>{requestService.title} · {requestService.provider.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={sendRequest} className="space-y-5" aria-busy={requestBusy}>
          <div className="space-y-2">
            <Label htmlFor="request-need">¿Qué trabajo necesitas? <span className="text-destructive">*</span></Label>
            <Textarea id="request-need" required minLength={10} maxLength={1000} rows={5} className="min-h-28 resize-y" placeholder="Describe el problema y lo que esperas del servicio." value={requestForm.need} onChange={(event) => setRequestForm({ ...requestForm, need: event.target.value })} disabled={requestBusy} />
            <p className="text-xs text-muted-foreground">Evita compartir teléfono, correo o dirección exacta antes de aceptar una propuesta.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="request-urgency">Urgencia <span className="text-destructive">*</span></Label>
              <Select value={requestForm.urgency} onValueChange={(value) => setRequestForm({ ...requestForm, urgency: value })} disabled={requestBusy}>
                <SelectTrigger id="request-urgency" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Flexible">Flexible</SelectItem><SelectItem value="Próximos días">Próximos días</SelectItem><SelectItem value="Urgente">Urgente</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-location">Zona general <span className="text-destructive">*</span></Label>
              <Select value={requestForm.location} onValueChange={(value) => setRequestForm({ ...requestForm, location: value })} disabled={requestBusy}>
                <SelectTrigger id="request-location" className="w-full"><SelectValue placeholder="Selecciona una zona" /></SelectTrigger>
                <SelectContent>{requestService.provider.zones.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-directions">Indicaciones privadas (opcional)</Label>
            <Textarea id="request-directions" maxLength={300} rows={3} placeholder="Dirección exacta o indicaciones para llegar." value={requestForm.directions} onChange={(event) => setRequestForm({ ...requestForm, directions: event.target.value })} disabled={requestBusy} />
            <p className="text-xs text-muted-foreground">El proveedor podrá verlas solo después de que aceptes su propuesta.</p>
          </div>
          <ImagePicker id="request-images" label="Fotos del problema o área del trabajo" images={requestForm.images} onChange={(images) => setRequestForm((current) => ({ ...current, images }))} disabled={requestBusy} hint="Hasta 3 imágenes JPG o PNG de 3 MB. El proveedor las verá al recibir tu solicitud; evita datos personales visibles en la foto." />
          {requestError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{requestError}</p>}
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setRequestService(null)} disabled={requestBusy}>Cancelar</Button>
            <Button type="submit" disabled={requestBusy}><Send className="size-4" aria-hidden="true" />{requestBusy ? 'Enviando...' : 'Enviar solicitud'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>}
    </Dialog>
    <ReportDialog open={Boolean(reportProvider)} onOpenChange={(open) => { if (!open) setReportProvider(null) }} target={reportProvider ? { providerId: reportProvider.provider.id } : undefined} targetLabel={reportProvider?.provider.name} onCreated={() => onNotice?.('Reporte enviado. Gracias por avisarnos')} />
    <PageFooter />
  </Page>
}

export default Search
