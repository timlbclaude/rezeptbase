import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Recipes from './pages/Recipes.jsx'
import Icon from './components/Icon.jsx'

export function Logo({ size = 40 }) {
  return (
    <span
      className="inline-grid place-content-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-paper shadow-card"
      style={{ width: size, height: size }}
    >
      <Icon name="chefHat" size={size * 0.55} strokeWidth={1.7} />
    </span>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="min-h-svh flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-4"><Logo size={56} /></div>
          <h1 className="font-display text-2xl font-semibold mb-2">Rezeptbase</h1>
          <p className="text-ink-500">
            Die App ist noch nicht mit der Datenbank verbunden. (Supabase-Konfiguration fehlt.)
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-4">
        <Logo size={56} />
        <p className="text-ink-400 animate-pulse text-sm tracking-wide">Rezeptbase wird geladen …</p>
      </div>
    )
  }

  return session ? <Recipes session={session} /> : <Login />
}
