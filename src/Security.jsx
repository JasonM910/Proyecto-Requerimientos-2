import { useEffect, useState } from 'react'
import { BadgeCheck, Check, CircleDashed, EyeOff, Flag, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { ReportDialog } from '@/components/ReportDialog'
import { getReports, getVerification, updateVerification } from './api.js'

const dateFormatter = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
const statusStyles = {
  Verificado: 'bg-mint text-mint-foreground',
  'En revisión': 'bg-lilac text-lilac-foreground',
  Rechazado: 'bg-destructive/10 text-destructive',
  'Sin verificar': 'bg-secondary text-secondary-foreground',
  Recibido: 'bg-apricot text-apricot-foreground',
  Resuelto: 'bg-mint text-mint-foreground',
}

function StatusBadge({ status }) {
  return <Badge variant="secondary" className={`gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status] || statusStyles['Sin verificar']}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{status}</Badge>
}

function VerificationPanel({ onNotice }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      getVerification().then((result) => { if (active) { setData(result); setError('') } }).catch((problem) => { if (active) setError(problem.message) })
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  async function act(action, message) {
    setBusy(true)
    setError('')
    try {
      setData(await updateVerification({ action }))
      onNotice?.(message)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return error ? <EmptyState error title="No se pudo cargar la verificación" description={error} /> : <EmptyState loading title="Cargando verificación..." />

  return <Card className="rounded-2xl py-0 shadow-sm" aria-labelledby="verification-title">
    <CardHeader className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id="verification-title" className="flex items-center gap-2 font-heading text-lg text-brand"><BadgeCheck className="size-5 text-primary" aria-hidden="true" />Verificación de proveedor</CardTitle>
        <StatusBadge status={data.status} />
      </div>
      <CardDescription>{data.status === 'Verificado' ? 'Tu perfil muestra la insignia «Verificado» a los clientes.' : 'La insignia «Verificado» ayuda a que los clientes confíen en tu perfil.'}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5 px-6 pb-6">
      <ul className="space-y-2.5" aria-label="Requisitos de verificación">
        {data.checks.map((check) => <li key={check.key} className="flex items-center gap-3 text-sm">
          <span className={`grid size-5 shrink-0 place-items-center rounded-full ${check.met ? 'bg-mint text-mint-foreground' : 'bg-secondary text-muted-foreground'}`}>{check.met ? <Check className="size-3" aria-hidden="true" /> : <CircleDashed className="size-3" aria-hidden="true" />}</span>
          <span className={check.met ? '' : 'text-muted-foreground'}>{check.label}</span><span className="sr-only">{check.met ? 'Cumplido' : 'Pendiente'}</span>
        </li>)}
      </ul>
      {!data.canRequest && ['Sin verificar', 'Rechazado'].includes(data.status) && <p className="text-xs leading-relaxed text-muted-foreground">Completa estos datos y guarda una foto del documento en «Mi perfil» para poder solicitar la verificación.</p>}
      {data.note && <p className="rounded-lg bg-secondary/70 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Observación:</strong> {data.note}</p>}
      {data.requestedAt && <p className="text-xs text-muted-foreground">Solicitada el {dateFormatter.format(new Date(data.requestedAt))}{data.reviewedAt && ` · Revisada el ${dateFormatter.format(new Date(data.reviewedAt))}`}</p>}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {['Sin verificar', 'Rechazado'].includes(data.status) && <Button disabled={busy || !data.canRequest} onClick={() => act('request', 'Verificación solicitada')}><ShieldCheck className="size-4" aria-hidden="true" />{data.status === 'Rechazado' ? 'Solicitar nueva verificación' : 'Solicitar verificación'}</Button>}
      {data.status === 'En revisión' && <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-accent/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">Revisión del equipo de Hogar+</p>
        <p className="text-xs leading-relaxed text-muted-foreground">Tu solicitud está pendiente. El equipo revisará la foto y los datos de identidad y te comunicará el resultado aquí.</p>
      </div>}
    </CardContent>
  </Card>
}

function ReportsPanel({ role, onNotice }) {
  const [reports, setReports] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      getReports().then((data) => { if (active) { setReports(data.reports); setError('') } }).catch((problem) => { if (active) setError(problem.message) })
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  return <Card className="rounded-2xl py-0 shadow-sm" aria-labelledby="reports-title">
    <CardHeader className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id="reports-title" className="flex items-center gap-2 font-heading text-lg text-brand"><Flag className="size-5 text-primary" aria-hidden="true" />Reportes de incidentes</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Flag className="size-4" aria-hidden="true" />Nuevo reporte</Button>
      </div>
      <CardDescription>Avísanos si viste conductas inapropiadas, cobros irregulares o cualquier anomalía. También puedes reportar desde cada solicitud{role === 'Cliente' ? ' o desde el perfil de un proveedor' : ''}.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 px-6 pb-6">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!reports ? <p className="text-sm text-muted-foreground" role="status">Cargando reportes...</p>
        : !reports.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No has enviado reportes.</p>
          : reports.map((report) => <AnimatedItem key={report.id}>
            <article className="space-y-3 rounded-xl border border-border bg-background p-4" aria-label={`Reporte: ${report.category}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{report.category}</h3><StatusBadge status={report.status} /></div>
              <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(report.createdAt))}{report.targetName && ` · Sobre ${report.targetName}`}{report.requestTitle && ` · ${report.requestTitle}`}</p>
              <p className="text-sm leading-relaxed whitespace-pre-line break-words text-muted-foreground">{report.description}</p>
              <ol className="space-y-1.5 border-l-2 border-primary/15 pl-4 text-xs text-muted-foreground">{report.history.map((event, index) => <li key={index}><strong className="text-foreground">{event.status}</strong> · {dateFormatter.format(new Date(event.at))}<span className="block">{event.note}</span></li>)}</ol>
              {report.status !== 'Resuelto' && <p className="text-xs text-muted-foreground">El equipo de Hogar+ está dando seguimiento a este reporte.</p>}
            </article>
          </AnimatedItem>)}
    </CardContent>
    <ReportDialog open={open} onOpenChange={setOpen} onCreated={(report) => { setReports((current) => [report, ...(current ?? [])]); onNotice?.('Reporte enviado. Gracias por avisarnos') }} />
  </Card>
}

function PrivacyPanel({ role }) {
  const provider = role === 'Proveedor'
  const groups = provider
    ? [
      { icon: ShieldCheck, title: 'Visible para los clientes', items: ['Nombre y especialidad', 'Descripción y experiencia', 'Zonas de atención', 'Insignia de verificación'] },
      { icon: EyeOff, title: 'Datos privados', items: ['Dirección y cuenta bancaria: solo tú', 'Identificación legal, referencia y foto del documento: tú y el equipo de revisión', 'Correo y teléfono: se comparten con un cliente cuando acepta tu propuesta'] },
      { icon: LockKeyhole, title: 'Datos del cliente', items: ['Su contacto y las fotos adjuntas se muestran solo cuando acepta tu propuesta', 'Los mensajes previos no pueden incluir teléfonos, correos ni enlaces'] },
    ]
    : [
      { icon: ShieldCheck, title: 'Visible para el proveedor desde el inicio', items: ['Tu nombre', 'Descripción del trabajo, urgencia y zona general'] },
      { icon: LockKeyhole, title: 'Visible solo tras aceptar una propuesta', items: ['Teléfono, correo, dirección, indicaciones privadas y fotos adjuntas'] },
      { icon: EyeOff, title: 'Acceso restringido', items: ['Tu contraseña no se muestra', 'Tus reportes solo los ven tú y el equipo de revisión'] },
    ]
  return <Card className="rounded-2xl py-0 shadow-sm" aria-labelledby="privacy-title">
    <CardHeader className="px-6 pt-6">
      <CardTitle id="privacy-title" className="flex items-center gap-2 font-heading text-lg text-brand"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />Protección de tus datos</CardTitle>
      <CardDescription>Así se manejan tus datos personales en Hogar+.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-3">
      {groups.map(({ icon: Icon, title, items }) => <section key={title} className="space-y-3 rounded-xl bg-secondary/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" aria-hidden="true" />{title}</h3>
        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul>
      </section>)}
    </CardContent>
  </Card>
}

function Security({ role, onNotice }) {
  return <Page>
    <PageHeader eyebrow="SEGURIDAD Y CONFIANZA" title="Seguridad y confianza" description="Verificación de proveedores, reportes de incidentes y protección de datos." />
    <div className="space-y-6">
      {role === 'Proveedor' && <VerificationPanel onNotice={onNotice} />}
      <ReportsPanel role={role} onNotice={onNotice} />
      <PrivacyPanel role={role} />
    </div>
    <PageFooter />
  </Page>
}

export default Security
