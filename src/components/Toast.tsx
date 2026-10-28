import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOAST_EVENT, type ToastDetail } from '../lib/notify.ts'

interface ToastItem extends ToastDetail { id: number }

/* Globale Toast-Anzeige. Hört auf das 'rezeptbase:toast'-Event (siehe
   lib/notify.js). Meldungen verschwinden nach 4 Sekunden von selbst.
   aria-live macht sie auch für Screenreader hörbar. */

let nextId = 1

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const id = nextId++
      const { message, type } = (e as CustomEvent<ToastDetail>).detail
      setToasts((ts) => [...ts.slice(-2), { id, message, type }])
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4000)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  return createPortal(
    <div
      className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4"
      style={{ top: 'max(14px, env(safe-area-inset-top))' }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-md w-full rounded-[14px] px-4 py-3 text-[14px] font-medium text-white shadow-lg animate-rise"
          style={{
            background: t.type === 'success' ? 'var(--color-tint)' : t.type === 'info' ? '#3A3A3C' : 'var(--color-love)',
          }}
          onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
