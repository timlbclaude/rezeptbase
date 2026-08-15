// Intelligente Suche: Normalisierung (Umlaute, Akzente), Basis-Lexikon
// mit Oberbegriffen/Synonymen und Mehrwort-Logik (alle Wörter müssen passen).
// Die KI-Schlagworte je Rezept (recipes.keywords) sind die Hauptquelle,
// das Lexikon hier ist das Sicherheitsnetz für Oberbegriffe.
//
// V1.3: Wort-basierte Treffer statt Teilstring im Gesamttext.
// Vorher matchte „Hähnchen" u. a. „brauner Zucker", weil der h-tolerante
// Vergleich („hühner" → „uner") als Teilstring gesucht wurde.

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

const stripH = (s) => s.replace(/h/g, '')

// Durchsuchbarer Text eines Rezepts als WORT-LISTE (einmal pro Rezept aufbauen)
export function buildHaystack(r) {
  const parts = [
    r.title,
    r.cuisine,
    r.category,
    r.description,
    ...(r.keywords ?? []),
    ...(r.ingredients ?? []).map((i) => i.name),
  ]
  const text = normalize(parts.filter(Boolean).join(' '))
  const tokens = [...new Set(text.split(/[^a-z0-9]+/).filter(Boolean))]
  return { tokens }
}

// Trifft eine Variante auf ein einzelnes Wort des Rezepts zu?
// - exakt gleich
// - Wort beginnt mit der Variante (ab 4 Zeichen: „huhn" → „hühnerbrühe")
// - Variante steckt im Wort (ab 5 Zeichen: „salat" → „nudelsalat")
// - Tippfehler-Toleranz: OHNE h identisch, nur als GANZES Wort
//   („spägetti" → „spaghetti", aber nie mehr „hühner" → „brauner")
function tokenMatches(token, v) {
  if (token === v) return true
  if (v.length >= 5 && token.includes(v)) return true
  if (v.length === 4 && token.startsWith(v)) return true
  if (v.length >= 5 && stripH(token) === stripH(v)) return true
  return false
}

// Mehrwort-Suche: JEDES Wort der Anfrage muss (in irgendeiner Variante) passen.
export function matchesQuery(haystack, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return words.every((w) => {
    const vs = variants(w)
    return haystack.tokens.some((t) => vs.some((v) => tokenMatches(t, v)))
  })
}
