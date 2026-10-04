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
