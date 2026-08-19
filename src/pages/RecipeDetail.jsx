import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { runWrite } from '../lib/mutate.js'
import { notify } from '../lib/notify.js'
import { READ_ONLY_MSG } from '../lib/roles.js'
import { onImgError } from '../lib/imageFallback.js'
import Icon from '../components/Icon.jsx'
import CookMode from '../components/CookMode.jsx'
import ImportPage from './ImportPage.jsx'

// Mengenformatierung zentral in lib/amounts.js (überall dieselben Zahlen)
import { formatScaled, formatIngredientAmount } from '../lib/amounts.js'

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const SEGMENTS = [
  { key: 'zutaten', label: 'Zutaten' },
  { key: 'schritte', label: 'Schritte' },
  { key: 'notizen', label: 'Notizen' },
]

export default function RecipeDetail({ recipeId, onBack, onDeleted, readOnly = false }) {
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checked, setChecked] = useState({})
  const [servings, setServings] = useState(4)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const [notesJustSaved, setNotesJustSaved] = useState(false)
  const [cartMessage, setCartMessage] = useState(null)
  const [cooking, setCooking] = useState(false)
  const [seg, setSeg] = useState('zutaten')
  const [editing, setEditing] = useState(false)
  const [shareMsg, setShareMsg] = useState(null)

  const loadData = useCallback(() => {
    return Promise.all([
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

  useEffect(() => {
    loadData()
  }, [loadData])

  // Optimistisch anzeigen, aber bei Server-Fehler vollständig zurückrollen.
  async function patch(fields) {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return false }
    const prev = recipe
    setRecipe((r) => ({ ...r, ...fields }))
    const { ok } = await runWrite(supabase.from('recipes').update(fields).eq('id', recipeId))
    if (!ok) setRecipe(prev)
    return ok
  }

  async function toggleStatus() {
    if (recipe.status === 'gekocht') {
      await patch({ status: 'zum_ausprobieren' })
    } else {
      await patch({ status: 'gekocht', last_cooked_at: new Date().toISOString().slice(0, 10) })
    }
  }

  async function markCooked() {
    await patch({ status: 'gekocht', last_cooked_at: new Date().toISOString().slice(0, 10) })
  }

  async function saveNotes() {
    const ok = await patch({ notes: notes.trim() || null })
    if (!ok) return // Eingabe bleibt erhalten, Fehler kam als Toast
    setNotesSaved(true)
    setNotesJustSaved(true)
    setTimeout(() => setNotesJustSaved(false), 3000)
  }

  async function addToShoppingList() {
    if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
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
      let res
      if (match) {
        res = await runWrite(
          supabase
            .from('shopping_list')
            .update({ amount: Math.round((Number(match.amount) + amount) * 100) / 100 })
            .eq('id', match.id),
        )
        if (res.ok) match.amount = Number(match.amount) + amount
      } else {
        res = await runWrite(
          supabase.from('shopping_list').insert({
            ingredient_name: ing.name,
            amount,
            unit: ing.unit ?? null,
            source_recipe_id: recipeId,
          }),
        )
      }
      if (!res.ok) { setCartMessage(null); return } // Fehler kam als Toast
      added++
    }
    setCartMessage(`${added} Zutaten (für ${servings} Portionen) auf der Einkaufsliste`)
    setTimeout(() => setCartMessage(null), 3500)
  }

  async function shareRecipe() {
    const lines = [recipe.title]
    if (recipe.description) lines.push(recipe.description)
    lines.push('', `Zutaten (für ${servings} ${servings === 1 ? 'Portion' : 'Portionen'}):`)
    for (const ing of ingredients) {
      lines.push('• ' + [formatIngredientAmount(ing, servings / (recipe.base_servings || 4)), ing.name].filter(Boolean).join(' '))
    }
    const stepList = recipe.steps ?? []
    if (stepList.length) {
      lines.push('', 'Zubereitung:')
      stepList.forEach((s, i) => lines.push(`${i + 1}. ${typeof s === 'string' ? s : s.text}`))
    }
    if (recipe.source_url) lines.push('', `Quelle: ${recipe.source_url}`)
    const text = lines.join('\n')
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, text })
      } catch { /* vom Nutzer abgebrochen */ }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareMsg('Rezept in die Zwischenablage kopiert.')
    } catch {
      setShareMsg('Teilen wird auf diesem Gerät nicht unterstützt.')
    }
    setTimeout(() => setShareMsg(null), 3500)
  }

  if (editing && recipe) {
    return (
      <ImportPage
        readOnly={readOnly}
        editRecipe={{ recipe, ingredients }}
        onCancel={() => setEditing(false)}
        onDone={() => { setEditing(false); setLoading(true); loadData() }}
      />
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="skeleton rounded-[20px]" style={{ height: 246 }} />
        <div className="mt-5 space-y-3">
          <div className="skeleton h-7 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton h-28 rounded-[16px]" />
        </div>
      </div>
    )
  }
  if (!recipe) {
    return <p className="text-ink-3 text-center py-16">Rezept nicht gefunden.</p>
  }

  const time = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  const base = recipe.base_servings || 4
  const factor = servings / base
  const isScaled = servings !== base
  const cooked = recipe.status === 'gekocht'
  const steps = recipe.steps ?? []
  const meta = [recipe.category, recipe.cuisine, time > 0 ? `${time} Min` : 'Zeit n. a.', recipe.rating ? `★ ${recipe.rating},0` : null]
    .filter(Boolean).join(' · ')

  const cardCls = 'bg-card rounded-[16px] shadow-card'

  return (
    <div className="mx-auto max-w-2xl animate-rise" style={{ paddingBottom: 110 }}>
      {cooking && (
        <CookMode
          recipe={recipe}
          ingredients={ingredients}
          servings={servings}
          formatAmount={(ing) => formatIngredientAmount(ing, factor)}
          onMarkCooked={markCooked}
          onClose={() => setCooking(false)}
        />
      )}

      {/* Hero als Inset-Karte */}
      <div className="relative mx-4 mt-4 rounded-[20px] overflow-hidden" style={{ height: recipe.video_embed_url ? undefined : 246 }}>
        {recipe.video_embed_url ? (
          <div className="aspect-video w-full bg-ink">
            <iframe
              src={recipe.video_embed_url}
              title="Video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} onError={onImgError} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-content-center bg-fill text-ink-3">
            <Icon name="utensils" size={34} strokeWidth={1.5} />
          </div>
        )}
        <button
          onClick={onBack}
          className="absolute top-3 left-3 grid place-content-center w-[34px] h-[34px] rounded-full text-ink active:scale-95 transition"
          style={{ background: 'var(--color-overlay-btn)' }}
          aria-label="Zurück"
        >
          <Icon name="arrowLeft" size={17} strokeWidth={2.2} />
        </button>
        <button
          onClick={() => patch({ is_favorite: !recipe.is_favorite })}
          className="absolute top-3 right-3 grid place-content-center w-[34px] h-[34px] rounded-full text-love active:scale-95 transition"
          style={{ background: 'var(--color-overlay-btn)', opacity: readOnly ? 0.5 : undefined }}
          aria-disabled={readOnly}
          aria-label="Favorit"
        >
          <Icon name="heart" size={17} filled={recipe.is_favorite} strokeWidth={2} />
        </button>
        <span
          className="absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-ink-2"
          style={{ background: 'var(--color-overlay-btn)' }}
        >
          {cooked ? 'Gekocht' : 'Zum Ausprobieren'}
        </span>
      </div>

      <div className="px-4 pt-4">
        <h1 className="text-[26px] font-bold text-ink leading-tight">{recipe.title}</h1>
        {meta && <p className="text-[14px] text-ink-3 mt-1">{meta}</p>}
        {recipe.description && <p className="text-[14.5px] text-ink-2 mt-2 leading-relaxed">{recipe.description}</p>}

        {/* Segmented Control */}
        <div className="flex bg-fill rounded-[10px] p-0.5 mt-4">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              className={`flex-1 rounded-[8px] py-1.5 text-[13.5px] font-semibold transition ${
                seg === s.key ? 'bg-card text-ink' : 'text-ink-2'
              }`}
              style={seg === s.key ? { boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ---- Tab: Zutaten ---- */}
        {seg === 'zutaten' && (
          <div className="mt-4 space-y-3">
            {/* Portionen-Karte mit Stepper */}
            <div className={`${cardCls} rounded-[14px] flex items-center justify-between px-4 py-3`}>
              <div>
                <p className="text-[15.5px] font-semibold text-ink">Portionen</p>
                <p className="text-[12px] text-ink-3 mt-0.5">
                  {isScaled ? `Original: ${base} — Mengen umgerechnet` : 'Originalmenge'}
                </p>
              </div>
              <div className="flex items-center bg-fill rounded-[9px] overflow-hidden">
                <button
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                  className="px-3.5 py-2 text-ink-2 active:bg-black/5"
                  aria-label="Weniger Portionen"
                >
                  <Icon name="minus" size={15} strokeWidth={2.4} />
                </button>
                <span className="w-px self-stretch my-1.5" style={{ background: 'var(--color-separator)' }} />
                <span className="px-3 text-[15px] font-bold text-tint min-w-8 text-center">{servings}</span>
                <span className="w-px self-stretch my-1.5" style={{ background: 'var(--color-separator)' }} />
                <button
                  onClick={() => setServings((s) => Math.min(24, s + 1))}
                  className="px-3.5 py-2 text-ink-2 active:bg-black/5"
                  aria-label="Mehr Portionen"
                >
                  <Icon name="plus" size={15} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            {/* Zutaten-Karte */}
            <div className={`${cardCls} overflow-hidden`}>
              {ingredients.map((ing, i) => (
                <button
                  key={ing.id}
                  onClick={() => setChecked((c) => ({ ...c, [ing.id]: !c[ing.id] }))}
                  className="relative w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-black/[0.03] transition"
                >
                  <span className={`text-[15.5px] ${checked[ing.id] ? 'line-through text-ink-4' : 'text-ink'}`}>
                    {ing.name}
                  </span>
                  <span
                    className={`shrink-0 text-[15px] ${
                      checked[ing.id]
                        ? 'line-through text-ink-4'
                        : isScaled && ing.is_scalable && ing.amount !== null
                          ? 'text-tint font-semibold'
                          : 'text-ink-3'
                    }`}
                  >
                    {formatIngredientAmount(ing, factor)}
                  </span>
                  {i < ingredients.length - 1 && (
                    <span className="absolute bottom-0 left-4 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
                  )}
                </button>
              ))}
              <button
                onClick={addToShoppingList}
                className="w-full flex items-center gap-2 px-4 py-3.5 text-[15px] font-semibold text-tint active:bg-black/[0.03] transition"
                style={{ boxShadow: 'inset 0 0.5px 0 var(--color-separator)' }}
              >
                <Icon name="bag" size={16} strokeWidth={2} />
                Alles auf die Einkaufsliste
              </button>
            </div>
            {cartMessage && (
              <p className="flex items-center gap-2 rounded-[12px] bg-tint-soft px-4 py-3 text-[13.5px] font-medium text-tint">
                <Icon name="check" size={15} strokeWidth={2.6} />
                {cartMessage}
              </p>
            )}
          </div>
        )}

        {/* ---- Tab: Schritte ---- */}
        {seg === 'schritte' && (
          <div className={`${cardCls} mt-4 overflow-hidden`}>
            {steps.length === 0 && <p className="px-4 py-4 text-[14px] text-ink-3">Keine Schritte hinterlegt.</p>}
            {steps.map((s, i) => (
              <div key={s.nr ?? i} className="relative flex gap-3.5 px-4 py-3.5">
                <span className="shrink-0 grid place-content-center w-[26px] h-[26px] rounded-full bg-fill text-[13px] font-bold text-ink-2">
                  {s.nr ?? i + 1}
                </span>
                <p className="text-[14.5px] text-ink-2 pt-0.5" style={{ lineHeight: 1.45 }}>{s.text}</p>
                {i < steps.length - 1 && (
                  <span className="absolute bottom-0 left-4 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ---- Tab: Notizen ---- */}
        {seg === 'notizen' && (
          <div className="mt-4 space-y-3">
            <div className={`${cardCls} rounded-[14px] px-4 py-3.5 flex items-center justify-between`}>
              <span className="text-[15.5px] font-semibold text-ink">Bewertung</span>
              <span className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => patch({ rating: recipe.rating === s ? null : s })}
                    className="active:scale-90 transition"
                    style={{ color: recipe.rating >= s ? 'var(--color-star)' : 'var(--color-line)', opacity: readOnly ? 0.5 : undefined }}
                    aria-disabled={readOnly}
                    aria-label={`${s} Sterne`}
                  >
                    <Icon name="star" size={26} filled={recipe.rating >= s} strokeWidth={1.7} />
                  </button>
                ))}
              </span>
            </div>

            <div className={`${cardCls} rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap`}>
              <div>
                <p className="text-[15.5px] font-semibold text-ink">{cooked ? 'Gekocht' : 'Zum Ausprobieren'}</p>
                <p className="text-[12.5px] text-ink-3 mt-0.5">
                  {recipe.last_cooked_at ? `Zuletzt gekocht: ${formatDate(recipe.last_cooked_at)}` : 'Noch nicht gekocht'}
                </p>
              </div>
              <button
                onClick={toggleStatus}
                className="rounded-full bg-fill px-4 py-2 text-[13.5px] font-semibold text-ink-2 active:opacity-80 transition"
              >
                {cooked ? 'Zurücksetzen' : 'Als gekocht markieren'}
              </button>
            </div>

            <div>
              <textarea
                rows={4}
                readOnly={readOnly}
                placeholder={readOnly ? 'Notizen (nur Leserechte)' : 'z.B. weniger Salz nehmen, Beilage: Reis …'}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
                className={`${cardCls} rounded-[14px] w-full px-4 py-3.5 text-[15px] outline-none border border-transparent focus:border-tint focus:ring-4 focus:ring-tint-soft placeholder:text-ink-3`}
              />
              {!notesSaved && (
                <button
                  onClick={saveNotes}
                  className="mt-2 rounded-full bg-tint px-4 py-2 text-[13.5px] font-semibold text-white active:bg-tint-dark transition"
                >
                  Notizen speichern
                </button>
              )}
              {notesSaved && notesJustSaved && (
                <p className="mt-2 text-[13.5px] font-medium text-tint">Gespeichert.</p>
              )}
            </div>

            {/* Aktionen */}
            <div className={`${cardCls} overflow-hidden`}>
              <button
                onClick={() => (readOnly ? notify(READ_ONLY_MSG, 'info') : setEditing(true))}
                className="relative w-full flex items-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold text-tint active:bg-black/[0.03] transition"
                style={{ opacity: readOnly ? 0.5 : undefined }}
                aria-disabled={readOnly}
              >
                <Icon name="edit" size={16} strokeWidth={2} />
                Rezept bearbeiten
                <span className="absolute bottom-0 left-4 right-0 pointer-events-none" style={{ height: 0.5, background: 'var(--color-separator)' }} />
              </button>
              <button
                onClick={shareRecipe}
                className="w-full flex items-center gap-2.5 px-4 py-3.5 text-[15px] font-semibold text-tint active:bg-black/[0.03] transition"
              >
                <Icon name="share" size={16} strokeWidth={2} />
                Rezept teilen
              </button>
            </div>
            {shareMsg && (
              <p className="flex items-center gap-2 rounded-[12px] bg-tint-soft px-4 py-3 text-[13.5px] font-medium text-tint">
                <Icon name="check" size={15} strokeWidth={2.6} />
                {shareMsg}
              </p>
            )}

            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-tint pt-1"
              >
                <Icon name="externalLink" size={15} strokeWidth={2} />
                Originalquelle öffnen
              </a>
            )}

            <div className="pt-3">
              {confirmDelete ? (
                <span className="text-[14px] text-ink-2">
                  Wirklich löschen?{' '}
                  <button
                    onClick={async () => {
                      if (readOnly) { notify(READ_ONLY_MSG, 'info'); return }
                      const { ok } = await runWrite(supabase.from('recipes').delete().eq('id', recipeId))
                      if (ok) onDeleted()
                    }}
                    className="font-semibold text-love"
                  >
                    Ja, löschen
                  </button>{' '}
                  <button onClick={() => setConfirmDelete(false)} className="text-ink-3">Abbrechen</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-[14px] text-ink-3">
                  Rezept löschen
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixe CTA-Leiste */}
      {steps.length > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-10"
          style={{
            background: 'linear-gradient(to top, var(--color-bg) 60%, transparent)',
            padding: '12px 16px max(28px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => setCooking(true)}
              className="w-full h-[52px] rounded-[14px] bg-tint text-white text-[16.5px] font-semibold flex items-center justify-center gap-2 active:bg-tint-dark active:scale-[0.99] transition"
            >
              <Icon name="flame" size={18} strokeWidth={2} />
              Kochmodus starten
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
