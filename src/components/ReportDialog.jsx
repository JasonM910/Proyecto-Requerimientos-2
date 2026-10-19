import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createReport } from '@/api.js'

export const REPORT_CATEGORIES = ['Conducta inapropiada', 'Incumplimiento del servicio', 'Cobro o pago irregular', 'Datos personales o contacto externo', 'Perfil o publicación falsa', 'Otra anomalía']

// Formulario de reportes de incidentes. `target` puede ser una solicitud ({ requestId }) o un proveedor ({ providerId }).
export function ReportDialog({ open, onOpenChange, target, targetLabel, onCreated }) {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close(next) {
    if (busy) return
    if (!next) { setCategory(''); setDescription(''); setError('') }
    onOpenChange(next)
  }

  async function submit(event) {
    event.preventDefault()
    if (!category) { setError('Selecciona una categoría para el reporte.'); return }
    setBusy(true)
    setError('')
    try {
      const { report } = await createReport({ category, description: description.trim(), ...target })
      setCategory('')
      setDescription('')
      onOpenChange(false)
      onCreated?.(report)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-lg" showCloseButton={!busy}>
      <DialogHeader className="pr-6 text-left">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary">SEGURIDAD Y CONFIANZA</p>
        <DialogTitle className="font-heading text-2xl text-brand">Reportar un problema</DialogTitle>
        <DialogDescription>{targetLabel ? `Sobre: ${targetLabel}. ` : ''}Cuéntanos qué ocurrió. El equipo de Hogar+ revisará el caso.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <div className="space-y-2">
          <Label htmlFor="report-category">Categoría <span className="text-destructive">*</span></Label>
          <Select value={category} onValueChange={setCategory} disabled={busy}>
            <SelectTrigger id="report-category" className="w-full"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
            <SelectContent>{REPORT_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-description">¿Qué ocurrió? <span className="text-destructive">*</span></Label>
          <Textarea id="report-description" required minLength={10} maxLength={800} rows={5} className="min-h-28 resize-y" placeholder="Describe el incidente con la mayor claridad posible." value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} />
          <p className="text-xs text-muted-foreground">{description.length}/800 · Tu reporte es confidencial: la otra persona no lo verá.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={busy}><Flag className="size-4" aria-hidden="true" />{busy ? 'Enviando...' : 'Enviar reporte'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
