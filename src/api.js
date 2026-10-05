async function request(path, options) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que la aplicación esté en ejecución.')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'No se pudo completar la operación.')
  return data
}

export const getDashboard = () => request('/api/dashboard')
export const createService = (service) => request('/api/services', { method: 'POST', body: JSON.stringify(service) })
export const updateService = (id, service) => request(`/api/services/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(service) })
export const removeService = (id) => request(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const getProfile = () => request('/api/profile')
export const updateProfile = (profile) => request('/api/profile', { method: 'PUT', body: JSON.stringify(profile) })
export const getPublicProfile = () => request('/api/profile/public')
export function searchServices({ q = '', category = '', zone = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (zone) params.set('zone', zone)
  return request(`/api/search?${params}`)
}