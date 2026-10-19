import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, ImagePlus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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

function ImageThumbnail({ image, alt, onOpen }) {
  return <button type="button" onClick={onOpen} aria-label={`Ampliar ${alt}`} className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <img src={image.dataUrl} alt={alt} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
    <span className="pointer-events-none absolute bottom-2 right-2 grid size-8 place-items-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform group-hover:scale-110 motion-reduce:transition-none" aria-hidden="true"><Expand className="size-4" /></span>
  </button>
}

function ImageLightbox({ images, activeIndex, onClose, altPrefix }) {
  const image = activeIndex === null ? null : images[activeIndex]
  const showNavigation = images.length > 1
  const move = (direction) => onClose((activeIndex + direction + images.length) % images.length)

  return <Dialog open={Boolean(image)} onOpenChange={(open) => { if (!open) onClose(null) }}>
    {image && <DialogContent showCloseButton={false} overlayClassName="bg-primary/15 backdrop-blur-[2px]" className="flex h-[90dvh] max-h-[820px] flex-col gap-3 overflow-hidden rounded-2xl border-border bg-card p-4 text-card-foreground shadow-xl sm:max-w-5xl sm:p-5" onKeyDown={(event) => {
      if (!showNavigation) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        move(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
      <DialogTitle className="sr-only">Foto</DialogTitle>
      <DialogDescription className="sr-only">Imagen {activeIndex + 1} de {images.length}</DialogDescription>
      <div className="flex justify-end">
        <DialogClose asChild><Button type="button" size="icon-sm" variant="outline" aria-label="Cerrar imagen" className="shrink-0 border-border bg-background text-primary hover:bg-accent hover:text-primary"><X className="size-4" /></Button></DialogClose>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/60">
        <img src={image.dataUrl} alt={`${altPrefix} ${activeIndex + 1}`} className="h-full w-full object-contain" />
      </div>
      {showNavigation && <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <Button type="button" size="sm" variant="ghost" onClick={() => move(-1)} className="text-primary hover:bg-accent hover:text-primary"><ChevronLeft className="size-4" />Anterior</Button>
        <span>{activeIndex + 1} / {images.length}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => move(1)} className="text-primary hover:bg-accent hover:text-primary">Siguiente<ChevronRight className="size-4" /></Button>
      </div>}
    </DialogContent>}
  </Dialog>
}

export function ImageGallery({ images = [], label = 'Imágenes adjuntas', altPrefix = 'Imagen' }) {
  const [activeIndex, setActiveIndex] = useState(null)
  if (!images.length) return null
  return <>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={label}>
      {images.map((image, index) => <ImageThumbnail key={`${image.name}-${index}`} image={image} alt={`${altPrefix} ${index + 1}: ${image.name}`} onOpen={() => setActiveIndex(index)} />)}
    </div>
    <ImageLightbox images={images} activeIndex={activeIndex} onClose={setActiveIndex} altPrefix={altPrefix} />
  </>
}

export function ImagePicker({ id, images, onChange, disabled = false, label = 'Imágenes de muestra', hint, maxCount = maxImages }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(null)

  async function selectImages(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    if (images.length + files.length > maxCount) {
      setError(`Puedes adjuntar hasta ${maxCount} ${maxCount === 1 ? 'imagen' : 'imágenes'}.`)
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
    <Input ref={inputRef} id={id} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple={maxCount > 1} onChange={selectImages} disabled={disabled || busy || images.length >= maxCount} className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
    <p className="text-xs text-muted-foreground">{hint || `Hasta ${maxCount} ${maxCount === 1 ? 'imagen' : 'imágenes'} JPG o PNG de 3 MB cada una.`}</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`Imágenes seleccionadas: ${label}`}>
      {images.map((image, index) => <div className="relative" key={`${image.name}-${index}`}>
        <ImageThumbnail image={image} alt={`${label} ${index + 1}: ${image.name}`} onOpen={() => setActiveIndex(index)} />
        <Button type="button" size="icon-sm" variant="secondary" className="absolute top-1 right-1 bg-card shadow-sm" aria-label={`Quitar imagen ${index + 1}`} onClick={() => { onChange(images.filter((_, position) => position !== index)); setError(''); inputRef.current?.focus() }} disabled={disabled || busy}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
      </div>)}
    </div>}
    <ImageLightbox images={images} activeIndex={activeIndex} onClose={setActiveIndex} altPrefix={label} />
  </div>
}
