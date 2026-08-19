// Zentrale, küchentaugliche Mengenformatierung (deutsch).
// Wird von Detailansicht, Kochmodus und Einkaufsliste gemeinsam genutzt,
// damit überall dieselben Zahlen stehen.

// Einheiten, die man nicht sinnvoll in Bruchteilen abmessen kann
const COUNTABLE_UNITS = ['stück', 'zehe', 'zehen', 'bund', 'dose', 'dosen', 'scheibe', 'scheiben', 'stängel', 'blatt', 'blätter', 'packung', 'päckchen', 'würfel']
const COUNTABLE_NAMES = ['ei', 'eier', 'zwiebel', 'knoblauchzehe', 'zitrone', 'limette']

// Löffel-Einheiten: auf ¼-Schritte runden
const SPOON_UNITS = ['tl', 'el', 'teelöffel', 'esslöffel', 'msp']

// Singular → Plural je Einheit (nur wo sich das Wort ändert)
const PLURALS = {
  zehe: 'Zehen', dose: 'Dosen', scheibe: 'Scheiben', blatt: 'Blätter',
  packung: 'Packungen', flasche: 'Flaschen', tasse: 'Tassen', prise: 'Prisen',
  handvoll: 'Handvoll', stange: 'Stangen', knolle: 'Knollen', kopf: 'Köpfe',
}
const SINGULARS = {
  zehen: 'Zehe', dosen: 'Dose', scheiben: 'Scheibe', blätter: 'Blatt',
  packungen: 'Packung', flaschen: 'Flasche', tassen: 'Tasse', prisen: 'Prise',
  stangen: 'Stange', knollen: 'Knolle', köpfe: 'Kopf',
}

export function isCountable(ing) {
  const unit = (ing.unit ?? '').toLowerCase().trim()
  const name = (ing.name ?? '').toLowerCase()
  if (COUNTABLE_UNITS.includes(unit)) return true
  if (!unit && COUNTABLE_NAMES.some((n) => name.startsWith(n))) return true
  return false
}

// Zahl deutsch formatieren (Komma statt Punkt)
export function formatNumber(n) {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// Skalierte Menge einer Zutat als String („1,5", „2–3", „¾" …)
export function formatScaled(ing, factor) {
  if (ing.amount === null || ing.amount === undefined) return ''
  if (!ing.is_scalable) return formatNumber(Number(ing.amount))

  const n = Number(ing.amount) * factor
  if (n <= 0) return ''

  if (isCountable(ing)) {
    const nearest = Math.round(n)
    if (Math.abs(n - nearest) <= 0.15 && nearest >= 1) return String(nearest)
    if (n < 1) return '1' // „0,5 Brühwürfel" gibt es in der Küche nicht
    const lo = Math.max(1, Math.floor(n))
    const hi = Math.ceil(n)
    return lo === hi ? String(lo) : `${lo}–${hi}`
  }

  const unit = (ing.unit ?? '').toLowerCase().trim()
  if (SPOON_UNITS.includes(unit)) {
    // ¼-Schritte, hübsch als Bruch angezeigt
    const q = Math.max(1, Math.round(n * 4)) / 4
    const whole = Math.floor(q)
    const frac = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[Math.round((q - whole) * 100) / 100]
    if (!frac) return String(whole)
    return whole === 0 ? frac : `${whole} ${frac}`
  }

  if (n >= 100) return String(Math.round(n))
  if (n >= 10) return formatNumber(Math.round(n * 2) / 2)
  if (n >= 1) return formatNumber(Math.round(n * 4) / 4)
  return formatNumber(Math.round(n * 100) / 100)
}

// Einheit passend zur Menge (Singular/Plural): „1 Zehe" / „3 Zehen"
export function unitForAmount(ing, amountStr) {
  const unit = (ing.unit ?? '').trim()
  if (!unit) return ''
  const key = unit.toLowerCase()
  // Menge > 1? (auch „2–3" und „1 ½" zählen als Mehrzahl)
  const firstNum = parseFloat(String(amountStr).replace(',', '.'))
  const isPlural = String(amountStr).includes('–') || String(amountStr).includes(' ') || (Number.isFinite(firstNum) && firstNum > 1)
  if (isPlural && PLURALS[key]) return PLURALS[key]
  if (!isPlural && SINGULARS[key]) return SINGULARS[key]
  return unit
}

// Komplette Mengenangabe: „1,5 EL", „3 Zehen", „" wenn keine Menge
export function formatIngredientAmount(ing, factor) {
  const amount = formatScaled(ing, factor)
  if (!amount) return '' // ohne Menge keine nackte Einheit anzeigen
  const unit = unitForAmount(ing, amount)
  return [amount, unit].filter(Boolean).join(' ')
}
