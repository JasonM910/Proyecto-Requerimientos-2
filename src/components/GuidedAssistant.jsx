import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const areas = [
  { id: 'cocina-bano', label: 'Cocina o baño', place: 'la cocina o el baño', categories: ['Plomería', 'Electricidad', 'Limpieza', 'Carpintería'] },
  { id: 'habitaciones', label: 'Habitaciones', place: 'una habitación', categories: ['Electricidad', 'Limpieza', 'Carpintería'] },
  { id: 'exteriores', label: 'Jardín o exteriores', place: 'el jardín o exterior', categories: ['Jardinería', 'Plomería', 'Electricidad'] },
  { id: 'cuidado', label: 'Cuidado en casa', place: 'casa', categories: ['Cuidado de personas'] },
  { id: 'otra', label: 'Otra área', place: 'otra área del hogar', categories: null },
]

const helpTypes = {
  Plomería: { label: 'Tuberías o grifos', phrase: 'tuberías o grifos' },
  Electricidad: { label: 'Luces o enchufes', phrase: 'luces o enchufes' },
  Limpieza: { label: 'Limpieza del espacio', phrase: 'la limpieza del espacio' },
  Jardinería: { label: 'Plantas o césped', phrase: 'plantas o césped' },
  Carpintería: { label: 'Puertas o muebles', phrase: 'puertas o muebles' },
  'Cuidado de personas': { label: 'Cuidado de una persona', phrase: 'el cuidado de una persona' },
  Otros: { label: 'Otro tipo de ayuda', phrase: 'otra tarea del hogar' },
}

function asSentence(value) {
  const text = value.trim()
  return /[.!?]$/.test(text) ? text : `${text}.`
}

export default function GuidedAssistant({ open, onOpenChange, categories, onApply }) {
  const [step, setStep] = useState(0)
  const [areaId, setAreaId] = useState('')
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [expected, setExpected] = useState('')
  const [urgency, setUrgency] = useState('Flexible')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const area = areas.find((item) => item.id === areaId)
  const choices = categories.filter((item) => !area?.categories || area.categories.includes(item.name))
  const selectedHelp = helpTypes[category] || { label: category, phrase: category.toLowerCase() }

  function reset() {
    setStep(0)
    setAreaId('')
    setCategory('')
    setDetails('')
    setExpected('')
    setUrgency('Flexible')
    setDescription('')
    setError('')
  }

  function changeOpen(next) {
    onOpenChange(next)
    if (!next) reset()
  }

  function prepare(event) {
    event.preventDefault()
    if (details.trim().length < 10) {
      setError('Describe el problema con al menos 10 caracteres.')
      return
    }
    const text = `Necesito ayuda con ${selectedHelp.phrase} en ${area.place}. ${asSentence(details)}${expected.trim() ? ` Resultado esperado: ${asSentence(expected)}` : ''}`
    setDescription(text)
    setError('')
    setStep(3)
  }

  function apply(event) {
    event.preventDefault()
    if (description.trim().length < 10) {
      setError('La descripción debe tener al menos 10 caracteres.')
      return
    }
    onApply({ category, description: description.trim(), urgency })
    changeOpen(false)
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl">
      <DialogHeader className="pr-6 text-left">
        <Badge variant="secondary" className="mb-2 w-fit gap-1.5 rounded-full bg-mint px-3 py-1 text-[10px] font-semibold text-mint-foreground"><Sparkles className="size-3" aria-hidden="true" />ASISTENTE DE SERVICIOS</Badge>
        <DialogTitle className="font-heading text-2xl font-bold text-brand">Te ayudamos a encontrar el servicio</DialogTitle>
        <DialogDescription>Responde unas preguntas y prepara tu solicitud. Podrás editarla antes de enviarla.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2" aria-label={`Paso ${step + 1} de 4`}>
        {[0, 1, 2, 3].map((number) => <span key={number} className={`h-1.5 flex-1 rounded-full ${number <= step ? 'bg-primary' : 'bg-secondary'}`} aria-hidden="true" />)}
      </div>
      <p className="text-xs font-semibold text-muted-foreground">Paso {step + 1} de 4</p>

      {step === 0 && <section className="space-y-4" aria-labelledby="assistant-question">
        <h3 id="assistant-question" className="font-heading text-lg font-bold text-brand">¿En qué parte del hogar necesitas ayuda?</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {areas.map((item) => <Button key={item.id} variant="outline" className="h-auto min-h-14 justify-between rounded-xl px-4 text-left whitespace-normal" onClick={() => { setAreaId(item.id); setStep(1) }}>{item.label}<ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /></Button>)}
        </div>
      </section>}

      {step === 1 && <section className="space-y-4" aria-labelledby="assistant-question">
        <h3 id="assistant-question" className="font-heading text-lg font-bold text-brand">¿Qué tipo de ayuda necesitas?</h3>
        <p className="text-sm text-muted-foreground">Área seleccionada: {area.label}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((item) => <Button key={item.name} variant="outline" className="h-auto min-h-16 justify-between rounded-xl px-4 text-left whitespace-normal" onClick={() => { setCategory(item.name); setStep(2) }}><span><strong className="block text-sm">{helpTypes[item.name]?.label || item.name}</strong><small className="block pt-1 text-xs text-muted-foreground">{item.name}</small></span><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /></Button>)}
        </div>
      </section>}

      {step === 2 && <form id="assistant-details" className="space-y-4" onSubmit={prepare}>
        <h3 className="font-heading text-lg font-bold text-brand">Cuéntanos qué está pasando</h3>
        <div className="space-y-2"><Label htmlFor="assistant-problem">Describe el problema <span className="text-destructive">*</span></Label><Textarea id="assistant-problem" required minLength={10} maxLength={500} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Ej. Hay una fuga debajo del fregadero desde ayer." /></div>
        <div className="space-y-2"><Label htmlFor="assistant-expected">¿Qué resultado esperas? (opcional)</Label><Textarea id="assistant-expected" maxLength={200} rows={2} value={expected} onChange={(event) => setExpected(event.target.value)} placeholder="Ej. Reparar la fuga y revisar las conexiones." /></div>
        <div className="space-y-2"><Label htmlFor="assistant-urgency">¿Qué tan pronto necesitas ayuda?</Label><Select value={urgency} onValueChange={setUrgency}><SelectTrigger id="assistant-urgency" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Flexible">Flexible</SelectItem><SelectItem value="Próximos días">Próximos días</SelectItem><SelectItem value="Urgente">Urgente</SelectItem></SelectContent></Select></div>
        <p className="text-xs text-muted-foreground">No incluyas teléfono, correo ni dirección exacta aquí. Podrás agregar indicaciones privadas al solicitar el servicio.</p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>}

      {step === 3 && <form id="assistant-summary" className="space-y-4" onSubmit={apply}>
        <h3 className="font-heading text-lg font-bold text-brand">Esta es nuestra sugerencia</h3>
        <div className="rounded-xl border border-primary/15 bg-accent/50 p-4"><p className="text-xs text-muted-foreground">Categoría recomendada</p><p className="mt-1 flex items-center gap-2 font-semibold text-brand"><Check className="size-4 text-primary" aria-hidden="true" />{category}</p></div>
        <div className="space-y-2"><Label htmlFor="assistant-description">Descripción para tu solicitud</Label><Textarea id="assistant-description" required minLength={10} maxLength={1000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /><p className="text-xs text-muted-foreground">Puedes modificar este texto ahora o al elegir un proveedor.</p></div>
        <p className="text-xs text-muted-foreground">Urgencia: {urgency}. La zona se selecciona al enviar la solicitud.</p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>}

      <DialogFooter className="border-t pt-4">
        {step > 0 && <Button type="button" variant="outline" className="mr-auto" onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Volver</Button>}
        {step === 2 && <Button type="submit" form="assistant-details">Preparar sugerencia<ArrowRight className="size-4" aria-hidden="true" /></Button>}
        {step === 3 && <Button type="submit" form="assistant-summary">Ver servicios recomendados<ArrowRight className="size-4" aria-hidden="true" /></Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
