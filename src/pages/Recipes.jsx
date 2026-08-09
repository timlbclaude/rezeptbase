import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import ImportPage from './ImportPage.jsx'
import RecipeDetail from './RecipeDetail.jsx'
import ShoppingList from './ShoppingList.jsx'

const TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'zum_ausprobieren', label: '🌱 Zum Ausprobieren' },
  { key: 'gekocht', label: '✅ Gekocht' },
]

export default function Recipes({ session }) {
  const [view, setView] = useState({ name: 'list' })
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('alle')
  const [category, setCategory] = useState('')
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [sort, setSort] = useState('neu')

  const loadRecipes = useCallback(() => {
    supabase
      .from('recipes')
      .select('id, title, category, cuisine, image_url, prep_time_min, cook_time_min, is_favorite, rating, status, created_at, ingredients(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecipes(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category).filter(Boolean))].sort(),
    [recipes],
  )

  const filtered = useMemo(() => {
    let list = recipes
    if (tab !== 'alle') list = list.filter((r) => (r.status ?? 'zum_ausprobieren') === tab)
    if (category) list = list.filter((r) => r.category === category)
    if (onlyFavs) list = list.filter((r) => r.is_favorite)
    const query = q.trim().toLowerCase()
    if (query) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          (r.cuisine ?? '').toLowerCase().includes(query) ||
          (r.ingredients ?? []).some((i) => i.name.toLowerCase().includes(query)),
      )
    }
    list = [...list]
    if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title, 'de'))
    else if (sort === 'bewertung') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return list
  }, [recipes, tab, category, onlyFavs, q, sort])

  const backToList = () => {
    loadRecipes()
    setView({ name: 'list' })
  }

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-10 bg-stone-50/90 backdrop-blur border-b border-stone-200">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={backToList} className="text-lg font-bold text-stone-900">
            🍳 Rezeptbase
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => setView({ name: 'shopping' })} className="text-xl" aria-label="Einkaufsliste">
              🛒
            </button>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-stone-500">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {view.name === 'import' && (
        <ImportPage
          onCancel={backToList}
          onDone={(id) => {
            loadRecipes()
            setView({ name: 'detail', id })
          }}
        />
      )}

      {view.name === 'detail' && (
        <RecipeDetail recipeId={view.id} onBack={backToList} onDeleted={backToList} />
      )}

      {view.name === 'shopping' && <ShoppingList onBack={backToList} />}

      {view.name === 'list' && (
        <main className="mx-auto max-w-2xl px-4 py-4">
          {/* Status-Tabs */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border ${
                  tab === t.key
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-stone-600 border-stone-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Suche + Filter */}
          <input
            type="search"
            placeholder="🔍 Suche nach Titel oder Zutat …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500 mb-2"
          />
          <div className="flex gap-2 mb-4 flex-wrap items-center text-sm">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none"
            >
              <option value="neu">Neueste zuerst</option>
              <option value="az">A–Z</option>
              <option value="bewertung">Beste Bewertung</option>
            </select>
            <button
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`rounded-lg border px-2.5 py-1.5 ${onlyFavs ? 'border-red-300 bg-red-50' : 'border-stone-300 bg-white'}`}
              aria-label="Nur Favoriten"
            >
              {onlyFavs ? '❤️' : '🤍'}
            </button>
          </div>

          {loading ? (
            <p className="text-stone-400 animate-pulse">Lade Rezepte …</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📖</p>
              <h2 className="font-semibold text-stone-900 mb-1">
                {recipes.length === 0 ? 'Noch keine Rezepte' : 'Nichts gefunden'}
              </h2>
              <p className="text-stone-500 text-sm max-w-xs mx-auto">
                {recipes.length === 0
                  ? 'Importiere dein erstes Rezept – einfach einen YouTube-Link oder eine Kochseite einfügen.'
                  : 'Kein Rezept passt zu Suche/Filter. Setze die Filter zurück oder importiere etwas Neues.'}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setView({ name: 'detail', id: r.id })}
                    className="w-full text-left rounded-2xl bg-white border border-stone-200 overflow-hidden active:scale-[0.98] transition"
                  >
                    <div className="relative">
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="h-28 w-full object-cover" />
                      ) : (
                        <div className="h-28 w-full bg-stone-100 flex items-center justify-center text-3xl">🍽️</div>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-xs shadow">
                        {(r.status ?? 'zum_ausprobieren') === 'gekocht' ? '✅' : '🌱'}
                      </span>
                      {r.is_favorite && (
                        <span className="absolute top-1.5 right-1.5 text-sm drop-shadow">❤️</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-900 line-clamp-2">{r.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {[
                          r.category,
                          (r.prep_time_min ?? 0) + (r.cook_time_min ?? 0) > 0
                            ? `${(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)} Min`
                            : null,
                          r.rating ? '⭐'.repeat(r.rating) : null,
                        ]
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
