# Steuertarif-Simulator

**Einkommensteuer-Tarifrechner nach §32a EStG — Veranlagungszeitraum 2026**

[steuerreform.sky-lab.de](https://steuerreform.sky-lab.de)

Tarifänderungen modellieren, Netto-Impact berechnen und die Fiskalwirkung auf ~42,5 Mio. Steuerpflichtige schätzen.

## Features

- **Tarifzonen-Slider** — Grundfreibetrag, Zonengrenzen, Spitzen- & Reichensteuersatz, Eingangssteuersatz frei konfigurierbar
- **Splitting-Reform** — Drei Modi: Splitting (Status Quo), Abschaffen (ersatzlos, 1 GFB) und Individualbesteuerung (je eigener GFB)
- **Partnereinkommen** — Gesamt-Brutto + Anteil Partner für realistische Splitting-Berechnung
- **Splittingvorteil-Anzeige** — Ersparnis ggü. Grundtarif, abhängig von Einkommensverteilung im Paar
- **Kinderfreibetrag & Kindergeld** — Günstigerprüfung (§31/§32), bis zu 6 Kinder
- **Alleinerziehende** — Entlastungsbetrag nach §24b
- **Erwerbsart** — Angestellt (mit SV-Berechnung) oder Selbständig (ohne SV)
- **Solidaritätszuschlag** — Ein-/Ausschalten zur Modellierung der Abschaffung
- **Fiskalschätzung** — Aggregierte Aufkommenswirkung mit gewichteten Paar-Typen (Alleinverdiener, StKl III/V, StKl IV/IV)
- **Dezilanalyse** — Steuerlastverteilung nach Einkommensdezilen (Status Quo vs. Szenario)
- **Grenzsteuersatz-Chart** — Visualisierung von Grenz- und Durchschnittssteuersatz
- **Szenarien** — Vorgefertigte Reformvorschläge (Klingbeil-Modell, Mittelstandsbauch, Flat Tax u.a.)
- **Teilen** — Szenario-Link kopieren oder direkt als Tweet posten
- **WCAG AA** — Alle Farben mit mindestens 4.8:1 Kontrastverhältnis

## Rechtsgrundlagen & Quellen

- §32a EStG 2026 (Steuerfortentwicklungsgesetz v. 23.12.2024, BGBl. 2024 I Nr. 449)
- Lohn- und Einkommensteuerstatistik 2021 (Destatis) — ~31% Splittingtarif-Nutzer
- DIW Wochenbericht 41/2020 — ~25,6 Mrd. € Splitting-Effekt p.a. (Bach/Fischer/Haan/Wrohlich)
- Destatis Steuerklassenwahl 2020 — Einkommensverteilung unter Ehepaaren
- Sozialversicherungsbeiträge & Beitragsbemessungsgrenzen 2026
- Kindergeld 2025 (259€/Monat), Kinderfreibetrag (§32 Abs. 6)

## Entwicklung

```bash
npm install
npm run dev            # Vite Dev-Server mit HMR
```

## Build

```bash
npm run build              # → dist/standalone/
npm run build:embed        # → dist/embed/tool.js (für Blog-Einbettung)
```

## Disclaimer

Statische Simulation ohne Verhaltensanpassung (static scoring). Fiskalschätzung mit gewichteter Splitting-Modellierung (~31% Splittingtarif, Paar-Typen: 22% Alleinverdiener, 39% StKl III/V ~70/30, 36% StKl IV/IV ~52/48). Kein Kindergeld/KFB in der Aggregation. Einkommensverteilung Destatis 2021 (nicht inflationsbereinigt). Grobe Größenordnung, keine Prognose. **Keine Gewähr.**

## Autor

**Leon J. Bergmann** — Solution Architect · Digital Tax Transformation

- [leonjbergmann.com](https://leonjbergmann.com)
- [@LeonJBergmann](https://x.com/LeonJBergmann)
