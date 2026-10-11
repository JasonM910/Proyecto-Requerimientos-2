import { useState } from 'react'
import Brand from './Brand.jsx'
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
    <section className="auth-intro" aria-label="Bienvenida a Hogar+">
      <Brand subtitle="SERVICIOS DEL HOGAR" className="auth-brand" />
      <div className="auth-intro-content">
        <div className="eyebrow">UN ESPACIO PARA CUIDAR TU HOGAR</div>
        <h1>Todo empieza en casa<span>.</span></h1>
        <p>Encuentra a quien te ayude con lo que necesitas o comparte los servicios que ofreces.</p>
        <div className="auth-benefits">
          <div className="auth-benefit">
            <span className="auth-benefit-icon mint"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
            <span><strong>Encuentra servicios</strong><small>Explora profesionales para tu hogar.</small></span>
          </div>
          <div className="auth-benefit">
            <span className="auth-benefit-icon apricot"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 5V3m8 2V3M4 10h16m-11 5h6" /></svg></span>
            <span><strong>Muestra lo que haces</strong><small>Publica y organiza tus servicios.</small></span>
          </div>
        </div>
      </div>
      <div className="auth-intro-footer">Hogar+ <span>·</span> Servicios cerca de ti</div>
    </section>
    <div className="auth-form-side">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="eyebrow">BIENVENIDO DE NUEVO</div>
        <h2 id="login-title">Iniciar sesión<span>.</span></h2>
        <p>Entra a tu espacio con tu correo o nombre de usuario.</p>
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
    </div>
  </main>
}

export default Auth
