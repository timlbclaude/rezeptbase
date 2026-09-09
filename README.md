# 🍳 Rezeptbase

Persönliche Rezeptdatenbank mit KI-Import: Link einfügen (YouTube, Shorts, Kochseiten) → Zutaten und Kochschritte werden automatisch extrahiert und gespeichert. Mit Portionsrechner, Suche, Favoriten und Einkaufsliste.

## Architektur

- **Frontend:** React + Vite + Tailwind CSS, deutsch, Mobile First (PWA)
- **Hosting:** GitHub Pages (automatisches Deployment via GitHub Actions)
- **Datenbank & Auth:** Supabase (Postgres, Row Level Security)
- **KI-Extraktion:** Supabase Edge Function → Claude API (Key nur als Supabase-Secret)

## Entwicklung

```bash
npm install
npm run dev
```

Supabase-Zugangsdaten werden beim Deployment über die Repository-Variablen `SUPABASE_URL` und `SUPABASE_ANON_KEY` gesetzt (lokal via `.env.local` mit `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

Das Datenbankschema liegt in `supabase/schema.sql`.

## Datensicherung

Der Workflow `.github/workflows/backup.yml` sichert die Datenbank montags und donnerstags. Er liest über `scripts/backup.mjs` alle Tabellen mit dem Service-Role-Key aus und legt das Ergebnis **verschlüsselt** unter `backups/rezepte-backup.json.gz.enc` ab. Die beiden Läufe pro Woche halten zugleich das Supabase-Free-Tier-Projekt aktiv, das sonst nach etwa sieben Tagen ohne Datenbankzugriff pausiert.

Der Klartext-Dump `backups/rezepte-backup.json` enthält sämtliche Rezepte, Zutaten und Einkaufslisten und ist über `.gitignore` ausgeschlossen. Er darf nicht committet werden, solange das Repository öffentlich ist.

Voraussetzung ist das Repository-Secret `BACKUP_PASSPHRASE` (Settings → Secrets and variables → Actions). Fehlt es, bricht der Workflow mit einer deutlichen Fehlermeldung ab. Die Passphrase gehört in einen Passwortmanager – ohne sie ist die Sicherung nicht wiederherstellbar.

Committet wird nur bei tatsächlicher Datenänderung. Verglichen wird die Prüfsumme in `backups/data.sha256`, die allein über die Nutzdaten gebildet wird; der Zeitstempel `erstellt_am` bleibt bewusst aussen vor.

### Sicherung wiederherstellen

Datei aus dem Repository laden und entschlüsseln (openssl ist in Git Bash enthalten):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in rezepte-backup.json.gz.enc -pass pass:DEINE_PASSPHRASE | gzip -d > rezepte-backup.json
```

Ergebnis ist die JSON-Datei mit den Schlüsseln `erstellt_am`, `hinweis` und `tabellen`.

## Projektstand

- [x] Phase 0: Anforderungen (siehe ANFORDERUNGEN_RezeptApp.md im Projektordner)
- [ ] Phase 1: Fundament (Repo, Supabase, Auth, Deployment)
- [ ] Phase 2: Import & Rezeptansicht
- [ ] Phase 3: Portionsrechner
- [ ] Phase 4: Suche/Filter, Favoriten, Einkaufsliste
- [ ] Phase 5: Feinschliff & PWA
