import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'

const CATEGORIES = ['Vorspeise', 'Hauptgericht', 'Beilage', 'Dessert', 'Frühstück', 'Snack', 'Getränk', 'Backen']

// Schritte können Text (alte Rezepte) oder Objekte {text, timer_min, zutaten} sein
function normalizeSteps(steps) {
  return (steps ?? []).map((s) =>
    typeof s === 'string'
      ? { text: s, timer_min: null, zutaten: null }
      : { text: s.text ?? '', timer_min: s.timer_min ?? null, zutaten: s.zutaten ?? null },
  )
}

// Foto im Browser verkleinern (max. 1568 px, JPEG) → base64 ohne Präfix
function photoToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const max = 1568
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')) }
    img.src = url
  })
}

export default function ImportPage({ onDone, onCancel, editRecipe }) {
  const isEdit = Boolean(editRecipe)
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyPhoto, setBusyPhoto] = useState(false)
  const [error, setError] = useState(null)
  const [duplicate, setDuplicate] = useState(false)
  const photoInputRef = useRef(null)
  const [preview, setPreview] = useState(() => {
    if (!isEdit) return null
    const r = editRecipe.recipe
    return {
      title: r.title,
      description: r.description ?? '',
      category: r.category,
      cuisine: r.cuisine ?? '',
      base_servings: r.base_servings ?? 4,
      prep_time_min: r.prep_time_min ?? '',
      cook_time_min: r.cook_time_min ?? '',
      image_url: r.image_url,
      keywords: r.keywords ?? [],
      steps: normalizeSteps(r.steps),
      ingredients: (editRecipe.ingredients ?? []).map((i) => ({
        name: i.name,
        amount: i.amount ?? '',
        unit: i.unit ?? '',
        is_scalable: i.is_scalable,
      })),
    }
  })

  async function applyFunctionResult(data, fnError) {
    if (fnError) {
      let msg = 'Import fehlgeschlagen. Bitte versuche es erneut.'
      try {
        const body = await fnError.context?.json?.()
        if (body?.error) msg = body.error
        if (body?.needs_manual) setShowManual(true)
      } catch { /* Standardmeldung */ }
      setError(msg)
      return
    }
    if (data?.recipe) {
      setPreview({
        ...data.recipe,
        prep_time_min: data.recipe.prep_time_min ?? '',
        cook_time_min: data.recipe.cook_time_min ?? '',
        cuisine: data.recipe.cuisine ?? '',
        description: data.recipe.description ?? '',
        keywords: data.recipe.keywords ?? [],
        steps: normalizeSteps(data.recipe.steps),
      })
    }
  }

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
      await applyFunctionResult(data, fnError)
    } catch {
      setError('Import fehlgeschlagen. Bitte versuche es erneut.')
    }
    setBusy(false)
  }

  async function handlePhoto(file) {
    if (!file) return
    setBusyPhoto(true)
    setError(null)
    setDuplicate(false)
    try {
      const image_base64 = await photoToBase64(file)
      const { data, error: fnError } = await supabase.functions.invoke('import-recipe', {
        body: { image_base64, image_type: 'image/jpeg' },
      })
      await applyFunctionResult(data, fnError)
    } catch {
      setError('Foto-Import fehlgeschlagen. Bitte versuche es erneut.')
    }
    setBusyPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    const p = preview
    const stepsJson = p.steps
      .filter((s) => s.text.trim())
      .map((s, i) => ({
        nr: i + 1,
        text: s.text,
        ...(s.timer_min != null && s.timer_min !== '' ? { timer_min: Number(s.timer_min) } : {}),
        ...(s.zutaten ? { zutaten: s.zutaten } : {}),
      }))
    const fields = {
      title: p.title,
      description: p.description || null,
      base_servings: Number(p.base_servings) || 4,
      prep_time_min: p.prep_time_min === '' ? null : Number(p.prep_time_min),
      cook_time_min: p.cook_time_min === '' ? null : Number(p.cook_time_min),
      category: p.category,
      cuisine: p.cuisine || null,
      keywords: (p.keywords ?? []).map((k) => String(k).trim()).filter(Boolean),
      steps: stepsJson,
    }

    let recipeId
    if (isEdit) {
      recipeId = editRecipe.recipe.id
      const { error: upError } = await supabase.from('recipes').update(fields).eq('id', recipeId)
      if (upError) {
        setError('Speichern fehlgeschlagen: ' + upError.message)
        setBusy(false)
        return
      }
      await supabase.from('ingredients').delete().eq('recipe_id', recipeId)
    } else {
      const { data: rec, error: insError } = await supabase
        .from('recipes')
        .insert({
          ...fields,
          source_url: p.source_url ?? null,
          source_type: p.source_type ?? 'manual',
          video_embed_url: p.video_embed_url ?? null,
          image_url: p.image_url || null,
        })
        .select('id')
        .single()
      if (insError || !rec) {
        setError('Speichern fehlgeschlagen: ' + (insError?.message ?? ''))
        setBusy(false)
        return
      }
      recipeId = rec.id
    }

    const rows = p.ingredients
      .filter((i) => i.name.trim())
      .map((ing, i) => ({
        recipe_id: recipeId,
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
    onDone(recipeId)
  }

  function setIngredient(idx, field, value) {
    setPreview((p) => ({
      ...p,
      ingredients: p.ingredients.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    }))
  }

  const inputCls =
    'w-full rounded-[12px] bg-card shadow-card px-3.5 py-2.5 text-[15px] outline-none border border-transparent ' +
    'transition focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3'
  const labelCls = 'text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-3'

  const Header = (
    <div className="flex items-center justify-between mb-1">
      <h1 className="text-[34px] font-bold text-ink" style={{ letterSpacing: '0.3px' }}>
        {isEdit ? 'Bearbeiten' : 'Import'}
      </h1>
      <button
        onClick={onCancel}
        className="grid place-content-center w-[34px] h-[34px] rounded-full bg-fill text-ink-2 active:scale-95 transition"
        aria-label="Schließen"
      >
        <Icon name="x" size={16} strokeWidth={2.2} />
      </button>
    </div>
  )

  // ---------- Schritt 2: Vorschau / Bearbeiten ----------
  if (preview) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-5 animate-rise" style={{ paddingBottom: 130 }}>
        {Header}
        <p className="text-[14.5px] text-ink-3 mb-5">
          {isEdit
            ? 'Passe Titel, Zutaten und Schritte an – Bewertung, Notizen und Status bleiben erhalten.'
            : 'Die KI hat Folgendes extrahiert – du kannst alles korrigieren, bevor es gespeichert wird.'}
        </p>
        {duplicate && (
          <div className="mb-4 rounded-[12px] bg-fill px-4 py-3 text-[13.5px] text-ink-2">
            Diese Quelle wurde schon einmal importiert. Du kannst trotzdem speichern.
          </div>
        )}

        {preview.image_url && (
          <img src={preview.image_url} alt="" className="w-full object-cover rounded-[16px] shadow-card mb-5" style={{ height: 150 }} />
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Titel</label>
            <input className={inputCls + ' !text-[16px] font-semibold'} value={preview.title}
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

          <div className="space-y-1.5">
            <label className={labelCls}>Suchbegriffe (für die Suche, mit Komma getrennt)</label>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="z.B. teigwaren, pasta, nudeln, vegetarisch …"
              value={(preview.keywords ?? []).join(', ')}
              onChange={(e) =>
                setPreview({ ...preview, keywords: e.target.value.split(',').map((k) => k.trim()) })
              }
            />
          </div>

          <div>
            <label className={labelCls}>Zutaten (für {preview.base_servings || '?'} Portionen)</label>
            <div className="space-y-2 mt-2">
              {preview.ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputCls + ' !w-18'} placeholder="Menge" inputMode="decimal"
                    value={ing.amount ?? ''}
                    onChange={(e) => setIngredient(i, 'amount', e.target.value)} />
                  <input className={inputCls + ' !w-18'} placeholder="Einheit"
                    value={ing.unit ?? ''}
                    onChange={(e) => setIngredient(i, 'unit', e.target.value)} />
                  <input className={inputCls + ' flex-1'} placeholder="Zutat"
                    value={ing.name}
                    onChange={(e) => setIngredient(i, 'name', e.target.value)} />
                  <button type="button" className="text-ink-3 px-1" aria-label="Zutat entfernen"
                    onClick={() => setPreview((p) => ({ ...p, ingredients: p.ingredients.filter((_, j) => j !== i) }))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
              <button type="button"
                className="inline-flex items-center gap-1.5 text-[13.5px] text-tint font-semibold p-1"
                onClick={() => setPreview((p) => ({ ...p, ingredients: [...p.ingredients, { name: '', amount: '', unit: '', is_scalable: true }] }))}>
                <Icon name="plus" size={14} strokeWidth={2.4} />
                Zutat hinzufügen
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Kochschritte</label>
            <div className="space-y-2 mt-2">
              {preview.steps.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 grid place-content-center w-[26px] h-[26px] mt-1.5 rounded-full bg-fill text-[13px] font-bold text-ink-2">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <textarea className={inputCls} rows={2} value={s.text}
                      onChange={(e) => setPreview((p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} />
                    {(s.timer_min != null || s.zutaten) && (
                      <p className="text-[12px] text-ink-3 px-1">
                        {[s.timer_min != null ? `⏱ ${s.timer_min} Min Timer` : null, s.zutaten].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button type="button" className="text-ink-3 px-1" aria-label="Schritt entfernen"
                    onClick={() => setPreview((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }))}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
              <button type="button"
                className="inline-flex items-center gap-1.5 text-[13.5px] text-tint font-semibold p-1"
                onClick={() => setPreview((p) => ({ ...p, steps: [...p.steps, { text: '', timer_min: null, zutaten: null }] }))}>
                <Icon name="plus" size={14} strokeWidth={2.4} />
                Schritt hinzufügen
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-[13.5px] text-love rounded-[12px] px-4 py-3 mt-4" style={{ background: 'rgb(195 61 36 / 0.1)' }}>
            {error}
          </p>
        )}

        <div
          className="fixed bottom-0 inset-x-0 z-10"
          style={{
            background: 'linear-gradient(to top, var(--color-bg) 60%, transparent)',
            padding: '12px 16px max(28px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="mx-auto max-w-2xl flex gap-3">
            <button onClick={() => (isEdit ? onCancel() : setPreview(null))} disabled={busy}
              className="flex-1 h-[50px] rounded-[14px] bg-fill text-[16px] font-semibold text-ink-2 active:opacity-80 transition">
              {isEdit ? 'Abbrechen' : 'Zurück'}
            </button>
            <button onClick={handleSave} disabled={busy || !preview.title.trim()}
              className="flex-[2] h-[50px] rounded-[14px] bg-tint text-white text-[16px] font-semibold flex items-center justify-center gap-2 active:bg-tint-dark transition disabled:opacity-45">
              <Icon name="check" size={17} strokeWidth={2.4} />
              {busy ? 'Speichern …' : isEdit ? 'Änderungen speichern' : 'Rezept speichern'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Schritt 1: Quelle ----------
  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 animate-rise pb-16">
      {Header}
      <p className="text-[14.5px] text-ink-3 mb-6">
        Füge einen Link ein – YouTube, TikTok, Instagram oder Kochseite – oder fotografiere ein Rezept.
        Die KI extrahiert Zutaten und Schritte automatisch.
      </p>
      <form onSubmit={handleExtract} className="space-y-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
            <Icon name="link" size={16} strokeWidth={2} />
          </span>
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-[14px] bg-card shadow-card pl-11 pr-4 py-3.5 text-[16px] outline-none border border-transparent transition focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3"
          />
        </div>

        <button
          type="submit"
          disabled={busy || busyPhoto || (!url.trim() && !(showManual && manualText.trim()))}
          className="w-full h-[50px] rounded-[14px] bg-tint text-white text-[16.5px] font-semibold flex items-center justify-center gap-2 active:bg-tint-dark transition disabled:opacity-45"
        >
          <Icon name="sparkles" size={17} strokeWidth={2} />
          {busy ? 'Extrahiere Rezept …' : 'Rezept extrahieren'}
        </button>

        {/* Foto-Import */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhoto(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy || busyPhoto}
          onClick={() => photoInputRef.current?.click()}
          className="w-full h-[50px] rounded-[14px] bg-card shadow-card text-[16px] font-semibold text-tint flex items-center justify-center gap-2 active:opacity-80 transition disabled:opacity-45"
        >
          <Icon name="camera" size={18} strokeWidth={2} />
          {busyPhoto ? 'Foto wird gelesen …' : 'Rezept fotografieren'}
        </button>
        <p className="text-[12.5px] text-ink-4 text-center -mt-1">
          Kochbuchseite, handschriftliche Karte oder Screenshot
        </p>

        <button type="button" className="text-[13.5px] text-ink-3 underline underline-offset-2"
          onClick={() => setShowManual(!showManual)}>
          {showManual ? 'Text-Eingabe ausblenden' : 'Oder Rezepttext manuell einfügen'}
        </button>
        {showManual && (
          <textarea
            rows={8}
            placeholder="Rezepttext hier einfügen (Zutaten + Zubereitung) …"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="w-full rounded-[14px] bg-card shadow-card px-4 py-3 text-[15px] outline-none border border-transparent transition focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3"
          />
        )}
        {error && (
          <p className="text-[13.5px] text-love rounded-[12px] px-4 py-3" style={{ background: 'rgb(195 61 36 / 0.1)' }}>
            {error}
          </p>
        )}
        {(busy || busyPhoto) && (
          <p className="text-[13px] text-ink-3 text-center animate-pulse">
            Quelle wird gelesen und von der KI strukturiert – das dauert 10–30 Sekunden …
          </p>
        )}
      </form>
    </div>
  )
}
