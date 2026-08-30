// Untere Tab-Leiste (Rezepte / Import / Einkauf) mit Blur-Hintergrund.
import Icon from './Icon.jsx'

export default function TabBar({ tab, onTab }) {
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
