import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Recipes({ session }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, title, category, image_url, prep_time_min, cook_time_min, is_favorite')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecipes(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-10 bg-stone-50/90 backdrop-blur border-b border-stone-200">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-stone-900">🍳 Rezeptbase</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-stone-500"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {loading ? (
          <p className="text-stone-400 animate-pulse">Lade Rezepte …</p>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📖</p>
            <h2 className="font-semibold text-stone-900 mb-1">Noch keine Rezepte</h2>
            <p className="text-stone-500 text-sm max-w-xs mx-auto">
              Der Rezept-Import per Link kommt in Phase 2. Angemeldet als{' '}
              {session.user.email}.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4">
            {recipes.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
                {r.image_url && (
                  <img src={r.image_url} alt="" className="h-28 w-full object-cover" />
                )}
                <div className="p-3">
                  <p className="font-semibold text-sm text-stone-900">{r.title}</p>
                  {r.category && <p className="text-xs text-stone-500 mt-0.5">{r.category}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
