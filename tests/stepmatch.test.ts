// Tests für die Schritt-Zutaten-Verknüpfung im Kochmodus.
// Ausführen: node tests/stepmatch.test.ts
import assert from 'node:assert/strict'
import { stepIngredients } from '../src/lib/stepMatch.ts'

let n = 0
function test(name: string, fn: () => void) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

const INGS = [
  { id: 1, name: 'Hähnchen (ganzes)' },
  { id: 2, name: 'Reiswein' },
  { id: 3, name: 'schwarzer Pfeffer (gemahlen)' },
  { id: 4, name: 'Kartoffelstärke (oder Maisstärke)' },
]

console.log('Kochmodus – Schritt-Zutaten:')

test('Dezimalkommas zerreißen keine Segmente (0,5 / 1,5)', () => {
  const r = stepIngredients({ text: '', zutaten: '1,5 kg Hähnchen, Reiswein, 0,5 TL schwarzer Pfeffer' }, INGS)!
  assert.equal(r.length, 3)
  // keine nackten Ziffern-Segmente wie „1" oder „0"
  assert.ok(r.every(({ seg }) => /[a-zäöü]/i.test(seg)))
})

test('Zutaten werden den echten Einträgen zugeordnet', () => {
  const r = stepIngredients({ text: '', zutaten: '1,5 kg Hähnchen, Reiswein und Kartoffelstärke' }, INGS)!
  assert.equal(r[0].match?.id, 1)
  assert.equal(r[1].match?.id, 2)
  assert.equal(r[2].match?.id, 4)
})

test('Unbekannte Segmente bleiben als Text erhalten', () => {
  const r = stepIngredients({ text: '', zutaten: 'Zauberpulver, Reiswein' }, INGS)!
  assert.equal(r[0].match, undefined)
  assert.equal(r[0].seg, 'Zauberpulver')
  assert.equal(r[1].match?.id, 2)
})

test('Schritt ohne zutaten-Feld → null', () => {
  assert.equal(stepIngredients({ text: 'nur Text' }, INGS), null)
})

console.log(`\nAlle ${n} Tests bestanden.`)
