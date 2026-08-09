import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Recipes from './pages/Recipes.jsx'

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
          <p className="text-4xl mb-3">🍳</p>
          <h1 className="text-xl font-bold mb-2">Rezeptbase</h1>
          <p className="text-stone-500">
            Die App ist noch nicht mit der Datenbank verbunden.
            (Supabase-Konfiguration fehlt.)
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-stone-400 animate-pulse">Lade Rezeptbase …</p>
      </div>
    )
  }

  return session ? <Recipes session={session} /> : <Login />
}
