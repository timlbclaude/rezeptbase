// Mengenformatierung-Tests (Fälle aus dem Prüfbericht vom 15.08.2026).
// Ausführen mit:  node tests/amounts.test.mjs
import assert from 'node:assert/strict'
import { formatScaled, formatIngredientAmount, unitForAmount } from '../src/lib/amounts.js'

const ING = (amount, unit, name = 'Zutat', is_scalable = true) => ({ amount, unit, name, is_scalable })

let n = 0
function check(name, fn) { n++; fn(); console.log('  ✓', name) }

console.log('Mengen – Löffel auf ¼-Schritte (Bericht: 0,94 TL / 0,63 TL / 3,75 EL):')
check('0,75 TL × 1,25 → „1 TL" statt „0,94 TL"', () =>
  assert.equal(formatIngredientAmount(ING(0.75, 'TL'), 1.25), '1 TL'))
check('0,5 TL × 1,25 → „¾ TL" statt „0,63 TL"', () =>
  assert.equal(formatIngredientAmount(ING(0.5, 'TL'), 1.25), '¾ TL'))
check('3 EL × 1,25 → „3 ¾ EL"', () =>
  assert.equal(formatIngredientAmount(ING(3, 'EL'), 1.25), '3 ¾ EL'))
check('1,2 EL → deutsches Komma, kein „1.5"', () =>
  assert.ok(!formatIngredientAmount(ING(1.2, 'EL'), 1.25).includes('.')))

console.log('Mengen – zählbare Einheiten:')
check('0,5 Würfel → „1 Würfel" (keine halben Brühwürfel)', () =>
  assert.equal(formatScaled(ING(1, 'Würfel'), 0.5), '1'))
check('3 Zehen bleiben „3 Zehen" (Plural)', () =>
  assert.equal(formatIngredientAmount(ING(2, 'Zehe'), 1.5), '3 Zehen'))
check('1 Zehe bleibt Singular', () =>
  assert.equal(formatIngredientAmount(ING(1, 'Zehe'), 1), '1 Zehe'))
check('2,4 Stück → Bereich „2–3"', () =>
  assert.equal(formatScaled(ING(2, 'Stück'), 1.2), '2–3'))

console.log('Mengen – Gramm/Milliliter und Diverses:')
check('237 g bleiben ganzzahlig', () =>
  assert.equal(formatScaled(ING(190, 'g'), 1.25), '238'))
check('Deutsche Kommas überall (1,5)', () =>
  assert.equal(formatScaled(ING(1.2, 'kg'), 1.25), '1,5'))
check('Ohne Menge → leer', () =>
  assert.equal(formatIngredientAmount(ING(null, 'g'), 2), ''))
check('unitForAmount lässt unbekannte Einheiten unverändert', () =>
  assert.equal(unitForAmount(ING(2, 'EL'), '3'), 'EL'))

console.log(`\nAlle ${n} Tests bestanden.`)
