import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Logo } from '../App.jsx'
import Icon from '../components/Icon.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Anmeldung fehlgeschlagen – bitte E-Mail und Passwort prüfen.')
    setBusy(false)
  }

  const inputCls =
    'w-full rounded-[12px] bg-card px-[15px] py-[14px] text-[16px] outline-none transition ' +
    'shadow-card border border-transparent focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3'
  const labelCls = 'text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-3'

  return (
    <div className="min-h-svh flex items-center justify-center animate-rise" style={{ padding: 24 }}>
      {/* Explizite Breiten, damit das Formular auf jedem Desktop stabil bleibt */}
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5"><Logo size={74} /></div>
          <h1 className="text-[28px] font-bold text-ink">Rezeptbase</h1>
          <p className="text-[14.5px] text-ink-3 mt-1.5">Deine persönliche Rezeptsammlung</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className={labelCls}>E-Mail</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="du@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className={labelCls}>Passwort</label>
            {/* Passwortfeld mit Auge zum Ein-/Ausblenden der Eingabe */}
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 grid place-content-center text-ink-3 active:opacity-70 transition"
                style={{ width: 44, height: 44 }}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                aria-pressed={showPassword}
                tabIndex={0}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          {error && (
            <p className="text-[13.5px] text-love rounded-[12px] px-4 py-3" style={{ background: 'rgb(195 61 36 / 0.1)' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-[50px] rounded-[14px] bg-tint text-[16.5px] font-semibold text-white transition active:bg-tint-dark active:scale-[0.98] disabled:opacity-45"
          >
            {busy ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
