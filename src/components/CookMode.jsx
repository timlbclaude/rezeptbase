import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/* Kochmodus: Vollbild, Schritt für Schritt, Display bleibt an (Wake Lock). */
export default function CookMode({ recipe, ingredients, formatAmount, onClose }) {
  const steps = recipe.steps ?? []
  const [idx, setIdx] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const wakeLockRef = useRef(null)

  // Wake Lock anfordern und bei Sichtbarkeitswechsel erneuern
  useEffect(() => {
    let released = false
    async function requestLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch { /* z.B. Energiesparmodus – Kochmodus funktioniert trotzdem */ }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible' && !released) requestLock()
    }
    requestLock()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release?.().catch(() => {})
    }
  }, [])

  // Scroll der Seite dahinter sperren
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const step = steps[idx]
  const done = idx >= steps.length

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col animate-rise">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 p-2 -ml-2 rounded-full active:bg-ink-100"
        >
          <Icon name="x" size={18} />
          Beenden
        </button>
        <span className="text-sm font-semibold text-ink-500">
          {done ? 'Fertig' : `Schritt ${idx + 1} von ${steps.length}`}
        </span>
        <button
          onClick={() => setShowIngredients(!showIngredients)}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold p-2 -mr-2 rounded-full active:bg-ink-100 ${
            showIngredients ? 'text-brand-700' : 'text-ink-500'
          }`}
        >
          <Icon name="utensils" size={16} />
          Zutaten
        </button>
      </div>

      {/* Fortschritt */}
      <div className="px-4">
        <div className="h-1.5 rounded-full bg-ink-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${(Math.min(idx + (done ? 0 : 1), steps.length) / Math.max(steps.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Inhalt */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {showIngredients ? (
          <div className="mx-auto max-w-lg">
            <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">Zutaten</h2>
            <ul className="space-y-2.5">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex gap-2 text-lg text-ink-700">
                  <span className="font-semibold text-ink-900 whitespace-nowrap">
                    {formatAmount(ing)} {ing.unit ?? ''}
                  </span>
                  <span>{ing.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : done ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="grid place-content-center w-20 h-20 rounded-full bg-brand-100 text-brand-700 mb-6">
              <Icon name="checkCircle" size={40} strokeWidth={1.6} />
            </div>
            <h2 className="font-display text-3xl font-semibold text-ink-900 mb-2">Guten Appetit!</h2>
            <p className="text-ink-500">
              Alle {steps.length} Schritte geschafft. Lass es dir schmecken.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-lg">
            <div className="grid place-content-center w-12 h-12 rounded-2xl bg-brand-700 text-paper font-display text-xl font-semibold mb-6">
              {step?.nr ?? idx + 1}
            </div>
            <p className="text-2xl leading-relaxed text-ink-900">{step?.text}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      {!showIngredients && (
        <div className="px-4 pb-6 pt-2 flex gap-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-ink-200 bg-card py-4 font-semibold text-ink-700 disabled:opacity-40 active:bg-ink-100"
          >
            <Icon name="chevronLeft" size={20} />
            Zurück
          </button>
          {done ? (
            <button
              onClick={onClose}
              className="flex-[2] rounded-2xl bg-brand-700 py-4 font-semibold text-paper shadow-card active:bg-brand-800"
            >
              Kochmodus beenden
            </button>
          ) : (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-700 py-4 font-semibold text-paper shadow-card active:bg-brand-800"
            >
              {idx === steps.length - 1 ? 'Fertig' : 'Weiter'}
              <Icon name="chevronRight" size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
