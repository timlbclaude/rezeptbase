// Suchtests (Fälle aus dem Prüfbericht vom 15.08.2026).
// Ausführen mit:  node tests/search.test.mjs   (keine Abhängigkeiten nötig)
import assert from 'node:assert/strict'
import { buildHaystack, matchesQuery, normalize } from '../src/lib/search.js'

const R = (title, extras = {}) => ({ title, ...extras })

const rezepte = {
  cookie: R('Virales TikTok Cookie-Croissant', {
    category: 'Dessert',
    keywords: ['dessert', 'backen', 'croissant', 'cookies', 'kekse', 'schokolade', 'gebäck'],
    ingredients: [{ name: 'Croissants' }, { name: 'brauner Zucker' }, { name: 'Butter' }, { name: 'Schokoladenstückchen' }],
  }),
  zwiebeln: R('Eingelegte rote Zwiebeln', {
    category: 'Beilage',
    keywords: ['eingelegtes gemüse', 'rote zwiebeln', 'pickles', 'beilage', 'burger-topping'],
    ingredients: [{ name: 'Rote Zwiebeln' }, { name: 'brauner Zucker' }, { name: 'Essig' }],
  }),
  fruehlingspasta: R('Frühlingspasta mit Bundzwiebelsauce', {
    category: 'Hauptgericht',
    keywords: ['teigwaren', 'pasta', 'nudeln', 'frühlingsgericht', 'spargel', 'erbsen'],
    ingredients: [{ name: 'Spaghetti' }, { name: 'Bundzwiebeln' }, { name: 'Sahne' }],
  }),
  marryMe: R('Marry Me Chicken', {
    category: 'Hauptgericht',
    keywords: ['hähnchen', 'poulet', 'cremig'],
    ingredients: [{ name: 'Hähnchenbrust' }, { name: 'Hühnerbrühe' }, { name: 'Sahne' }],
  }),
  kfc: R('Koreanisches Fried Chicken', {
    category: 'Hauptgericht',
    description: 'Knusprig frittiert mit süß-scharfer Sauce',
    keywords: ['hähnchen', 'poulet', 'koreanisch', 'scharf'],
    ingredients: [{ name: 'Hähnchenflügel' }, { name: 'Gochujang' }],
  }),
  spaghetti: R('Spaghetti al limone', {
    category: 'Hauptgericht',
    keywords: ['teigwaren', 'pasta', 'zitrone', 'vegetarisch'],
    ingredients: [{ name: 'Spaghetti' }, { name: 'Zitrone' }, { name: 'Parmesan' }],
  }),
  hoernli: R('Hörnlisalat', {
    category: 'Hauptgericht',
    keywords: ['teigwaren', 'nudeln', 'pasta', 'hörnli', 'salat', 'nudelsalat', 'schweizerisch'],
    ingredients: [{ name: 'Hörnli' }, { name: 'Mayonnaise' }],
  }),
}

const hay = Object.fromEntries(Object.entries(rezepte).map(([k, r]) => [k, buildHaystack(r)]))
const treffer = (q) => Object.keys(rezepte).filter((k) => matchesQuery(hay[k], q))

let n = 0
function check(name, fn) {
  n++
  fn()
  console.log('  ✓', name)
}

console.log('Suche – Regressionsfälle aus dem Prüfbericht:')

check('„Hähnchen" trifft KEIN Dessert (Cookie-Croissant)', () =>
  assert.ok(!treffer('Hähnchen').includes('cookie')))
check('„Hähnchen" trifft KEINE eingelegten Zwiebeln', () =>
  assert.ok(!treffer('Hähnchen').includes('zwiebeln')))
check('„Hähnchen" trifft NICHT die Frühlingspasta', () =>
  assert.ok(!treffer('Hähnchen').includes('fruehlingspasta')))
check('„Hähnchen" findet Marry Me Chicken', () =>
  assert.ok(treffer('Hähnchen').includes('marryMe')))
check('„Poulet" findet Marry Me Chicken (Synonym)', () =>
  assert.ok(treffer('Poulet').includes('marryMe')))
check('„Chicken" findet Marry Me Chicken (Titel)', () =>
  assert.ok(treffer('Chicken').includes('marryMe')))

console.log('Suche – Oberbegriffe und Synonyme:')

check('„Teigwaren" findet alle Teigwaren-Gerichte', () =>
  assert.deepEqual(treffer('Teigwaren').sort(), ['fruehlingspasta', 'hoernli', 'spaghetti'].sort()))
check('„Pasta" findet alle Teigwaren-Gerichte', () =>
  assert.deepEqual(treffer('Pasta').sort(), ['fruehlingspasta', 'hoernli', 'spaghetti'].sort()))
check('„Nudeln" findet auch den Hörnlisalat (Keyword)', () =>
  assert.ok(treffer('Nudeln').includes('hoernli')))
check('„Salat" findet den Hörnlisalat (Wortteil im Titel)', () =>
  assert.ok(treffer('Salat').includes('hoernli')))

console.log('Suche – Tippfehler und Umlaute:')

check('„Spägetti" findet Spaghetti al limone', () =>
  assert.ok(treffer('Spägetti').includes('spaghetti')))
check('„Spägetti" liefert keine falschen Zusatztreffer', () =>
  assert.ok(!treffer('Spägetti').includes('cookie') && !treffer('Spägetti').includes('zwiebeln')))
check('„hörnli" und „hoernli"-Normalisierung', () =>
  assert.equal(normalize('Hörnli'), 'hornli'))

console.log('Suche – Mehrwort (UND-Logik) und Leerfälle:')

check('„hähnchen cremig" findet nur Marry Me Chicken', () =>
  assert.deepEqual(treffer('hähnchen cremig'), ['marryMe']))
check('„hähnchen dessert" findet NICHTS', () =>
  assert.deepEqual(treffer('hähnchen dessert'), []))
check('„dessert" matcht kein Hauptgericht mit süß-scharfer Sauce', () =>
  assert.ok(!treffer('dessert').includes('kfc')))
check('„dessert" findet das Cookie-Croissant', () =>
  assert.ok(treffer('dessert').includes('cookie')))
check('„hähnchen scharf" findet das Korean Fried Chicken', () =>
  assert.ok(treffer('hähnchen scharf').includes('kfc')))
check('„xyz123" findet nichts', () =>
  assert.deepEqual(treffer('xyz123'), []))

console.log(`\nAlle ${n} Tests bestanden.`)
