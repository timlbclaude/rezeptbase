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

## Projektstand

- [x] Phase 0: Anforderungen (siehe ANFORDERUNGEN_RezeptApp.md im Projektordner)
- [ ] Phase 1: Fundament (Repo, Supabase, Auth, Deployment)
- [ ] Phase 2: Import & Rezeptansicht
- [ ] Phase 3: Portionsrechner
- [ ] Phase 4: Suche/Filter, Favoriten, Einkaufsliste
- [ ] Phase 5: Feinschliff & PWA
