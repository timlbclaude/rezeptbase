# Rezeptbase — Design System „2a Nativ"

Dieses Dokument beschreibt das Design der Rezeptbase-App so, wie es aktuell
umgesetzt ist. Es ist die verbindliche Referenz für alle künftigen
UI-Änderungen. Die technische Quelle der Wahrheit ist `src/index.css`
(der `@theme`-Block) — dieses Dokument erklärt sie.

---

## 1. Design-Philosophie

**Ruhige, iOS-native Anmutung.** Das System heißt intern „2a Nativ" und
orientiert sich an der Optik nativer iOS-Apps:

- **Eine einzige Markenfarbe** (Apfelgrün, „Tint"). Alles Farbige in der
  App ist entweder diese Tint-Farbe oder ein neutraler Grauton. Bunte
  Akzente gibt es nur für klare Bedeutung (Favorit = Rot, Bewertung = Gelb).
- **System-Schrift statt eigener Fonts** — die App übernimmt die
  Schriftart des Betriebssystems und fühlt sich dadurch „eingebaut" an.
- **Gruppierte Listen auf ruhigem Grau.** Inhalte liegen als weiße Karten
  auf einem hellgrauen Hintergrund, wie in den iOS-Einstellungen.
- **Zurückhaltung.** Wenig Schatten, dünne Trennlinien, sanfte Animationen.
  Der Inhalt (die Rezepte) steht im Vordergrund, nicht die Oberfläche.

---

## 2. So funktioniert das Theming

Alle Design-Werte sind **Tokens** (CSS-Variablen) im `@theme`-Block von
`src/index.css`. Komponenten benutzen diese Tokens über Tailwind-Klassen
(z.B. `bg-card`, `text-ink`, `text-tint`) — **nie** feste Farbwerte direkt.

**Goldene Regel:** Farbe, Schatten und Schrift werden zentral über die
Tokens geändert, nicht über einzelne Klassen an einzelnen Elementen. Wer
einen Ton anpassen will, ändert genau eine Stelle und die ganze App zieht
mit.

### Heller und dunkler Modus

Jedes Farb-Token existiert **zweimal** — einmal hell (im `@theme`-Block),
einmal dunkel. Der Dunkelmodus ist an zwei Stellen definiert, die
identische Werte haben:

1. `@media (prefers-color-scheme: dark)` — greift automatisch nach der
   Systemeinstellung des Geräts.
2. `:root[data-theme="dark"]` — greift, wenn der Nutzer im Profil manuell
   „Dunkel" wählt.

Zusätzlich lässt sich der Modus zum Testen per URL erzwingen:
`?theme=dark` bzw. `?theme=light`.

> **Wichtig bei Änderungen:** Wer ein Farb-Token anfasst, muss es in
> **allen** Blöcken anpassen (hell + beide Dunkel-Blöcke) und danach
> beide Modi prüfen.

---

## 3. Farb-Tokens

### Marke (Tint)

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--color-tint` | `#3F9147` | `#4DA955` | Primärfarbe: Buttons, aktive Zustände, Links, Icons |
| `--color-tint-dark` | `#35803C` | `#3F9147` | Gedrückter Zustand von Tint-Buttons (`active:`) |
| `--color-tint-soft` | grün 12 % | grün 18 % | Zarte grüne Flächen: Erfolgs-Hinweise, Timer-Chip, Icon-Kreise |

### Flächen (iOS-grouped)

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--color-bg` | `#F2F2F7` | `#000000` | Seitenhintergrund |
| `--color-card` | `#FFFFFF` | `#1C1C1E` | Karten, Sheets, Eingabefelder |
| `--color-fill` | `#E3E3E8` | `#2C2C2E` | Gefüllte Sekundärflächen: Chips, Icon-Buttons, Skeleton |
| `--color-fill-2` | `#ECECF0` | `#3A3A3C` | Zweiter Fill-Ton (Skeleton-Schimmer) |

### Text (kräftig → blass)

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--color-ink` | `#1C1C1E` | `#F2F2F7` | Überschriften, Haupttext |
| `--color-ink-2` | `#3C3C43` | weiß 72 % | Fließtext, Sekundärtext |
| `--color-ink-3` | `#8E8E93` | weiß 50 % | Meta-Angaben, Platzhalter, Labels |
| `--color-ink-4` | `#B0B0B5` | weiß 32 % | Sehr zurückhaltend: Chevrons, deaktivierter Text |

### Semantik & Linien

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--color-love` | `#C33D24` | `#E0604A` | Favorit-Herz, „Löschen", destruktive Aktionen |
| `--color-star` | `#F5A623` | `#F5A623` | Bewertungssterne (in beiden Modi gleich) |
| `--color-separator` | schwarz 12 % | weiß-grau 50 % | Trennlinien zwischen Listenzeilen (Hairline) |
| `--color-line` | `#C7C7CC` | `#48484A` | Rahmen (z.B. runde Checkbox) |
| `--color-handle` | `#D9D9DE` | `#48484A` | Griff oben an Bottom-Sheets |
| `--color-bar` | hell 92 % | dunkel 90 % | Tab-Bar-Hintergrund (mit Blur) |
| `--color-overlay-btn` | weiß 90 % | dunkel 85 % | Halbtransparente Buttons auf Bildern (Zurück, Favorit im Rezept-Hero) |

**Es gibt bewusst nur diese Farben.** Eine neue Farbe wird nicht einfach
eingeführt — wenn ein Zustand eine braucht, wird das vorher besprochen und
begründet.

---

## 4. Schrift

| Token | Wert |
|---|---|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif` |

Die App nutzt die **System-Schrift** des jeweiligen Geräts (SF auf Apple,
Segoe/Roboto sonst). Es werden keine Web-Fonts geladen — das spart
Ladezeit und wirkt nativ.

Schriftgrößen und -gewichte werden pro Element als Tailwind-Klasse gesetzt
(z.B. `text-[15.5px] font-semibold`). Gängige Größen: 34 px (Seitentitel),
26 px (Rezepttitel), 15–16 px (Fließtext/Buttons), 12–13 px (Labels/Meta).
Labels sind meist `uppercase` mit leichtem `letter-spacing`.

---

## 5. Tiefe & Schatten

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--shadow-card` | `0 1px 2px` schwarz 4 % | `0 1px 2px` schwarz 30 % | Karten — sehr flach, nur eine leichte Abhebung |
| `--shadow-sheet` | `0 -8px 30px` schwarz 12 % | `0 -8px 30px` schwarz 55 % | Bottom-Sheets, die von unten hochkommen |

Die Anmutung ist bewusst **flach**: Karten heben sich nur minimal ab,
Tiefe entsteht vor allem durch die Flächenkontraste (Karte auf Hintergrund),
nicht durch starke Schatten.

---

## 6. Form-Konventionen (Radien, Höhen, Abstände)

Radien, Höhen und Abstände sind **nicht** tokenisiert, sondern werden pro
Komponente als Tailwind-Klasse gesetzt. Damit es einheitlich bleibt, gelten
folgende eingebürgerte Werte:

**Eckenradien**
- `rounded-full` — Chips, Pills, runde Icon-Buttons, Bewertungssterne
- `14px` — Primär-Buttons, größere Karten-Zeilen
- `12px` — Eingabefelder, kompakte Buttons
- `16px` — Listen-/Inhaltskarten
- `18px` / `13px` — Rezept-Grid-Kacheln (außen/Bild)
- `20px` — Rezept-Hero (Detailansicht)
- `22px` (oben) — Bottom-Sheets

**Höhen & Touch-Ziele**
- Primär-Buttons: `50px` (CTA im Kochmodus `52px`)
- Sekundär-Buttons: `48px`
- **Mindest-Touch-Ziel: `44px`** für alle antippbaren Elemente
  (Icon-Buttons, Tab-Bar, Auge im Passwortfeld) — Barrierefreiheits-Vorgabe
- Chips: `≥36px`, Filter-Chips im Sheet `≥34px`

---

## 7. Wiederkehrende Bausteine

- **Karte** (`bg-card` + `--shadow-card`, Radius 16 px): Grundcontainer für
  Inhalte. Gruppierte Listen liegen als eine Karte mit Hairline-getrennten
  Zeilen.
- **Listenzeile**: Höhe ausreichend fürs Antippen, `active:bg-black/[0.03]`
  als Tap-Feedback, unten eine Hairline (`--color-separator`), die letzte
  Zeile ohne.
- **Chip / Pill** (`rounded-full`): Filter und Kategorien. Aktiv =
  `bg-tint text-white`, inaktiv = `bg-card`/`bg-fill` mit `text-ink-2`.
  Aktive Chips tragen `aria-pressed`.
- **Segmented Control**: Umschalter (z.B. Zutaten/Schritte/Notizen) auf
  `bg-fill`, aktives Segment als weiße Karte mit leichtem Schatten.
- **Bottom-Sheet**: von unten (`animate-sheet`), Radius oben 22 px,
  Griff-Balken (`--color-handle`), `--shadow-sheet`, halbtransparenter
  Overlay dahinter. Wird für Filter, Profil, Sammlungen, Einkaufs-Auswahl
  genutzt.
- **Tab-Bar**: fix unten, `--color-bar` mit Backdrop-Blur, drei Tabs
  (Rezepte/Import/Einkauf). Aktiver Tab in Tint, `aria-current="page"`.
- **Toast**: kurze Rückmeldung (Erfolg/Fehler/Info), via Portal an `body`,
  `aria-live="polite"`, max. 3 gleichzeitig, nach 4 s weg.
- **Skeleton**: grauer Schimmer-Platzhalter (`.skeleton`) während Ladezeiten.
- **Runde Checkbox** (`.checkbox-circle`): Einkaufsliste, füllt sich bei
  Auswahl mit Tint und zeigt einen weißen Haken.
- **Hairline** (`.hairline` / `--color-separator`): 0,5-px-Trennlinie,
  scharf auch auf Retina-Displays.

---

## 8. Bewegung (Motion)

Sanft und kurz, mit iOS-typischem Easing `cubic-bezier(0.22, 1, 0.36, 1)`:

- **`rise-in`** (0,35 s): Ansichten blenden sanft ein und steigen leicht auf.
- **`sheet-up`** (0,3 s): Bottom-Sheets fahren von unten herein.
- **`shimmer`** (1,6 s, endlos): Skeleton-Schimmer beim Laden.

> **CSS-Falle (wichtig, dokumentiert im Code):** Die `rise-in`-Animation
> endet auf `transform: none`, **nicht** auf `translateY(0)`. Sonst behält
> die Seite ein `transform` und `position: fixed`-Overlays (z.B. der
> Kochmodus) verankern sich an der Seite statt am Bildschirm. **Regel:**
> Neue Vollbild-Overlays immer per `createPortal(document.body)` rendern.

---

## 9. Icons

- Eigene SVG-Icon-Komponente `src/components/Icon.jsx` (Strichzeichnungen im
  Lucide-Stil), aktuell **36 Icons** (u.a. `search`, `heart`, `star`,
  `clock`, `chefHat`, `flame`, `bag`, `sliders`, `eye`/`eyeOff`).
- **Keine Emojis** als UI-Symbole — durchgängig diese SVG-Icons, damit die
  Optik plattformübergreifend gleich ist.
- Icons erben die Textfarbe (`currentColor`), passen sich also automatisch
  an Tint bzw. Ink-Töne und an den Dunkelmodus an. Übliche Größen: 15–20 px
  in Fließkontext, 24–26 px in der Tab-Bar / Leerzuständen.

---

## 10. Barrierefreiheit

- **Sichtbare Fokus-Ringe** für Tastaturnutzer: `:focus-visible` zeichnet
  einen 2,5-px-Tint-Ring (Eingabefelder ohne Versatz).
- **Touch-Ziele ≥ 44 px** bei allen antippbaren Elementen.
- **ARIA**: `aria-pressed` an Umschalt-Chips, `aria-current` in der Tab-Bar,
  `aria-label` an Icon-Buttons, Live-Regionen für Ergebnis-Ansagen und
  Toasts, `role="dialog"` mit `aria-modal` beim Kochmodus.
- Farbkontraste folgen der iOS-Palette; `--color-star` ist in beiden Modi
  gleich, alle übrigen Töne haben eine Dunkel-Entsprechung.

---

## 11. Regeln für Änderungen am Design

1. **Über Tokens, nicht über Einzelelemente.** Farbe/Schatten/Schrift
   zentral im `@theme`-Block ändern.
2. **Keine neuen Farben ohne Rücksprache.** Wird eine gebraucht, vorher
   begründen — nicht einfach setzen.
3. **Beide Modi prüfen.** Jede Farbänderung in hell *und* dunkel testen
   (`?theme=dark` / `?theme=light`).
4. **Neue Vollbild-Overlays als Portal** (siehe CSS-Falle in Abschnitt 8).
5. **Am Schluss zeigen, welche Tokens angefasst wurden.**

---

*Quelle der Wahrheit: `src/index.css`. Dieses Dokument beschreibt den Stand
zum Zeitpunkt der Erstellung und sollte bei Design-Änderungen mitgepflegt
werden.*
