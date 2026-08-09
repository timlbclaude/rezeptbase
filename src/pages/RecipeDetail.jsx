import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Einheiten, die man nicht sinnvoll in Bruchteilen abmessen kann
const COUNTABLE_UNITS = ['stück', 'zehe', 'zehen', 'bund', 'dose', 'dosen', 'scheibe', 'scheiben', 'stängel', 'blatt', 'blätter', 'packung', 'päckchen', 'würfel']
const COUNTABLE_NAMES = ['ei', 'eier', 'zwiebel', 'knoblauchzehe', 'zitrone', 'limette']

function isCountable(ing) {
  const unit = (ing.unit ?? '').toLowerCase().trim()
  const name = (ing.name ?? '').toLowerCase()
  if (COUNTABLE_UNITS.includes(unit)) return true
  if (!unit && COUNTABLE_NAMES.some((n) => name.startsWith(n))) return true
  return false
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// Intelligente Rundung der skalierten Menge
function formatScaled(ing, factor) {
  if (ing.amount === null || ing.amount === undefined) return ''
  if (!ing.is_scalable) return formatNumber(Number(ing.amount))

  const n = Number(ing.amount) * factor
  if (n <= 0) return ''

  if (isCountable(ing)) {
    const nearest = Math.round(n)
    if (Math.abs(n - nearest) <= 0.15 && nearest >= 1) return String(nearest)
    const lo = Math.max(1, Math.floor(n))
    const hi = Math.ceil(n)
    return lo === hi ? String(lo) : `${lo}–${hi}`
  }

  if (n >= 100) return String(Math.round(n))
  if (n >= 10) return formatNumber(Math.round(n * 2) / 2)
  if (n >= 1) return formatNumber(Math.round(n * 4) / 4)
  return formatNumber(Math.round(n * 100) / 100)
}

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function RecipeDetail({ recipeId, onBack, onDeleted }) {
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checked, setChecked] = useState({})
  const [servings, setServings] = useState(4)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const [cartMessage, setCartMessage] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
    ]).then(([r, i]) => {
      setRecipe(r.data)
      setIngredients(i.data ?? [])
      if (r.data?.base_servings) setServings(r.data.base_servings)
      setNotes(r.data?.notes ?? '')
      setLoading(false)
    })
  }, [recipeId])

  async function patch(fields) {
    setRecipe((r) => ({ ...r, ...fields }))
    await supabase.from('recipes').update(fields).eq('id', recipeId)
  }

  async function toggleStatus() {
    if (recipe.status === 'gekocht') {
      await patch({ status: 'zum_ausprobieren' })
    } else {
      await patch({ status: 'gekocht', last_cooked_at: new Date().toISOString().slice(0, 10) })
    }
  }

  async function saveNotes() {
    await patch({ notes: notes.trim() || null })
    setNotesSaved(true)
  }

  async function addToShoppingList() {
    setCartMessage('…')
    const factor = servings / (recipe.base_servings || 4)
    const { data: existing } = await supabase.from('shopping_list').select('*')
    const list = existing ?? []
    let added = 0
    for (const ing of ingredients) {
      if (!ing.name?.trim()) continue
      const amount =
        ing.amount === null || ing.amount === undefined
          ? null
          : ing.is_scalable
            ? Math.round(Number(ing.amount) * factor * 100) / 100
            : Number(ing.amount)
      const match = list.find(
        (x) =>
          !x.checked &&
          x.ingredient_name.toLowerCase().trim() === ing.name.toLowerCase().trim() &&
          (x.unit ?? '') === (ing.unit ?? '') &&
          x.amount !== null &&
          amount !== null,
      )
      if (match) {
        await supabase
          .from('shopping_list')
          .update({ amount: Math.round((Number(match.amount) + amount) * 100) / 100 })
          .eq('id', match.id)
        match.amount = Number(match.amount) + amount
      } else {
        await supabase.from('shopping_list').insert({
          ingredient_name: ing.name,
          amount,
          unit: ing.unit ?? null,
          source_recipe_id: recipeId,
        })
      }
      added++
    }
    setCartMessage(`✓ ${added} Zutaten (für ${servings} Portionen) auf der Einkaufsliste`)
    setTimeout(() => setCartMessage(null), 4000)
  }

  if (loading) {
    return <p className="text-stone-400 animate-pulse text-center py-16">Lade Rezept …</p>
  }
  if (!recipe) {
    return <p className="text-stone-500 text-center py-16">Rezept nicht gefunden.</p>
  }

  const time = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  const base = recipe.base_servings || 4
  const factor = servings / base
  const sliderMax = Math.max(12, base)
  const isScaled = servings !== base
  const cooked = recipe.status === 'gekocht'

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {recipe.video_embed_url ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={recipe.video_embed_url}
            title="Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : recipe.image_url ? (
        <img src={recipe.image_url} alt="" className="w-full h-52 object-cover" />
      ) : null}

      <div className="px-4 pt-4">
        <button onClick={onBack} className="text-sm text-brand-600 font-semibold mb-2">← Zurück</button>

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-900">{recipe.title}</h1>
          <button
            onClick={() => patch({ is_favorite: !recipe.is_favorite })}
            className="shrink-0 text-2xl pt-0.5"
            aria-label="Favorit"
          >
            {recipe.is_favorite ? '❤️' : '🤍'}
          </button>
        </div>
        {recipe.description && <p className="text-stone-600 mt-1">{recipe.description}</p>}

        <div className="flex flex-wrap gap-2 mt-3 text-xs items-center">
          <span className={`rounded-full px-3 py-1 font-semibold ${cooked ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
            {cooked ? '✅ Schon gekocht' : '🌱 Zum Ausprobieren'}
          </span>
          {recipe.category && <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">{recipe.category}</span>}
          {recipe.cuisine && <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">{recipe.cuisine}</span>}
          {time > 0 && <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">⏱ {time} Min</span>}
        </div>

        {/* Kochstatus + Bewertung */}
        <div className="mt-4 rounded-2xl bg-white border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={toggleStatus}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${cooked ? 'border border-stone-300 text-stone-600' : 'bg-brand-600 text-white active:bg-brand-700'}`}
            >
              {cooked ? '↩ Zurück auf „Zum Ausprobieren“' : '✅ Als gekocht markieren'}
            </button>
            {recipe.last_cooked_at && (
              <span className="text-xs text-stone-400">Zuletzt gekocht: {formatDate(recipe.last_cooked_at)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-stone-500 mr-2">Bewertung:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => patch({ rating: recipe.rating === s ? null : s })}
                className="text-xl"
                aria-label={`${s} Sterne`}
              >
                {recipe.rating >= s ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* Portionsrechner */}
        <div className="mt-4 rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-stone-900">
              👥 {servings} {servings === 1 ? 'Portion' : 'Portionen'}
            </span>
            <span className="text-xs text-stone-400">
              {isScaled ? `Original: ${base}` : 'Originalmenge'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="shrink-0 w-9 h-9 rounded-full border border-stone-300 text-lg font-bold text-stone-600 active:bg-stone-100"
              aria-label="Weniger Portionen"
            >
              −
            </button>
            <input
              type="range"
              min="1"
              max={sliderMax}
              step="1"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="flex-1 accent-brand-600 h-2"
              aria-label="Portionen"
            />
            <button
              onClick={() => setServings((s) => Math.min(sliderMax, s + 1))}
              className="shrink-0 w-9 h-9 rounded-full border border-stone-300 text-lg font-bold text-stone-600 active:bg-stone-100"
              aria-label="Mehr Portionen"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <h2 className="font-bold text-stone-900">Zutaten</h2>
          <button onClick={addToShoppingList} className="text-sm font-semibold text-brand-600">
            🛒 Auf die Einkaufsliste
          </button>
        </div>
        {cartMessage && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-2">{cartMessage}</p>
        )}
        <ul className="space-y-1.5">
          {ingredients.map((ing) => (
            <li key={ing.id}>
              <label className="flex items-start gap-2.5 text-stone-700">
                <input
                  type="checkbox"
                  checked={!!checked[ing.id]}
                  onChange={() => setChecked((c) => ({ ...c, [ing.id]: !c[ing.id] }))}
                  className="mt-1 accent-brand-600"
                />
                <span className={checked[ing.id] ? 'line-through text-stone-400' : ''}>
                  <strong className={isScaled && ing.is_scalable && ing.amount !== null ? 'text-brand-700' : ''}>
                    {formatScaled(ing, factor)} {ing.unit ?? ''}
                  </strong>{' '}
                  {ing.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {isScaled && (
          <p className="text-xs text-stone-400 mt-2">
            Mengen umgerechnet auf {servings} {servings === 1 ? 'Portion' : 'Portionen'} und sinnvoll gerundet.
          </p>
        )}

        <h2 className="font-bold text-stone-900 mt-6 mb-2">Zubereitung</h2>
        <ol className="space-y-3">
          {(recipe.steps ?? []).map((s) => (
            <li key={s.nr} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">
                {s.nr}
              </span>
              <p className="text-stone-700 pt-0.5">{s.text}</p>
            </li>
          ))}
        </ol>

        <h2 className="font-bold text-stone-900 mt-6 mb-2">Meine Notizen</h2>
        <textarea
          rows={3}
          placeholder="z.B. weniger Salz nehmen, Beilage: Reis …"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {!notesSaved && (
          <button onClick={saveNotes} className="mt-1 text-sm font-semibold text-brand-600">
            Notizen speichern
          </button>
        )}

        {recipe.source_url && (
          <p className="mt-6 text-sm">
            <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
              Originalquelle öffnen ↗
            </a>
          </p>
        )}

        <div className="mt-10 border-t border-stone-200 pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-600">Wirklich löschen?</span>
              <button onClick={async () => { await supabase.from('recipes').delete().eq('id', recipeId); onDeleted() }} className="text-sm font-semibold text-red-600">Ja, löschen</button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500">Abbrechen</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm text-stone-400">
              Rezept löschen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
