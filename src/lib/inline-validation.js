import { createContext, useContext } from 'react'

export const ValidationContext = createContext(null)

export function useInlineField(id, describedBy, invalid) {
  const errors = useContext(ValidationContext)
  const message = id && errors?.[id]
  return {
    'aria-invalid': Boolean(invalid || message),
    'aria-describedby': [describedBy, message ? `${id}-error` : null].filter(Boolean).join(' ') || undefined,
  }
}
