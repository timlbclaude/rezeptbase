import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { getTheme } from '../lib/theme.js'
import { buildHaystack, matchesQuery } from '../lib/search.js'
import { parseHash as parseHashPure, buildListHash } from '../lib/route.js'
import { runWrite } from '../lib/mutate.js'
import { notify } from '../lib/notify.js'
import { READ_ONLY_MSG } from '../lib/roles.js'
import ImportPage from './ImportPage.jsx'
import RecipeDetail from './RecipeDetail.jsx'
import ShoppingList from './ShoppingList.jsx'
import Icon from '../components/Icon.jsx'
import { RecipeRow, GridCard, SectionLabel, RowSkeleton } from '../components/RecipeCards.jsx'
import TabBar from '../components/TabBar.jsx'
import FilterSheet from '../components/FilterSheet.jsx'
import ProfileSheet from '../components/ProfileSheet.jsx'

const CHIPS = [
  { key: 'alle', label: 'Alle' },
  { key: 'zum_ausprobieren', label: 'Ausprobieren' },
  { key: 'gekocht', label: 'Gekocht' },
]

// Hash-Routing: reine Funktionen liegen in lib/route.js (dort auch getestet)
const parseHash = () => parseHashPure(window.location.hash)

export default function Recipes({ session, readOnly = false }) {
  // Startzustand aus der URL (Deep Link), z. B. #/rezept/<id>
  const initial = parseHash()
  const [tab, setTab] = useState(initial.tab ?? 'rezepte')
  const [screen, setScreen] = useState(initial.screen ?? null) // null | {name:'detail',id} | {name:'import'}
  const [profileOpen, setProfileOpen] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(initial.list?.q ?? '')
  const [filter, setFilter] = useState(initial.list?.filter ?? 'alle')
  const [onlyFavs, setOnlyFavs] = useState(initial.list?.fav ?? false)
  const [sortBy, setSortBy] = useState(initial.list?.sort ?? 'neueste')
  const [catFilter, setCatFilter] = useState(initial.list?.cat ?? null)
  const [collFilter, setCollFilter] = useState(initial.list?.collection ?? null)
  const [collections, setCollections] = useState([])
  const [collLinks, setCollLinks] = useState([]) // {recipe_id, collection_id}
  const [confirmDeleteColl, setConfirmDeleteColl] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [theme, setTheme] = useState(getTheme)

  // Zustand → URL. Screen-Wechsel erzeugen History-Einträge (Browser-Zurück
  // führt zur Liste zurück), Such-/Filteränderungen ersetzen nur die URL.
  useEffect(() => {
    const target = screen?.name === 'detail'
      ? `#/rezept/${screen.id}`
      : screen?.name === 'import'
        ? '#/import'
        : tab === 'einkauf'
          ? '#/einkauf'
          : buildListHash(q, filter, catFilter, sortBy, onlyFavs, collFilter)
    if (window.location.hash === target) return
    const isScreenChange = target.startsWith('#/rezept/') || target === '#/import' || target === '#/einkauf'
      || window.location.hash.startsWith('#/rezept/') || window.location.hash === '#/import' || window.location.hash === '#/einkauf'
    if (isScreenChange) window.history.pushState(null, '', target)
    else window.history.replaceState(null, '', target)
  }, [screen, tab, q, filter, catFilter, sortBy, onlyFavs, collFilter])

  // Browser-Zurück/Vorwärts → Zustand aus der URL übernehmen
  useEffect(() => {
    function onPop() {
      const p = parseHash()
      setScreen(p.screen ?? null)
      setTab(p.tab ?? 'rezepte')
      if (p.list) {
        setQ(p.list.q)
        setFilter(p.list.filter)
        setCatFilter(p.list.cat)
        setSortBy(p.list.sort)
        setOnlyFavs(p.list.fav)
        setCollFilter(p.list.collection)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const loadRecipes = useCallback(() => {
    supabase
      .from('recipes')
      .select('id, title, category, cuisine, description, keywords, image_url, prep_time_min, cook_time_min, is_favorite, rating, status, created_at, last_cooked_at, ingredients(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecipes(data ?? [])
        setLoading(false)
      })
    // Sammlungen + Zuordnungen (für den Sammlungs-Filter)
    supabase.from('collections').select('id, name').order('name')
      .then(({ data }) => setCollections(data ?? []))
    supabase.from('recipe_collections').select('recipe_id, collection_id')
      .then(({ data }) => setCollLinks(data ?? []))
  }, [])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const filtered = useMemo(() => {
    let list = recipes
    if (filter !== 'alle') list = list.filter((r) => (r.status ?? 'zum_ausprobieren') === filter)
    if (onlyFavs) list = list.filter((r) => r.is_favorite)
    if (catFilter) list = list.filter((r) => r.category === catFilter)
    if (collFilter) {
      const inColl = new Set(collLinks.filter((l) => l.collection_id === collFilter).map((l) => l.recipe_id))
      list = list.filter((r) => inColl.has(r.id))
    }
    const query = q.trim()
    if (query) {
      list = list.filter((r) => matchesQuery(r.__hay ?? (r.__hay = buildHaystack(r)), query))
    }
    if (sortBy !== 'neueste') {
      list = [...list]
      if (sortBy === 'bewertung') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      if (sortBy === 'gekocht') list.sort((a, b) => (b.last_cooked_at ?? '').localeCompare(a.last_cooked_at ?? ''))
      if (sortBy === 'titel') list.sort((a, b) => a.title.localeCompare(b.title, 'de'))
    }
    return list
  }, [recipes, filter, onlyFavs, catFilter, sortBy, q, collFilter, collLinks])

  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category).filter(Boolean))],
    [recipes],
  )
  const filterCount = (catFilter !== null ? 1 : 0) + (sortBy !== 'neueste' ? 1 : 0) + (collFilter ? 1 : 0)
  const filterActive = filterCount > 0

  const tryList = useMemo(
    () => recipes.filter((r) => (r.status ?? 'zum_ausprobieren') === 'zum_ausprobieren'),
    [recipes],
  )

  // Screens, die aus der App heraus geöffnet wurden, schließen wir über die
  // Browser-History (echtes Zurück). Direkt geöffnete Deep Links nicht –
  // sonst würde der Nutzer aus der App fallen.
  const openedInApp = useRef(false)
  const openScreen = (s) => {
    openedInApp.current = true
    setScreen(s)
  }
  const backToList = () => {
    loadRecipes()
    if (openedInApp.current) {
      openedInApp.current = false
      window.history.back()
    } else {
      setScreen(null)
    }
  }

  const isDefaultView = filter === 'alle' && !q.trim() && !onlyFavs && !filterActive

  function resetAllFilters() {
    setQ('')
    setFilter('alle')
    setOnlyFavs(false)
    setCatFilter(null)
    setCollFilter(null)
    setSortBy('neueste')
  }

  async function deleteCollection(id) {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
    const { ok } = await runWrite(supabase.from('collections').delete().eq('id', id))
    if (ok) {
      setCollections((cs) => cs.filter((c) => c.id !== id))
      setCollLinks((ls) => ls.filter((l) => l.collection_id !== id))
      if (collFilter === id) setCollFilter(null)
    }
    setConfirmDeleteColl(false)
  }

  // ---- Push-Screens (ohne Tab-Bar) ----
  if (screen?.name === 'import') {
    return (
      <ImportPage
        readOnly={readOnly}
        onCancel={backToList}
        onDone={(id) => {
          loadRecipes()
          setScreen({ name: 'detail', id })
        }}
      />
    )
  }
  if (screen?.name === 'detail') {
    return <RecipeDetail recipeId={screen.id} readOnly={readOnly} onBack={backToList} onDeleted={backToList} />
  }

  return (
    <div className="min-h-svh pb-32">
      {tab === 'einkauf' ? (
        <ShoppingList readOnly={readOnly} />
      ) : (
        <main className="mx-auto max-w-2xl px-4 pt-5 animate-rise">
          {/* Kopf */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[34px] font-bold text-ink" style={{ letterSpacing: '0.3px' }}>Rezepte</h1>
            <button
              onClick={() => setProfileOpen(true)}
              className="grid place-content-center w-[44px] h-[44px] rounded-full bg-fill text-tint active:scale-95 transition"
              aria-label="Profil"
            >
              <Icon name="user" size={17} strokeWidth={2} />
            </button>
          </div>

          {/* Suchfeld + Filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
                <Icon name="search" size={16} strokeWidth={2} />
              </span>
              <input
                type="search"
                placeholder="Titel oder Zutat suchen"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-[12px] bg-fill pl-9 pr-3 text-[16px] text-ink-2 outline-none placeholder:text-ink-3"
                style={{ padding: '9px 12px 9px 36px' }}
              />
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className={`relative shrink-0 grid place-content-center w-[44px] rounded-[12px] transition ${
                filterActive ? 'bg-tint text-white' : 'bg-fill text-ink-2'
              }`}
              aria-label={filterCount > 0 ? `Filter und Sortierung, ${filterCount} aktiv` : 'Filter und Sortierung'}
            >
              <Icon name="sliders" size={17} strokeWidth={2} />
              {filterCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 grid place-content-center rounded-full bg-love text-white text-[10.5px] font-bold"
                  style={{ width: 18, height: 18, boxShadow: '0 0 0 2px var(--color-bg)' }}
                  aria-hidden="true"
                >
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter-Chips */}
          <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar -mx-4 px-4">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                aria-pressed={filter === c.key}
                className={`shrink-0 rounded-full text-[14px] transition ${
                  filter === c.key ? 'bg-tint text-white font-semibold' : 'bg-card text-ink-2 font-medium shadow-card'
                }`}
                style={{ padding: '7px 15px', minHeight: 36 }}
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={() => setOnlyFavs(!onlyFavs)}
              aria-pressed={onlyFavs}
              className={`shrink-0 rounded-full transition grid place-content-center ${
                onlyFavs ? 'bg-tint text-white' : 'bg-card text-love shadow-card'
              }`}
              style={{ padding: '7px 13px', minHeight: 36 }}
              aria-label="Nur Favoriten"
            >
              <Icon name="heart" size={15} filled={onlyFavs} strokeWidth={2} />
            </button>
          </div>

          {/* Ergebnisanzahl für Screenreader (Live-Region) */}
          <p className="sr-only" aria-live="polite" role="status">
            {loading ? 'Rezepte werden geladen' : `${filtered.length} ${filtered.length === 1 ? 'Rezept' : 'Rezepte'} angezeigt`}
          </p>

          {loading ? (
            <div className="bg-card rounded-[16px] shadow-card overflow-hidden">
              <RowSkeleton /><RowSkeleton /><RowSkeleton /><RowSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            /* Drei unterscheidbare Leerzustände: keine Rezepte / Suche leer / Filter leer */
            <div className="text-center py-14">
              <div className="inline-grid place-content-center w-14 h-14 rounded-[18px] bg-fill text-ink-3 mb-4">
                <Icon name={recipes.length === 0 ? 'chefHat' : q.trim() ? 'search' : 'sliders'} size={26} strokeWidth={1.6} />
              </div>
              <h2 className="text-[16px] font-semibold text-ink mb-1">
                {recipes.length === 0
                  ? 'Noch keine Rezepte'
                  : q.trim()
                    ? `Nichts zu „${q.trim()}“ gefunden`
                    : 'Keine Treffer mit diesen Filtern'}
              </h2>
              <p className="text-[13.5px] text-ink-3 max-w-xs mx-auto">
                {recipes.length === 0
                  ? 'Importiere dein erstes Rezept über den Import-Tab – einfach einen Link einfügen.'
                  : q.trim()
                    ? 'Versuch einen anderen Begriff – die Suche kennt auch Oberbegriffe wie „Pasta“ oder „Dessert“.'
                    : 'Die aktive Filter-Kombination passt auf kein Rezept.'}
              </p>
              {recipes.length > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="mt-4 rounded-full bg-tint px-5 py-2.5 text-[14px] font-semibold text-white active:bg-tint-dark transition"
                >
                  {q.trim() ? 'Suche und Filter zurücksetzen' : 'Filter zurücksetzen'}
                </button>
              )}
            </div>
          ) : isDefaultView ? (
            <>
              {tryList.length > 0 && (
                <>
                  <SectionLabel>Zum Ausprobieren · {tryList.length}</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {tryList.map((r) => (
                      <GridCard key={r.id} r={r} onOpen={() => openScreen({ name: 'detail', id: r.id })} />
                    ))}
                  </div>
                </>
              )}
              <SectionLabel>Alle Rezepte</SectionLabel>
              <div className="bg-card rounded-[16px] shadow-card overflow-hidden text-ink-4">
                {recipes.map((r, i) => (
                  <RecipeRow key={r.id} r={r} last={i === recipes.length - 1} onOpen={() => openScreen({ name: 'detail', id: r.id })} />
                ))}
              </div>
            </>
          ) : (
            <>
              <SectionLabel>Ergebnisse · {filtered.length}</SectionLabel>
              <div className="bg-card rounded-[16px] shadow-card overflow-hidden text-ink-4">
                {filtered.map((r, i) => (
                  <RecipeRow key={r.id} r={r} last={i === filtered.length - 1} onOpen={() => openScreen({ name: 'detail', id: r.id })} />
                ))}
              </div>
            </>
          )}

          <p className="text-center text-[12px] text-ink-4 mt-10">Angemeldet als {session.user.email}</p>
        </main>
      )}

      <TabBar
        tab={tab}
        onTab={(t) => {
          if (t === 'import') openScreen({ name: 'import' })
          else setTab(t)
        }}
      />

      {/* Filter-Sheet */}
      {filterOpen && (
        <FilterSheet
          categories={categories}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          collections={collections}
          collLinks={collLinks}
          collFilter={collFilter}
          setCollFilter={setCollFilter}
          confirmDeleteColl={confirmDeleteColl}
          setConfirmDeleteColl={setConfirmDeleteColl}
          onDeleteCollection={deleteCollection}
          readOnly={readOnly}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {/* Profil-Sheet */}
      {profileOpen && (
        <ProfileSheet
          session={session}
          readOnly={readOnly}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  )
}
