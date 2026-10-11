import { useState } from 'react'
import { login } from './api.js'

const demos = [
  { label: 'Proveedor', identifier: 'proveedor@hogar.test', password: 'Proveedor2026!' },
  { label: 'Cliente', identifier: 'cliente@hogar.test', password: 'Cliente2026!' },
]

function Auth({ onLogin }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user } = await login({ identifier: identifier.trim(), password })
      onLogin(user)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  function fillDemo(account) {
    setIdentifier(account.identifier)
    setPassword(account.password)
    setError('')
  }

  return <main className="auth-page">
    <div className="auth-intro">
      <div className="auth-logo"><span>⌂</span> hogar<span>+</span></div>
      <div className="eyebrow">SERVICIOS PARA TU HOGAR</div>
      <h1>Bienvenido a un hogar de confianza.</h1>
      <p>Un espacio para encontrar profesionales y para dar a conocer tus servicios.</p>
    </div>
    <section className="auth-card" aria-labelledby="login-title">
      <div className="eyebrow">INGRESA A TU ESPACIO</div>
      <h2 id="login-title">Iniciar sesión</h2>
      <p>Usa tu correo o nombre de usuario y contraseña.</p>
      <form onSubmit={submit}>
        <label htmlFor="login-identifier">Correo electrónico o usuario</label>
        <input id="login-identifier" autoComplete="username" required maxLength={120} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="tu@correo.com" />
        <label htmlFor="login-password">Contraseña</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" />
        {error && <p className="action-error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Ingresando...' : 'Entrar'}</button>
      </form>
      <div className="auth-demo">
        <strong>Cuentas para probar la página</strong>
        <p>Selecciona una cuenta para completar el formulario.</p>
        <div>{demos.map((account) => <button type="button" key={account.label} onClick={() => fillDemo(account)}>{account.label}</button>)}</div>
      </div>
    </section>
  </main>
}

export default Auth
