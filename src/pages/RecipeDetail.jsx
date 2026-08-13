import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'
import CookMode from '../components/CookMode.jsx'

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
  const [cooking, setCooking] = useState(false)

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
    setCartMessage(`${added} Zutaten (für ${servings} Portionen) auf der Einkaufsliste`)
    setTimeout(() => setCartMessage(null), 4000)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-56 skeleton" />
        <div className="px-4 pt-5 space-y-3">
          <div className="h-7 w-3/4 rounded skeleton" />
          <div className="h-4 w-1/2 rounded skeleton" />
          <div className="h-28 rounded-3xl skeleton" />
        </div>
      </div>
    )
  }
  if (!recipe) {
    return <p className="text-ink-500 text-center py-16">Rezept nicht gefunden.</p>
  }

  const time = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  const base = recipe.base_servings || 4
  const factor = servings / base
  const sliderMax = Math.max(12, base)
  const isScaled = servings !== base
  const cooked = recipe.status === 'gekocht'

  return (
    <div className="mx-auto max-w-2xl pb-16 animate-rise">
      {cooking && (
        <CookMode
          recipe={recipe}
          ingredients={ingredients}
          formatAmount={(ing) => formatScaled(ing, factor)}
          onClose={() => setCooking(false)}
        />
      )}

      {recipe.video_embed_url ? (
        <div className="aspect-video w-full bg-ink-900">
          <iframe
            src={recipe.video_embed_url}
            title="Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : recipe.image_url ? (
        <div className="relative">
          <img src={recipe.image_url} alt="" className="w-full h-56 object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/25 to-transparent" />
        </div>
      ) : null}

      <div className="px-4 pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 font-semibold mb-3 p-1 -ml-1 rounded-lg active:bg-brand-50"
        >
          <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
          Zurück
        </button>

        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ink-900 leading-tight tracking-tight">
            {recipe.title}
          </h1>
          <button
            onClick={() => patch({ is_favorite: !recipe.is_favorite })}
            className={`shrink-0 grid place-content-center w-11 h-11 rounded-full border transition active:scale-95 ${
              recipe.is_favorite
                ? 'border-accent-200 bg-accent-50 text-accent-500'
                : 'border-ink-200 bg-card text-ink-400'
            }`}
            aria-label="Favorit"
          >
            <Icon name="heart" size={20} filled={recipe.is_favorite} />
          </button>
        </div>
        {recipe.description && <p className="text-ink-500 mt-2 leading-relaxed">{recipe.description}</p>}

        <div className="flex flex-wrap gap-2 mt-4 text-xs items-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
              cooked ? 'bg-brand-100 text-brand-700' : 'bg-try-100 text-try-700'
            }`}
          >
            <Icon name={cooked ? 'checkCircle' : 'sprout'} size={13} strokeWidth={2.4} />
            {cooked ? 'Schon gekocht' : 'Zum Ausprobieren'}
          </span>
          {recipe.category && (
            <span className="rounded-full bg-ink-100 text-ink-700 px-3 py-1.5 font-medium">{recipe.category}</span>
          )}
          {recipe.cuisine && (
            <span className="rounded-full bg-ink-100 text-ink-700 px-3 py-1.5 font-medium">{recipe.cuisine}</span>
          )}
          {time > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 text-ink-700 px-3 py-1.5 font-medium">
              <Icon name="clock" size={13} strokeWidth={2.2} />
              {time} Min
            </span>
          )}
        </div>

        {/* Kochstatus + Bewertung */}
        <div className="mt-5 rounded-3xl bg-card border border-ink-100 shadow-card p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={toggleStatus}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                cooked
                  ? 'border border-ink-200 text-ink-700 bg-card'
                  : 'bg-brand-700 text-paper shadow-card active:bg-brand-800'
              }`}
            >
              <Icon name={cooked ? 'sprout' : 'checkCircle'} size={16} strokeWidth={2.2} />
              {cooked ? 'Zurück auf „Zum Ausprobieren“' : 'Als gekocht markieren'}
            </button>
            {recipe.last_cooked_at && (
              <span className="text-xs text-ink-400">Zuletzt gekocht: {formatDate(recipe.last_cooked_at)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-ink-500 mr-1">Bewertung</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => patch({ rating: recipe.rating === s ? null : s })}
                className={`transition active:scale-90 ${recipe.rating >= s ? 'text-amber-500' : 'text-ink-300'}`}
                aria-label={`${s} Sterne`}
              >
                <Icon name="star" size={22} filled={recipe.rating >= s} strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </div>

        {/* Portionsrechner */}
        <div className="mt-4 rounded-3xl bg-card border border-ink-100 shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-2 font-semibold text-ink-900">
              <Icon name="users" size={17} strokeWidth={2} className="text-brand-700" />
              {servings} {servings === 1 ? 'Portion' : 'Portionen'}
            </span>
            <span className="text-xs text-ink-400">{isScaled ? `Original: ${base}` : 'Originalmenge'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="shrink-0 grid place-content-center w-10 h-10 rounded-full border border-ink-200 bg-card text-ink-700 active:bg-ink-100 transition"
              aria-label="Weniger Portionen"
            >
              <Icon name="minus" size={18} strokeWidth={2.4} />
            </button>
            <input
              type="range"
              min="1"
              max={sliderMax}
              step="1"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="flex-1"
              aria-label="Portionen"
            />
            <button
              onClick={() => setServings((s) => Math.min(sliderMax, s + 1))}
              className="shrink-0 grid place-content-center w-10 h-10 rounded-full border border-ink-200 bg-card text-ink-700 active:bg-ink-100 transition"
              aria-label="Mehr Portionen"
            >
              <Icon name="plus" size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Zutaten */}
        <div className="flex items-center justify-between mt-7 mb-3">
          <h2 className="font-display text-xl font-semibold text-ink-900">Zutaten</h2>
          <button
            onClick={addToShoppingList}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 p-1.5 -mr-1.5 rounded-lg active:bg-brand-50"
          >
            <Icon name="cart" size={16} strokeWidth={2} />
            Auf die Einkaufsliste
          </button>
        </div>
        {cartMessage && (
          <p className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-3">
            <Icon name="check" size={16} strokeWidth={2.4} />
            {cartMessage}
          </p>
        )}
        <ul className="rounded-3xl bg-card border border-ink-100 shadow-card divide-y divide-ink-100 overflow-hidden">
          {ingredients.map((ing) => (
            <li key={ing.id}>
              <label className="flex items-center gap-3 px-4 py-3 text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={!!checked[ing.id]}
                  onChange={() => setChecked((c) => ({ ...c, [ing.id]: !c[ing.id] }))}
                />
                <span className={checked[ing.id] ? 'line-through text-ink-400' : ''}>
                  <strong
                    className={`font-semibold ${
                      isScaled && ing.is_scalable && ing.amount !== null ? 'text-brand-700' : 'text-ink-900'
                    }`}
                  >
                    {formatScaled(ing, factor)} {ing.unit ?? ''}
                  </strong>{' '}
                  {ing.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {isScaled && (
          <p className="text-xs text-ink-400 mt-2">
            Mengen umgerechnet auf {servings} {servings === 1 ? 'Portion' : 'Portionen'} und sinnvoll gerundet.
          </p>
        )}

        {/* Zubereitung */}
        <div className="flex items-center justify-between mt-7 mb-3">
          <h2 className="font-display text-xl font-semibold text-ink-900">Zubereitung</h2>
          {(recipe.steps ?? []).length > 0 && (
            <button
              onClick={() => setCooking(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 text-paper text-sm font-semibold px-3.5 py-2 shadow-card transition active:scale-[0.98] active:bg-accent-600"
            >
              <Icon name="flame" size={15} strokeWidth={2.2} />
              Kochmodus
            </button>
          )}
        </div>
        <ol className="space-y-3">
          {(recipe.steps ?? []).map((s) => (
            <li key={s.nr} className="flex gap-3.5 rounded-2xl bg-card border border-ink-100 p-4">
              <span className="shrink-0 grid place-content-center w-8 h-8 rounded-xl bg-brand-700 text-paper text-sm font-bold">
                {s.nr}
              </span>
              <p className="text-ink-700 leading-relaxed pt-1">{s.text}</p>
            </li>
          ))}
        </ol>

        {/* Notizen */}
        <h2 className="font-display text-xl font-semibold text-ink-900 mt-7 mb-3">Meine Notizen</h2>
        <textarea
          rows={3}
          placeholder="z.B. weniger Salz nehmen, Beilage: Reis …"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
          className="w-full rounded-2xl border border-ink-200 bg-card px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 placeholder:text-ink-400"
        />
        {!notesSaved && (
          <button
            onClick={saveNotes}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 p-1.5 -ml-1.5 rounded-lg active:bg-brand-50"
          >
            <Icon name="notebookPen" size={15} strokeWidth={2} />
            Notizen speichern
          </button>
        )}

        {recipe.source_url && (
          <p className="mt-7">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
            >
              <Icon name="externalLink" size={15} strokeWidth={2} />
              Originalquelle öffnen
            </a>
          </p>
        )}

        <div className="mt-10 border-t border-ink-200 pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-ink-700">Wirklich löschen?</span>
              <button
                onClick={async () => { await supabase.from('recipes').delete().eq('id', recipeId); onDeleted() }}
                className="text-sm font-semibold text-accent-600"
              >
                Ja, löschen
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-500">
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-sm text-ink-400"
            >
              <Icon name="trash" size={15} />
              Rezept löschen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
