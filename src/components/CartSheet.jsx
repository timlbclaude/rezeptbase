// Einkaufs-Auswahl-Sheet: Zutaten einzeln an-/abwählen, dann gesammelt
// auf die Einkaufsliste legen. Reine Darstellung – Zustand (cartSel) und
// das eigentliche Hinzufügen (onSubmit) verwaltet RecipeDetail.
import Sheet from './Sheet.jsx'
import { formatIngredientAmount } from '../lib/amounts.js'

export default function CartSheet({
  ingredients,
  factor,
  servings,
  cartSel,
  setCartSel,
  cartBusy,
  onSubmit,
  onClose,
}) {
  const named = ingredients.filter((i) => i.name?.trim())
  const selectedCount = Object.values(cartSel).filter(Boolean).length

  return (
    <Sheet ariaLabel="Zutaten für die Einkaufsliste auswählen" onClose={onClose}>
      <div className="flex items-center justify-between mt-4 mb-1 shrink-0">
        <h3 className="text-[17px] font-bold text-ink">Auf die Einkaufsliste</h3>
        <button
          onClick={() => {
            const allOn = named.every((i) => cartSel[i.id])
            const sel = {}
            for (const i of named) sel[i.id] = !allOn
            setCartSel(sel)
          }}
          className="text-[14px] font-semibold text-tint"
          style={{ minHeight: 44 }}
        >
          {named.every((i) => cartSel[i.id]) ? 'Keine' : 'Alle'}
        </button>
      </div>
      <p className="text-[13px] text-ink-3 mb-2 shrink-0">Mengen für {servings} {servings === 1 ? 'Portion' : 'Portionen'} – gleiche Artikel werden zusammengeführt.</p>
      <div className="overflow-y-auto min-h-0">
        {named.map((ing, i, arr) => (
          <button
            key={ing.id}
            onClick={() => setCartSel((s) => ({ ...s, [ing.id]: !s[ing.id] }))}
            aria-pressed={!!cartSel[ing.id]}
            className="relative w-full flex items-center gap-3 py-2.5 text-left"
          >
            <input type="checkbox" className="checkbox-circle pointer-events-none" checked={!!cartSel[ing.id]} readOnly tabIndex={-1} />
            <span className={`flex-1 text-[15px] ${cartSel[ing.id] ? 'text-ink' : 'text-ink-3'}`}>{ing.name}</span>
            <span className="text-[14px] text-ink-3 shrink-0">{formatIngredientAmount(ing, factor)}</span>
            {i < arr.length - 1 && (
              <span className="absolute bottom-0 left-9 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
            )}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSubmit(new Set(Object.keys(cartSel).filter((k) => cartSel[k])))}
        disabled={cartBusy || Object.values(cartSel).every((v) => !v)}
        className="mt-3 h-[50px] rounded-[14px] bg-tint text-white text-[16px] font-semibold active:bg-tint-dark transition disabled:opacity-45 shrink-0"
      >
        {cartBusy ? 'Wird hinzugefügt …' : `${selectedCount} ${selectedCount === 1 ? 'Zutat' : 'Zutaten'} hinzufügen`}
      </button>
    </Sheet>
  )
}
