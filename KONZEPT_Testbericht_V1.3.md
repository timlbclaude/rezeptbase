# Konzept V1.3 – Umsetzung Testbericht (P0–P2)

**Stand:** 15.08.2026 · **Scope:** Alle P0-, P1- und P2-Punkte des Testberichts. P3 (Pantry, Haushaltsfreigabe, Sprachsteuerung, Nährwerte) wird bewusst NICHT umgesetzt.

---

## 0. Diagnose vorab: Der Suchfehler ist gefunden und belegt

Ich habe die 15 „Hähnchen“-Treffer aus dem Bericht exakt in der Datenbank nachgestellt. Ursache sind zwei Konstruktionsfehler in der Suche (src/lib/search.js):

1. **Teilstring- statt Wort-Vergleich:** Jede Suchvariante wird als Teilstring im Gesamttext gesucht.
2. **Zu aggressive Tippfehler-Toleranz:** Der „h-tolerante“ Zweitvergleich entfernt ALLE h aus Variante und Text. „Hühner“ wird zu „uner“ – und „uner“ steckt in „br**auner** Zucker“. Genau darüber matchen Cookie-Croissant und Eingelegte rote Zwiebeln. „Hähnchen“ wird zu „ancen“ und trifft die Frühlingspasta.

Damit ist der P0-Befund vollständig erklärt – kein Datenbank- oder Join-Problem, die Keywords selbst sind sauber.

---

## Paket A – Vertrauen & Korrektheit (P0 + dringende P1)

### A1 Suche korrigieren (P0)
- Gesamttext in **Wörter zerlegen** (Token-Set statt einem langen String).
- Treffer nur noch: Token = Variante, oder Token **beginnt mit** Variante (ab 4 Zeichen, fängt „Hähnchenbrust“).
- Tippfehler-Toleranz neu: h-bereinigter **Ganzwort**-Vergleich (Suchwort ≥ 5 Zeichen). „Spägetti“ findet weiter Spaghetti, „brauner Zucker“ matcht nie wieder „Hühner“.
- Suche + Status-/Kategorie-/Favoritenfilter: explizit UND-verknüpft (Code-Review + Tests).
- **Automatisierte Tests (Vitest)** mit den Fällen aus dem Bericht: positiv (Titel, Zutat, Teilwort, Umlaut, „Spägetti“) und negativ („Hähnchen“ ≠ Dessert/Zwiebeln, „Hähnchen + Dessert“ = leer).
- Abnahme: „Hähnchen“ liefert nur echte Geflügelgerichte; „Hähnchen“ + Filter Dessert zeigt den Leerzustand.

### A2 Zentrale Fehlerbehandlung für alle Schreibvorgänge (P0)
- Neues Modul `src/lib/mutate.js`: EIN Weg für alle Inserts/Updates/Deletes mit einheitlicher Fehlerübersetzung:
  - RLS/403 → „Dieses Konto besitzt nur Leserechte. Änderungen können nicht gespeichert werden.“
  - Abgelaufene Sitzung/401 → „Deine Sitzung ist abgelaufen – App neu laden.“ (plus automatischer Token-Refresh-Versuch)
  - Netzwerk → „Keine Verbindung – Änderung nicht gespeichert.“
- **Kein Blind-Optimismus mehr:** Bewertung, Notizen, Favorit, Status, Einkaufsartikel warten auf Server-OK; bei Fehler wird der alte Zustand wiederhergestellt und ein Toast + Inline-Hinweis gezeigt. Eingabefelder werden erst nach Erfolg geleert.
- Buttons während des Requests deaktiviert mit Ladezustand.
- Rohe Datenbanktexte (Tabellen-/RLS-Details) erscheinen nirgendwo mehr; technische Details nur in der Browser-Konsole.

### A3 Leserechte in der Oberfläche (P1)
- Beim Login wird die Rolle erkannt (Review-Konto = bekannte Nutzer-ID, zentral in `src/lib/roles.js`).
- Im Lese-Modus: dezenter Hinweis-Banner „Nur Leserechte“ im Profil + alle Schreibaktionen (Favorit, Sterne, Notizen, Bearbeiten, Import-Speichern, Einkauf) **deaktiviert mit Erklärung** statt versteckt – so sieht ein Prüfer die Funktionen, kann aber keine Fehlversuche auslösen.
- Sicherheit bleibt zu 100 % serverseitig (RLS); das hier ist reine UX.

### A4 Desktop-Login reparieren (P1)
- Login-Formular: `width: 100%`, `max-width: 420px`, zentriert, volle Feldbreite.
- Screenshot-Kontrolle bei 390/768/1024/1280/1440 px als Teil des E2E-Tests.

## Paket B – Routing & Datenqualität (P1)

### B1 Deep Links + Browser-Zurück
- **Hash-Routing** (ideal für GitHub Pages, kein Server nötig): `#/rezept/<id>`, `#/import`, `#/einkauf`; Suchbegriff + Filter als Parameter (`#/?q=pasta&kat=Dessert`).
- Interne Navigation erzeugt echte History-Einträge; Browser-Zurück führt zur Liste zurück (inkl. Suchbegriff, Filter, Scrollposition), statt aus der App zu fallen.
- Abnahme: Rezept-Link kopieren → neues Fenster → nach Login öffnet sich direkt dieses Rezept.

### B2 Mengen küchentauglich machen
- Zentrale Formatierung `formatAmount` für ALLE Anzeigen (Detail, Kochmodus, Einkauf):
  - deutsches Komma („1,5 EL“ statt „1.5 EL“),
  - Rundung je Einheit: TL/EL auf ¼-Schritte (Anzeige „¾ TL“), Stück/Zehen/Würfel auf halbe, g/ml auf 5er-Schritte,
  - Singular/Plural je Einheit („1 Zehe“ / „3 Zehen“, „1 Würfel“ / „2 Würfel“).
- **Schritt-Zutaten über IDs:** Beim Speichern werden die Zutaten-Hinweise der Schritte den echten Zutaten zugeordnet; der Kochmodus zeigt dann dieselben skalierten, formatierten Mengen wie die Zutatenliste (kein „0,5 Brühwürfel“ neben „1 Brühwürfel“ mehr). Fallback: Text ohne Mengen.

### B3 Import-Plausibilisierung
- Edge Function: Anweisung an die KI, **Einheiten der Quelle zu übernehmen** (Mehl/Käse/feste Zutaten nie als ml/l; Cups → Gramm nur mit Stoff-üblicher Umrechnung).
- Vorschau: gelbe Warnung bei unplausiblen Kombinationen (z. B. „60 ml Mehl“) – Liste typischer Feststoffe im Client.
- **Duplikat-Umgang:** Bei bereits vorhandener Quelle zeigt die Vorschau einen Hinweis mit den wichtigsten Unterschieden (Titel, Portionen, abweichende Mengenanzahl) und der Wahl „Vorhandenes behalten / trotzdem neu speichern“.

### B4 Bilder & Metadaten
- Bild-Ladefehler → stabiler Platzhalter (neutrale SVG-Kachel) statt leerer Fläche.
- Alt-Texte: Karten bewusst dekorativ (Kartenknopf trägt bereits den Titel), Detailbild erhält den Rezepttitel als Alt-Text.
- Fehlende Zeitangabe: Anzeige „Zeit n. a.“ statt stiller Lücke; Import-Editor markiert leere Felder (Zeit, Kategorie) sichtbar.

## Paket C – Produktreife (P2)

### C1 Barrierefreiheit & Bedienbarkeit
- `aria-pressed` für Favorit/Sterne/Chips, Tabs mit `aria-selected`, Hauptnavigation mit `aria-current="page"`.
- Eine dezente `aria-live`-Region meldet Trefferzahl, Speichererfolg und Fehler.
- Touch-Ziele auf mindestens 44×44 px (unsichtbares Padding, Optik bleibt).
- Sichtbarer Fokus-Ring für Tastaturbedienung; Kontrast der grauen Sekundärtexte im Dark Mode angehoben.
- Kochmodus: Hintergrund für Screenreader inaktiv (`aria-hidden`/`inert`), solange das Overlay offen ist.

### C2 Filterstatus & Leerzustände
- Filterbutton zeigt einen Punkt-Badge, sobald Kategorie/Sortierung aktiv ist; aktive Filter als entfernbare Chips über der Liste.
- Drei unterscheidbare Leerzustände: „Noch keine Rezepte“, „Keine Treffer für ‚…‘“, „Keine Treffer mit diesen Filtern“ + Primäraktion „Filter zurücksetzen“.

### C3 Einkaufsliste intelligenter
- Vor dem Übernehmen eines Rezepts: Auswahlansicht (vorhandene Zutaten abwählen).
- Gleiche Artikel werden zusammengeführt (Normalisierung über die Such-Logik), Mengen addiert, wo Einheiten passen.
- Sortierung nach Warengruppe (einfache Zuordnungstabelle: Gemüse, Milchprodukte, Fleisch, Vorrat, Sonstiges).

### C4 Sammlungen
- Neue Tabellen `collections` + `recipe_collections` (RLS wie gehabt, inkl. Lese-Regel für den Review-Nutzer, solange er existiert).
- Nutzerdefinierte Sammlungen („Schnell nach Feierabend“, „Gäste“ …), ein Rezept kann mehreren angehören; Filter-Sheet erhält einen Sammlungen-Bereich.

### C5 Benannte Timer im Kochmodus
- Mehrere gleichzeitige Timer mit Namen („Pasta abgießen“), sichtbar als kleine Leiste im Kochmodus; laufen über Schrittwechsel hinweg weiter.
- (Volles „Parallelkochen“ mit mehreren offenen Rezepten lasse ich bewusst weg – hoher Aufwand, kleiner Haushalt.)

### C6 Testfundament
- Vitest-Suite für Suche, Mengenformatierung, Rundung, Plural (läuft lokal und im GitHub-Build).
- Manuelle E2E-Checkliste je Paket (siehe unten); Screenshot-Serie über die 5 Breakpoints.

**Nicht enthalten (bewusst):** Wochenplan mit Einkaufskette (P2 im Bericht) – du hattest den Wochenplaner ausdrücklich als „kein Mehrwert“ eingestuft. C3 liefert den Einkaufs-Nutzen auch ohne Plan. Sag Bescheid, falls du das inzwischen anders siehst.

---

## Reihenfolge, Deployment & Abnahme

| Schritt | Inhalt | E2E-Abnahme |
|---|---|---|
| 1 | Paket A (A1–A4) | Suchtests aus dem Bericht, Schreibversuch als Review-Nutzer zeigt saubere Meldung, Login-Screenshots 5 Breakpoints |
| 2 | Paket B (B1–B4) | Deep-Link-Test, Zurück-Taste, Portionen 1–12 Stichproben, Re-Import Feta-Pasta ohne ml-Mehl |
| 3 | Paket C (C1–C6) | Screenreader-Stichprobe, Filter-Badge, Einkaufs-Zusammenführung, Sammlung anlegen, 2 parallele Timer |

Jedes Paket wird einzeln gebaut, deployed und getestet, bevor das nächste beginnt – die App bleibt dazwischen jederzeit benutzbar. Datenbankänderungen (nur Paket C: zwei neue Tabellen) sind rein additiv, bestehende Daten bleiben unangetastet. Die Edge Function wird einmal aktualisiert (B3).

**Risiken:** B1 (Routing) greift am tiefsten in die App ein → eigener, gründlicher Test aller drei Bereiche inkl. PWA-Start. B2 (Schritt-Zutaten-Zuordnung) hat unscharfe Fälle → Fallback auf reine Namensanzeige ist eingebaut.
