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

export default function RecipeDetail({ recipeId, onBack, onDeleted }) {
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checked, setChecked] = useState({})
  const [servings, setServings] = useState(4)

  useEffect(() => {
    Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
    ]).then(([r, i]) => {
      setRecipe(r.data)
      setIngredients(i.data ?? [])
      if (r.data?.base_servings) setServings(r.data.base_servings)
      setLoading(false)
    })
  }, [recipeId])

  async function handleDelete() {
    await supabase.from('recipes').delete().eq('id', recipeId)
    onDeleted()
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
        <h1 className="text-2xl font-bold text-stone-900">{recipe.title}</h1>
        {recipe.description && <p className="text-stone-600 mt-1">{recipe.description}</p>}

        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {recipe.category && <span className="rounded-full bg-brand-100 text-brand-700 px-3 py-1 font-semibold">{recipe.category}</span>}
          {recipe.cuisine && <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">{recipe.cuisine}</span>}
          {time > 0 && <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">⏱ {time} Min</span>}
        </div>

        {/* Portionsrechner */}
        <div className="mt-5 rounded-2xl bg-white border border-stone-200 p-4">
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

        <h2 className="font-bold text-stone-900 mt-6 mb-2">Zutaten</h2>
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
                  {!ing.is_scalable && ing.amount === null && ''}
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
              <button onClick={handleDelete} className="text-sm font-semibold text-red-600">Ja, löschen</button>
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
