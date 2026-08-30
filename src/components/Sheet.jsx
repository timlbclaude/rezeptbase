// Gemeinsames Bottom-Sheet-Gerüst: Backdrop, Panel, Zieh-Griff.
// Klick auf den Backdrop schließt; Klicks im Panel bleiben im Panel.
// Bewusst KEIN Portal: die Seiten-Container enden nach animate-rise auf
// `transform: none`, daher klebt position:fixed korrekt am Bildschirm
// (siehe CSS-Falle in src/index.css).
export default function Sheet({ ariaLabel, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30" onClick={onClose} style={{ background: 'rgb(0 0 0 / 0.25)' }}>
      <div
        role="dialog"
        aria-label={ariaLabel}
        className="absolute bottom-0 inset-x-0 bg-card rounded-t-[22px] animate-sheet px-5 pt-3 flex flex-col"
        style={{ boxShadow: 'var(--shadow-sheet)', maxHeight: '80%', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto rounded-full shrink-0" style={{ width: 38, height: 4, background: 'var(--color-handle)' }} />
        {children}
      </div>
    </div>
  )
}
