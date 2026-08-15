import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { runWrite } from '../lib/mutate.js'
import { notify } from '../lib/notify.js'
import { READ_ONLY_MSG } from '../lib/roles.js'
import Icon from '../components/Icon.jsx'

function fmt(a) {
  if (a === null || a === undefined) return ''
  const n = Number(a)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// Freitext wie „250 g Mehl" in Menge/Einheit/Name zerlegen (optional)
function parseEntry(text) {
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜ.]{0,12})?\s+(.{2,})$/.exec(text.trim())
  if (!m) return { name: text.trim(), amount: null, unit: null }
  return {
    amount: Number(m[1].replace(',', '.')),
    unit: m[2]?.trim() || null,
    name: m[3].trim(),
  }
}

export default function ShoppingList({ readOnly = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [busyAdd, setBusyAdd] = useState(false)

  function load() {
    supabase
      .from('shopping_list')
      .select('*')
      .order('created_at')
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(item) {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
    const prev = items
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)))
    const { ok } = await runWrite(supabase.from('shopping_list').update({ checked: !item.checked }).eq('id', item.id))
    if (!ok) setItems(prev)
  }

  async function addManual(e) {
    e.preventDefault()
    if (!newText.trim() || busyAdd) return
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
    setBusyAdd(true)
    const parsed = parseEntry(newText)
    const { ok, data } = await runWrite(
      supabase
        .from('shopping_list')
        .insert({ ingredient_name: parsed.name, amount: parsed.amount, unit: parsed.unit })
        .select('*')
        .single(),
    )
    // Eingabe wird erst geleert, wenn der Server das Speichern bestätigt hat.
    if (ok && data) {
      setItems((xs) => [...xs, data])
      setNewText('')
    }
    setBusyAdd(false)
  }

  async function removeChecked() {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
    const ids = items.filter((x) => x.checked).map((x) => x.id)
    if (!ids.length) return
    const prev = items
    setItems((xs) => xs.filter((x) => !x.checked))
    const { ok } = await runWrite(supabase.from('shopping_list').delete().in('id', ids))
    if (!ok) setItems(prev)
  }

  async function clearAll() {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
    const prev = items
    const ids = items.map((x) => x.id)
    setItems([])
    setConfirmClear(false)
    if (!ids.length) return
    const { ok } = await runWrite(supabase.from('shopping_list').delete().in('id', ids))
    if (!ok) setItems(prev)
  }

  const open = items.filter((x) => !x.checked)
  const done = items.filter((x) => x.checked)

  function Row({ item, dimmed, last }) {
    return (
      <button
        onClick={() => toggle(item)}
        className="relative w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] transition"
      >
        <input type="checkbox" className="checkbox-circle pointer-events-none" checked={item.checked} readOnly tabIndex={-1} />
        <span className={`text-[15.5px] ${dimmed ? 'text-ink-3 line-through' : 'text-ink'}`}>
          {item.amount !== null && <strong className="font-semibold">{fmt(item.amount)} {item.unit ?? ''} </strong>}
          {item.ingredient_name}
        </span>
        {!last && (
          <span className="absolute bottom-0 pointer-events-none" style={{ left: 52, right: 0, height: 0.5, background: 'var(--color-separator)' }} />
        )}
      </button>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 animate-rise" style={{ paddingBottom: 190 }}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[34px] font-bold text-ink" style={{ letterSpacing: '0.3px' }}>Einkauf</h1>
        {done.length > 0 && (
          <button onClick={removeChecked} className="text-[14px] font-semibold text-tint">
            Erledigte entfernen
          </button>
        )}
      </div>
      <p className="text-[13.5px] text-ink-3 mb-5">Synchron auf allen Geräten – am PC planen, am Handy einkaufen.</p>

      {loading ? (
        <div className="bg-card rounded-[16px] shadow-card overflow-hidden">
          <div className="skeleton h-12 m-3 rounded-[10px]" />
          <div className="skeleton h-12 m-3 rounded-[10px]" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14">
          <div className="inline-grid place-content-center w-14 h-14 rounded-[18px] bg-fill text-ink-3 mb-4">
            <Icon name="bag" size={26} strokeWidth={1.6} />
          </div>
          <h2 className="text-[16px] font-semibold text-ink mb-1">Noch leer</h2>
          <p className="text-[13.5px] text-ink-3 max-w-xs mx-auto">
            Öffne ein Rezept und tippe auf „Alles auf die Einkaufsliste“ – oder füge unten selbst etwas hinzu.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="bg-card rounded-[16px] shadow-card overflow-hidden">
              {open.map((item, i) => (
                <Row key={item.id} item={item} last={i === open.length - 1} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <p className="text-[13px] font-semibold uppercase text-ink-3 mt-6 mb-2" style={{ letterSpacing: '0.03em' }}>
                Im Wagen · {done.length}
              </p>
              <div className="bg-card rounded-[16px] shadow-card overflow-hidden" style={{ opacity: 0.75 }}>
                {done.map((item, i) => (
                  <Row key={item.id} item={item} dimmed last={i === done.length - 1} />
                ))}
              </div>
            </>
          )}
          <div className="mt-5">
            {confirmClear ? (
              <span className="text-[14px] text-ink-2">
                Wirklich alles löschen?{' '}
                <button onClick={clearAll} className="font-semibold text-love">Ja</button>{' '}
                <button onClick={() => setConfirmClear(false)} className="text-ink-3">Nein</button>
              </span>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="text-[14px] text-ink-3">
                Liste leeren
              </button>
            )}
          </div>
        </>
      )}

      {/* Hinzufügen-Zeile fix über der Tab-Bar */}
      <form
        onSubmit={addManual}
        className="fixed inset-x-0 z-10 flex justify-center"
        style={{
          bottom: 'calc(max(24px, env(safe-area-inset-bottom)) + 58px)',
          background: 'linear-gradient(to top, var(--color-bg) 70%, transparent)',
          padding: '14px 16px 10px',
        }}
      >
        <div className="flex gap-2 w-full max-w-2xl">
          <input
            className="flex-1 rounded-[12px] bg-card shadow-card px-4 py-3 text-[16px] outline-none border border-transparent focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3"
            placeholder="Artikel hinzufügen …"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button
            type="submit"
            disabled={busyAdd}
            className="grid place-content-center rounded-[12px] bg-tint text-white shrink-0 active:bg-tint-dark active:scale-95 transition disabled:opacity-45"
            style={{ width: 46, height: 46, opacity: readOnly ? 0.5 : undefined }}
            aria-disabled={readOnly}
            aria-label="Hinzufügen"
          >
            <Icon name="plus" size={19} strokeWidth={2.4} />
          </button>
        </div>
      </form>
    </main>
  )
}
