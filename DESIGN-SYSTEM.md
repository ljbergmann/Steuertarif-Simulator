# Design-System & Projekt-Blueprint

> Referenzdoku für neue Tools mit konsistentem Look & Feel.
> Basierend auf dem §32a Steuertarif-Simulator v3.0.0.

---

## 1. Tech-Stack

| Komponente | Version | Hinweis |
|---|---|---|
| React | 19.x | Functional Components, Hooks only |
| TypeScript | 5.7+ | `strict: false`, `jsx: "react-jsx"` |
| Vite | 6.x | `@vitejs/plugin-react` |
| ES-Target | ES2020 | `"type": "module"` in package.json |

### package.json (Vorlage)

```json
{
  "name": "tool-name",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --outDir dist/standalone"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### vite.config.ts

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist/standalone",
    emptyOutDir: true,
  },
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true
  },
  "include": ["src"]
}
```

---

## 2. Dual-Entry-Point-Architektur

Jedes Tool hat zwei Modi: **Standalone** (eigene Seite) und **Embed** (Blog-Einbettung).

### src/main-standalone.tsx

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
```

### src/main-embed.tsx

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";

const el = document.getElementById("tool-TOOL_ID");
if (el) createRoot(el).render(<App mode="embed" />);
```

### index.html

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tool-Titel</title>
  <meta name="description" content="..." />
  <meta property="og:title" content="..." />
  <meta property="og:description" content="..." />
  <meta property="og:image" content="/og-image.svg" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/svg+xml" href="/og-image.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main-standalone.tsx"></script>
</body>
</html>
```

---

## 3. Farbsystem

```ts
const C = {
  bg:        "#fafaf8",   // Seiten-Hintergrund (warmes Off-White)
  card:      "#ffffff",   // Karten-Hintergrund
  border:    "#e8e5df",   // Rahmen & Trenner (warmes Beige)
  text:      "#1a1a1a",   // Primärtext (Fast-Schwarz)
  sub:       "#524d48",   // Sekundärtext (warmes Grau) — WCAG AA ✓
  light:     "#78726b",   // Tertiärtext (helles Grau) — WCAG AA ✓
  blue:      "#1d5088",   // Baseline / Status Quo — WCAG AA ✓
  orange:    "#a84a08",   // Szenario / Akzent / Interaktion — WCAG AA ✓
  green:     "#15632f",   // Positive Werte — WCAG AA ✓
  red:       "#9e1826",   // Negative Werte — WCAG AA ✓
  accent:    "#a84a08",   // = orange (Alias)
  cardHover: "#f5f3ef",   // Karten-Hover
  tag:       "#f0ece6",   // Tag/Badge-Hintergrund
};
```

### Semantische Zuordnung

| Farbe | Bedeutung |
|---|---|
| `blue` | Ist-Zustand, Baseline, Referenzwert |
| `orange` | Szenario, Alternative, User-Interaktion, Akzent |
| `green` | Positives Ergebnis, Ersparnis, Gewinn |
| `red` | Negatives Ergebnis, Mehrbelastung, Verlust |

### Status-Hintergründe

```ts
// Positiv
{ background: "#f0f9f2", border: "1px solid #bbdfc4" }

// Negativ
{ background: "#fef2f2", border: "1px solid #f5c6c6" }

// Info / Neutral
{ background: "#f0f7ff", border: `1px solid ${C.blue}30` }

// Warnung
{ background: "#fef9ef", border: "1px solid #e8dcc8" }
```

---

## 4. Typografie

### Font-Stacks

```ts
const FF = "'Söhne', 'Inter', system-ui, -apple-system, sans-serif";
const FM = "'Söhne Mono', 'JetBrains Mono', 'SF Mono', monospace";
```

### Google Fonts Import (im Root-Component als `<style>`)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Gewichte

| Gewicht | Einsatz |
|---|---|
| 400 | Body, Fließtext |
| 500 | Labels, leichte Betonung |
| 600 | Buttons, Emphasis, Section-Labels |
| 700 | Headlines, KPI-Werte |

### Größen-Spektrum

| px | Einsatz |
|---|---|
| 8–9 | Hints, kleine Captions, Input-Labels |
| 10–11 | Body-Standard, Beschreibungen, Buttons |
| 12–13 | Kleine Überschriften |
| 17–20 | KPI-Werte, Haupttitel |
| 26–34 | Hero-Zahlen |

### Section-Labels (Uppercase)

```ts
{
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  color: C.light,
  fontWeight: 600,
  marginBottom: 10,
}
```

### Headlines (Tight Kerning)

```ts
{
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: "-.02em",
}
```

---

## 5. Layout

### Container

```ts
{
  maxWidth: 960,
  margin: "0 auto",
  padding: "24px 16px",  // ss-Modus: 12
  minHeight: "100vh",
}
```

### 2-Spalten-Grid (Sidebar + Content)

```ts
{
  display: "grid",
  gridTemplateColumns: "minmax(260px, 310px) 1fr",
  gap: 22,
  alignItems: "start",
}
```

### Responsive Breakpoint: `800px`

```css
@media (max-width: 800px) {
  .grid-main { grid-template-columns: 1fr !important; }
}
```

Unter 800px: Single Column, `flexWrap: "wrap"`, reduziertes Padding.

---

## 6. Karten-System

### Standard-Karte

```ts
const cd = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: 16,
  marginBottom: 14,
};
```

### Border-Radius-Skala

| Wert | Einsatz |
|---|---|
| 3 | Inputs, kleine Elemente |
| 4 | Buttons, kleine Karten |
| 5–6 | Standard-Karten, Alerts |
| 8 | Feature-Karten |
| 20 | Pill-Buttons |
| 50% | Avatare |

---

## 7. Komponenten-Patterns

### Buttons

**Toggle / Selection:**
```ts
// Aktiv
{ background: C.tag, border: `1px solid ${C.orange}`, color: C.orange, fontWeight: 600 }

// Inaktiv
{ background: C.card, border: `1px solid ${C.border}`, color: C.text, fontWeight: 400 }
```

**Primary Action (Pill):**
```ts
{ background: C.text, color: "#fff", borderRadius: 20, padding: "8px 20px", fontWeight: 600 }
```

**Secondary Action (Pill):**
```ts
{ background: C.card, color: C.sub, border: `1px solid ${C.border}`, borderRadius: 20, padding: "8px 18px" }
```

### Inputs

**Range-Slider:**
```ts
{ height: 4, borderRadius: 2, background: C.border, accentColor: C.orange, width: "100%" }
```

**Editable Value:**
```ts
{
  width: 100, textAlign: "right", color: C.orange, fontWeight: 600,
  fontSize: 12, fontFamily: FF, background: C.tag,
  border: `1px solid ${C.orange}`, borderRadius: 3, padding: "1px 4px",
  outline: "none",
}
```

**Select:**
```ts
{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10 }
```

**Checkbox:**
```ts
{ accentColor: C.orange }
```

### Toggle-Gruppe (Inline, 3-Spalten)

Für Auswahl zwischen 2–4 Optionen (z.B. Splitting-Modus):

```ts
// Container
{ display: "flex", gap: 4 }

// Button (aktiv)
{
  flex: 1, background: C.tag, border: `1px solid ${C.orange}`,
  borderRadius: 4, padding: "6px 4px", cursor: "pointer",
  fontFamily: FF, fontSize: 9, fontWeight: 600, color: C.orange,
  textAlign: "center",
}

// Button (inaktiv)
{
  flex: 1, background: C.card, border: `1px solid ${C.border}`,
  borderRadius: 4, padding: "6px 4px", cursor: "pointer",
  fontFamily: FF, fontSize: 9, fontWeight: 400, color: C.text,
  textAlign: "center",
}
```

### Preset-Grid (3-Spalten)

Für Szenario-Auswahl mit Titel + Beschreibung:

```ts
// Container
{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 10 }

// Zelle (aktiv)
{ background: C.tag, border: `1px solid ${C.orange}`, borderRadius: 4, padding: "5px 4px", cursor: "pointer", textAlign: "center", fontFamily: FF }

// Titel
{ fontSize: 9, fontWeight: 600, color: C.orange }  // aktiv
{ fontSize: 9, fontWeight: 600, color: C.text }     // inaktiv

// Beschreibung
{ fontSize: 7, color: C.light, marginTop: 1 }
```

### Vergleichskarte (Side-by-Side KPI)

Für Vorher/Nachher-Vergleich (z.B. Splittingvorteil):

```ts
// Container
{
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "12px 16px", marginBottom: 14,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  flexWrap: "wrap", gap: 8,
}

// KPI-Spalten
{ display: "flex", gap: 16 }

// KPI-Label (Uppercase)
{ fontSize: 8, color: C.blue, textTransform: "uppercase", letterSpacing: ".06em" }  // Status Quo
{ fontSize: 8, color: C.orange, textTransform: "uppercase", letterSpacing: ".06em" } // Szenario

// KPI-Wert
{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: FM }

// Fußnote
{ fontSize: 8, color: C.light, marginTop: 6 }
```

### Tabellen

```ts
// Container
{ borderCollapse: "collapse", width: "100%" }

// Header-Zeile
{ borderBottom: `2px solid ${C.text}` }

// Body-Zeile
{ borderBottom: `1px solid ${C.border}` }

// Zellen
{ padding: "5px 0", fontSize: 10, fontFamily: FM /* für Zahlen */ }
```

---

## 8. Zahlenformatierung

```ts
// Ganzzahl, deutsch
const f = (n: number) => Math.round(n).toLocaleString("de-DE");

// Prozent
const fp = (n: number) => (n * 100).toFixed(1).replace(".", ",") + "%";

// Fiskal (Mrd./Mio. €)
const fm = (n: number) => {
  const m = n / 1e9;
  if (Math.abs(m) >= 1) return `${m >= 0 ? "+" : ""}${m.toFixed(1).replace(".", ",")} Mrd. €`;
  return `${n / 1e6 >= 0 ? "+" : ""}${(n / 1e6).toFixed(0)} Mio. €`;
};
```

**Alle Zahlen in Monospace:** `fontFamily: FM`

---

## 9. Interaktionen

### Selection-Highlight

```css
::selection { background: ${C.orange}; color: #fff; }
```

### Cursor

- Klickbar: `cursor: "pointer"`
- Editierbar: `cursor: "text"`

### Kein Transition

Bewusste Designentscheidung: sofortige State-Changes, keine CSS-Transitions.

### Disclosure-Pattern

Sections sind per Default collapsed. Toggle-Buttons schalten Sichtbarkeit.

---

## 10. SVG-Charts

```ts
// Viewbox & Responsive
{ viewBox: "0 0 680 280", style: { width: "100%", height: "auto" } }

// Grid
{ stroke: C.border }  // Linien
{ fill: C.light }     // Achsen-Text
{ fontFamily: FF, fontSize: 9 }

// Linien
{ stroke: C.blue, strokeWidth: 2 }                          // Baseline solid
{ stroke: C.orange, strokeWidth: 2, strokeDasharray: "5,3" } // Szenario dashed
{ strokeWidth: 1, opacity: 0.5, strokeDasharray: "2,3" }    // Effektiv-Raten

// Flächen
{ fill: C.blue, fillOpacity: 0.06 }   // Fläche unter Kurve
```

---

## 11. Globale Styles (im Root-Component)

```tsx
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${FF};
    background: ${C.bg};
    color: ${C.text};
    -webkit-font-smoothing: antialiased;
  }
  ::selection { background: ${C.orange}; color: #fff; }
  input[type=range] { -webkit-appearance: auto; accent-color: ${C.orange}; }
  @media (max-width: 800px) {
    .gm { grid-template-columns: 1fr !important; }
  }
`}</style>
```

---

## 12. Styling-Philosophie

| Prinzip | Umsetzung |
|---|---|
| **Inline-Only** | Alles via React `style` Prop, kein externes CSS |
| **Flat Design** | Keine Schatten, keine Gradienten |
| **Warme Neutraltöne** | Beige/Creme statt kaltem Grau |
| **Daten-fokussiert** | Monospace für Zahlen, klare Hierarchie |
| **Minimale Radien** | 3–6px Standard, 20px nur für Pill-Buttons |
| **Sofortige Feedback** | Keine Transitions, direkte State-Changes |
| **Semantische Farben** | Blau/Orange/Grün/Rot mit fester Bedeutung |
| **WCAG AA Kontrast** | Alle Textfarben ≥ 4.5:1 auf weißem Hintergrund |

---

## 13. Header-Pattern

```ts
// Container
{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: `2px solid ${C.text}`,
  paddingBottom: 10,
  marginBottom: 20,
  flexWrap: "wrap",
  gap: 8,
}

// Titel
{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }

// Untertitel
{ fontWeight: 400, color: C.light, fontSize: 13 }

// Version-Tag
{ fontSize: 9, color: C.border }
```

---

## 14. Dateistruktur (Vorlage)

```
neues-tool/
├── index.html
├── index.template.html       # ohne Analytics
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── og-image.svg
└── src/
    ├── App.tsx                # Hauptkomponente (alles inline)
    ├── main-standalone.tsx    # Entry: Standalone
    └── main-embed.tsx         # Entry: Blog-Embed
```

---

## 15. Checkliste neues Tool

- [ ] Projekt-Skeleton aus Vorlage erstellen
- [ ] `C`-Konstante, `FF`, `FM` übernehmen
- [ ] Globale Styles im Root-Component injizieren
- [ ] `mode="embed"` Prop unterstützen
- [ ] Embed-ID festlegen: `tool-NEUER-NAME`
- [ ] Responsive Breakpoint 800px testen
- [ ] Zahlen immer mit `de-DE` Locale + Monospace
- [ ] OG-Image erstellen
