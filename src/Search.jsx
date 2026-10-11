import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, LockKeyhole, MapPin, Search as SearchIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { categoryStyle } from '@/lib/category-styles'
import { searchServices } from './api.js'

const initialsOf = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '—'
const yearsLabel = (years) => `${years} ${years === 1 ? 'año' : 'años'} de experiencia`
const allZones = '__all_zones__'

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

function Search() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Todas')
  const [zone, setZone] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const detailTrigger = useRef(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      searchServices({ q: q.trim(), category: category === 'Todas' ? '' : category, zone })
        .then((result) => { if (active) { setData(result); setError('') } })
        .catch((err) => { if (active) setError(err.message) })
    }, q ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [q, category, zone])

  const categories = data?.categories ?? []
  const results = data?.results ?? []
  const filtered = q.trim() !== '' || category !== 'Todas' || zone !== ''
  const detail = detailId ? results.find((item) => item.id === detailId) : null
  const styleOf = (name) => categories.find((item) => item.name === name) || { icon: '▦', color: 'gray' }
  const clear = () => { setQ(''); setCategory('Todas'); setZone('') }

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
    <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
      <Button variant={category === 'Todas' ? 'default' : 'outline'} size="sm" className="rounded-full px-4 shadow-none" aria-pressed={category === 'Todas'} onClick={() => setCategory('Todas')}>Todas</Button>
      {categories.map((item) => <Button key={item.name} variant={category === item.name ? 'default' : 'outline'} size="sm" className="rounded-full px-4 shadow-none" aria-pressed={category === item.name} onClick={() => setCategory(item.name)}>{item.name}</Button>)}
    </div>
    {error ? <EmptyState error title="No se pudo realizar la búsqueda" description={error}>
      <Button variant="outline" onClick={() => window.location.reload()}>Volver a intentar</Button>
    </EmptyState>
      : !data ? <EmptyState loading title="Cargando servicios..." />
        : <>
          <p className="mb-4 text-sm text-muted-foreground" role="status">{data.total === 0 ? 'Sin resultados' : `${data.total} ${data.total === 1 ? 'servicio encontrado' : 'servicios encontrados'}`}</p>
          {results.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((service) => {
              const style = styleOf(service.category)
              return <AnimatedItem className="min-w-0" key={service.id}>
                <Card className="h-full gap-0 rounded-2xl py-0 shadow-none transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md motion-reduce:transition-none">
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
                        <div className="min-w-0"><p className="truncate text-sm font-semibold">{service.provider.name}</p><p className="truncate text-xs text-muted-foreground">{service.provider.headline || 'Proveedor de servicios'}</p></div>
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
          <section className="space-y-4 rounded-xl border border-border bg-background p-4 sm:p-5" aria-label="Perfil público del proveedor">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary" aria-hidden="true">{initialsOf(detail.provider.name)}</span>
              <div><h3 className="font-heading font-bold text-brand">{detail.provider.name}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail.provider.headline || 'Proveedor de servicios'}{detail.provider.experienceYears != null && ` · ${yearsLabel(detail.provider.experienceYears)}`}</p></div>
            </div>
            {detail.provider.about && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{detail.provider.about}</p>}
            {detail.provider.experience && <div className="space-y-2"><h4 className="text-sm font-semibold">Experiencia</h4><p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{detail.provider.experience}</p></div>}
            <div className="space-y-2.5"><h4 className="text-sm font-semibold">Zonas de atención</h4><Zones zones={detail.provider.zones} /></div>
          </section>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Los datos de contacto del proveedor no se muestran en la búsqueda.</p>
        </div>
        <DialogFooter className="border-t border-border pt-4"><Button variant="outline" onClick={() => setDetailId(null)}>Cerrar</Button></DialogFooter>
      </DialogContent>}
    </Dialog>
    <PageFooter />
  </Page>
}

export default Search
