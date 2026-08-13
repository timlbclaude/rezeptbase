import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'

const CATEGORIES = ['Vorspeise', 'Hauptgericht', 'Beilage', 'Dessert', 'Frühstück', 'Snack', 'Getränk', 'Backen']

export default function ImportPage({ onDone, onCancel }) {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [duplicate, setDuplicate] = useState(false)
  const [preview, setPreview] = useState(null)

  async function handleExtract(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDuplicate(false)
    try {
      if (url.trim()) {
        const { data: dup } = await supabase
          .from('recipes')
          .select('id')
          .eq('source_url', url.trim())
          .limit(1)
        if (dup?.length) setDuplicate(true)
      }
      const { data, error: fnError } = await supabase.functions.invoke('import-recipe', {
        body: { url: url.trim() || null, text: showManual ? manualText : null },
      })
      if (fnError) {
        let msg = 'Import fehlgeschlagen. Bitte versuche es erneut.'
        try {
          const body = await fnError.context?.json()
          if (body?.error) msg = body.error
          if (body?.needs_manual) setShowManual(true)
        } catch { /* Standardmeldung */ }
        setError(msg)
      } else if (data?.recipe) {
        setPreview({
          ...data.recipe,
          prep_time_min: data.recipe.prep_time_min ?? '',
          cook_time_min: data.recipe.cook_time_min ?? '',
          cuisine: data.recipe.cuisine ?? '',
          description: data.recipe.description ?? '',
        })
      }
    } catch {
      setError('Import fehlgeschlagen. Bitte versuche es erneut.')
    }
    setBusy(false)
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    const p = preview
    const { data: rec, error: insError } = await supabase
      .from('recipes')
      .insert({
        title: p.title,
        description: p.description || null,
        source_url: p.source_url,
        source_type: p.source_type,
        video_embed_url: p.video_embed_url,
        image_url: p.image_url || null,
        base_servings: Number(p.base_servings) || 4,
        prep_time_min: p.prep_time_min === '' ? null : Number(p.prep_time_min),
        cook_time_min: p.cook_time_min === '' ? null : Number(p.cook_time_min),
        category: p.category,
        cuisine: p.cuisine || null,
        steps: p.steps.map((text, i) => ({ nr: i + 1, text })),
      })
      .select('id')
      .single()
    if (insError || !rec) {
      setError('Speichern fehlgeschlagen: ' + (insError?.message ?? ''))
      setBusy(false)
      return
    }
    const rows = p.ingredients
      .filter((i) => i.name.trim())
      .map((ing, i) => ({
        recipe_id: rec.id,
        name: ing.name,
        amount: ing.amount === '' || ing.amount === null ? null : Number(ing.amount),
        unit: ing.unit || null,
        is_scalable: ing.is_scalable,
        sort_order: i,
      }))
    if (rows.length) {
      const { error: ingError } = await supabase.from('ingredients').insert(rows)
      if (ingError) {
        setError('Zutaten konnten nicht gespeichert werden: ' + ingError.message)
        setBusy(false)
        return
      }
    }
    setBusy(false)
    onDone(rec.id)
  }

  function setIngredient(idx, field, value) {
    setPreview((p) => ({
      ...p,
      ingredients: p.ingredients.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    }))
  }

  const inputCls =
    'w-full rounded-xl border border-ink-200 bg-card px-3 py-2.5 text-sm outline-none transition ' +
    'focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400'
  const labelCls = 'text-xs font-semibold uppercase tracking-wider text-ink-500'

  // ---------- Schritt 2: Vorschau ----------
  if (preview) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 pb-32 animate-rise">
        <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">Rezept prüfen</h2>
        <p className="text-sm text-ink-500 mb-5">
          Die KI hat Folgendes extrahiert – du kannst alles korrigieren, bevor es gespeichert wird.
        </p>
        {duplicate && (
          <div className="mb-5 rounded-2xl bg-try-100 border border-amber-200 px-4 py-3 text-sm text-try-700">
            Diese Quelle wurde schon einmal importiert. Du kannst trotzdem speichern.
          </div>
        )}

        {preview.image_url && (
          <img src={preview.image_url} alt="" className="w-full h-48 object-cover rounded-3xl shadow-card mb-5" />
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Titel</label>
            <input className={inputCls} value={preview.title}
              onChange={(e) => setPreview({ ...preview, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Beschreibung</label>
            <textarea className={inputCls} rows={2} value={preview.description}
              onChange={(e) => setPreview({ ...preview, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Kategorie</label>
              <select className={inputCls} value={preview.category}
                onChange={(e) => setPreview({ ...preview, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Küche</label>
              <input className={inputCls} value={preview.cuisine} placeholder="z.B. Italienisch"
                onChange={(e) => setPreview({ ...preview, cuisine: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Portionen</label>
              <input type="number" min="1" className={inputCls} value={preview.base_servings}
                onChange={(e) => setPreview({ ...preview, base_servings: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Vorb. (Min)</label>
              <input type="number" min="0" className={inputCls} value={preview.prep_time_min}
                onChange={(e) => setPreview({ ...preview, prep_time_min: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Kochen (Min)</label>
              <input type="number" min="0" className={inputCls} value={preview.cook_time_min}
                onChange={(e) => setPreview({ ...preview, cook_time_min: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Zutaten (für {preview.base_servings || '?'} Portionen)</label>
            <div className="space-y-2 mt-2">
              {preview.ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputCls + ' !w-20'} placeholder="Menge" inputMode="decimal"
                    value={ing.amount ?? ''}
                    onChange={(e) => setIngredient(i, 'amount', e.target.value)} />
                  <input className={inputCls + ' !w-20'} placeholder="Einheit"
                    value={ing.unit ?? ''}
                    onChange={(e) => setIngredient(i, 'unit', e.target.value)} />
                  <input className={inputCls + ' flex-1'} placeholder="Zutat"
                    value={ing.name}
                    onChange={(e) => setIngredient(i, 'name', e.target.value)} />
                  <button type="button" className="text-ink-400 px-1" aria-label="Zutat entfernen"
                    onClick={() => setPreview((p) => ({ ...p, ingredients: p.ingredients.filter((_, j) => j !== i) }))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
              <button type="button"
                className="inline-flex items-center gap-1.5 text-sm text-brand-700 font-semibold p-1"
                onClick={() => setPreview((p) => ({ ...p, ingredients: [...p.ingredients, { name: '', amount: '', unit: '', is_scalable: true }] }))}>
                <Icon name="plus" size={15} strokeWidth={2.4} />
                Zutat hinzufügen
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Kochschritte</label>
            <div className="space-y-2 mt-2">
              {preview.steps.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 grid place-content-center w-7 h-7 mt-1 rounded-lg bg-brand-700 text-paper text-xs font-bold">
                    {i + 1}
                  </span>
                  <textarea className={inputCls + ' flex-1'} rows={2} value={s}
                    onChange={(e) => setPreview((p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? e.target.value : x)) }))} />
                  <button type="button" className="text-ink-400 px-1" aria-label="Schritt entfernen"
                    onClick={() => setPreview((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
              <button type="button"
                className="inline-flex items-center gap-1.5 text-sm text-brand-700 font-semibold p-1"
                onClick={() => setPreview((p) => ({ ...p, steps: [...p.steps, ''] }))}>
                <Icon name="plus" size={15} strokeWidth={2.4} />
                Schritt hinzufügen
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-xl px-4 py-3 mt-4">
            {error}
          </p>
        )}

        <div className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur border-t border-ink-200 p-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-2xl flex gap-3">
            <button onClick={() => setPreview(null)} disabled={busy}
              className="flex-1 rounded-xl border border-ink-200 bg-card py-3 font-semibold text-ink-700 active:bg-ink-100">
              Zurück
            </button>
            <button onClick={handleSave} disabled={busy || !preview.title.trim()}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-semibold text-paper shadow-card active:bg-brand-800 disabled:opacity-50">
              <Icon name="check" size={17} strokeWidth={2.4} />
              {busy ? 'Speichern …' : 'Rezept speichern'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Schritt 1: Quelle ----------
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-rise">
      <div className="flex items-center gap-3 mb-1">
        <span className="grid place-content-center w-10 h-10 rounded-2xl bg-brand-100 text-brand-700">
          <Icon name="sparkles" size={20} strokeWidth={1.9} />
        </span>
        <h2 className="font-display text-2xl font-semibold text-ink-900">Rezept importieren</h2>
      </div>
      <p className="text-sm text-ink-500 mb-6">
        Füge einen Link ein – YouTube-Video, Short oder Kochseite. Die KI extrahiert Zutaten und Schritte automatisch.
      </p>
      <form onSubmit={handleExtract} className="space-y-4">
        <div className="relative">
          <Icon name="link" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-2xl border border-ink-200 bg-card pl-11 pr-4 py-3.5 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400"
          />
        </div>
        <button type="button" className="text-sm text-ink-500 underline underline-offset-2"
          onClick={() => setShowManual(!showManual)}>
          {showManual ? 'Text-Eingabe ausblenden' : 'Oder Rezepttext manuell einfügen'}
        </button>
        {showManual && (
          <textarea
            rows={8}
            placeholder="Rezepttext hier einfügen (Zutaten + Zubereitung) …"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="w-full rounded-2xl border border-ink-200 bg-card px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400"
          />
        )}
        {error && (
          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-ink-200 bg-card py-3 font-semibold text-ink-700 active:bg-ink-100">
            Abbrechen
          </button>
          <button type="submit" disabled={busy || (!url.trim() && !(showManual && manualText.trim()))}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-semibold text-paper shadow-card active:bg-brand-800 disabled:opacity-50">
            <Icon name="sparkles" size={17} strokeWidth={2} />
            {busy ? 'Extrahiere Rezept …' : 'Rezept extrahieren'}
          </button>
        </div>
        {busy && (
          <p className="text-xs text-ink-400 text-center animate-pulse">
            Quelle wird gelesen und von der KI strukturiert – das dauert 10–30 Sekunden …
          </p>
        )}
      </form>
    </div>
  )
}
