// Tests für das Hash-Routing (Deep Links, Filter in der URL).
// Ausführen: node tests/route.test.mjs
import assert from 'node:assert/strict'
import { parseHash, buildListHash } from '../src/lib/route.js'

let n = 0
function test(name, fn) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('Routing – parseHash:')

test('Rezept-Deep-Link', () => {
  assert.deepEqual(parseHash('#/rezept/abc-123').screen, { name: 'detail', id: 'abc-123' })
})

test('Import und Einkauf', () => {
  assert.deepEqual(parseHash('#/import').screen, { name: 'import' })
  assert.equal(parseHash('#/einkauf').tab, 'einkauf')
})

test('Leerer Hash → Standard-Liste', () => {
  const l = parseHash('').list
  assert.equal(l.q, '')
  assert.equal(l.filter, 'alle')
  assert.equal(l.sort, 'neueste')
  assert.equal(l.fav, false)
  assert.equal(l.collection, null)
})

test('Liste mit allen Parametern', () => {
  const l = parseHash('#/?q=h%C3%A4hnchen+scharf&status=gekocht&kat=Hauptgericht&sort=titel&fav=1&slg=c1').list
  assert.equal(l.q, 'hähnchen scharf')
  assert.equal(l.filter, 'gekocht')
  assert.equal(l.cat, 'Hauptgericht')
  assert.equal(l.sort, 'titel')
  assert.equal(l.fav, true)
  assert.equal(l.collection, 'c1')
})

console.log('Routing – buildListHash:')

test('Standard → #/', () => {
  assert.equal(buildListHash('', 'alle', null, 'neueste', false, null), '#/')
})

test('Roundtrip: build → parse ergibt denselben Zustand', () => {
  const h = buildListHash('pasta', 'gekocht', 'Hauptgericht', 'titel', true, 'coll-9')
  const l = parseHash(h).list
  assert.equal(l.q, 'pasta')
  assert.equal(l.filter, 'gekocht')
  assert.equal(l.cat, 'Hauptgericht')
  assert.equal(l.sort, 'titel')
  assert.equal(l.fav, true)
  assert.equal(l.collection, 'coll-9')
})

test('Umlaute und Leerzeichen überleben den Roundtrip', () => {
  const h = buildListHash('süß-scharfe Soße', 'alle', null, 'neueste', false, null)
  assert.equal(parseHash(h).list.q, 'süß-scharfe Soße')
})

console.log(`\nAlle ${n} Tests bestanden.`)
