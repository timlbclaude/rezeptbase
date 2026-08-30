// Rezeptbase – automatische Datensicherung
// Liest alle Tabellen über die Supabase-REST-API (Service-Role-Key, nur in
// GitHub Actions als Secret hinterlegt) und schreibt sie als eine JSON-Datei
// nach backups/rezepte-backup.json. Ältere Stände bleiben über die
// Git-Historie erhalten.
//
// Benötigte Umgebungsvariablen:
//   SUPABASE_URL               – z.B. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  – Service-Role-Key (GitHub-Secret, NIE im Code)

import { writeFileSync, mkdirSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'FEHLER: SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY fehlen.\n' +
    'Bitte in den GitHub-Repo-Einstellungen unter Secrets/Variables hinterlegen.',
  );
  process.exit(1);
}

// Tabelle → stabile Sortierung für die Seiten-Abfrage
// (recipe_collections hat keine id-Spalte, sondern einen zusammengesetzten Schlüssel)
const TABLES = {
  recipes: 'id.asc',
  ingredients: 'id.asc',
  collections: 'id.asc',
  recipe_collections: 'recipe_id.asc,collection_id.asc',
  shopping_list: 'id.asc',
};
const PAGE = 1000;

async function fetchAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    });
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} – ${(await res.text()).slice(0, 200)}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const backup = {
  erstellt_am: new Date().toISOString(),
  hinweis: 'Automatische Sicherung der Rezeptbase-Datenbank (GitHub Actions, wöchentlich).',
  tabellen: {},
};

for (const [t, order] of Object.entries(TABLES)) {
  backup.tabellen[t] = await fetchAll(t, order);
  console.log(`${t}: ${backup.tabellen[t].length} Zeilen gesichert`);
}

mkdirSync('backups', { recursive: true });
writeFileSync('backups/rezepte-backup.json', JSON.stringify(backup, null, 1) + '\n');
console.log('Sicherung geschrieben: backups/rezepte-backup.json');
