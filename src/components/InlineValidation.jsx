import { useContext, useState } from 'react'
import { ValidationContext } from '@/lib/inline-validation'

function messageFor(field) {
  const value = typeof field.value === 'string' ? field.value.trim() : ''
  if (field.required && !value) return field.value && field.minLength > 0 ? `Escribe al menos ${field.minLength} caracteres.` : 'Completa este campo.'
  if (field.validity?.typeMismatch) return field.type === 'email' ? 'Escribe un correo válido.' : 'Revisa el formato de este campo.'
  if (field.validity?.patternMismatch) return 'Revisa el formato de este campo.'
  if (field.validity?.rangeUnderflow) return `El valor mínimo es ${field.min}.`
  if (field.validity?.rangeOverflow) return `El valor máximo es ${field.max}.`
  if (field.validity?.stepMismatch || field.validity?.badInput) return 'Escribe un número válido.'
  if (field.minLength > 0 && value && value.length < field.minLength) return `Escribe al menos ${field.minLength} caracteres.`
  return ''
}

export function ValidatedForm({ children, onSubmit, onInvalidCapture, onInput, onChange, ...props }) {
  const [errors, setErrors] = useState({})

  function updateField(field) {
    if (!field.id) return
    setErrors((current) => {
      if (!current[field.id]) return current
      const message = messageFor(field)
      if (message === current[field.id]) return current
      const next = { ...current }
      if (message) next[field.id] = message
      else delete next[field.id]
      return next
    })
  }

  function submit(event) {
    const fields = [...event.currentTarget.querySelectorAll('input, textarea, select')]
    const invalid = fields.map((field) => [field, messageFor(field)]).filter(([, message]) => message)
    if (invalid.length) {
      event.preventDefault()
      setErrors(Object.fromEntries(invalid.filter(([field]) => field.id).map(([field, message]) => [field.id, message])))
      invalid[0][0].focus()
      return
    }
    setErrors({})
    onSubmit?.(event)
  }

  return <ValidationContext.Provider value={errors}>
    <form {...props} onSubmit={submit} onInvalidCapture={(event) => {
      event.preventDefault()
      const field = event.target
      if (field.id) setErrors((current) => ({ ...current, [field.id]: messageFor(field) || 'Revisa este campo.' }))
      if (field === event.currentTarget.querySelector(':invalid')) field.focus()
      onInvalidCapture?.(event)
    }} onInput={(event) => { updateField(event.target); onInput?.(event) }} onChange={(event) => { updateField(event.target); onChange?.(event) }}>{children}</form>
  </ValidationContext.Provider>
}

export function FieldError({ id }) {
  const errors = useContext(ValidationContext)
  return errors?.[id] ? <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{errors[id]}</p> : null
}
