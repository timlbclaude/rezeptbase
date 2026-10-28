# 🍳 Rezeptbase

Persönliche Rezeptdatenbank mit KI-Import: Link einfügen (YouTube, Shorts, TikTok, Instagram, Kochseiten), Rezept fotografieren oder Text einfügen → Zutaten und Kochschritte werden automatisch extrahiert und im Prüfformular bestätigt. Mit Portionsrechner, Kochmodus mit Timern, Suche, Favoriten, Sammlungen und geräteübergreifender Einkaufsliste.

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

Stand 28.10.2026 – die App ist produktiv im Einsatz. Ein vollständiges Fachkonzept (Architektur, Datenmodell, Funktionen, Betrieb) liegt im Claude-Projekt «Rezeptbase».

- [x] Phase 0: Anforderungen (ANFORDERUNGEN_RezeptApp.md im Projektordner)
- [x] Phase 1: Fundament (Repo, Supabase, Auth, Deployment) – 09.08.2026
- [x] Phase 2: Import & Rezeptansicht – 09.08.2026
- [x] Phase 3: Portionsrechner – 09.08.2026
- [x] Phase 4: Suche/Filter, Favoriten, Einkaufsliste – 09.08.2026
- [x] Phase 5: Feinschliff & PWA, Redesign «2a Nativ» (siehe `DESIGN.md`) – 13.08.2026
- [x] Ausbaupaket V1.1: Bearbeiten, Dark Mode, Filter/Sortierung, Teilen, Foto- und Instagram-Import, Offline-Cache (`KONZEPT_Ausbaupaket.md`) – 14.08.2026
- [x] V1.3 Pakete A–C: Suche, Fehlerbehandlung, Deep Links, Mengenformatierung, Barrierefreiheit, Warengruppen, Sammlungen, Mehrfach-Timer (`KONZEPT_Testbericht_V1.3.md`) – 19.08.2026
- [x] Betrieb: CI-Gate (Lint + Tests), verschlüsselte Datensicherung, Kochverlauf, Lazy-Load, Mehrfachauswahl – 30.08.2026 / 09.09.2026
- [x] Security Review: Edge Function v16 (Identität, Stundenlimit fail-closed, CORS, keine Fehlerdetails an den Client), `anon` ohne Tabellenrechte – 28.10.2026

### Bewusst nicht umgesetzt

Wochenplaner, Vorratsverwaltung, Haushaltsfreigabe, Sprachsteuerung, Nährwerte, Parallelkochen, PDF-Druckansicht, Registrierung in der App.

### Offen (nur nach Rückbestätigung)

- Bilder in Supabase Storage mit Thumbnails statt data-URLs in `recipes.image_url`
- TypeScript-Migration
