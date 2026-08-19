// Tests für die Warengruppen-Sortierung der Einkaufsliste.
// Ausführen: node tests/shopgroups.test.mjs
import assert from 'node:assert/strict'
import { groupForItem, groupItems, SHOP_GROUPS } from '../src/lib/shopGroups.js'

let n = 0
function test(name, fn) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('Warengruppen – Zuordnung:')

test('Gemüse und Obst', () => {
  assert.equal(groupForItem('Kirschtomaten'), 'obst_gemuese')
  assert.equal(groupForItem('Knoblauchzehen'), 'obst_gemuese')
  assert.equal(groupForItem('Frühlingszwiebel (fein gehackt)'), 'obst_gemuese')
})

test('Fleisch, Milchprodukte, Vorräte', () => {
  assert.equal(groupForItem('Hähnchen (ganzes)'), 'fleisch_fisch')
  assert.equal(groupForItem('Feta-Käse'), 'milch_kaese')
  assert.equal(groupForItem('Getrocknete Pasta'), 'vorrat')
  assert.equal(groupForItem('Sojasoße'), 'vorrat')
})

test('Gewürze & Öle', () => {
  assert.equal(groupForItem('Olivenöl extra vergine'), 'gewuerze')
  assert.equal(groupForItem('Schwarzer Pfeffer'), 'gewuerze')
})

test('Längster Treffer gewinnt (Stärke, Ketchup, Chilipaste → Vorrat)', () => {
  assert.equal(groupForItem('Kartoffelstärke (oder Maisstärke)'), 'vorrat')
  assert.equal(groupForItem('Tomatensoße (Ketchup)'), 'vorrat')
  assert.equal(groupForItem('Gochujang (koreanische Chilipaste)'), 'vorrat')
  // aber echte Kartoffeln/Tomaten bleiben beim Gemüse
  assert.equal(groupForItem('Kartoffeln, festkochend'), 'obst_gemuese')
  assert.equal(groupForItem('Tomaten'), 'obst_gemuese')
})

test('Unbekanntes → Sonstiges', () => {
  assert.equal(groupForItem('Bambusdämpfer'), 'sonstiges')
  assert.equal(groupForItem(''), 'sonstiges')
  assert.equal(groupForItem(null), 'sonstiges')
})

console.log('Warengruppen – Gruppierung:')

test('Gruppen kommen in Laden-Reihenfolge, leere entfallen', () => {
  const items = [
    { id: 1, ingredient_name: 'Sojasoße' },
    { id: 2, ingredient_name: 'Kirschtomaten' },
    { id: 3, ingredient_name: 'Feta-Käse' },
    { id: 4, ingredient_name: 'Zwiebeln' },
  ]
  const gs = groupItems(items)
  assert.deepEqual(gs.map((g) => g.key), ['obst_gemuese', 'milch_kaese', 'vorrat'])
  assert.deepEqual(gs[0].items.map((i) => i.id), [2, 4])
})

test('Jeder Gruppen-Key hat ein Label', () => {
  for (const g of SHOP_GROUPS) assert.ok(g.label.length > 2)
})

console.log(`\nAlle ${n} Tests bestanden.`)
