import { normalize } from './search.js'

// Ordnet die Text-Zutatenhinweise eines Schritts den echten Zutaten zu,
// damit im Kochmodus dieselben (skalierten, formatierten) Mengen stehen
// wie in der Zutatenliste – statt der rohen Original-Textmengen.
export function stepIngredients(step, ingredients) {
  if (!step?.zutaten) return null
  // Nicht am Dezimalkomma splitten („0,5 TL“, „1,5 kg“) und
  // rein numerische Rest-Segmente aussortieren.
  const segs = String(step.zutaten)
    .split(/;|,(?!\d)|\sund\s/)
    .map((s) => s.trim())
    .filter((s) => s && /[a-zäöüA-ZÄÖÜ]/.test(s))
  return segs.map((seg) => {
    const nseg = normalize(seg)
    const core = nseg.replace(/^[\d.,\s½¼¾/–-]+[a-z.]{0,12}\s*/, '')
    const match = ingredients.find((ing) => {
      const n = normalize(ing.name ?? '')
      return n.length >= 3 && (nseg.includes(n) || (core.length >= 3 && n.includes(core)))
    })
    return { seg, match }
  })
}
