import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Logo } from '../App.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    'w-full rounded-xl border border-ink-200 bg-card px-4 py-3 text-base outline-none transition ' +
    'focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400'

  return (
    <div className="min-h-svh flex items-center justify-center p-6 animate-rise">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5"><Logo size={64} /></div>
          <h1 className="font-display text-4xl font-semibold text-ink-900 tracking-tight">Rezeptbase</h1>
          <p className="text-ink-500 mt-2">Deine persönliche Rezeptsammlung</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              E-Mail
            </label>
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
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          {error && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-paper shadow-card transition active:scale-[0.99] active:bg-brand-800 disabled:opacity-50"
          >
            {busy ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
