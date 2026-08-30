// Darstellungs-Bausteine der Rezeptliste: Zeile, Kachel, Abschnitts-Label,
// Lade-Skeleton. Reine Präsentation ohne eigenen Zustand.
import { onImgError } from '../lib/imageFallback.js'
import Icon from './Icon.jsx'

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

// Im Auswahlmodus (selectable) zeigt die Zeile links einen Kreis-Haken und
// der Klick wählt aus statt zu öffnen (onOpen bekommt dann die Toggle-Funktion).
export function RecipeRow({ r, onOpen, last, selectable = false, selected = false }) {
  return (
    <button
      onClick={onOpen}
      aria-pressed={selectable ? selected : undefined}
      className="relative w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03] transition"
    >
      {selectable && (
        <input type="checkbox" className="checkbox-circle pointer-events-none" checked={selected} readOnly tabIndex={-1} />
      )}
      <Thumb src={r.image_url} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] font-semibold text-ink truncate">{r.title}</span>
        <span className="block text-[12.5px] text-ink-3 mt-0.5 truncate">{metaLine(r)}</span>
      </span>
      {!selectable && (
        <span className="shrink-0" style={{ color: 'var(--color-ink-4)' }}>
          <Icon name="chevronRight" size={17} strokeWidth={2.2} />
        </span>
      )}
      {!last && (
        <span
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ left: 73, height: 0.5, background: 'var(--color-separator)' }}
        />
      )}
    </button>
  )
}

export function GridCard({ r, onOpen }) {
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
      {/* Titel reserviert immer zwei Zeilen – alle Karten gleich hoch */}
      <p className="text-[15px] font-semibold text-ink leading-snug line-clamp-2 px-2 pt-2" style={{ minHeight: 'calc(2.75em + 8px)' }}>{r.title}</p>
      <p className="text-[12.5px] text-ink-3 px-2 pt-0.5">
        {[(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0) > 0 ? `${(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)} Min` : null, r.category].filter(Boolean).join(' · ')}
      </p>
    </button>
  )
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[13px] font-semibold uppercase text-ink-3 mb-2 mt-6 first:mt-0" style={{ letterSpacing: '0.03em' }}>
      {children}
    </p>
  )
}

export function RowSkeleton() {
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
