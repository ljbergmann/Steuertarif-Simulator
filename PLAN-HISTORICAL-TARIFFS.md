# Historische Tarife 1958–2026 mit Inflationsbereinigung

## Context
Der Simulator soll alle deutschen ESt-Tarife seit 1958 abbilden können — mit Umschaltung nominal/real (VPI-bereinigt auf 2026-Kaufkraft). Das erfordert eine flexible Tarif-Engine, da sich die Formelstruktur 4x grundlegend geändert hat.

## Historische Tarif-Epochen

| Epoche | Zonen | Max. Grad | Besonderheit |
|--------|-------|-----------|-------------|
| 1958–1974 | 4+Top | Kubisch (3) | Flat 20% Eingangszone, Top 53% |
| 1975–1989 | 5 | Quartisch (4) Horner | Linearzone 22%, Top 56% |
| 1990–1995 | 3 | Quadratisch (2) | Eine Progressionszone, Top 53% |
| 1996–2006 | 4 | Quadratisch (2) | Zwei Progressionszonen, GFB verdoppelt |
| 2007–2026 | 5 | Quadratisch (2) | + Reichensteuer 45% |

## Architektur: Flexible Tarif-Engine

### Neues Tarif-Format
Statt fester `est()`-Funktion ein generisches **Bracket-Array** pro Tarif:

```js
const TARIFFS = {
  "2026": {
    label: "2026 (Steuerfortentwicklungsgesetz)",
    currency: "EUR",
    zones: [
      { from: 0,      to: 12348,  type: "free" },
      { from: 12348,  to: 17799,  type: "quad", a: 914.51, b: 1400, base: 12348, div: 10000 },
      { from: 17799,  to: 69878,  type: "quad", a: 173.10, b: 2397, c: 1034.87, base: 17799, div: 10000 },
      { from: 69878,  to: 277825, type: "linear", rate: 0.42, const: 11135.63 },
      { from: 277825, to: Infinity, type: "linear", rate: 0.45, const: 19470.38 },
    ],
    vpiYear: 2026,
  },
  "1975": {
    label: "1975 (Steueränderungsgesetz)",
    currency: "DM",
    zones: [
      { from: 0,      to: 3029,   type: "free" },
      { from: 3029,   to: 16019,  type: "linear", rate: 0.22, offset: 3029 },
      { from: 16019,  to: 47999,  type: "horner", coeffs: [-49.2, 505.3, 3077], const: 2858, base: 16020, div: 10000 },
      { from: 47999,  to: 130019, type: "horner", coeffs: [0.1, -6.07, 109.95, 4800], const: 16266, base: 48000, div: 10000 },
      { from: 130019, to: Infinity, type: "linear", rate: 0.56, const: 18986 },
    ],
    vpiYear: 1975,
  },
  // ... weitere Jahre
};
```

### Generische `estGeneric()` Funktion

```js
function estGeneric(zvE, tariff) {
  for (const z of tariff.zones) {
    if (zvE <= z.to) {
      switch (z.type) {
        case "free": return 0;
        case "linear": return z.rate * zvE - (z.const || 0);
        case "quad": {
          const y = (zvE - z.base) / z.div;
          return (z.a * y + z.b) * y + (z.c || 0);
        }
        case "horner": {
          const y = (zvE - z.base) / z.div;
          let r = z.coeffs[0];
          for (let i = 1; i < z.coeffs.length; i++) r = r * y + z.coeffs[i];
          return r * y + (z.const || 0);
        }
      }
    }
  }
  return 0;
}
```

### Inflationsbereinigung
- VPI-Tabelle: `const VPI = { 1958: 17.4, 1975: 37.2, ..., 2026: 125.8 }` (Basis 2020=100, Destatis)
- DM→EUR: `/ 1.95583`
- Reale Anpassung: `zvE_real = zvE * VPI[2026] / VPI[tarifJahr]`
- Umschalter: "Nominal" zeigt Originalwerte, "Real (2026)" skaliert Zonengrenzen hoch
- Bei "Real": `zones[].from` und `zones[].to` mit VPI-Faktor multiplizieren, Koeffizienten anpassen

### UI-Erweiterung
1. **Tarif-Dropdown/Slider** — Jahresauswahl (1958–2026) als Vergleichstarif
2. **Nominal/Real Toggle** — Umschalter in der Chart-Ansicht
3. **Chart** — Dritte Kurve: historischer Grenzsteuersatz
4. **Währungshinweis** — "DM" / "EUR" Label
5. **Zeitstrahl** — Optional: visueller Zeitstrahl mit Tarif-Epochen

### Datenrecherche nötig
Exakte Koeffizienten aus Gesetzestexten für alle Schlüsseljahre:
- **1958, 1965** (kubisch, Proportionalzone)
- **1975, 1978, 1981, 1986, 1988** (Horner quartisch)
- **1990, 1993, 1995** (einzelne Quadratik)
- **1996, 1998, 1999, 2000, 2002** (zwei Quadratiken, GFB-Sprung)
- **2004, 2005, 2007, 2009, 2010** (Reichensteuer ab 2007)
- **2014–2026** (jährliche Kalte-Progression-Anpassungen)

### Quellen
- BMF Tarifhistorie (Uni Mainz PDF): macro.economics.uni-mainz.de
- buzer.de §32a historische Fassungen
- parmentier.de (Tarife 1958–2010)
- Destatis VPI Lange Reihen (1948–2025)
- Wikipedia: Tarifgeschichte der Einkommensteuer

### Kompatibilität mit bestehendem Code
- Bestehende `est(zv, params)` bleibt für **Szenario-Modus** (Slider)
- `estGeneric(zvE, tariff)` für **historischen Vergleich**
- Chart bekommt optionale dritte Kurve
- Fiskal: historischer Vergleich nicht sinnvoll (andere Einkommensverteilung), nur persönlich

## Phasen

### Phase 1: Engine + Datenstruktur
- `estGeneric()` implementieren (free/linear/quad/horner)
- TARIFFS-Objekt mit 5-6 Schlüsseljahren (1958, 1975, 1990, 2000, 2010, 2026)
- VPI-Tabelle
- Unit-Tests gegen bekannte Werte

### Phase 2: UI
- Jahresauswahl-Dropdown
- Nominal/Real Toggle
- Chart-Erweiterung (historische Kurve)
- Währungs-Label (DM/EUR)

### Phase 3: Vollständige Daten
- Alle Tarifjahre 1958–2026 (~25-30 Parametersätze)
- Quellenangaben pro Tarif

## Dateien
- `src/App.tsx` — UI, Chart-Erweiterung, Dropdown
- `src/tariffs.ts` (NEU) — TARIFFS-Objekt, VPI-Tabelle, estGeneric()

## Verification
- Stichproben: est(50.000 DM, 1975) gegen parmentier.de / BMF-Tabellen
- VPI-Skalierung: 1975er GFB (3.029 DM) × VPI-Faktor ≈ heutiger Kaufkraft-Äquivalent
- Chart: historische Kurve mit korrekten Zonengrenzen und Spitzensteuersätzen
