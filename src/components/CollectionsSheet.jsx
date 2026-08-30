// Sammlungen-Sheet: Rezept eigenen Sammlungen zuordnen und neue anlegen.
// Reine Darstellung – Datenzugriff (toggle/create) verwaltet RecipeDetail.
import Icon from './Icon.jsx'
import Sheet from './Sheet.jsx'

export default function CollectionsSheet({
  collections,
  linkedColls,
  onToggle,
  onCreate,
  newCollName,
  setNewCollName,
  collBusy,
  readOnly,
  onClose,
}) {
  return (
    <Sheet ariaLabel="Rezept in Sammlungen einordnen" onClose={onClose}>
      <h3 className="text-[17px] font-bold text-ink mt-4 mb-1 shrink-0">Sammlungen</h3>
      <p className="text-[13px] text-ink-3 mb-2 shrink-0">
        Ordne das Rezept eigenen Sammlungen zu – z.B. „Schnelle Feierabendküche“ oder „Gäste-Menüs“.
      </p>
      <div className="overflow-y-auto min-h-0">
        {collections.length === 0 && (
          <p className="text-[14px] text-ink-3 py-3">Noch keine Sammlungen – lege unten die erste an.</p>
        )}
        {collections.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            aria-pressed={linkedColls.includes(c.id)}
            className="relative w-full flex items-center justify-between gap-3 py-3 text-left"
            style={{ opacity: readOnly ? 0.5 : undefined }}
            aria-disabled={readOnly}
          >
            <span className={`text-[15.5px] ${linkedColls.includes(c.id) ? 'font-semibold text-ink' : 'text-ink-2'}`}>
              {c.name}
            </span>
            {linkedColls.includes(c.id) && (
              <span className="text-tint"><Icon name="check" size={17} strokeWidth={2.4} /></span>
            )}
            {i < collections.length - 1 && (
              <span className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
            )}
          </button>
        ))}
      </div>
      <form onSubmit={onCreate} className="flex gap-2 mt-3 shrink-0">
        <input
          value={newCollName}
          onChange={(e) => setNewCollName(e.target.value)}
          placeholder="Neue Sammlung anlegen …"
          readOnly={readOnly}
          className="flex-1 rounded-[12px] bg-fill px-4 py-3 text-[15px] outline-none border border-transparent focus:border-tint placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={collBusy || !newCollName.trim()}
          className="grid place-content-center rounded-[12px] bg-tint text-white shrink-0 active:bg-tint-dark transition disabled:opacity-45"
          style={{ width: 46, height: 46, opacity: readOnly ? 0.5 : undefined }}
          aria-disabled={readOnly}
          aria-label="Sammlung anlegen"
        >
          <Icon name="plus" size={19} strokeWidth={2.4} />
        </button>
      </form>
      <button
        onClick={onClose}
        className="mt-3 h-[48px] rounded-[14px] bg-fill text-[15.5px] font-semibold text-ink-2 active:opacity-80 transition shrink-0"
      >
        Fertig
      </button>
    </Sheet>
  )
}
