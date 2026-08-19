// Warengruppen für die Einkaufsliste: sortiert die Artikel so,
// wie man typischerweise durch den Laden läuft.

export const SHOP_GROUPS = [
  { key: 'obst_gemuese', label: 'Obst & Gemüse' },
  { key: 'fleisch_fisch', label: 'Fleisch & Fisch' },
  { key: 'milch_kaese', label: 'Milchprodukte & Eier' },
  { key: 'brot', label: 'Brot & Backwaren' },
  { key: 'vorrat', label: 'Vorräte & Trockenwaren' },
  { key: 'gewuerze', label: 'Gewürze & Öle' },
  { key: 'tiefkuehl', label: 'Tiefkühl' },
  { key: 'getraenke', label: 'Getränke' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

const WORDS = {
  obst_gemuese: [
    'tomate', 'kirschtomate', 'zwiebel', 'knoblauch', 'kartoffel', 'karotte', 'möhre', 'moehre',
    'paprika', 'zucchini', 'aubergine', 'gurke', 'salat', 'spinat', 'brokkoli', 'blumenkohl',
    'kohl', 'lauch', 'porree', 'sellerie', 'pilz', 'champignon', 'apfel', 'banane', 'zitrone',
    'limette', 'orange', 'beere', 'erdbeere', 'himbeere', 'avocado', 'ingwer', 'chili',
    'frühlingszwiebel', 'fruehlingszwiebel', 'kräuter', 'kraeuter', 'petersilie', 'basilikum',
    'koriander', 'dill', 'schnittlauch', 'minze', 'oregano frisch', 'thymian frisch', 'rosmarin frisch',
    'mango', 'birne', 'traube', 'kürbis', 'kuerbis', 'mais', 'bohne grün', 'rucola', 'fenchel', 'rote bete',
  ],
  fleisch_fisch: [
    'hähnchen', 'haehnchen', 'huhn', 'poulet', 'pute', 'rind', 'hack', 'schwein', 'speck',
    'wurst', 'salami', 'schinken', 'lachs', 'fisch', 'thunfisch', 'garnele', 'shrimp',
    'filet', 'steak', 'kotelett', 'lamm', 'ente', 'bacon', 'chorizo',
  ],
  milch_kaese: [
    'milch', 'butter', 'sahne', 'rahm', 'joghurt', 'jogurt', 'quark', 'käse', 'kaese',
    'feta', 'mozzarella', 'parmesan', 'gouda', 'frischkäse', 'frischkaese', 'ei', 'eier',
    'crème fraîche', 'creme fraiche', 'schmand', 'mascarpone', 'ricotta', 'halloumi', 'burrata',
  ],
  brot: ['brot', 'brötchen', 'broetchen', 'baguette', 'toast', 'tortilla', 'wrap', 'fladenbrot', 'ciabatta', 'brioche'],
  vorrat: [
    'mehl', 'zucker', 'reis', 'pasta', 'nudel', 'spaghetti', 'penne', 'linsen', 'kichererbse',
    'bohne', 'dose', 'passierte tomaten', 'tomatenmark', 'kokosmilch', 'brühe', 'bruehe',
    'fond', 'haferflocken', 'honig', 'stärke', 'staerke', 'backpulver', 'hefe', 'vanille',
    'schokolade', 'kakao', 'nuss', 'nüsse', 'nuesse', 'mandel', 'erdnuss', 'sesam', 'couscous',
    'bulgur', 'quinoa', 'panko', 'paniermehl', 'ketchup', 'senf', 'mayonnaise', 'sojasoße', 'sojasosse',
    'sojasauce', 'gochujang', 'sriracha', 'currypaste', 'marmelade', 'sirup', 'datteln',
    'kartoffelstärke', 'kartoffelstaerke', 'maisstärke', 'maisstaerke', 'speisestärke', 'speisestaerke',
    'tomatensoße', 'tomatensosse', 'tomatensauce', 'chilipaste', 'chilisauce', 'chilisoße', 'chilisosse',
  ],
  gewuerze: [
    'salz', 'pfeffer', 'paprikapulver', 'curry', 'kreuzkümmel', 'kreuzkuemmel', 'kumin',
    'zimt', 'muskat', 'kurkuma', 'öl', 'oel', 'olivenöl', 'olivenoel', 'essig', 'oregano',
    'thymian', 'rosmarin', 'lorbeer', 'chiliflocken', 'garam masala', 'sesamöl', 'sesamoel', 'gewürz', 'gewuerz',
  ],
  tiefkuehl: ['tiefkühl', 'tiefkuehl', 'tk-', 'gefroren', 'eis '],
  getraenke: ['wasser', 'saft', 'wein', 'bier', 'reiswein', 'mirin', 'limonade', 'cola'],
}

/** Liefert den Gruppen-Key für einen Artikelnamen.
    Bei mehreren Treffern gewinnt das längste (spezifischste) Stichwort –
    so landet „Kartoffelstärke" im Vorrat und nicht bei den Kartoffeln. */
export function groupForItem(name) {
  const n = String(name ?? '').toLowerCase()
  if (!n.trim()) return 'sonstiges'
  let best = null
  let bestLen = 0
  for (const g of SHOP_GROUPS) {
    const words = WORDS[g.key]
    if (!words) continue
    for (const w of words) {
      if (w.length > bestLen && n.includes(w)) {
        best = g.key
        bestLen = w.length
      }
    }
  }
  return best ?? 'sonstiges'
}

/** Gruppiert Einkaufszeilen zu [{key,label,items}] in Laden-Reihenfolge. */
export function groupItems(items) {
  const buckets = new Map()
  for (const it of items) {
    const key = groupForItem(it.ingredient_name)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(it)
  }
  return SHOP_GROUPS.filter((g) => buckets.has(g.key)).map((g) => ({
    key: g.key,
    label: g.label,
    items: buckets.get(g.key),
  }))
}
