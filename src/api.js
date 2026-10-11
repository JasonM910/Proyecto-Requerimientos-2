async function request(path, options) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
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
export const getSession = () => request('/api/auth/session')
export const login = (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
export const logout = () => request('/api/auth/logout', { method: 'POST' })
export const createService = (service) => request('/api/services', { method: 'POST', body: JSON.stringify(service) })
export const updateService = (id, service) => request(`/api/services/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(service) })
export const removeService = (id) => request(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const getProfile = () => request('/api/profile')
export const updateProfile = (profile) => request('/api/profile', { method: 'PUT', body: JSON.stringify(profile) })
export const getPublicProfile = () => request('/api/profile/public')
export const getClientProfile = () => request('/api/client/profile')
export const updateClientProfile = (profile) => request('/api/client/profile', { method: 'PUT', body: JSON.stringify(profile) })
export const getClientRequests = () => request('/api/client/requests')
export const getProviderRequests = () => request('/api/provider/requests')
export const createRequest = (data) => request('/api/client/requests', { method: 'POST', body: JSON.stringify(data) })
export const updateClientRequest = (id, data) => request(`/api/client/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) })
export const updateProviderRequest = (id, data) => request(`/api/provider/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) })
export function searchServices({ q = '', category = '', group = '', zone = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (group) params.set('group', group)
  if (zone) params.set('zone', zone)
  return request(`/api/search?${params}`)
}
