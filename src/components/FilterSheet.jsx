// Filter- & Sortier-Sheet der Rezeptliste. Zustand liegt in Recipes.jsx;
// hier nur Darstellung + Callbacks. Wrapper bewusst identisch zum
// bisherigen Markup (kein Sheet.jsx: dieses Sheet hat kein maxHeight/flex-col).
import Icon from './Icon.jsx'

const SORTS = [
  { key: 'neueste', label: 'Neueste zuerst' },
  { key: 'bewertung', label: 'Beste Bewertung' },
  { key: 'gekocht', label: 'Zuletzt gekocht' },
  { key: 'titel', label: 'Titel A–Z' },
]

export default function FilterSheet({
  categories,
  catFilter,
  setCatFilter,
  collections,
  collLinks,
  collFilter,
  setCollFilter,
  confirmDeleteColl,
  setConfirmDeleteColl,
  onDeleteCollection,
  readOnly,
  sortBy,
  setSortBy,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-30" onClick={onClose} style={{ background: 'rgb(0 0 0 / 0.25)' }}>
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
                    <button onClick={() => onDeleteCollection(collFilter)} className="font-semibold text-love">Ja</button>{' '}
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
            onClick={onClose}
            className="flex-1 h-[48px] rounded-[14px] bg-tint text-white text-[15.5px] font-semibold active:bg-tint-dark transition"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  )
}
