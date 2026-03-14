# Steuertarif-Simulator

**Einkommensteuer-Tarifrechner nach §32a EStG — Veranlagungszeitraum 2026**

[steuerreform.sky-lab.de](https://steuerreform.sky-lab.de)

Tarifänderungen modellieren, Netto-Impact berechnen und die Fiskalwirkung auf ~42,5 Mio. Steuerpflichtige schätzen.

## Features

- **Tarifzonen-Slider** — Grundfreibetrag, Zonengrenzen, Spitzen- & Reichensteuersatz, Eingangssteuersatz frei konfigurierbar
- **Splitting** — Zusammenveranlagung nach §32a Abs. 5
- **Kinderfreibetrag & Kindergeld** — Günstigerprüfung (§31/§32), bis zu 6 Kinder
- **Alleinerziehende** — Entlastungsbetrag nach §24b
- **Erwerbsart** — Angestellt (mit SV-Berechnung) oder Selbständig (ohne SV)
- **Solidaritätszuschlag** — Ein-/Ausschalten zur Modellierung der Abschaffung
- **Fiskalschätzung** — Aggregierte Aufkommenswirkung basierend auf Destatis-Einkommensverteilung 2021
- **Dezilanalyse** — Steuerlastverteilung nach Einkommensdezilen (Status Quo vs. Szenario)
- **Grenzsteuersatz-Chart** — Visualisierung von Grenz- und Durchschnittssteuersatz
- **Szenarien** — Vorgefertigte Reformvorschläge (FDP, Grüne, SPD, Mittelstandsbauch u.a.)
- **Teilen** — Szenario-Link kopieren oder direkt als Tweet posten

## Rechtsgrundlagen & Quellen

- §32a EStG 2026 (BMF-Referentenentwurf)
- Lohn- und Einkommensteuerstatistik 2021 (Destatis)
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
```

## Disclaimer

Statische Simulation ohne Verhaltensanpassung (static scoring). Grundtarif für die Fiskalschätzung — kein Splitting, kein Kindergeld/KFB in der Aggregation. Einkommensverteilung Destatis 2021 (nicht inflationsbereinigt). Grobe Größenordnung, keine Prognose. **Keine Gewähr.**

## Autor

**Leon J. Bergmann** — Solution Architect · Digital Tax Transformation

- [leonjbergmann.com](https://leonjbergmann.com)
- [@LeonJBergmann](https://x.com/LeonJBergmann)
