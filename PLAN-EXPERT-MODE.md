# Expert Mode: zvE-Direkteingabe & Personengesellschaften

## Context

Die Brutto→zvE-Approximation (SV + 1.230€ WK + 36€ SA) ist die größte Schwäche des Rechners. Wer optimiert (echte WK, Sonderausgaben, etc.) hat ein deutlich niedrigeres zvE als modelliert. Zusätzlich fehlt jede Modellierung von Gewerbesteuer — relevant für Gewerbetreibende und Personengesellschaften (GbR, OHG, KG).

**Ziel:** Opt-in Expert-Mode mit (1) direkter zvE-Eingabe und (2) Gewerbesteuer-Modellierung.

---

## 1. Neue State-Variablen

```
expert: boolean (false)              — Expert-Toggle
inputMode: "brutto" | "zve"         — Eingabemodus
directZvE: number (0)               — Direkte zvE-Eingabe
hebesatz: number (400)              — GewSt-Hebesatz (200–900%)
```

Erwerbsart erweitern: `"a"` | `"f"` (Freiberufler) | `"g"` (Gewerbe) | `"p"` (Pers.ges.)
- Altes `"s"` = `"f"` (Backward-Compat)
- Abgeleitete Booleans: `isSelbst = ea !== "a"`, `isGewerbe = ea === "g" || ea === "p"`

---

## 2. Neue Berechnung: `gewStCalc(gewinn, hebesatz)`

```
Freibetrag:      24.500 € (nur natürliche Personen / PersGes)
Gewerbeertrag:   max(0, gewinn − 24.500)
Messbetrag:      floor(gewerbeertrag × 3,5%)
GewSt:           floor(messbetrag × hebesatz / 100)
§35-Anrechnung:  min(3,8 × messbetrag, tatsächliche ESt)
```

Platzierung: neben `svCalc()` und `est()` im CORE MATH Block (~Zeile 38).

---

## 3. Modifikation Berechnungskette (`r` useMemo)

### Pfad A: zvE direkt (`inputMode === "zve"`)
- `svCalc` überspringen → `sv = { tot: 0, abz: 0, ... }`
- `zvGes = directZvE` (bei Zusammenveranlagung: Gesamt-zvE, Splitting halbiert)
- `familyCalc(directZvE, ...)` wie bisher
- Netto: `zvE − ESt − Soli ± Kindergeld` (kein "echtes" Netto, Label: "Einkommen nach Steuern")
- Partner-Brutto-Slider ausblenden (irrelevant)

### Pfad B: Gewerbesteuer (`isGewerbe`)
- Input = Gewinn (kein SV, nur 36€ SA-Pauschbetrag wie bisher Selbständig)
- `gew = gewStCalc(gewinn, hebesatz)` — gleich für SQ und Szenario
- §35-Credit: `credit35 = min(gew.maxCredit, est)` — **unterschiedlich** für SQ vs Szenario!
- Soli-Basis: `estForSoli` **nach** §35-Anrechnung (§3 SolZG → festzusetzende ESt)
- Neue Return-Felder: `gewSt`, `messbetrag`, `credit35B`, `credit35S`

---

## 4. UI-Design

### 4a. Expert-Toggle
Header-Button neben bestehenden Toggles (Screenshot, Quellen, Formeln):
```
[Experte] — gleicher Button-Style wie [Formeln]
```

### 4b. Eingabemodus (nur wenn expert=true)
Zwei-Button-Toggle über dem Brutto-Slider:
```
[Brutto eingeben]  [zvE direkt]
```
Bei "zvE direkt":
- Slider-Label: "zu versteuerndes Einkommen"
- Erwerbsart-Toggle ausblenden
- zvE-Summary-Box ausblenden
- Partner-Brutto ausblenden (Zusammenveranlagung = Gesamt-zvE)

### 4c. Erweiterte Erwerbsart (nur wenn expert=true UND inputMode="brutto")
Vier statt zwei Buttons:
```
[Angestellt]  [Freiberufler]  [Gewerbe]  [Pers.ges.]
```
Im Basic-Mode bleiben die zwei Buttons, `"s"` wird intern zu `"f"`.

### 4d. Hebesatz-Slider (nur wenn isGewerbe)
Unter Erwerbsart:
```
Sl: Hebesatz 200%–900%, Step 5, Default 400%
Hinweis: "Freibetrag 24.500 € · Messzahl 3,5% · §35 Anrechnung 3,8×"
```

### 4e. GewSt-Info-Box (nur wenn isGewerbe)
Unter zvE-Summary, gleicher Tag-Style:
```
Gewerbeertrag: XX.XXX € · Messbetrag: X.XXX €
GewSt: X.XXX € · §35: −X.XXX € (SQ) / −X.XXX € (Sz.)
```

---

## 5. Abrechnung-Tabelle

### Bei inputMode="zve":
| Position | SQ | Szenario | Δ |
|---|---|---|---|
| zvE | ... | = | — |
| − ESt | ... | ... | ... |
| − Soli | ... | ... | ... |
| ± Kindergeld | ... | ... | ... |
| **Einkommen nach Steuern** | ... | ... | ... |

SV-Zeilen entfallen. Label "Netto" → "Einkommen nach Steuern".

### Bei isGewerbe:
Zusätzliche Zeilen einfügen:
| − Gewerbesteuer | ... | = | — |
| + §35 Anrechnung | ... | ... | ... |
| = ESt nach Anrechnung | ... | ... | ... |

GewSt ist gleich in beiden Spalten, §35-Credit unterscheidet sich.

---

## 6. URL-Encoding

Neue Parameter in `encSt()`/`decURL()`:
| Key | Wert | Default | |
|---|---|---|---|
| `ex` | `1` | absent | Expert mode |
| `im` | `z` | absent | inputMode=zve |
| `dz` | int | 0 | directZvE |
| `hs` | int | 400 | Hebesatz |

Erwerbsart: `ea` akzeptiert jetzt auch `"f"`, `"g"`, `"p"`.

---

## 7. Resets

### `aPre()` (Szenario-Wechsel):
Zusätzlich zurücksetzen: `setExpert(false)`, `setInputMode("brutto")`, `setDirectZvE(0)`, `setHebesatz(400)`

### `applyTaxpayer()` (Beispiel-Wechsel):
Neue Defaults: `im: "brutto"`, `dz: 0`, `hs: 400`. Expert-Schnellauswahl-Presets:
```
{ l: "Freiberufler", v: 80000, opts: { ea: "f" } }
{ l: "Gewerbe 60k", v: 60000, opts: { ea: "g" } }
{ l: "GbR Partner", v: 120000, opts: { ea: "p" } }
```
Nur sichtbar wenn expert=true.

---

## 8. Edge Cases

1. **zvE direkt + Zusammenveranlagung**: Eingegebenes zvE = Gesamt-zvE. Splitting halbiert. Kein Partner-Slider.
2. **§35-Credit > ESt**: Credit gedeckelt auf tatsächliche ESt → ESt kann nicht negativ werden.
3. **Soli-Basis bei GewSt**: Soli auf festzusetzende ESt (nach §35-Credit), nicht davor.
4. **GewSt + Splitting**: GewSt berechnet sich aus Gewinn (vor Splitting). §35-Credit auf die gesplittete ESt.
5. **Kindergeld bei zvE-direkt**: Günstigerprüfung funktioniert normal. Kindergeld als Fußnote ("nicht in Abrechnung, da kein Brutto").
6. **Chart-Marker**: Bei zvE-direkt `directZvE` statt `r.zv` für die vertikale Markerlinie.
7. **Fiskal-Sektion**: Unverändert (nur ESt+Soli, bundesweit). Hinweis: "GewSt ist Gemeindesteuer, nicht enthalten."

---

## 9. Implementierungsreihenfolge

1. State + URL-Encoding (`expert`, `inputMode`, `directZvE`, `hebesatz`, erweiterte `erwerbsart`)
2. `gewStCalc()` Funktion
3. Hauptberechnung (`r` useMemo) — Branching für zvE-direkt und GewSt
4. Expert-Toggle-Button im Header
5. Eingaben-Sidebar: Input-Mode-Toggle, erweiterte Erwerbsart, Hebesatz-Slider
6. Abrechnung-Tabelle: Konditionale Zeilen
7. Hero-Box + KPIs: Label-Anpassungen, GewSt-KPIs
8. Math-Display: GewSt-Berechnungsschritte
9. Resets (aPre, applyTaxpayer)

---

## 10. Verifikation

- [ ] Basic-Mode unverändert (kein visueller Unterschied ohne Expert-Toggle)
- [ ] Expert-Toggle ein/aus: alle Expert-UI-Elemente erscheinen/verschwinden
- [ ] zvE-direkt: Eingabe 50.000€ → ESt muss exakt dem Tarif entsprechen
- [ ] zvE-direkt + Zusammenveranlagung: Splitting korrekt (zvE/2)
- [ ] Gewerbe: Gewinn 100.000€, Hebesatz 400% → GewSt, §35-Credit prüfen
- [ ] §35-Credit nicht > ESt (kleiner Gewinn testen)
- [ ] URL-Sharing: Expert-Parameter roundtrippen (encode → decode → gleiche Werte)
- [ ] Alte URLs ohne Expert-Parameter → Basic-Mode, keine Fehler
- [ ] Preset-Wechsel → Expert-Mode wird zurückgesetzt
- [ ] Szenario-Vergleich funktioniert in allen Modi (SQ vs Reform)

---

## Betroffene Datei

- `/Users/ljb/WebstormProjects/32a/src/App.tsx` — einzige Datei (State, Berechnung, UI, URL)
