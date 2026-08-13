import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import ImportPage from './ImportPage.jsx'
import RecipeDetail from './RecipeDetail.jsx'
import ShoppingList from './ShoppingList.jsx'
import Icon from '../components/Icon.jsx'
import { Logo } from '../App.jsx'

const TABS = [
  { key: 'alle', label: 'Alle', icon: null },
  { key: 'zum_ausprobieren', label: 'Zum Ausprobieren', icon: 'sprout' },
  { key: 'gekocht', label: 'Gekocht', icon: 'checkCircle' },
]

function StatusChip({ status }) {
  const cooked = status === 'gekocht'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold backdrop-blur-sm ${
        cooked ? 'bg-brand-700/90 text-paper' : 'bg-card/90 text-try-700'
      }`}
    >
      <Icon name={cooked ? 'checkCircle' : 'sprout'} size={12} strokeWidth={2.4} />
      {cooked ? 'Gekocht' : 'Ausprobieren'}
    </span>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-3xl bg-card border border-ink-100 overflow-hidden shadow-card">
      <div className="h-32 skeleton" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 w-4/5 rounded skeleton" />
        <div className="h-3 w-3/5 rounded skeleton" />
      </div>
    </div>
  )
}

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

  const tryCount = recipes.filter((r) => (r.status ?? 'zum_ausprobieren') === 'zum_ausprobieren').length

  return (
    <div className="min-h-svh pb-28">
      <header className="sticky top-0 z-10 bg-paper/85 backdrop-blur-md border-b border-ink-100">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={backToList} className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="font-display text-xl font-semibold text-ink-900 tracking-tight">Rezeptbase</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView({ name: 'shopping' })}
              className="p-2.5 rounded-full text-ink-700 active:bg-ink-100 transition"
              aria-label="Einkaufsliste"
            >
              <Icon name="cart" size={21} />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2.5 rounded-full text-ink-400 active:bg-ink-100 transition"
              aria-label="Abmelden"
            >
              <Icon name="logOut" size={20} />
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
        <main className="mx-auto max-w-2xl px-4 py-5 animate-rise">
          <div className="mb-5">
            <h1 className="font-display text-3xl font-semibold text-ink-900 tracking-tight">
              Deine Rezepte
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              {recipes.length} {recipes.length === 1 ? 'Rezept' : 'Rezepte'}
              {tryCount > 0 && ` · ${tryCount} zum Ausprobieren`}
            </p>
          </div>

          {/* Status-Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold border transition ${
                  tab === t.key
                    ? 'bg-brand-700 text-paper border-brand-700 shadow-card'
                    : 'bg-card text-ink-700 border-ink-200'
                }`}
              >
                {t.icon && <Icon name={t.icon} size={15} strokeWidth={2.2} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* Suche */}
          <div className="relative mb-3">
            <Icon
              name="search"
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Suche nach Titel oder Zutat …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-2xl border border-ink-200 bg-card pl-11 pr-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-5 flex-wrap items-center">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-ink-200 bg-card px-3 py-2 text-sm outline-none text-ink-700"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-ink-200 bg-card px-3 py-2 text-sm outline-none text-ink-700"
            >
              <option value="neu">Neueste zuerst</option>
              <option value="az">A–Z</option>
              <option value="bewertung">Beste Bewertung</option>
            </select>
            <button
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`inline-flex items-center justify-center rounded-xl border p-2 transition ${
                onlyFavs
                  ? 'border-accent-300 bg-accent-50 text-accent-500'
                  : 'border-ink-200 bg-card text-ink-400'
              }`}
              aria-label="Nur Favoriten"
            >
              <Icon name="heart" size={18} filled={onlyFavs} />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-grid place-content-center w-16 h-16 rounded-3xl bg-ink-100 text-ink-400 mb-4">
                <Icon name={recipes.length === 0 ? 'chefHat' : 'search'} size={28} strokeWidth={1.5} />
              </div>
              <h2 className="font-display text-lg font-semibold text-ink-900 mb-1">
                {recipes.length === 0 ? 'Noch keine Rezepte' : 'Nichts gefunden'}
              </h2>
              <p className="text-ink-500 text-sm max-w-xs mx-auto">
                {recipes.length === 0
                  ? 'Importiere dein erstes Rezept – einfach einen YouTube-Link oder eine Kochseite einfügen.'
                  : 'Kein Rezept passt zu Suche oder Filter. Setze die Filter zurück oder importiere etwas Neues.'}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4">
              {filtered.map((r) => {
                const time = (r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setView({ name: 'detail', id: r.id })}
                      className="group w-full text-left rounded-3xl bg-card border border-ink-100 overflow-hidden shadow-card transition active:scale-[0.98]"
                    >
                      <div className="relative">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt=""
                            loading="lazy"
                            className="h-32 w-full object-cover transition duration-500 group-active:scale-105"
                          />
                        ) : (
                          <div className="h-32 w-full bg-gradient-to-br from-ink-100 to-ink-200 grid place-content-center text-ink-400">
                            <Icon name="utensils" size={28} strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink-900/30 to-transparent" />
                        <span className="absolute top-2 left-2">
                          <StatusChip status={r.status ?? 'zum_ausprobieren'} />
                        </span>
                        {r.is_favorite && (
                          <span className="absolute top-2 right-2 grid place-content-center w-7 h-7 rounded-full bg-card/90 text-accent-500 backdrop-blur-sm">
                            <Icon name="heart" size={14} filled />
                          </span>
                        )}
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-[15px] leading-snug text-ink-900 line-clamp-2">
                          {r.title}
                        </p>
                        <div className="flex items-center gap-2.5 text-xs text-ink-500 mt-1.5">
                          {r.category && <span>{r.category}</span>}
                          {time > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="clock" size={12} strokeWidth={2.2} />
                              {time} Min
                            </span>
                          )}
                          {r.rating && (
                            <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                              <Icon name="star" size={12} filled />
                              {r.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="text-center text-xs text-ink-400 mt-12">Angemeldet als {session.user.email}</p>
        </main>
      )}

      {view.name === 'list' && (
        <button
          onClick={() => setView({ name: 'import' })}
          className="fixed bottom-6 right-1/2 translate-x-1/2 sm:right-8 sm:translate-x-0 inline-flex items-center gap-2 rounded-full bg-brand-700 text-paper font-semibold pl-5 pr-6 py-3.5 shadow-float transition active:scale-[0.97] active:bg-brand-800"
        >
          <Icon name="plus" size={20} strokeWidth={2.4} />
          Rezept importieren
        </button>
      )}
    </div>
  )
}
