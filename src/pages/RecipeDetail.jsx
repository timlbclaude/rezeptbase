import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function formatAmount(a) {
  if (a === null || a === undefined) return ''
  const n = Number(a)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

export default function RecipeDetail({ recipeId, onBack, onDeleted }) {
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checked, setChecked] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
    ]).then(([r, i]) => {
      setRecipe(r.data)
      setIngredients(i.data ?? [])
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
          <span className="rounded-full bg-stone-100 text-stone-600 px-3 py-1">👥 {recipe.base_servings} Portionen</span>
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
                  <strong>{formatAmount(ing.amount)} {ing.unit ?? ''}</strong> {ing.name}
                </span>
              </label>
            </li>
          ))}
        </ul>

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
