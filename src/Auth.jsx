import { useRef, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, LoaderCircle, Search, ShieldCheck, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import Brand from './Brand.jsx'
import { login } from './api.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const demos = [
  { label: 'Proveedor', identifier: 'proveedor@hogar.test', password: 'Proveedor2026!', icon: BriefcaseBusiness },
  { label: 'Laura Jiménez', identifier: 'laura@hogar.test', password: 'Proveedor2026!', icon: BriefcaseBusiness },
  { label: 'Andrés Solís', identifier: 'andres@hogar.test', password: 'Proveedor2026!', icon: BriefcaseBusiness },
  { label: 'Marta Rojas', identifier: 'marta@hogar.test', password: 'Proveedor2026!', icon: BriefcaseBusiness },
  { label: 'Cliente', identifier: 'cliente@hogar.test', password: 'Cliente2026!', icon: UserRound },
  { label: 'Equipo Hogar+', identifier: 'admin@hogar.test', password: 'Admin2026!', icon: ShieldCheck },
]

const entrance = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' },
}

function Auth({ onLogin }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const identifierRef = useRef(null)
  const passwordRef = useRef(null)
  const identifierError = submitted && !identifier.trim() ? 'Escribe tu correo o nombre de usuario.' : ''
  const passwordError = submitted && !password ? 'Escribe tu contraseña.' : ''

  async function submit(event) {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    if (!identifier.trim() || !password) {
      const firstEmptyField = !identifier.trim() ? identifierRef : passwordRef
      firstEmptyField.current?.focus()
      return
    }
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
    setSubmitted(false)
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <section className="flex flex-col justify-between bg-login p-6 sm:p-10 lg:min-h-dvh lg:p-[clamp(36px,5vw,72px)]" aria-label="Bienvenida a Hogar+">
        <Brand subtitle="SERVICIOS DEL HOGAR" size="large" />
        <motion.div {...entrance} className="my-auto max-w-xl py-9 sm:py-12 lg:py-16">
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary sm:text-[11px]">UN ESPACIO PARA CUIDAR TU HOGAR</p>
          <h1 className="mb-5 mt-4 max-w-lg font-heading text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-brand sm:text-5xl lg:text-[clamp(44px,4.5vw,68px)]">
            Todo empieza en casa<span className="text-brand-accent">.</span>
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-foreground/75 sm:text-base sm:leading-7">Encuentra a quien te ayude con lo que necesitas o comparte los servicios que ofreces.</p>
          <div className="mt-9 hidden max-w-lg gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-primary/5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint text-mint-foreground"><Search className="size-5" aria-hidden="true" /></span>
              <span><strong className="block text-[13px] font-semibold">Encuentra servicios</strong><small className="mt-1 block text-xs leading-relaxed text-muted-foreground">Explora profesionales para tu hogar.</small></span>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-primary/5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-apricot text-apricot-foreground"><BriefcaseBusiness className="size-5" aria-hidden="true" /></span>
              <span><strong className="block text-[13px] font-semibold">Muestra lo que haces</strong><small className="mt-1 block text-xs leading-relaxed text-muted-foreground">Publica y organiza tus servicios.</small></span>
            </div>
          </div>
        </motion.div>
        <p className="hidden text-xs text-foreground/60 sm:block">Hogar+ <span className="px-1 text-brand-accent">·</span> Servicios cerca de ti</p>
      </section>

      <div className="grid place-items-center px-4 py-7 sm:p-10 lg:p-9">
        <motion.section {...entrance} transition={{ ...entrance.transition, delay: 0.08 }} className="w-full max-w-[470px]" aria-labelledby="login-title">
          <Card className="gap-0 overflow-hidden rounded-3xl py-0 shadow-xl shadow-primary/5">
            <CardContent className="p-6 sm:p-10">
              <p className="mb-3.5 text-[10px] font-bold tracking-[0.18em] text-primary">BIENVENIDO DE NUEVO</p>
              <h2 id="login-title" className="font-heading text-3xl font-extrabold tracking-tight text-brand">Iniciar sesión<span className="text-brand-accent">.</span></h2>
              <p className="mb-7 mt-2 text-sm leading-relaxed text-muted-foreground">Entra a tu espacio con tu correo o nombre de usuario.</p>

              <form onSubmit={submit} className="space-y-5" aria-busy={busy} noValidate>
                <div className="space-y-2.5">
                  <Label htmlFor="login-identifier" className="text-xs font-semibold">Correo electrónico o usuario</Label>
                  <Input ref={identifierRef} id="login-identifier" autoComplete="username" required maxLength={120} value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError('') }} placeholder="tu@correo.com" className="h-12" disabled={busy} aria-invalid={Boolean(identifierError)} aria-describedby={identifierError ? 'login-identifier-error' : undefined} />
                  {identifierError && <p id="login-identifier-error" className="text-xs text-destructive" aria-live="polite">{identifierError}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="login-password" className="text-xs font-semibold">Contraseña</Label>
                  <Input ref={passwordRef} id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Tu contraseña" className="h-12" disabled={busy} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? 'login-password-error' : undefined} />
                  {passwordError && <p id="login-password-error" className="text-xs text-destructive" aria-live="polite">{passwordError}</p>}
                </div>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive" role="alert">{error}</motion.p>}
                <Button className="h-12 w-full gap-2" type="submit" disabled={busy}>
                  {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                  {busy ? 'Ingresando...' : 'Entrar'}
                  {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
                </Button>
              </form>

              <div className="mt-7 rounded-2xl border border-primary/10 bg-accent/55 p-4 sm:p-5">
                <strong className="text-xs font-semibold">Cuentas para probar la página</strong>
                <p className="mb-3.5 mt-1 text-xs leading-relaxed text-muted-foreground">Selecciona una cuenta para completar el formulario.</p>
                <div className="flex flex-wrap gap-2">
                  {demos.map(({ icon: Icon, ...account }) => (
                    <Button variant="outline" size="sm" type="button" key={account.label} onClick={() => fillDemo(account)} disabled={busy} className="gap-2 border-primary/15 bg-card text-primary hover:bg-accent hover:text-primary">
                      <Icon className="size-3.5" aria-hidden="true" />{account.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </main>
  )
}

export default Auth
