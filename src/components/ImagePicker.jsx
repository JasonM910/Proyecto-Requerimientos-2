import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const maxImages = 3
const maxImageBytes = 3 * 1024 * 1024

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result })
    reader.onerror = () => reject(new Error('No se pudo leer una imagen. Inténtalo de nuevo.'))
    reader.readAsDataURL(file)
  })
}

export function ImageGallery({ images = [], label = 'Imágenes adjuntas', altPrefix = 'Imagen' }) {
  if (!images.length) return null
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={label}>
    {images.map((image, index) => <img key={`${image.name}-${index}`} src={image.dataUrl} alt={`${altPrefix} ${index + 1}: ${image.name}`} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />)}
  </div>
}

export function ImagePicker({ id, images, onChange, disabled = false, label = 'Imágenes de muestra', hint }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function selectImages(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    if (images.length + files.length > maxImages) {
      setError(`Puedes adjuntar hasta ${maxImages} imágenes.`)
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/png'].includes(file.type))) {
      setError('Selecciona únicamente imágenes JPG o PNG.')
      return
    }
    if (files.some((file) => !file.size || file.size > maxImageBytes || file.name.length > 100)) {
      setError('Cada imagen debe tener un nombre corto y pesar menos de 3 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onChange([...images, ...await Promise.all(files.map(readImage))])
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-3">
    <Label htmlFor={id} className="flex items-center gap-2"><ImagePlus className="size-4 text-primary" aria-hidden="true" />{label} (opcional)</Label>
    <Input ref={inputRef} id={id} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple onChange={selectImages} disabled={disabled || busy || images.length >= maxImages} className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
    <p className="text-xs text-muted-foreground">{hint || 'Hasta 3 imágenes JPG o PNG de 3 MB cada una.'}</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`Imágenes seleccionadas: ${label}`}>
      {images.map((image, index) => <div className="relative" key={`${image.name}-${index}`}>
        <img src={image.dataUrl} alt={`${label} ${index + 1}: ${image.name}`} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
        <Button type="button" size="icon-sm" variant="secondary" className="absolute top-1 right-1 bg-card shadow-sm" aria-label={`Quitar imagen ${index + 1}`} onClick={() => { onChange(images.filter((_, position) => position !== index)); setError(''); inputRef.current?.focus() }} disabled={disabled || busy}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
      </div>)}
    </div>}
  </div>
}
