# Vorgehenskonzept „Ausbaupaket V1.1" — Rezeptbase

Stand: 14.08.2026 · Umsetzung direkt im Anschluss, vollautomatisch bis zum Deploy.

## Umfang (von Tim freigegeben)

Alles außer Wochenplaner: 1) Rezepte bearbeiten, 2) Timer & Zutaten je Kochschritt aus dem Import,
3) Instagram-Reels-Import, 4) Foto-Import, 5) Dark Mode, 6) Sortieren & Filtern,
7) Offline-Kochen, 8) Rezept teilen, 9) Supabase-Hygiene.

## Architektur-Entscheidungen

**Kochschritte werden Objekte.** Die Import-KI liefert Schritte künftig als
`{ text, timer_min?, zutaten? }` statt als reiner Text. Alle Ansichten (Detail, Kochmodus)
verstehen BEIDE Formate — bestehende Rezepte mit Text-Schritten funktionieren unverändert
(Timer dort weiterhin per Text-Erkennung „5–6 Minuten").

**Instagram-Reels** laufen über dieselbe Route wie TikTok: serverseitiger Abruf der
Open-Graph-Metadaten (Caption steht in og:title/og:description; Abruf mit Crawler-User-Agent),
Vorschaubild wird wie bei TikTok dauerhaft als data-URL eingebettet (Instagram-CDN-Links laufen ab).
Liefert die Caption zu wenig, greift automatisch der bestehende Websuche-Fallback.
Neuer source_type `instagram` (DB-Constraint wird erweitert).

**Foto-Import** als dritter Weg auf der Import-Seite: Foto aufnehmen/auswählen →
im Browser auf max. 1568 px verkleinert (JPEG) → an die Edge Function → Claude liest das Bild
(Kochbuchseite, handschriftliche Karte, Screenshot) und extrahiert das Rezept.
Neuer source_type `foto`, Prüfformular wie bei jedem Import.

**Rezepte bearbeiten** nutzt das vorhandene Import-Prüfformular wieder (eine Quelle der Wahrheit):
RecipeDetail erhält „Bearbeiten" (im Notizen-Tab), öffnet das Formular vorbefüllt,
Speichern = Update des Rezepts + Neuaufbau der Zutaten. Portionszahl-Änderung bleibt konsistent
zur Skalierungslogik.

**Dark Mode** rein über Design-Tokens: alle Farben liegen als CSS-Variablen vor; ein
`prefers-color-scheme: dark`-Block mappt sie auf die iOS-Dunkelpalette (bg #000, Karten #1C1C1E,
Tint minimal heller). Zusätzlich `?theme=dark|light` als Test-/Erzwing-Schalter und passende
theme-color-Metas. Kein Umbau der Komponenten nötig.

**Sortieren & Filtern**: Filter-Knopf neben dem Suchfeld öffnet ein Bottom-Sheet mit
Kategorie-Chips (Hauptgericht, Dessert, …) und Sortierung (Neueste, Bewertung, Zuletzt gekocht, A–Z).
Aktiver Filter wird als Badge am Knopf angezeigt.

**Offline-Kochen**: Der Service Worker cacht künftig Supabase-GET-Antworten (Rezepte, Zutaten,
Einkaufsliste) network-first mit Cache-Fallback. Einmal geladene Rezepte inkl. Kochmodus
funktionieren damit ohne Netz; Schreibaktionen brauchen weiterhin Verbindung.

**Teilen**: Teilen-Knopf im Rezept erzeugt einen sauber formatierten Text (Titel, Portionen,
Zutaten, Schritte, Quelle) und nutzt das native Teilen-Menü des Geräts (Web Share API);
am PC Fallback „In Zwischenablage kopiert".

**Hygiene**: debug_content aus der Fehlerantwort der Edge Function entfernt;
Supabase Auth Site URL auf die Live-URL gesetzt.

## Reihenfolge & Deploy

1. Edge Function (Schritt-Objekte, Instagram, Foto, Hygiene) → Deploy im Dashboard
2. DB: source_type-Constraint + 'instagram', 'foto' → SQL-Editor
3. Frontend (7 Dateien) → Build & Lint lokal → Push via Git Data API → Pages-Deploy
4. Auth Site URL im Dashboard
5. Kompletter E2E-Test aller neuen Features + Regressionstest, Fixes, Abschlussbericht

## Risiken & Absicherung

- Instagram blockt Crawler gelegentlich → Websuche-Fallback fängt das ab, schlimmstenfalls
  klare Fehlermeldung mit Hinweis auf manuellen Text.
- Alte Rezepte (Text-Schritte) → beide Formate werden überall unterstützt, Regressionstest Kochmodus.
- Foto-Qualität → Formular-Prüfschritt bleibt Pflicht, nichts wird ungeprüft gespeichert.
