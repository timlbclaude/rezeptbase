import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import ImportPage from './ImportPage.jsx'
import RecipeDetail from './RecipeDetail.jsx'

export default function Recipes({ session }) {
  const [view, setView] = useState({ name: 'list' })
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  const loadRecipes = useCallback(() => {
    supabase
      .from('recipes')
      .select('id, title, category, image_url, prep_time_min, cook_time_min, is_favorite')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecipes(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-10 bg-stone-50/90 backdrop-blur border-b border-stone-200">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => setView({ name: 'list' })} className="text-lg font-bold text-stone-900">
            🍳 Rezeptbase
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-stone-500">
            Abmelden
          </button>
        </div>
      </header>

      {view.name === 'import' && (
        <ImportPage
          onCancel={() => setView({ name: 'list' })}
          onDone={(id) => {
            loadRecipes()
            setView({ name: 'detail', id })
          }}
        />
      )}

      {view.name === 'detail' && (
        <RecipeDetail
          recipeId={view.id}
          onBack={() => setView({ name: 'list' })}
          onDeleted={() => {
            loadRecipes()
            setView({ name: 'list' })
          }}
        />
      )}

      {view.name === 'list' && (
        <main className="mx-auto max-w-2xl px-4 py-6">
          {loading ? (
            <p className="text-stone-400 animate-pulse">Lade Rezepte …</p>
          ) : recipes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📖</p>
              <h2 className="font-semibold text-stone-900 mb-1">Noch keine Rezepte</h2>
              <p className="text-stone-500 text-sm max-w-xs mx-auto">
                Importiere dein erstes Rezept – einfach einen YouTube-Link oder eine Kochseite einfügen.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setView({ name: 'detail', id: r.id })}
                    className="w-full text-left rounded-2xl bg-white border border-stone-200 overflow-hidden active:scale-[0.98] transition"
                  >
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="h-28 w-full object-cover" />
                    ) : (
                      <div className="h-28 w-full bg-stone-100 flex items-center justify-center text-3xl">🍽️</div>
                    )}
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-900 line-clamp-2">{r.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {[r.category, (r.prep_time_min ?? 0) + (r.cook_time_min ?? 0) > 0 ? `${(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)} Min` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-center text-xs text-stone-400 mt-10">Angemeldet als {session.user.email}</p>
        </main>
      )}

      {view.name === 'list' && (
        <button
          onClick={() => setView({ name: 'import' })}
          className="fixed bottom-6 right-1/2 translate-x-1/2 sm:right-8 sm:translate-x-0 rounded-full bg-brand-600 text-white font-semibold px-6 py-3.5 shadow-lg shadow-brand-600/30 active:bg-brand-700"
        >
          + Rezept importieren
        </button>
      )}
    </div>
  )
}
