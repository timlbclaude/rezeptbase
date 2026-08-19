import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { stepIngredients } from '../lib/stepMatch.js'
import Icon from './Icon.jsx'

/* Kochmodus „2a Nativ": Vollbild weiß, Schritt für Schritt,
   mehrere benannte Timer (laufen über Schrittwechsel hinweg weiter),
   Zutaten-Bottom-Sheet, Wake Lock. */

// Dauer eines Schritts: explizites timer_min-Feld, sonst aus dem Text erkannt.
function stepDurationSec(step) {
  if (!step) return null
  if (typeof step.timer_min === 'number' && step.timer_min > 0) return Math.round(step.timer_min * 60)
  const m = /(\d+)(?:\s*[–\-bis]{1,5}\s*(\d+))?\s*(sekunden|minuten|stunden|sek\.?|min\.?|std\.?|min\b)/i.exec(step.text ?? '')
  if (!m) return null
  const value = Number(m[2] ?? m[1])
  const unit = m[3].toLowerCase()
  if (unit.startsWith('sek')) return value
  if (unit.startsWith('std') || unit.startsWith('stunden')) return value * 3600
  return value * 60
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDuration(sec) {
  if (sec % 3600 === 0) return `${sec / 3600} ${sec === 3600 ? 'Stunde' : 'Stunden'}`
  if (sec % 60 === 0) return `${sec / 60} ${sec === 60 ? 'Minute' : 'Minuten'}`
  return `${sec} Sekunden`
}

function beep() {
  try {
    if (navigator.vibrate) navigator.vibrate([250, 120, 250])
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880
      g.gain.setValueAtTime(0.001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.32)
    }
    play(0); play(0.45)
  } catch { /* Ton optional */ }
}

export default function CookMode({ recipe, ingredients, servings, formatAmount, onClose, onMarkCooked }) {
  const steps = recipe.steps ?? []
  const [idx, setIdx] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const wakeLockRef = useRef(null)

  const done = idx >= steps.length
  const step = steps[idx]
  const durationSec = useMemo(() => stepDurationSec(step), [step])

  // ---- Mehrere benannte Timer, laufen über Schrittwechsel hinweg weiter ----
  // { id: Schrittindex, label, total, left, running }
  const [timers, setTimers] = useState([])
  const anyRunning = timers.some((t) => t.running && t.left > 0)

  useEffect(() => {
    if (!anyRunning) return
    const iv = setInterval(() => {
      setTimers((ts) =>
        ts.map((t) => {
          if (!t.running || t.left <= 0) return t
          if (t.left <= 1) { beep(); return { ...t, left: 0, running: false, finished: true } }
          return { ...t, left: t.left - 1 }
        }),
      )
    }, 1000)
    return () => clearInterval(iv)
  }, [anyRunning])

  const currentTimer = timers.find((t) => t.id === idx)

  function startTimerForStep() {
    setTimers((ts) => {
      const existing = ts.find((t) => t.id === idx)
      if (existing) {
        return ts.map((t) => (t.id === idx
          ? (t.left > 0 ? { ...t, running: !t.running } : { ...t, left: t.total, running: true, finished: false })
          : t))
      }
      return [...ts, { id: idx, label: `Schritt ${idx + 1}`, total: durationSec, left: durationSec, running: true }]
    })
  }

  function removeTimer(id) {
    setTimers((ts) => ts.filter((t) => t.id !== id))
  }

  function toggleTimer(id) {
    setTimers((ts) => ts.map((t) => (t.id === id && t.left > 0 ? { ...t, running: !t.running } : t)))
  }

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

  // Scroll der Seite dahinter sperren + Seite für Screenreader stummschalten
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const appRoot = document.getElementById('root')
    if (appRoot) appRoot.setAttribute('aria-hidden', 'true')
    return () => {
      document.body.style.overflow = prev
      if (appRoot) appRoot.removeAttribute('aria-hidden')
    }
  }, [])

  // Fokus beim Öffnen in den Dialog holen (Escape schließt)
  const dialogRef = useRef(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const otherTimers = timers.filter((t) => t.id !== idx || done)

  // Als Portal direkt an <body>: so bleibt der Vollbild-Kochmodus immer am
  // Bildschirm verankert, egal welche Animationen die Seite dahinter hat.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Kochmodus: ${recipe.title}`}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      className="fixed inset-0 z-50 bg-card flex flex-col animate-rise outline-none"
    >
      {/* Kopfzeile */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={onClose}
          className="grid place-content-center rounded-full bg-fill text-ink-2 active:scale-95 transition"
          style={{ width: 44, height: 44 }}
          aria-label="Kochmodus beenden"
        >
          <Icon name="x" size={16} strokeWidth={2.2} />
        </button>
        <span className="text-[15px] font-semibold text-ink" aria-live="polite">
          {done ? 'Fertig' : `Schritt ${idx + 1} von ${steps.length}`}
        </span>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-[15px] font-medium text-tint px-2"
          style={{ minHeight: 44 }}
        >
          Zutaten
        </button>
      </div>

      {/* Fortschritt */}
      <div className="px-4">
        <div className="rounded-full bg-fill overflow-hidden" style={{ height: 4 }}>
          <div
            className="h-full rounded-full bg-tint"
            style={{ width: `${(Math.min(idx + (done ? 0 : 1), steps.length) / Math.max(steps.length, 1)) * 100}%`, transition: 'width .3s' }}
          />
        </div>
      </div>

      {/* Laufende Timer anderer Schritte: bleiben immer sichtbar */}
      {otherTimers.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 flex-wrap" aria-live="polite">
          {otherTimers.map((t) => (
            <span
              key={t.id}
              className={`inline-flex items-center gap-1.5 rounded-full pl-3 pr-1 py-1 text-[13px] font-semibold ${
                t.left === 0 ? 'bg-tint text-white' : 'bg-tint-soft text-tint'
              }`}
            >
              <Icon name="clock" size={13} strokeWidth={2.2} />
              {t.label}: {t.left === 0 ? 'fertig!' : fmtClock(t.left)}
              {t.left > 0 && (
                <button
                  onClick={() => toggleTimer(t.id)}
                  className="grid place-content-center rounded-full"
                  style={{ width: 26, height: 26 }}
                  aria-label={t.running ? `Timer ${t.label} pausieren` : `Timer ${t.label} fortsetzen`}
                >
                  <Icon name={t.running ? 'pause' : 'play'} size={12} strokeWidth={2.2} />
                </button>
              )}
              <button
                onClick={() => removeTimer(t.id)}
                className="grid place-content-center rounded-full"
                style={{ width: 26, height: 26 }}
                aria-label={`Timer ${t.label} entfernen`}
              >
                <Icon name="x" size={12} strokeWidth={2.2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Inhalt */}
      <div className="flex-1 overflow-y-auto px-6 py-7">
        {done ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="grid place-content-center rounded-full bg-tint-soft text-tint mb-6" style={{ width: 84, height: 84 }}>
              <Icon name="check" size={38} strokeWidth={2.4} />
            </div>
            <h2 className="text-[28px] font-bold text-ink mb-1.5">Guten Appetit!</h2>
            <p className="text-[14.5px] text-ink-3 mb-7">Alle {steps.length} Schritte geschafft.</p>
            <button
              onClick={async () => { setMarking(true); await onMarkCooked?.(); onClose() }}
              disabled={marking}
              className="w-full max-w-xs h-[50px] rounded-[14px] bg-tint text-white text-[16px] font-semibold active:bg-tint-dark transition disabled:opacity-45"
            >
              Als gekocht markieren
            </button>
            <button onClick={onClose} className="mt-4 text-[14.5px] font-medium text-tint" style={{ minHeight: 44 }}>
              Zum Rezept
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-5">
            <p className="text-[25px] font-semibold text-ink" style={{ lineHeight: 1.42, textWrap: 'pretty' }}>
              {step?.text}
            </p>

            {/* Timer für diesen Schritt (benannt, läuft beim Weiterblättern weiter) */}
            {(durationSec || currentTimer) && (
              <div className="flex items-center gap-3 rounded-[16px] bg-bg px-4 py-3.5">
                <span className="grid place-content-center w-10 h-10 rounded-full bg-tint-soft text-tint shrink-0">
                  <Icon name="clock" size={19} strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-tint">
                    {!currentTimer
                      ? fmtDuration(durationSec)
                      : currentTimer.left === 0
                        ? '0:00 — fertig!'
                        : fmtClock(currentTimer.left)}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    Timer „Schritt {idx + 1}“ — läuft auch beim Weiterblättern
                  </p>
                </div>
                <button
                  onClick={startTimerForStep}
                  className="rounded-full bg-tint px-4 text-[13.5px] font-semibold text-white active:bg-tint-dark transition shrink-0"
                  style={{ minHeight: 44 }}
                >
                  {!currentTimer
                    ? 'Start'
                    : currentTimer.left === 0
                      ? 'Nochmal'
                      : currentTimer.running
                        ? 'Pause'
                        : 'Weiter'}
                </button>
              </div>
            )}

            {/* Zutaten in diesem Schritt: mit den echten Zutaten verknüpft,
                Mengen skaliert und einheitlich formatiert */}
            {step?.zutaten && (
              <div className="rounded-[16px] bg-bg px-4 py-3.5">
                <p className="text-[12px] font-semibold uppercase text-ink-3 mb-1.5" style={{ letterSpacing: '0.03em' }}>
                  In diesem Schritt
                </p>
                {stepIngredients(step, ingredients).map(({ seg, match }, i) => (
                  <p key={i} className="text-[14.5px] text-ink-2 py-0.5">
                    {match
                      ? [match.name, formatAmount(match)].filter(Boolean).join(' — ')
                      : seg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {!done && (
        <div className="px-4 pt-2 flex gap-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="flex-1 h-[50px] rounded-[14px] bg-fill text-[16px] font-semibold text-ink-2 transition"
            style={idx === 0 ? { opacity: 0.45 } : {}}
          >
            Zurück
          </button>
          <button
            onClick={() => setIdx((i) => i + 1)}
            className="flex-[2] h-[50px] rounded-[14px] bg-tint text-white text-[16px] font-semibold flex items-center justify-center gap-1 active:bg-tint-dark transition"
          >
            {idx === steps.length - 1 ? 'Fertig' : 'Weiter'}
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* Zutaten-Bottom-Sheet */}
      {sheetOpen && (
        <div className="absolute inset-0 z-10" style={{ background: 'rgb(0 0 0 / 0.25)' }} onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-label="Zutatenliste"
            className="absolute bottom-0 inset-x-0 bg-card animate-sheet px-5 pt-3 max-h-[70%] overflow-y-auto"
            style={{ borderRadius: '22px 22px 0 0', boxShadow: 'var(--shadow-sheet)', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto rounded-full" style={{ width: 38, height: 4, background: 'var(--color-handle)' }} />
            <h3 className="text-[17px] font-bold text-ink mt-4 mb-2">
              Zutaten für {servings} {servings === 1 ? 'Portion' : 'Portionen'}
            </h3>
            {ingredients.map((ing, i) => (
              <div key={ing.id} className="relative flex items-center justify-between gap-3 py-2.5">
                <span className="text-[15.5px] text-ink">{ing.name}</span>
                <span className="text-[15px] text-ink-3 shrink-0">
                  {formatAmount(ing)}
                </span>
                {i < ingredients.length - 1 && (
                  <span className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
