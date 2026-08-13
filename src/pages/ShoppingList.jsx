import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'

function fmt(a) {
  if (a === null || a === undefined) return ''
  const n = Number(a)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

export default function ShoppingList({ onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

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
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)))
    await supabase.from('shopping_list').update({ checked: !item.checked }).eq('id', item.id)
  }

  async function addManual(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { data } = await supabase
      .from('shopping_list')
      .insert({
        ingredient_name: newName.trim(),
        amount: newAmount === '' ? null : Number(String(newAmount).replace(',', '.')),
        unit: newUnit.trim() || null,
      })
      .select('*')
      .single()
    if (data) setItems((xs) => [...xs, data])
    setNewName('')
    setNewAmount('')
    setNewUnit('')
  }

  async function removeChecked() {
    const ids = items.filter((x) => x.checked).map((x) => x.id)
    if (!ids.length) return
    setItems((xs) => xs.filter((x) => !x.checked))
    await supabase.from('shopping_list').delete().in('id', ids)
  }

  async function clearAll() {
    const ids = items.map((x) => x.id)
    setItems([])
    setConfirmClear(false)
    if (ids.length) await supabase.from('shopping_list').delete().in('id', ids)
  }

  const open = items.filter((x) => !x.checked)
  const done = items.filter((x) => x.checked)

  const inputCls =
    'rounded-xl border border-ink-200 bg-card px-3 py-2.5 text-sm outline-none transition ' +
    'focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400'

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-24 animate-rise">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 font-semibold mb-3 p-1 -ml-1 rounded-lg active:bg-brand-50"
      >
        <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
        Zurück
      </button>
      <div className="flex items-center gap-3 mb-1">
        <span className="grid place-content-center w-10 h-10 rounded-2xl bg-brand-100 text-brand-700">
          <Icon name="cart" size={20} strokeWidth={1.9} />
        </span>
        <h1 className="font-display text-3xl font-semibold text-ink-900 tracking-tight">Einkaufsliste</h1>
      </div>
      <p className="text-sm text-ink-500 mb-6 ml-13">
        Synchron auf allen Geräten – am PC planen, am Handy einkaufen.
      </p>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 rounded-2xl skeleton" />
          <div className="h-12 rounded-2xl skeleton" />
          <div className="h-12 rounded-2xl skeleton" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-grid place-content-center w-16 h-16 rounded-3xl bg-ink-100 text-ink-400 mb-4">
            <Icon name="cart" size={28} strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-lg font-semibold text-ink-900 mb-1">Noch leer</h2>
          <p className="text-ink-500 text-sm max-w-xs mx-auto">
            Öffne ein Rezept und tippe auf „Auf die Einkaufsliste“ – oder füge unten selbst etwas hinzu.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="rounded-3xl bg-card border border-ink-100 shadow-card divide-y divide-ink-100 overflow-hidden">
              {open.map((item) => (
                <li key={item.id}>
                  <label className="flex items-center gap-3 px-4 py-3 text-ink-700 cursor-pointer">
                    <input type="checkbox" className="checkbox" checked={false} onChange={() => toggle(item)} />
                    <span>
                      <strong className="font-semibold text-ink-900">
                        {fmt(item.amount)} {item.unit ?? ''}
                      </strong>{' '}
                      {item.ingredient_name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mt-6 mb-2">
                Im Wagen ({done.length})
              </p>
              <ul className="rounded-3xl bg-card/60 border border-ink-100 divide-y divide-ink-100 overflow-hidden">
                {done.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-3 px-4 py-3 text-ink-400 cursor-pointer">
                      <input type="checkbox" className="checkbox" checked onChange={() => toggle(item)} />
                      <span className="line-through">
                        {fmt(item.amount)} {item.unit ?? ''} {item.ingredient_name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <form onSubmit={addManual} className="mt-6 flex gap-2">
        <input
          className={inputCls + ' w-18'}
          placeholder="Menge"
          inputMode="decimal"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
        />
        <input
          className={inputCls + ' w-18'}
          placeholder="Einh."
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
        />
        <input
          className={inputCls + ' flex-1'}
          placeholder="Artikel hinzufügen …"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          className="grid place-content-center rounded-xl bg-brand-700 text-paper w-11 shadow-card transition active:bg-brand-800 active:scale-95"
          aria-label="Hinzufügen"
        >
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </form>

      {items.length > 0 && (
        <div className="mt-6 flex items-center gap-5 text-sm">
          {done.length > 0 && (
            <button onClick={removeChecked} className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
              <Icon name="check" size={15} strokeWidth={2.4} />
              Erledigte entfernen
            </button>
          )}
          {confirmClear ? (
            <span className="text-ink-700">
              Wirklich alles löschen?{' '}
              <button onClick={clearAll} className="font-semibold text-accent-600">Ja</button>{' '}
              <button onClick={() => setConfirmClear(false)} className="text-ink-500">Nein</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1.5 text-ink-400">
              <Icon name="trash" size={15} />
              Liste leeren
            </button>
          )}
        </div>
      )}
    </div>
  )
}
