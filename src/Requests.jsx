import { useEffect, useState } from 'react'
import { getClientRequests, getProviderRequests } from './api.js'

const statusClass = {
  Pendiente: 'pending',
  Cotizado: 'quoted',
  Aceptado: 'accepted',
  'En proceso': 'progress',
  Finalizado: 'finished',
}

function Requests({ role }) {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const isClient = role === 'Cliente'

  useEffect(() => {
    let active = true
    const load = isClient ? getClientRequests : getProviderRequests
    load().then((data) => { if (active) setRequests(data.requests) })
      .catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [isClient])

  const heading = isClient ? 'Mis solicitudes' : 'Solicitudes recibidas'
  return <main>
    <div className="page-title"><div><div className="eyebrow">HISTORIAL DE SERVICIOS</div><h1>{heading}<span>.</span></h1><p>{isClient ? 'Consulta tus solicitudes y su estado actual.' : 'Consulta las solicitudes relacionadas con tus servicios.'}</p></div></div>
    {error ? <div className="empty" role="alert"><h3>No se pudo cargar el historial</h3><p>{error}</p></div>
      : !requests ? <div className="empty" role="status"><h3>Cargando solicitudes...</h3></div>
        : !requests.length ? <div className="empty"><h3>Aún no hay solicitudes</h3><p>Cuando haya actividad, aparecerá aquí.</p></div>
          : <div className="request-list">{requests.map((item) => <article className="request-card" key={item.id}>
            <div className="request-top"><span className="request-date">{new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.createdAt))}</span><span className={`request-status ${statusClass[item.status] || 'pending'}`}>{item.status}</span></div>
            <h2>{item.serviceTitle}</h2>
            <p><strong>{isClient ? 'Proveedor' : 'Cliente'}:</strong> {isClient ? item.providerName : item.clientName}</p>
            {item.need && <p><strong>Necesidad:</strong> {item.need}</p>}
            {!isClient && (item.clientContact
              ? <div className="request-contact"><strong>Datos de contacto disponibles</strong><span>Teléfono: {item.clientContact.phone || 'Sin registrar'}</span><span>Correo: {item.clientContact.email || 'Sin registrar'}</span><span>Dirección: {item.clientContact.address || 'Sin registrar'}</span></div>
              : <div className="request-contact locked"><strong>Datos de contacto protegidos</strong><span>Se mostrarán cuando la solicitud esté aceptada.</span></div>)}
          </article>)}</div>}
    <footer>Hogar+ · Tu espacio de servicios</footer>
  </main>
}

export default Requests
