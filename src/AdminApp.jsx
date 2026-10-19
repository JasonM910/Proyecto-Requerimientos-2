import { useEffect, useState } from 'react'
import { BadgeCheck, ClipboardList, RefreshCw } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, Notice, Page, PageFooter, PageHeader } from '@/components/page'
import { FieldError, ValidatedForm } from '@/components/InlineValidation'
import { ImageGallery } from '@/components/ImagePicker'
import { getAdminReports, getAdminVerifications, reviewReport, reviewVerification } from './api.js'

const date = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })

function AdminApp({ initialUser, onLogout }) {
  const [view, setView] = useState('reportes')
  const [reports, setReports] = useState(null)
  const [verifications, setVerifications] = useState(null)
  const [notes, setNotes] = useState({})
  const [reviewedEvidence, setReviewedEvidence] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      const load = view === 'reportes' ? getAdminReports : getAdminVerifications
      load().then((data) => {
        if (!active) return
        if (view === 'reportes') setReports(data.reports)
        else setVerifications(data.verifications)
        setError('')
      }).catch((problem) => { if (active) setError(problem.message) })
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [view])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  function setNote(id, value) { setNotes((current) => ({ ...current, [id]: value })) }

  async function actReport(report, action) {
    setBusy(report.id)
    setError('')
    try {
      const { report: updated } = await reviewReport(report.id, { action, note: notes[report.id]?.trim() || '' })
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNote(report.id, '')
      setNotice(action === 'review' ? 'Reporte en revisión' : 'Reporte resuelto')
    } catch (problem) { setError(problem.message) } finally { setBusy('') }
  }

  async function actVerification(profile, action) {
    setBusy(profile.providerId)
    setError('')
    try {
      const { verification } = await reviewVerification(profile.providerId, { action, note: notes[profile.providerId]?.trim() || '', reviewedEvidence: reviewedEvidence[profile.providerId] === true })
      setVerifications((current) => current.map((item) => item.providerId === profile.providerId ? { ...item, ...verification } : item))
      setNote(profile.providerId, '')
      setReviewedEvidence((current) => ({ ...current, [profile.providerId]: false }))
      setNotice(action === 'approve' ? 'Proveedor verificado' : 'Verificación rechazada')
    } catch (problem) { setError(problem.message) } finally { setBusy('') }
  }

  const isReports = view === 'reportes'
  const records = isReports ? reports : verifications
  return <AppShell user={initialUser} view={view} onViewChange={setView} onLogout={onLogout}>
    <Page>
      <PageHeader eyebrow="EQUIPO HOGAR+" title={isReports ? 'Reportes recibidos' : 'Verificar proveedores'}
        description={isReports ? 'Revisa los incidentes enviados por clientes y proveedores.' : 'Comprueba los datos de identidad y decide qué perfiles muestran la insignia.'}
        action={<Button variant="outline" onClick={() => { const load = isReports ? getAdminReports : getAdminVerifications; load().then((data) => { if (isReports) setReports(data.reports); else setVerifications(data.verifications); setError('') }).catch((problem) => setError(problem.message)) }}><RefreshCw className="size-4" aria-hidden="true" />Actualizar</Button>} />
      {error && <p role="alert" className="mb-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {!records ? <EmptyState loading title="Cargando pendientes..." /> : !records.length ? <EmptyState title="No hay registros por revisar" />
        : <div className="space-y-4">
          {isReports ? reports.map((report) => <Card className="gap-0 rounded-2xl py-0 shadow-none" key={report.id} aria-label={`Reporte: ${report.category}`}>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-brand"><ClipboardList className="size-4" aria-hidden="true" />{report.category}</h2><Badge variant="secondary">{report.status}</Badge></div>
              <p className="text-xs text-muted-foreground">{report.reporterName} · {report.reporterRole} · <time dateTime={report.createdAt}>{date.format(new Date(report.createdAt))}</time>{report.targetName && ` · Sobre ${report.targetName}`}{report.requestTitle && ` · ${report.requestTitle}`}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{report.description}</p>
              <ol className="space-y-1 border-l-2 border-primary/15 pl-4 text-xs text-muted-foreground">{report.history.map((entry, index) => <li key={index}><strong className="text-foreground">{entry.status}</strong> · {entry.note}</li>)}</ol>
              {report.status !== 'Resuelto' && <ValidatedForm className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); actReport(report, report.status === 'Recibido' ? 'review' : 'resolve') }}>
                <Label htmlFor={`report-note-${report.id}`}>Respuesta del equipo</Label>
                <Textarea id={`report-note-${report.id}`} required minLength={5} maxLength={500} rows={2} value={notes[report.id] || ''} onChange={(event) => setNote(report.id, event.target.value)} disabled={busy === report.id} placeholder="Describe lo revisado o la resolución del caso." />
                <FieldError id={`report-note-${report.id}`} />
                <Button size="sm" type="submit" disabled={busy === report.id}>{report.status === 'Recibido' ? 'Iniciar revisión' : 'Resolver reporte'}</Button>
              </ValidatedForm>}
            </CardContent>
          </Card>) : verifications.map((profile) => <Card className="gap-0 rounded-2xl py-0 shadow-none" key={profile.providerId} aria-label={`Verificación: ${profile.name}`}>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-brand"><BadgeCheck className="size-4" aria-hidden="true" />{profile.name}</h2><Badge variant="secondary">{profile.status}</Badge></div>
              <dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="font-semibold">Identificación</dt><dd>{profile.legalId || 'Sin registrar'}</dd></div><div><dt className="font-semibold">Referencia del documento</dt><dd className="break-words">{profile.documentReference || 'Sin registrar'}</dd></div><div><dt className="font-semibold">Contacto</dt><dd>{profile.email || 'Sin correo'} · {profile.phone || 'Sin teléfono'}</dd></div><div><dt className="font-semibold">Zonas</dt><dd>{profile.zones.join(', ') || 'Sin zonas'}</dd></div></dl>
              {profile.verificationEvidence?.length > 0 && <div className="max-w-sm space-y-2"><p className="text-xs font-semibold">Documento de identidad adjunto · solo para el equipo</p><ImageGallery images={profile.verificationEvidence} label={`Documento de identidad de ${profile.name}`} altPrefix="Documento de identidad" /></div>}
              <p className="text-xs text-muted-foreground">Experiencia: {profile.experience || 'Sin descripción'}</p>
              {profile.note && <p className="text-xs text-muted-foreground">Observación: {profile.note}</p>}
              {profile.status === 'En revisión' && <div className="space-y-3 border-t pt-4">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed"><input type="checkbox" checked={reviewedEvidence[profile.providerId] === true} onChange={(event) => setReviewedEvidence((current) => ({ ...current, [profile.providerId]: event.target.checked }))} disabled={busy === profile.providerId || !profile.verificationEvidence?.length} className="mt-0.5 size-4 shrink-0 accent-primary" />Revisé la foto del documento y comparé sus datos con el perfil.</label>
                <Label htmlFor={`verification-note-${profile.providerId}`}>Observación de la revisión</Label>
                <Textarea id={`verification-note-${profile.providerId}`} maxLength={200} rows={2} value={notes[profile.providerId] || ''} onChange={(event) => setNote(profile.providerId, event.target.value)} disabled={busy === profile.providerId} placeholder="Obligatoria si rechazas la solicitud." />
                <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy === profile.providerId || !profile.checks.every((check) => check.met) || reviewedEvidence[profile.providerId] !== true} onClick={() => actVerification(profile, 'approve')}>Aprobar verificación</Button><Button size="sm" variant="outline" disabled={busy === profile.providerId || (notes[profile.providerId]?.trim().length || 0) < 5} onClick={() => actVerification(profile, 'reject')}>Rechazar</Button></div>
              </div>}
            </CardContent>
          </Card>)}
        </div>}
      <PageFooter />
    </Page>
    <Notice message={notice} />
  </AppShell>
}

export default AdminApp
