import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { applyTheme, getTheme } from '../lib/theme.js'
import { buildHaystack, matchesQuery } from '../lib/search.js'
import { onImgError } from '../lib/imageFallback.js'
import { parseHash as parseHashPure, buildListHash } from '../lib/route.js'
import { runWrite } from '../lib/mutate.js'
import { notify } from '../lib/notify.js'
import { READ_ONLY_MSG } from '../lib/roles.js'
import ImportPage from './ImportPage.jsx'
import RecipeDetail from './RecipeDetail.jsx'
import ShoppingList from './ShoppingList.jsx'
import Icon from '../components/Icon.jsx'

const CHIPS = [
  { key: 'alle', label: 'Alle' },
  { key: 'zum_ausprobieren', label: 'Ausprobieren' },
  { key: 'gekocht', label: 'Gekocht' },
]

// Hash-Routing: reine Funktionen liegen in lib/route.js (dort auch getestet)
const parseHash = () => parseHashPure(window.location.hash)

const SORTS = [
  { key: 'neueste', label: 'Neueste zuerst' },
  { key: 'bewertung', label: 'Beste Bewertung' },
  { key: 'gekocht', label: 'Zuletzt gekocht' },
  { key: 'titel', label: 'Titel A–Z' },
]

function metaLine(r) {
  const time = (r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)
  const cooked = (r.status ?? 'zum_ausprobieren') === 'gekocht'
  return [
    time > 0 ? `${time} Min` : null,
    r.rating ? `★ ${r.rating},0` : null,
    cooked ? 'Gekocht' : r.category,
  ].filter(Boolean).join(' · ')
}

function Thumb({ src, size = 52, radius = 10 }) {
  return src ? (
    <img src={src} alt="" loading="lazy" onError={onImgError} className="object-cover shrink-0" style={{ width: size, height: size, borderRadius: radius }} />
  ) : (
    <span className="grid place-content-center bg-fill text-ink-3 shrink-0" style={{ width: size, height: size, borderRadius: radius }}>
      <Icon name="utensils" size={size * 0.42} strokeWidth={1.8} />
    </span>
  )
}

function RecipeRow({ r, onOpen, last }) {
  return (
    <button
      onClick={onOpen}
      className="relative w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03] transition"
    >
      <Thumb src={r.image_url} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] font-semibold text-ink truncate">{r.title}</span>
        <span className="block text-[12.5px] text-ink-3 mt-0.5 truncate">{metaLine(r)}</span>
      </span>
      <span className="shrink-0" style={{ color: 'var(--color-ink-4)' }}>
        <Icon name="chevronRight" size={17} strokeWidth={2.2} />
      </span>
      {!last && (
        <span
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ left: 73, height: 0.5, background: 'var(--color-separator)' }}
        />
      )}
    </button>
  )
}

function GridCard({ r, onOpen }) {
  return (
    <button onClick={onOpen} className="text-left bg-card rounded-[18px] shadow-card p-1.5 pb-3 active:scale-[0.98] transition">
      <div className="relative">
        {r.image_url ? (
          <img src={r.image_url} alt="" loading="lazy" onError={onImgError} className="w-full object-cover rounded-[13px]" style={{ height: 106 }} />
        ) : (
          <div className="w-full grid place-content-center bg-fill text-ink-3 rounded-[13px]" style={{ height: 106 }}>
            <Icon name="utensils" size={26} strokeWidth={1.6} />
          </div>
        )}
        {r.is_favorite && (
          <span className="absolute top-1.5 right-1.5 grid place-content-center w-6 h-6 rounded-full text-love" style={{ background: 'var(--color-overlay-btn)' }}>
            <Icon name="heart" size={13} filled />
          </span>
        )}
      </div>
      <p className="text-[15px] font-semibold text-ink leading-snug line-clamp-2 px-2 pt-2">{r.title}</p>
      <p className="text-[12.5px] text-ink-3 px-2 pt-0.5">
        {[(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0) > 0 ? `${(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)} Min` : null, r.category].filter(Boolean).join(' · ')}
      </p>
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[13px] font-semibold uppercase text-ink-3 mb-2 mt-6 first:mt-0" style={{ letterSpacing: '0.03em' }}>
      {children}
    </p>
  )
}

function TabBar({ tab, onTab }) {
  const items = [
    { key: 'rezepte', label: 'Rezepte', icon: 'book' },
    { key: 'import', label: 'Import', icon: 'plusCircle' },
    { key: 'einkauf', label: 'Einkauf', icon: 'bag' },
  ]
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed bottom-0 inset-x-0 z-20 flex justify-center gap-10"
      style={{
        background: 'var(--color-bar)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'inset 0 0.5px 0 var(--color-separator)',
        padding: '9px 40px max(24px, env(safe-area-inset-bottom))',
      }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onTab(it.key)}
          aria-current={tab === it.key ? 'page' : undefined}
          className="flex flex-col items-center gap-0.5 min-w-16"
          style={{ color: tab === it.key ? 'var(--color-tint)' : 'var(--color-ink-3)', minHeight: 44 }}
        >
          <Icon name={it.icon} size={24} strokeWidth={tab === it.key ? 2 : 1.8} />
          <span className="text-[10px] font-semibold">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="skeleton rounded-[10px]" style={{ width: 52, height: 52 }} />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}

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
        <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} style={{ background: 'rgb(0 0 0 / 0.25)' }}>
          <div
            className="absolute bottom-0 inset-x-0 bg-card rounded-t-[22px] animate-sheet px-5 pt-3"
            style={{ boxShadow: 'var(--shadow-sheet)', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto rounded-full" style={{ width: 38, height: 4, background: 'var(--color-handle)' }} />
            <h3 className="text-[17px] font-bold text-ink mt-4 mb-3">Filter & Sortierung</h3>

            <p className="text-[12px] font-semibold uppercase text-ink-3 mb-2" style={{ letterSpacing: '0.03em' }}>Kategorie</p>
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setCatFilter(null)}
                aria-pressed={catFilter === null}
                className={`rounded-full text-[13.5px] transition ${
                  catFilter === null ? 'bg-tint text-white font-semibold' : 'bg-fill text-ink-2 font-medium'
                }`}
                style={{ padding: '6px 13px', minHeight: 34 }}
              >
                Alle
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(catFilter === c ? null : c)}
                  aria-pressed={catFilter === c}
                  className={`rounded-full text-[13.5px] transition ${
                    catFilter === c ? 'bg-tint text-white font-semibold' : 'bg-fill text-ink-2 font-medium'
                  }`}
                  style={{ padding: '6px 13px', minHeight: 34 }}
                >
                  {c}
                </button>
              ))}
            </div>

            {collections.length > 0 && (
              <>
                <p className="text-[12px] font-semibold uppercase text-ink-3 mb-2" style={{ letterSpacing: '0.03em' }}>Sammlungen</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCollFilter(collFilter === c.id ? null : c.id); setConfirmDeleteColl(false) }}
                      aria-pressed={collFilter === c.id}
                      className={`rounded-full text-[13.5px] transition ${
                        collFilter === c.id ? 'bg-tint text-white font-semibold' : 'bg-fill text-ink-2 font-medium'
                      }`}
                      style={{ padding: '6px 13px', minHeight: 34 }}
                    >
                      {c.name} · {collLinks.filter((l) => l.collection_id === c.id).length}
                    </button>
                  ))}
                </div>
                <div className="mb-5" style={{ minHeight: 20 }}>
                  {collFilter && !readOnly && (
                    confirmDeleteColl ? (
                      <span className="text-[13px] text-ink-2">
                        Sammlung „{collections.find((c) => c.id === collFilter)?.name}“ löschen? (Rezepte bleiben erhalten){' '}
                        <button onClick={() => deleteCollection(collFilter)} className="font-semibold text-love">Ja</button>{' '}
                        <button onClick={() => setConfirmDeleteColl(false)} className="text-ink-3">Nein</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteColl(true)} className="text-[13px] text-ink-3">
                        Ausgewählte Sammlung löschen …
                      </button>
                    )
                  )}
                </div>
              </>
            )}

            <p className="text-[12px] font-semibold uppercase text-ink-3 mb-1" style={{ letterSpacing: '0.03em' }}>Sortierung</p>
            <div className="mb-5">
              {SORTS.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  aria-pressed={sortBy === s.key}
                  className="relative w-full flex items-center justify-between py-3 text-left"
                >
                  <span className={`text-[15.5px] ${sortBy === s.key ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    {s.label}
                  </span>
                  {sortBy === s.key && (
                    <span className="text-tint"><Icon name="check" size={17} strokeWidth={2.4} /></span>
                  )}
                  {i < SORTS.length - 1 && (
                    <span className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setCatFilter(null); setSortBy('neueste'); setCollFilter(null); setConfirmDeleteColl(false) }}
                className="flex-1 h-[48px] rounded-[14px] bg-fill text-[15.5px] font-semibold text-ink-2 active:opacity-80 transition"
              >
                Zurücksetzen
              </button>
              <button
                onClick={() => setFilterOpen(false)}
                className="flex-1 h-[48px] rounded-[14px] bg-tint text-white text-[15.5px] font-semibold active:bg-tint-dark transition"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profil-Sheet */}
      {profileOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} style={{ background: 'rgb(0 0 0 / 0.25)' }}>
          <div
            className="absolute bottom-0 inset-x-0 bg-card rounded-t-[22px] animate-sheet px-5 pt-3"
            style={{ boxShadow: 'var(--shadow-sheet)', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto rounded-full" style={{ width: 38, height: 4, background: 'var(--color-handle)' }} />
            <div className="flex items-center gap-3 mt-5 mb-6">
              <span className="grid place-content-center w-11 h-11 rounded-full bg-tint-soft text-tint">
                <Icon name="user" size={20} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[15.5px] font-semibold text-ink">Angemeldet</p>
                <p className="text-[13.5px] text-ink-3">{session.user.email}</p>
              </div>
            </div>

            {readOnly && (
              <div className="mb-5 rounded-[12px] bg-fill px-4 py-3 text-[13.5px] text-ink-2">
                Dieses Konto besitzt <strong>nur Leserechte</strong> – du kannst alles ansehen,
                aber nichts speichern oder ändern.
              </div>
            )}

            {/* Darstellung: System / Hell / Dunkel */}
            <p className="text-[12px] font-semibold uppercase text-ink-3 mb-2" style={{ letterSpacing: '0.03em' }}>
              Darstellung
            </p>
            <div className="flex bg-fill rounded-[10px] p-0.5 mb-6">
              {[
                { key: 'system', label: 'System' },
                { key: 'light', label: 'Hell' },
                { key: 'dark', label: 'Dunkel' },
              ].map((o) => (
                <button
                  key={o.key}
                  onClick={() => { applyTheme(o.key); setTheme(o.key) }}
                  className={`flex-1 rounded-[8px] py-1.5 text-[13.5px] font-semibold transition ${
                    theme === o.key ? 'bg-card text-ink' : 'text-ink-2'
                  }`}
                  style={theme === o.key ? { boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' } : {}}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full h-[50px] rounded-[14px] bg-fill text-[16px] font-semibold text-love active:opacity-80 transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
