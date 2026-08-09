import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <button onClick={onBack} className="text-sm text-brand-600 font-semibold mb-2">← Zurück</button>
      <h1 className="text-2xl font-bold text-stone-900 mb-1">🛒 Einkaufsliste</h1>
      <p className="text-sm text-stone-500 mb-5">
        Synchron auf allen Geräten – am PC planen, am Handy einkaufen.
      </p>

      {loading ? (
        <p className="text-stone-400 animate-pulse">Lade Einkaufsliste …</p>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">🧺</p>
          <p className="text-stone-500 text-sm max-w-xs mx-auto">
            Noch leer. Öffne ein Rezept und tippe auf „Auf die Einkaufsliste“ – oder füge unten selbst etwas hinzu.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {open.map((item) => (
              <li key={item.id}>
                <label className="flex items-start gap-2.5 text-stone-700">
                  <input type="checkbox" checked={false} onChange={() => toggle(item)} className="mt-1 accent-brand-600" />
                  <span>
                    <strong>{fmt(item.amount)} {item.unit ?? ''}</strong> {item.ingredient_name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <p className="text-xs font-semibold text-stone-400 mt-5 mb-1.5">Im Wagen ({done.length})</p>
              <ul className="space-y-1.5">
                {done.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-start gap-2.5 text-stone-400">
                      <input type="checkbox" checked onChange={() => toggle(item)} className="mt-1 accent-brand-600" />
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
          className="w-16 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-brand-500"
          placeholder="Menge"
          inputMode="decimal"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
        />
        <input
          className="w-16 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-brand-500"
          placeholder="Einh."
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
        />
        <input
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          placeholder="Artikel hinzufügen …"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="rounded-lg bg-brand-600 text-white font-bold px-4 active:bg-brand-700">+</button>
      </form>

      {items.length > 0 && (
        <div className="mt-6 flex items-center gap-4 text-sm">
          {done.length > 0 && (
            <button onClick={removeChecked} className="font-semibold text-brand-600">
              Erledigte entfernen
            </button>
          )}
          {confirmClear ? (
            <span className="text-stone-600">
              Wirklich alles löschen?{' '}
              <button onClick={clearAll} className="font-semibold text-red-600">Ja</button>{' '}
              <button onClick={() => setConfirmClear(false)} className="text-stone-500">Nein</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="text-stone-400">
              Liste leeren
            </button>
          )}
        </div>
      )}
    </div>
  )
}
