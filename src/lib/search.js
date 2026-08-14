// Intelligente Suche: Normalisierung (Umlaute, Akzente), Basis-Lexikon
// mit Oberbegriffen/Synonymen und Mehrwort-Logik (alle Wörter müssen passen).
// Die KI-Schlagworte je Rezept (recipes.keywords) sind die Hauptquelle,
// das Lexikon hier ist das Sicherheitsnetz für Oberbegriffe.

const GROUPS = [
  ['teigwaren', 'pasta', 'nudel', 'nudeln', 'spaghetti', 'hornli', 'rigatoni', 'penne', 'tortiglioni', 'makkaroni', 'maccheroni', 'tagliatelle', 'lasagne', 'manti', 'spatzli', 'ravioli', 'tortellini', 'fusilli', 'linguine', 'orecchiette', 'gnocchi'],
  ['geflugel', 'hahnchen', 'huhn', 'huhner', 'poulet', 'chicken', 'pute', 'truthahn'],
  ['rind', 'rindfleisch', 'beef', 'steak', 'entrecote'],
  ['hackfleisch', 'hack', 'gehacktes', 'faschiertes', 'hackballchen', 'kofte', 'kafta'],
  ['schwein', 'schweinefleisch', 'pork', 'speck', 'schinken'],
  ['fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'dorsch'],
  ['meeresfruchte', 'garnelen', 'crevetten', 'shrimps', 'scampi'],
  ['kase', 'cheese', 'mozzarella', 'burrata', 'feta', 'parmesan', 'sbrinz', 'cheddar'],
  ['reis', 'risotto', 'basmati'],
  ['kartoffel', 'kartoffeln', 'pommes', 'rosti'],
  ['suss', 'susses', 'dessert', 'nachtisch', 'kuchen', 'sussspeise'],
  ['scharf', 'chili', 'spicy', 'peperoni', 'jalapeno'],
  ['vegetarisch', 'vegi', 'veggie', 'fleischlos'],
  ['salat', 'salad', 'bowl'],
  ['suppe', 'soup', 'eintopf'],
  ['wrap', 'taco', 'tacos', 'tortilla', 'fladenbrot', 'burrito'],
  ['ofen', 'backofen', 'blech', 'gratin', 'uberbacken'],
  ['grill', 'gegrillt', 'gegrilltes', 'bbq', 'barbecue'],
]

// Kleinbuchstaben, Umlaute/Akzente vereinheitlichen (ä→a, é→e, ß→ss)
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Alle Suchvarianten eines Wortes: das Wort selbst + Lexikon-Gruppenmitglieder
function variants(word) {
  const n = normalize(word)
  const set = new Set([n])
  for (const group of GROUPS) {
    const hit = group.some(
      (t) => t === n || (n.length >= 4 && t.startsWith(n)) || (t.length >= 4 && n.startsWith(t)),
    )
    if (hit) group.forEach((t) => set.add(t))
  }
  return [...set]
}

// Durchsuchbarer Text eines Rezepts (einmal pro Rezept aufbauen)
export function buildHaystack(r) {
  const parts = [
    r.title,
    r.cuisine,
    r.category,
    r.description,
    ...(r.keywords ?? []),
    ...(r.ingredients ?? []).map((i) => i.name),
  ]
  const hay = normalize(parts.filter(Boolean).join(' '))
  return { hay, hayNoH: hay.replace(/h/g, '') }
}

// Mehrwort-Suche: JEDES Wort der Anfrage muss (in irgendeiner Variante) vorkommen.
// h-toleranter Zweitvergleich fängt Schreibweisen wie „Spägetti" ab.
export function matchesQuery(haystack, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return words.every((w) =>
    variants(w).some(
      (v) =>
        haystack.hay.includes(v) ||
        (v.length >= 5 && haystack.hayNoH.includes(v.replace(/h/g, ''))),
    ),
  )
}
