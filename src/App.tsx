import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const B26 = {
  grundfreibetrag: 12348, zone2End: 17799, zone3End: 69878, zone4End: 277825,
  y_coeff_a: 914.51, y_coeff_b: 1400, z_coeff_a: 173.10, z_coeff_b: 2397, z_const: 1034.87,
  spitzensteuersatz: 0.42, spitzen_const: 11135.63, reichensteuersatz: 0.45, reichen_const: 19470.38,
};
const SV = { kv: .146, kvZ: .021, rv: .186, av: .026, pv: .036, pvK: .006, bbKV: 66150, bbRV: 96600 };
const KFB_VOLL = 9756;   // Kinderfreibetrag pro Kind (Zusammenveranlagung)
const KFB_HALB = 4878;   // Kinderfreibetrag pro Kind (Einzelveranlagung)
const KG_JAHR = 3108;    // Kindergeld pro Kind/Jahr (259€ × 12)
const ALLEINERZ_BASIS = 4260;
const ALLEINERZ_ZUSCHLAG = 240;

// ═══════════════════════════════════════════════════════════════════════════════
// CORE MATH
// ═══════════════════════════════════════════════════════════════════════════════

// PV-Beitrag AN-Anteil (inkl. Kinderlosenzuschlag / Kinderabschlag)
function pvAN(kinder) {
  const base = SV.pv / 2; // 1,8% AN-Basis
  if (kinder === 0) return base + SV.pvK; // +0,6% Kinderlosenzuschlag (nur AN)
  if (kinder === 1) return base;
  return Math.max(0, base - 0.0025 * (Math.min(kinder, 5) - 1)); // −0,25% pro Kind ab 2., max 5
}

function svCalc(br, kinder) {
  const kp = Math.min(br, SV.bbKV), ra = Math.min(br, SV.bbRV);
  const kv = kp * (SV.kv + SV.kvZ) / 2, rv = ra * SV.rv / 2, av = ra * SV.av / 2;
  const pv = kp * pvAN(kinder);
  const tot = kv + rv + av + pv;
  const abz = kp * (SV.kv * .96 + SV.kvZ) / 2 + pv + rv + 1230 + 36;
  return { tot, abz, kv, rv, av, pv };
}

function est(zv, p) {
  if (zv <= p.grundfreibetrag) return 0;
  let tax;
  if (zv <= p.zone2End) { const y = (zv - p.grundfreibetrag) / 1e4; tax = (p.y_coeff_a * y + p.y_coeff_b) * y; }
  else if (zv <= p.zone3End) { const z = (zv - p.zone2End) / 1e4; tax = (p.z_coeff_a * z + p.z_coeff_b) * z + p.z_const; }
  else if (zv <= p.zone4End) tax = p.spitzensteuersatz * zv - p.spitzen_const;
  else tax = p.reichensteuersatz * zv - p.reichen_const;
  return Math.max(0, Math.floor(tax));
}

function zoneName(zv, p) {
  if (zv <= p.grundfreibetrag) return "Zone 1 · Grundfreibetrag";
  if (zv <= p.zone2End) return "Zone 2 · Progressionszone I";
  if (zv <= p.zone3End) return "Zone 3 · Progressionszone II";
  if (zv <= p.zone4End) return "Zone 4 · Spitzensteuersatz";
  return "Zone 5 · Reichensteuer";
}

function formulaStr(zv, p) {
  const f = (n) => Math.round(n).toLocaleString("de-DE");
  if (zv <= p.grundfreibetrag) return "ESt = 0";
  if (zv <= p.zone2End) { const y = (zv - p.grundfreibetrag) / 1e4; return `y = (${f(zv)} − ${f(p.grundfreibetrag)}) / 10.000 = ${y.toFixed(4)}\nESt = (${p.y_coeff_a.toFixed(2)} · y + ${p.y_coeff_b.toFixed(0)}) · y = ${f(est(zv, p))} €`; }
  if (zv <= p.zone3End) { const z = (zv - p.zone2End) / 1e4; return `z = (${f(zv)} − ${f(p.zone2End)}) / 10.000 = ${z.toFixed(4)}\nESt = (${p.z_coeff_a.toFixed(2)} · z + ${p.z_coeff_b.toFixed(2)}) · z + ${p.z_const.toFixed(2)} = ${f(est(zv, p))} €`; }
  if (zv <= p.zone4End) return `ESt = ${p.spitzensteuersatz.toFixed(2)} · ${f(zv)} − ${p.spitzen_const.toFixed(2)} = ${f(est(zv, p))} €`;
  return `ESt = ${p.reichensteuersatz.toFixed(2)} · ${f(zv)} − ${p.reichen_const.toFixed(2)} = ${f(est(zv, p))} €`;
}

function soli(e) { const fg = 18130; if (e <= fg) return 0; return Math.min(e * .055, (e - fg) * .119); }

function reParams(base, ov, er = .14) {
  const p = { ...base, ...ov };
  if (p.zone2End < p.grundfreibetrag) p.zone2End = p.grundfreibetrag;
  if (p.zone3End < p.zone2End) p.zone3End = p.zone2End;
  if (p.zone4End < p.zone3End) p.zone4End = p.zone3End;
  const zM = (p.zone3End - p.zone2End) / 1e4;
  let az;
  if (p.zone2End <= p.grundfreibetrag + 1) { p.z_coeff_b = er * 1e4; az = zM > 0 ? (p.spitzensteuersatz * 1e4 - p.z_coeff_b) / (2 * zM) : p.z_coeff_a; p.z_coeff_a = az; }
  else { az = p.z_coeff_a; p.z_coeff_b = p.spitzensteuersatz * 1e4 - 2 * az * zM; }
  const m3 = p.z_coeff_b / 1e4, yM = (p.zone2End - p.grundfreibetrag) / 1e4;
  p.y_coeff_b = er * 1e4; if (yM > 0) p.y_coeff_a = (m3 * 1e4 - p.y_coeff_b) / (2 * yM);
  p.z_const = (p.y_coeff_a * yM + p.y_coeff_b) * yM;
  const t3 = (az * zM + p.z_coeff_b) * zM + p.z_const;
  p.spitzen_const = p.spitzensteuersatz * p.zone3End - t3;
  p.reichen_const = p.reichensteuersatz * p.zone4End - (p.spitzensteuersatz * p.zone4End - p.spitzen_const);
  return p;
}

// ─── Family Tax Calculation ───
// Returns { est, estForSoli, kindergeld, freibetragWins }
// estForSoli: ESt basis for Soli/KiSt (always with Freibetrag per §32 Abs. 6 S. 3)
function familyCalc(zvE, kinder, params, zusammen) {
  const calcEst = zusammen
    ? (z) => 2 * est(Math.floor(z / 2), params)
    : (z) => est(z, params);
  const estBase = calcEst(zvE);
  if (kinder === 0) return { est: estBase, estForSoli: estBase, kindergeld: 0, freibetragWins: false };
  const fb = zusammen ? KFB_VOLL : KFB_HALB;
  const zveFB = Math.max(0, zvE - fb * kinder);
  const estWithFB = calcEst(zveFB);
  const ersparnis = estBase - estWithFB;
  const kg = KG_JAHR * kinder;
  if (ersparnis > kg) {
    return { est: estWithFB, estForSoli: estWithFB, kindergeld: 0, freibetragWins: true };
  }
  return { est: estBase, estForSoli: estWithFB, kindergeld: kg, freibetragWins: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESETS & DATA
// ═══════════════════════════════════════════════════════════════════════════════

const PRE = {
  status_quo: { l: "Status Quo 2026", d: "Geltendes Recht nach Steuerfortentwicklungsgesetz", o: {} },
  mittelstandsbauch: { l: "Mittelstandsbauch abschaffen + 49%", d: "Durchgehende Progression 14%→49%, Spitze ab 75k", o: { zone2End: 12348, zone3End: 75000, spitzensteuersatz: .49, reichensteuersatz: .49, zone4End: 277825 } },
  mindestlohn_gfb: { l: "Mindestlohn ESt-frei", d: "GFB auf 22.100€ (≈ zvE bei 28.912€ Brutto / 13,90€/h Vollzeit)", o: { grundfreibetrag: 22100, zone2End: 22100, zone3End: 75000 } },
  flat42: { l: "Flat 42% ab 60k", d: "Progressionszone bis 60k, dann 42%", o: { zone3End: 60000, spitzensteuersatz: .42 } },
  flat25: { l: "Flat Tax 25%", d: "Einheitssteuersatz 25% ab GFB (keine Progression)", o: { eingangssteuersatz: .25, zone2End: 12348, zone3End: 12348, spitzensteuersatz: .25, reichensteuersatz: .25, zone4End: 277825 } },
  gfb15: { l: "Grundfreibetrag 15.000€", d: "Höherer GFB, Zone 2 bis 20.000€", o: { grundfreibetrag: 15000, zone2End: 20000 } },
  klingbeil: { l: "Klingbeil-Modell", d: "Mittelstandsbauch weg, kein Soli, 49% ab 75k, Individualbesteuerung", o: { zone2End: 12348, zone3End: 75000, spitzensteuersatz: .49, reichensteuersatz: .49, zone4End: 277825 }, ns: true, sm: "individuell" },
};

const f = n => Math.round(n).toLocaleString("de-DE");
const fp = n => (n * 100).toFixed(1).replace(".", ",") + "%";
const fm = n => { const m = n / 1e9; if (Math.abs(m) >= 1) return `${m >= 0 ? "+" : ""}${m.toFixed(1).replace(".", ",")} Mrd. €`; return `${n / 1e6 >= 0 ? "+" : ""}${(n / 1e6).toFixed(0)} Mio. €`; };

const ID = [[5e3,42e5],[1e4,48e5],[15e3,45e5],[2e4,42e5],[25e3,39e5],[3e4,34e5],[35e3,3e6],[4e4,26e5],[45e3,22e5],[5e4,18e5],[55e3,15e5],[6e4,12e5],[65e3,95e4],[7e4,75e4],[75e3,6e5],[8e4,48e4],[9e4,68e4],[1e5,45e4],[12e4,5e5],[15e4,32e4],[2e5,2e5],[3e5,1e5],[5e5,45e3],[1e6,18e3],[2e6,5e3],[5e6,1500]];

const SPLIT_ANTEIL = .31; // ~31% der Steuerfälle nutzen Splittingtarif (Destatis LuESt 2021: 13,6 Mio. / 43,3 Mio.)
// Einkommensverteilung unter Splitting-Paaren (Destatis StKl / Mikrozensus)
// [Anteil innerhalb Splitting-Nutzer, Hauptverdiener-Anteil am Gesamteinkommen]
const SPLIT_TYPEN = [[.22, 1.0], [.39, .70], [.36, .52], [.03, .55]]; // Alleinverdiener / III-V / IV-IV / Sonstige
function fiscal(bp, sp, ns, splitMode) {
  let de = 0, ds = 0; const bk = [];
  for (const [z, n] of ID) {
    const eB_grund = est(z, bp);
    const eS_grund = est(z, sp);
    let eB, eS, sB_, sS_;
    if (splitMode !== "splitting") {
      // SQ: Splitting-Paare mit gewichteter Einkommensverteilung
      const eB_split = 2 * est(Math.floor(z / 2), bp);
      eB = eB_grund * (1 - SPLIT_ANTEIL) + eB_split * SPLIT_ANTEIL;
      sB_ = soli(eB_grund) * (1 - SPLIT_ANTEIL) + soli(eB_split) * SPLIT_ANTEIL;
      if (splitMode === "abschaffen") {
        // Ersatzlos: Gesamteinkommen → 1 GFB
        eS = eS_grund;
        sS_ = ns ? 0 : soli(eS_grund);
      } else {
        // Individualbesteuerung: gewichteter Mix über Paar-Typen
        let eS_indiv = 0, soliIndiv = 0;
        for (const [w, r] of SPLIT_TYPEN) {
          const z1 = Math.floor(z * r), z2 = z - z1;
          const e1 = est(z1, sp), e2 = est(z2, sp);
          eS_indiv += (e1 + e2) * w;
          soliIndiv += (soli(e1) + soli(e2)) * w;
        }
        eS = eS_indiv * SPLIT_ANTEIL + eS_grund * (1 - SPLIT_ANTEIL);
        sS_ = ns ? 0 : soliIndiv * SPLIT_ANTEIL + soli(eS_grund) * (1 - SPLIT_ANTEIL);
      }
    } else {
      eB = eB_grund;
      eS = eS_grund;
      sB_ = soli(eB_grund);
      sS_ = ns ? 0 : soli(eS_grund);
    }
    de += (eS - eB) * n; ds += (sS_ - sB_) * n;
    bk.push({ z, n, dp: (eS + sS_) - (eB + sB_), tB: (eB + sB_) * n, tS: (eS + sS_) * n });
  }
  return { t: de + ds, de, ds, bk };
}

function calcDeciles(bk) {
  const sorted = [...bk].sort((a, b) => a.z - b.z);
  const totalN = sorted.reduce((s, b) => s + b.n, 0);
  const decileSize = totalN / 10;
  const dec = Array.from({length: 10}, () => ({ tB: 0, tS: 0, n: 0, zMin: Infinity, zMax: 0 }));
  let consumed = 0;
  for (const b of sorted) {
    if (b.n === 0) continue;
    const taxPerPersonB = b.n > 0 ? b.tB / b.n : 0;
    const taxPerPersonS = b.n > 0 ? b.tS / b.n : 0;
    let remaining = b.n;
    while (remaining > 0.5) {
      const di = Math.min(Math.floor(consumed / decileSize), 9);
      const spaceInDecile = (di + 1) * decileSize - consumed;
      const take = Math.min(remaining, spaceInDecile);
      dec[di].tB += taxPerPersonB * take; dec[di].tS += taxPerPersonS * take;
      dec[di].n += take; dec[di].zMin = Math.min(dec[di].zMin, b.z); dec[di].zMax = Math.max(dec[di].zMax, b.z);
      consumed += take; remaining -= take;
    }
  }
  const totB = dec.reduce((s, d) => s + d.tB, 0), totS = dec.reduce((s, d) => s + d.tS, 0);
  return dec.map((d, i) => ({
    i: i + 1, n: Math.round(d.n), tB: d.tB, tS: d.tS,
    zMin: d.zMin === Infinity ? 0 : d.zMin, zMax: d.zMax,
    pctB: totB > 0 ? d.tB / totB : 0, pctS: totS > 0 ? d.tS / totS : 0,
  }));
}

const SRCS = [
  { l: "§32a EStG", d: "Einkommensteuertarif 2026, Steuerfortentwicklungsgesetz v. 23.12.2024 (BGBl. 2024 I Nr. 449)", u: "https://www.gesetze-im-internet.de/estg/__32a.html" },
  { l: "Tarifformeln 2026", d: "Formeln mit Koeffizienten und Zonengrenzen (finanz-tools.de)", u: "https://www.finanz-tools.de/einkommensteuer/berechnung-formeln/2026" },
  { l: "BMF Datensammlung 2025", d: "Einkommensverteilung, Steuerpflichtige nach Klassen (Fraunhofer FIT / Destatis)", u: "https://www.bundesfinanzministerium.de/Content/DE/Downloads/Broschueren_Bestellservice/datensammlung-zur-steuerpolitik-2025.pdf" },
  { l: "Destatis LuESt 2021", d: "Lohn- und Einkommensteuerstatistik — Vollerhebung ~42,5 Mio. Steuerpflichtige", u: "https://www.destatis.de/DE/Themen/Staat/Steuern/Lohnsteuer-Einkommensteuer/_inhalt.html" },
  { l: "SV-Rechengrößen 2026", d: "KV 14,6%+2,1%, RV 18,6%, AV 2,6%, PV 3,6%. BBG KV 66.150€, RV 96.600€", u: "https://www.bundesregierung.de/breg-de/themen/sozialversicherungswerte" },
  { l: "§3 SolZG", d: "Soli 5,5%, Freigrenze 18.130€, Milderungszone 11,9%", u: "https://www.gesetze-im-internet.de/solzg_1995/__3.html" },
  { l: "§32 Abs. 6 EStG", d: "Kinderfreibetrag 2026: 9.756€ (6.828€ Existenzminimum + 2.928€ BEA)", u: "https://www.gesetze-im-internet.de/estg/__32.html" },
  { l: "§31 EStG", d: "Kindergeld-Günstigerprüfung: 259€/Monat vs. Kinderfreibetrag", u: "https://www.gesetze-im-internet.de/estg/__31.html" },
  { l: "§24b EStG", d: "Entlastungsbetrag Alleinerziehende: 4.260€ + 240€/weiteres Kind", u: "https://www.gesetze-im-internet.de/estg/__24b.html" },
  { l: "DIW: Reform Ehegattensplitting", d: "~25,6 Mrd. € Mindereinnahmen p.a. durch Splitting (Bach/Fischer/Haan/Wrohlich 2020)", u: "https://www.diw.de/de/diw_01.c.800291.de/publikationen/wochenberichte/2020_41_1/reform_des_ehegattensplittings__realsplitting_mit_niedrigem_uebertragungsbetrag_ist_ein_guter_kompromiss.html" },
  { l: "Destatis: Steuerklassenwahl", d: "~31% Zusammenveranlagung, 39% der Ehepaare in StKl III/V (2020/2021)", u: "https://www.destatis.de/DE/Presse/Pressemitteilungen/2024/07/PD24_287_73.html" },
  { l: "Mindestlohn 2026", d: "13,90€/h seit 01.01.2026 (MiLoG), Vollzeit 2.080h = 28.912€/Jahr", u: "https://www.bundesregierung.de/breg-de/aktuelles/mindestlohn-steigt-2391010" },
  { l: "Median-Bruttoeinkommen", d: "52.000€ Vollzeit (Stepstone Gehaltsreport 2026 / Destatis Verdiensterhebung 2024)", u: "https://www.stepstone.de/e-recruiting/gehalt/gehaltsreport-deutschlands-gehaelter-im-fokus/" },
  { l: "Quellcode (GitHub)", d: "Open Source — Rechenlogik, Tarifparameter und Methodik transparent einsehbar", u: "https://github.com/ljbergmann/Steuertarif-Simulator" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// URL STATE
// ═══════════════════════════════════════════════════════════════════════════════

function encSt(s) {
  const p = new URLSearchParams();
  if (s.b !== 75000) p.set("b", s.b); if (s.pr !== "mittelstandsbauch") p.set("p", s.pr);
  if (s.gf !== B26.grundfreibetrag) p.set("gf", s.gf); if (s.z2 !== B26.zone2End) p.set("z2", s.z2);
  if (s.z3 !== B26.zone3End) p.set("z3", s.z3); if (s.sp !== B26.spitzensteuersatz) p.set("sp", Math.round(s.sp * 1e3));
  if (s.rs !== B26.reichensteuersatz) p.set("rs", Math.round(s.rs * 1e3)); if (s.z4 !== B26.zone4End) p.set("z4", s.z4);
  if (s.er !== .14) p.set("er", Math.round(s.er * 1e3));
  if (s.ns) p.set("ns", 1); if (s.sm !== "splitting") p.set("sm", s.sm === "abschaffen" ? "a" : "i"); if (s.b2) p.set("b2", s.b2); if (s.ki) p.set("ki", s.ki);
  if (s.v !== "einzel") p.set("v", "z"); if (s.kd > 0) p.set("kd", s.kd); if (s.ae) p.set("ae", 1);
  if (s.ea !== "a") p.set("ea", s.ea);
  return p.toString();
}

function decURL() {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  if (p.toString() === "") return null;
  return {
    pr: p.get("p") || "c",
    gf: parseInt(p.get("gf")) || B26.grundfreibetrag,
    z2: parseInt(p.get("z2")) || B26.zone2End,
    z3: parseInt(p.get("z3")) || B26.zone3End,
    sp: p.has("sp") ? parseInt(p.get("sp")) / 1e3 : B26.spitzensteuersatz,
    rs: p.has("rs") ? parseInt(p.get("rs")) / 1e3 : B26.reichensteuersatz,
    z4: parseInt(p.get("z4")) || B26.zone4End,
    er: p.has("er") ? parseInt(p.get("er")) / 1e3 : .14,
    ns: p.get("ns") === "1",
    sm: p.get("sm") === "a" ? "abschaffen" : p.get("sm") === "i" ? "individuell" : p.get("ks") === "1" ? "abschaffen" : "splitting",
    b2: parseInt(p.get("b2")) || 0,
    b: parseInt(p.get("b")) || null,
    ki: parseInt(p.get("ki")) || 0,
    v: p.get("v") === "z" ? "zusammen" : "einzel",
    kd: parseInt(p.get("kd")) || (p.get("k") === "1" ? 1 : 0), // backward compat
    ae: p.get("ae") === "1",
    ea: p.get("ea") || "a",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#fafaf8", card: "#ffffff", border: "#e8e5df", text: "#1a1a1a", sub: "#524d48", light: "#78726b",
  blue: "#1d5088", orange: "#a84a08", green: "#15632f", red: "#9e1826", accent: "#a84a08",
  cardHover: "#f5f3ef", tag: "#f0ece6",
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Sl({ label, value, onChange, min, max, step, format, inputMax }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const effectiveMax = inputMax || max;
  const startEdit = () => { setDraft(String(value)); setEditing(true); };
  const commitEdit = () => {
    setEditing(false);
    const raw = draft.replace(/[^0-9.,\-]/g, "").replace(",", ".");
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(Math.min(effectiveMax, Math.max(min, step < 1 ? n : Math.round(n / step) * step)));
  };
  const FF = "'Söhne', 'Inter', system-ui, -apple-system, sans-serif";
  const sliderVal = Math.min(value, max);
  return (<div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 12 }}>
      <span style={{ color: C.sub }}>{label}</span>
      {editing ? (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
               onBlur={commitEdit} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
               style={{ width: 100, textAlign: "right", color: C.orange, fontWeight: 600, fontSize: 12, fontFamily: FF, background: C.tag, border: `1px solid ${C.orange}`, borderRadius: 3, padding: "1px 4px", outline: "none" }} />
      ) : (
        <span onClick={startEdit} style={{ color: C.orange, fontWeight: 600, cursor: "text", borderBottom: `1px dashed ${C.border}`, paddingBottom: 1 }} title="Klicken zum Bearbeiten">
          {format ? format(value) : value}
        </span>
      )}
    </div>
    <input type="range" min={min} max={max} step={step} value={sliderVal} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: C.orange, cursor: "pointer" }} />
    {value > max && <div style={{ fontSize: 8, color: C.light, marginTop: 2 }}>Wert über Slider-Maximum — Eingabe per Klick auf den Wert</div>}
  </div>);
}

function Chart({ bp, sp, zvE, zusammen }) {
  const W = 680, H = 280, pad = { t: 16, r: 24, b: 38, l: 44 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b, mx = 300000, st = 1000;
  const pts = useMemo(() => {
    const b = [], s = [], eb = [], es = [];
    for (let i = 0; i <= mx; i += st) {
      b.push({ x: i + st / 2, r: (est(i + st, bp) - est(i, bp)) / st });
      s.push({ x: i + st / 2, r: (est(i + st, sp) - est(i, sp)) / st });
      // Durchschnittssteuersatz
      if (i + st > 0) {
        eb.push({ x: i + st, r: est(i + st, bp) / (i + st) });
        es.push({ x: i + st, r: est(i + st, sp) / (i + st) });
      }
    }
    return { b, s, eb, es };
  }, [bp, sp]);
  const tx = v => pad.l + (v / mx) * cW, ty = r => pad.t + cH - (r / .55) * cH;
  const pd = a => a.map((p, i) => `${i ? "L" : "M"}${tx(p.x).toFixed(1)},${ty(p.r).toFixed(1)}`).join("");
  const vx = zvE ? tx(Math.min(zvE, mx)) : null;
  const vxHalf = zusammen && zvE ? tx(Math.min(Math.floor(zvE / 2), mx)) : null;
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
    <rect width={W} height={H} fill="#fafaf8" rx="4" />
    {[0, .1, .2, .3, .4, .5].map(t => <g key={t}><line x1={pad.l} y1={ty(t)} x2={W - pad.r} y2={ty(t)} stroke="#e8e5df" strokeWidth=".7" /><text x={pad.l - 5} y={ty(t) + 3.5} textAnchor="end" fill={C.light} fontSize="9" fontFamily="'Söhne',system-ui,sans-serif">{(t * 100)}%</text></g>)}
    {[0, 50000, 100000, 150000, 200000, 250000, 300000].map(t => <g key={t}><line x1={tx(t)} y1={pad.t} x2={tx(t)} y2={H - pad.b} stroke="#e8e5df" strokeWidth=".4" /><text x={tx(t)} y={H - pad.b + 14} textAnchor="middle" fill={C.light} fontSize="9" fontFamily="'Söhne',system-ui,sans-serif">{(t / 1e3)}k</text></g>)}
    {/* Marginal rate fills */}
    <path d={`${pd(pts.b)} L${tx(mx)},${ty(0)} L${tx(0)},${ty(0)} Z`} fill={C.blue} fillOpacity=".06" />
    <path d={`${pd(pts.s)} L${tx(mx)},${ty(0)} L${tx(0)},${ty(0)} Z`} fill={C.orange} fillOpacity=".06" />
    {/* Effective rate lines (thin, dashed) */}
    <path d={pd(pts.eb)} fill="none" stroke={C.blue} strokeWidth="1" strokeDasharray="2,3" opacity=".5" />
    <path d={pd(pts.es)} fill="none" stroke={C.orange} strokeWidth="1" strokeDasharray="2,3" opacity=".5" />
    {/* Marginal rate lines */}
    <path d={pd(pts.b)} fill="none" stroke={C.blue} strokeWidth="2" />
    <path d={pd(pts.s)} fill="none" stroke={C.orange} strokeWidth="2" strokeDasharray="5,3" />
    {/* zvE markers */}
    {vxHalf && vxHalf < W - pad.r && <><line x1={vxHalf} y1={pad.t} x2={vxHalf} y2={H - pad.b} stroke={C.green} strokeWidth="1" strokeDasharray="2,2" opacity=".4" /><text x={vxHalf + 3} y={pad.t + 22} fill={C.green} fontSize="7" fontFamily="'Söhne',system-ui,sans-serif" opacity=".7">zvE/2 (Splitting)</text></>}
    {vx && vx < W - pad.r && <><line x1={vx} y1={pad.t} x2={vx} y2={H - pad.b} stroke={C.green} strokeWidth="1" strokeDasharray="3,2" opacity=".5" /><text x={vx + 3} y={pad.t + 10} fill={C.green} fontSize="8" fontFamily="'Söhne',system-ui,sans-serif">Dein zvE</text></>}
    <text x={W / 2} y={H - 3} textAnchor="middle" fill={C.light} fontSize="9" fontFamily="'Söhne',system-ui,sans-serif">zu versteuerndes Einkommen in €</text>
    {/* Legend */}
    <line x1={pad.l + 10} y1={pad.t + 8} x2={pad.l + 28} y2={pad.t + 8} stroke={C.blue} strokeWidth="2" />
    <text x={pad.l + 32} y={pad.t + 11.5} fill={C.sub} fontSize="9" fontFamily="'Söhne',system-ui,sans-serif">SQ Grenz</text>
    <line x1={pad.l + 100} y1={pad.t + 8} x2={pad.l + 118} y2={pad.t + 8} stroke={C.orange} strokeWidth="2" strokeDasharray="4,2" />
    <text x={pad.l + 122} y={pad.t + 11.5} fill={C.sub} fontSize="9" fontFamily="'Söhne',system-ui,sans-serif">Sz. Grenz</text>
    <line x1={pad.l + 190} y1={pad.t + 8} x2={pad.l + 208} y2={pad.t + 8} stroke={C.blue} strokeWidth="1" strokeDasharray="2,3" opacity=".5" />
    <text x={pad.l + 212} y={pad.t + 11.5} fill={C.light} fontSize="8" fontFamily="'Söhne',system-ui,sans-serif">Ø Steuersatz</text>
  </svg>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App({ mode = "standalone" }: { mode?: "standalone" | "embed" }) {
  const init = useMemo(() => decURL(), []);
  const fromLink = !!init;
  const defPre = PRE.mittelstandsbauch.o;

  // ─── State ───
  const [br, setBr] = useState(init?.b || 75000);
  const [kist, setKist] = useState(init?.ki || 0);
  const [pre, setPre] = useState(init ? (init.pr || "c") : "mittelstandsbauch");
  const [gf, sGF] = useState(init?.gf || (defPre.grundfreibetrag ?? B26.grundfreibetrag));
  const [z2, sZ2] = useState(init ? (init.z2 ?? B26.zone2End) : (defPre.zone2End ?? B26.zone2End));
  const [z3, sZ3] = useState(init?.z3 || (defPre.zone3End ?? B26.zone3End));
  const [sp, sSP] = useState(init ? (init.sp || B26.spitzensteuersatz) : (defPre.spitzensteuersatz ?? B26.spitzensteuersatz));
  const [rs, sRS] = useState(init ? (init.rs || B26.reichensteuersatz) : (defPre.reichensteuersatz ?? B26.reichensteuersatz));
  const [z4, sZ4] = useState(init?.z4 || (defPre.zone4End ?? B26.zone4End));
  const [er, sER] = useState(init ? (init.er || .14) : (defPre.eingangssteuersatz ?? .14));
  const [ns, sNS] = useState(init?.ns || false);
  const [splitMode, setSplitMode] = useState(init?.sm || "splitting");
  const [br2, sBR2] = useState(init?.b2 || 0);
  const [math, sMath] = useState(false);
  const [src, sSrc] = useState(false);
  const [ss, sSS] = useState(false);
  const [cop, sCop] = useState(false);
  const [surl, sSurl] = useState("");
  const [banner, sBanner] = useState(fromLink);
  const [showChangelog, setShowChangelog] = useState(() => {
    try { return localStorage.getItem("32a-changelog-v3") !== "1"; } catch { return true; }
  });
  const dismissChangelog = () => { setShowChangelog(false); try { localStorage.setItem("32a-changelog-v3", "1"); } catch {} };

  // ─── Erwerbsart ───
  const [erwerbsart, setErwerbsart] = useState(init?.ea || "a");
  const isSelbst = erwerbsart === "s";

  // ─── Family State (V2) ───
  const [veranlagung, setVeranlagung] = useState(init?.v || "einzel");
  const [kinder, setKinder] = useState(init?.kd || 0);
  const [alleinerziehend, setAlleinerziehend] = useState(init?.ae || false);

  const setV = useCallback(v => { setVeranlagung(v); if (v === "zusammen") setAlleinerziehend(false); if (v === "einzel") { setSplitMode("splitting"); sBR2(0); } }, []);
  const setK = useCallback(n => { setKinder(n); if (n === 0) setAlleinerziehend(false); }, []);

  // ─── Preset Apply ───
  const aPre = useCallback(k => {
    setPre(k); const p = PRE[k] || {}; const o = p.o || {};
    sGF(o.grundfreibetrag ?? B26.grundfreibetrag); sZ2(o.zone2End ?? B26.zone2End);
    sZ3(o.zone3End ?? B26.zone3End); sSP(o.spitzensteuersatz ?? B26.spitzensteuersatz);
    sRS(o.reichensteuersatz ?? B26.reichensteuersatz); sZ4(o.zone4End ?? B26.zone4End); sER(o.eingangssteuersatz ?? .14); sNS(p.ns || false); setSplitMode(p.sm || "splitting");
  }, []);

  // ─── Taxpayer Presets (set brutto + family) ───
  const applyTaxpayer = useCallback((v, opts) => {
    setBr(v);
    if (opts?.v) setVeranlagung(opts.v);
    if (opts?.kd !== undefined) setKinder(opts.kd);
    if (opts?.ae !== undefined) setAlleinerziehend(opts.ae);
    setErwerbsart(opts?.ea ?? "a");
    if (opts?.v === "zusammen") { setAlleinerziehend(false); sBR2(opts?.b2 ?? 0); }
    if (opts?.v === "einzel") { setSplitMode("splitting"); sBR2(0); }
  }, []);

  // ─── Derived ───
  const bp = B26;
  const sp2 = useMemo(() => reParams(B26, { grundfreibetrag: gf, zone2End: z2, zone3End: z3, spitzensteuersatz: sp, reichensteuersatz: rs, zone4End: z4 }, er), [gf, z2, z3, sp, rs, z4, er]);
  const zusammen = veranlagung === "zusammen";

  const r = useMemo(() => {
    // Bei Zusammenveranlagung: br = Gesamt, br1 = Person A, br2 = Person B
    const br1 = zusammen ? br - br2 : br;
    const sv1 = isSelbst
      ? { tot: 0, abz: 36, kv: 0, rv: 0, av: 0, pv: 0 }
      : svCalc(br1, kinder);
    const zveRaw = Math.max(0, Math.floor(br1 - sv1.abz));
    const entlastung = alleinerziehend && kinder > 0 && !zusammen
      ? ALLEINERZ_BASIS + ALLEINERZ_ZUSCHLAG * Math.max(0, kinder - 1) : 0;
    const zv = Math.max(0, zveRaw - entlastung);

    // Partner (nur bei Zusammenveranlagung)
    const sv2 = zusammen && br2 > 0 ? (isSelbst ? { tot: 0, abz: 36 } : svCalc(br2, 0)) : { tot: 0, abz: 0 };
    const zv2 = zusammen ? Math.max(0, Math.floor(br2 - sv2.abz)) : 0;
    const zvGes = zv + zv2;

    const keinSplitting = splitMode !== "splitting";
    const fcB = familyCalc(zvGes, kinder, bp, zusammen);
    let fcS;
    if (zusammen && splitMode === "abschaffen") {
      // Ersatzlos: Gesamteinkommen wie 1 Person, nur 1 GFB
      fcS = familyCalc(zvGes, kinder, sp2, false);
    } else if (zusammen && splitMode === "individuell") {
      // Individualbesteuerung: jeder Ehepartner separat, je eigener GFB
      const fc1 = familyCalc(zv, kinder, sp2, false);
      const fc2 = familyCalc(zv2, 0, sp2, false);
      fcS = { est: fc1.est + fc2.est, estForSoli: fc1.estForSoli + fc2.estForSoli, kindergeld: fc1.kindergeld, freibetragWins: fc1.freibetragWins };
    } else {
      fcS = familyCalc(zvGes, kinder, sp2, zusammen);
    }
    // Splittingvorteil: Grundtarif beider Einzeleinkommen vs. Splittingtarif
    const splitVorteilB = zusammen ? est(zv, bp) + est(zv2, bp) - 2 * est(Math.floor(zvGes / 2), bp) : 0;
    const splitVorteilS = zusammen && !keinSplitting ? est(zv, sp2) + est(zv2, sp2) - 2 * est(Math.floor(zvGes / 2), sp2) : 0;
    const sB = soli(fcB.estForSoli), sS = ns ? 0 : soli(fcS.estForSoli);
    const kB = kist > 0 ? fcB.estForSoli * kist / 100 : 0;
    const kS = kist > 0 ? fcS.estForSoli * kist / 100 : 0;

    const nB = br - sv1.tot - sv2.tot - fcB.est + fcB.kindergeld - sB - kB;
    const nS = br - sv1.tot - sv2.tot - fcS.est + fcS.kindergeld - sS - kS;

    return {
      zv, zv2, zvGes, zveRaw, entlastung, sv: sv1, sv2, br1,
      eB: fcB.est, eS: fcS.est, sB, sS, kB, kS,
      kgB: fcB.kindergeld, kgS: fcS.kindergeld,
      fbWinsB: fcB.freibetragWins, fbWinsS: fcS.freibetragWins,
      estForSoliB: fcB.estForSoli, estForSoliS: fcS.estForSoli,
      nB, nS,
      aB: br > 0 ? (fcB.est + sB + kB - fcB.kindergeld) / br : 0,
      aS: br > 0 ? (fcS.est + sS + kS - fcS.kindergeld) / br : 0,
      svB: splitVorteilB, svS: splitVorteilS,
    };
  }, [br, br2, kinder, alleinerziehend, zusammen, kist, bp, sp2, ns, splitMode, isSelbst]);

  const nd = r.nS - r.nB;
  const fi = useMemo(() => fiscal(bp, sp2, ns, splitMode), [bp, sp2, ns, splitMode]);
  const deciles = useMemo(() => calcDeciles(fi.bk), [fi]);

  const tarifWarning = useMemo(() => {
    const marginalAtZ3Start = sp2.z_coeff_b / 1e4;
    if (marginalAtZ3Start < 0) return "Der Grenzsteuersatz wird in der Progressionszone II negativ. Die Kombination aus hohem Grundfreibetrag, breiter Zone I und niedrigem Spitzensteuersatz ist mathematisch nicht darstellbar. Ergebnisse sind unzuverlässig.";
    return null;
  }, [sp2]);

  // ─── Sharing ───
  const share = useCallback(() => {
    const qs = encSt({ b: br, pr: pre, gf, z2, z3, sp, rs, z4, er, ns, sm: splitMode, b2: br2, ki: kist, v: veranlagung, kd: kinder, ae: alleinerziehend, ea: erwerbsart });
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    const url = qs ? `${base}?${qs}` : base;
    sSurl(url);
    navigator?.clipboard?.writeText(url).then(() => { sCop(true); setTimeout(() => sCop(false), 2500); });
    return url;
  }, [br, pre, gf, z2, z3, sp, rs, z4, er, ns, splitMode, br2, kist, veranlagung, kinder, alleinerziehend, erwerbsart]);

  const scenarioUrl = useMemo(() => {
    const qs = encSt({ b: 75000, pr: pre, gf, z2, z3, sp, rs, z4, er, ns, sm: splitMode, ki: 0, v: "einzel", kd: 0, ae: false, ea: "a" });
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return qs ? `${base}?${qs}` : base;
  }, [pre, gf, z2, z3, sp, rs, z4, er, ns, splitMode]);

  const composeTweet = useCallback(() => {
    const fiAbs = Math.abs(fi.t);
    const fiStr = fiAbs >= 1e9 ? `${(fiAbs / 1e9).toFixed(1).replace(".", ",")} Mrd. €` : `${(fiAbs / 1e6).toFixed(0)} Mio. €`;
    const fiDir = fi.t >= 0 ? "mehr" : "weniger";
    const personas = [{ label: "Mindestlohn", br: 28912 }, { label: "Median", br: 52000 }, { label: "85k", br: 85000 }];
    const impacts = personas.map(p => {
      const { abz } = svCalc(p.br, 0);
      const zv = Math.max(0, Math.floor(p.br - abz));
      const eB = est(zv, bp) + soli(est(zv, bp));
      const eS = est(zv, sp2) + (ns ? 0 : soli(est(zv, sp2)));
      const d = Math.round((p.br - svCalc(p.br, 0).tot - eS) - (p.br - svCalc(p.br, 0).tot - eB));
      return { ...p, d };
    });
    const parts = [];
    if (sp !== B26.spitzensteuersatz) parts.push(`Spitzensteuersatz ${fp(sp)}`);
    if (gf !== B26.grundfreibetrag) parts.push(`Grundfreibetrag ${f(gf)} €`);
    if (ns) parts.push("Soli weg");
    if (z2 <= gf + 1 && z2 !== B26.zone2End) parts.push("Mittelstandsbauch abschaffen");
    const reform = parts.length > 0 ? parts.join(". ") + "." : PRE[pre]?.l + "." || "Mein Szenario.";
    const impactLines = impacts.map(p => `${p.label}: ${p.d >= 0 ? "+" : ""}${f(p.d)} €/Jahr`).join(" · ");
    const top10 = deciles.find(d => d.i === 10);
    const top10pctS = top10 ? (top10.pctS * 100).toFixed(0) : "?";
    const lines = [`Mein Vorschlag für eine Steuerreform:`, `${reform}`, ``, `${impactLines}`, `Top 10% tragen ${top10pctS}% der Steuerlast. ${fiStr} ${fiDir} im Staatshaushalt.`, ``, `Was bedeutet das für dein Gehalt?`];
    const text = lines.join("\n");
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(scenarioUrl)}&via=LeonJBergmann`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }, [scenarioUrl, fi, sp, gf, ns, z2, pre, bp, sp2, deciles]);

  // ─── Styles ───
  const FF = "'Söhne', 'Inter', system-ui, -apple-system, sans-serif";
  const FM = "'Söhne Mono', 'JetBrains Mono', 'SF Mono', monospace";
  const cd = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, marginBottom: 14 };
  const st = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: C.light, marginBottom: 10, fontWeight: 600 };

  // ─── Family info text ───
  const familyInfo = [];
  if (zusammen) familyInfo.push("Splitting");
  if (kinder > 0) familyInfo.push(`${kinder} Kind${kinder > 1 ? "er" : ""}`);
  if (alleinerziehend) familyInfo.push("Alleinerz.");
  const familyStr = familyInfo.length > 0 ? ` · ${familyInfo.join(", ")}` : "";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FF, padding: ss ? 12 : "24px 16px", WebkitFontSmoothing: "antialiased" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
input[type=range]{height:4px;border-radius:2px;background:${C.border};-webkit-appearance:auto}
::selection{background:${C.orange};color:#fff}
@media(max-width:800px){.gm{grid-template-columns:1fr!important}}`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${C.text}`, paddingBottom: 10, marginBottom: ss ? 10 : 20, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-.02em" }}>Steuertarif-Simulator <span style={{ fontWeight: 400, color: C.light, fontSize: 13 }}>§32a EStG · VZ 2026</span> <span style={{ fontSize: 9, color: C.border, fontWeight: 400, verticalAlign: "middle" }}>v3.0</span></h1>
            {!ss && <p style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>Tarifänderungen modellieren · Netto-Impact & Fiskalwirkung berechnen · inkl. Splitting & Kindergeld</p>}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[
              { on: ss, click: () => sSS(v => !v), label: ss ? "✕ Screenshot" : "Screenshot", icon: "📷" },
              { on: false, click: share, label: cop ? "✓ Kopiert!" : "Link teilen", icon: "🔗" },
              { on: false, click: composeTweet, label: "Tweet", icon: "🐦" },
              { on: src, click: () => sSrc(v => !v), label: "Quellen", icon: "📚" },
              { on: math, click: () => sMath(v => !v), label: "Formeln", icon: "𝑓" },
            ].map((b, i) => <button key={i} onClick={b.click} style={{
              background: b.on ? C.text : C.card, color: b.on ? "#fff" : C.sub,
              border: `1px solid ${C.border}`, borderRadius: 4, padding: "5px 10px",
              fontSize: 10, fontFamily: FF, cursor: "pointer", fontWeight: 500,
            }}>{b.icon} {b.label}</button>)}
          </div>
        </div>

        {/* CHANGELOG */}
        {showChangelog && <div style={{ background: "#f0f7ff", border: `1px solid ${C.blue}30`, borderRadius: 6, padding: "12px 16px", marginBottom: 14, position: "relative" }}>
          <button onClick={dismissChangelog} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 14, fontFamily: FF }}>✕</button>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 6 }}>Neu in v3.0</div>
          <ul style={{ fontSize: 10, color: C.sub, lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>
            <li>Splitting-Reform: 3 Modi — Splitting / Abschaffen (1 GFB) / Individualbesteuerung (je eigener GFB)</li>
            <li>Partnereinkommen — Gesamt-Brutto mit Aufteilung auf beide Ehepartner</li>
            <li>Splittingvorteil-Anzeige mit realer Einkommensverteilung</li>
            <li>Fiskalschätzung mit gewichteten Paar-Typen (Alleinverdiener, StKl III/V, IV/IV)</li>
            <li>Klingbeil-Preset (Mittelstandsbauch weg, kein Soli, 49%, Individualbesteuerung)</li>
            <li>WCAG AA Farbkontrast</li>
          </ul>
        </div>}

        {/* CREATOR */}
        {mode === "standalone" && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <img src="/profile.jpg" alt="Leon J. Bergmann" style={{ width: 68, height: 68, borderRadius: "50%", flexShrink: 0, border: `3px solid ${C.border}`, objectFit: "cover" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Leon J. Bergmann</span>
              <span style={{ fontSize: 11, color: C.orange, fontWeight: 500 }}>Solution Architect · Digital Tax Transformation</span>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 5, lineHeight: 1.65 }}>
              Ich arbeite an der Schnittstelle zwischen internationalem Steuerrecht und Technologie — mit Fokus auf US-Steuer-Compliance für komplexe Strukturen. Diesen Simulator habe ich gebaut, weil in der Steuerdebatte zu viel behauptet und zu wenig nachgerechnet wird. Feedback, Fehler und Feature-Wünsche gerne direkt auf Twitter.
            </div>
            <div style={{ marginTop: 8 }}>
              <a href="https://x.com/LeonJBergmann" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: C.text, color: "#fff", fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 20, textDecoration: "none", fontFamily: FF }}>🐦 @LeonJBergmann auf Twitter</a>
              <a href="https://leonjbergmann.com" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: C.card, color: C.sub, fontSize: 11, fontWeight: 500, padding: "6px 14px", borderRadius: 20, textDecoration: "none", fontFamily: FF, border: `1px solid ${C.border}`, marginLeft: 6 }}>leonjbergmann.com</a>
            </div>
          </div>
        </div>}

        {src && <div style={{ ...cd, background: "#f8f6f2", borderColor: C.blue + "40" }}>
          <h3 style={{ ...st, color: C.blue }}>Quellen & Rechtsgrundlagen</h3>
          {SRCS.map((s, i) => <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{s.l}</div>
            <div style={{ fontSize: 10, color: C.sub, margin: "1px 0 2px" }}>{s.d}</div>
            <a href={s.u} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.blue, wordBreak: "break-all", textDecoration: "none" }}>{s.u}</a>
          </div>)}
          <div style={{ fontSize: 9, color: C.light, marginTop: 6, lineHeight: 1.6 }}>
            <b style={{ color: C.sub }}>Methodik:</b> zvE via Werbungskostenpauschale (1.230€), SA-PB (36€), Vorsorgeaufwendungen (AN-Anteil KV·96%/PV/RV).
            Modus „Selbständig": keine SV, nur SA-Pauschbetrag (36€) als Abzug — vereinfacht für Freiberufler/Gewerbetreibende ohne AN-Verhältnis.
            Berechnung nach Grundtarif (Einzelveranlagung) oder Splittingtarif (§32a Abs. 5). Kinderfreibetrag (§32 Abs. 6) mit Günstigerprüfung (§31) gegen Kindergeld (259€/Monat).
            Entlastungsbetrag Alleinerziehende (§24b). PV-Staffelung nach Kinderzahl (PUEG 2023).
            Fiskalschätzung: Statische Simulation ohne Verhaltensanpassung (static scoring).
            {splitMode !== "splitting" ? "Splitting-Effekt modelliert (~31% der Steuerpflichtigen, Alleinverdiener-Annahme — konservative Schätzung)." : "Grundtarif (kein Splitting)."}{" "}Ohne Kindergeld/KFB. Keine Unterscheidung nach Erwerbsart.
            Einkommensverteilung Destatis 2021 (~5 Jahre alt). Grobe Größenordnung, keine Prognose.
            Szenario-Koeffizienten automatisch aus Zonengrenzen abgeleitet (Stetigkeit gesichert). <b style={{ color: C.red }}>Keine Gewähr.</b>
          </div>
        </div>}

        {surl && <div style={{ ...cd, padding: 10 }}><div style={{ fontSize: 9, color: C.sub, marginBottom: 3 }}>Teilbarer Link:</div>
          <div style={{ fontSize: 9, color: C.blue, wordBreak: "break-all", background: C.tag, padding: 6, borderRadius: 3, fontFamily: FM }}>{surl}</div></div>}

        <div className="gm" style={{ display: ss ? "block" : "grid", gridTemplateColumns: "minmax(260px, 310px) 1fr", gap: 22, alignItems: "start" }}>
          {!ss && <div>
            {/* ─── EINGABEN ─── */}
            <div style={cd}>
              <h3 style={st}>Eingaben</h3>
              <Sl label={zusammen ? "Gesamt-Brutto Haushalt" : isSelbst ? "Gewinn / Einkünfte (vor Steuern)" : "Brutto-Jahresgehalt"} value={br} onChange={v => { setBr(v); if (br2 > v) sBR2(v); }} min={10000} max={500000} step={1000} inputMax={100000000} format={v => v >= 1e6 ? `${(v/1e6).toFixed(1).replace(".",",")} Mio. €` : `${f(v)} €`} />

              {/* Erwerbsart */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.light, marginBottom: 4 }}>Erwerbsart:</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ k: "a", l: "Angestellt" }, { k: "s", l: "Selbständig" }].map(v =>
                    <button key={v.k} onClick={() => setErwerbsart(v.k)} style={{
                      flex: 1, background: erwerbsart === v.k ? C.tag : C.card,
                      border: `1px solid ${erwerbsart === v.k ? C.orange : C.border}`,
                      borderRadius: 4, padding: "6px 4px", cursor: "pointer", fontFamily: FF,
                      fontSize: 9, fontWeight: erwerbsart === v.k ? 600 : 400,
                      color: erwerbsart === v.k ? C.orange : C.text,
                    }}>{v.l}</button>)}
                </div>
                {isSelbst && <div style={{ fontSize: 8, color: C.light, marginTop: 3 }}>Keine Sozialversicherung. Abzug: nur SA-Pauschbetrag (36€).</div>}
              </div>

              {/* Veranlagungsart */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.light, marginBottom: 4 }}>Veranlagungsart (§32a):</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ k: "einzel", l: "Einzelveranlagung" }, { k: "zusammen", l: "Zusammenveranlagung" }].map(v =>
                    <button key={v.k} onClick={() => setV(v.k)} style={{
                      flex: 1, background: veranlagung === v.k ? C.tag : C.card,
                      border: `1px solid ${veranlagung === v.k ? C.orange : C.border}`,
                      borderRadius: 4, padding: "6px 4px", cursor: "pointer", fontFamily: FF,
                      fontSize: 9, fontWeight: veranlagung === v.k ? 600 : 400,
                      color: veranlagung === v.k ? C.orange : C.text,
                    }}>{v.l}</button>)}
                </div>
              </div>
              {zusammen && <div style={{ marginBottom: 10 }}>
                <Sl label="davon Partner" value={br2} onChange={sBR2} min={0} max={br} step={1000} inputMax={br} format={v => v === 0 ? "0 € (Alleinverdiener)" : `${f(v)} €  (${Math.round(v / br * 100)}%)`} />
                <div style={{ fontSize: 8, color: C.light, marginTop: 2 }}>
                  {br2 === 0 ? "Alleinverdiener-Modell (maximaler Splittingvorteil)" : `Person A: ${f(br - br2)} € · Person B: ${f(br2)} €`}
                </div>
              </div>}

              {/* Kinder */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.light, marginBottom: 4 }}>Kinder unter 25 Jahre:</div>
                <div style={{ display: "flex", gap: 3 }}>
                  {[0,1,2,3,4,5,6].map(n =>
                    <button key={n} onClick={() => setK(n)} style={{
                      flex: 1, background: kinder === n ? C.tag : C.card,
                      border: `1px solid ${kinder === n ? C.orange : C.border}`,
                      borderRadius: 4, padding: "5px 0", cursor: "pointer", fontFamily: FF,
                      fontSize: 10, fontWeight: kinder === n ? 700 : 400,
                      color: kinder === n ? C.orange : C.text,
                    }}>{n}</button>)}
                </div>
                {kinder > 0 && <div style={{ fontSize: 8, color: C.light, marginTop: 3 }}>
                  KFB {f(zusammen ? KFB_VOLL * kinder : KFB_HALB * kinder)} € · KG {f(KG_JAHR * kinder)} €/Jahr
                </div>}
              </div>

              {/* Alleinerziehend */}
              {!zusammen && kinder > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: C.sub, marginBottom: 10 }}>
                  <input type="checkbox" checked={alleinerziehend} onChange={e => setAlleinerziehend(e.target.checked)} style={{ accentColor: C.orange }} />
                  Alleinerziehend (§24b: −{f(ALLEINERZ_BASIS + ALLEINERZ_ZUSCHLAG * Math.max(0, kinder - 1))} € zvE)
                </label>
              )}

              {/* Schnellauswahl */}
              <div style={{ fontSize: 9, color: C.light, marginBottom: 4 }}>Schnellauswahl:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 10 }}>
                {[
                  { l: "Mindestlohn", v: 28912, d: "13,90€/h Vollzeit", opts: {} },
                  { l: "Fachkraft", v: 45000, d: "Ohne Studium", opts: {} },
                  { l: "Median", v: 52000, d: "Stepstone 2025", opts: {} },
                  { l: "Freelancer", v: 65000, d: "Selbständig", opts: { ea: "s", v: "einzel", kd: 0, ae: false } },
                  { l: "Familie 2K", v: 75000, d: "Zusammen, 60/40", opts: { v: "zusammen", kd: 2, ae: false, b2: 30000 } },
                  { l: "Ehepaar", v: 85000, d: "45k / 40k", opts: { v: "zusammen", kd: 0, ae: false, b2: 40000 } },
                  { l: "Gutverdiener", v: 85000, d: "Obere ~15%", opts: {} },
                  { l: "Top 5%", v: 130000, d: "~130k zvE", opts: {} },
                  { l: "Alleinerz.", v: 35000, d: "1 Kind", opts: { v: "einzel", kd: 1, ae: true } },
                ].map(p => {
                  const active = br === p.v && (p.opts.ea ?? "a") === erwerbsart && (p.opts.v ?? veranlagung) === veranlagung && (p.opts.kd ?? kinder) === kinder;
                  return <button key={p.l} onClick={() => applyTaxpayer(p.v, p.opts)} style={{
                    background: active ? C.tag : C.card, border: `1px solid ${active ? C.orange : C.border}`,
                    borderRadius: 4, padding: "5px 4px", cursor: "pointer", textAlign: "center", fontFamily: FF,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: active ? C.orange : C.text }}>{p.l}</div>
                    <div style={{ fontSize: 7, color: C.light, marginTop: 1 }}>{p.d}</div>
                  </button>;
                })}
              </div>

              <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 11, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: C.sub }}>KiSt: <select value={kist} onChange={e => setKist(Number(e.target.value))} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontFamily: FF }}><option value={0}>keine</option><option value={8}>8%</option><option value={9}>9%</option></select></label>
              </div>

              {/* zvE Summary */}
              <div style={{ background: C.tag, borderRadius: 4, padding: 8, fontSize: 10, color: C.sub, lineHeight: 1.6, fontFamily: FM }}>
                {zusammen ? f(r.br1) : f(br)} € → −{f(r.sv.abz)} € {isSelbst ? "SA-PB" : "Vorsorge"}
                {r.entlastung > 0 && <> → −{f(r.entlastung)} € §24b</>}
                {" → "}<b style={{ color: C.text }}>zvE {f(r.zv)} €</b>
                {zusammen && br2 > 0 && <><br/>Partner: {f(br2)} € → −{f(r.sv2.abz)} € → zvE {f(r.zv2)} €</>}
                {zusammen && <><br/>Splitting: 2 × est({f(Math.floor(r.zvGes / 2))}){br2 > 0 ? ` (zvE gesamt: ${f(r.zvGes)} €)` : ""}</>}
                {kinder > 0 && <><br/>{r.fbWinsB ? "Freibetrag günstiger (SQ)" : `Kindergeld günstiger: ${f(r.kgB)} €/Jahr (SQ)`}</>}
              </div>

              <div style={{ background: "#fef9ef", border: "1px solid #e8dcc8", borderRadius: 4, padding: 8, fontSize: 8, color: C.sub, lineHeight: 1.5, marginTop: 8 }}>
                {zusammen
                  ? br2 === 0
                    ? "⚠ Zusammenveranlagung (§32a Abs. 5): Alleinverdiener-Modell (maximaler Splitting-Vorteil). Anteil Partner oben anpassen."
                    : `⚠ Zusammenveranlagung (§32a Abs. 5): Splitting auf Gesamteinkommen ${f(br)} €. Person A: ${f(br - br2)} €, Person B: ${f(br2)} €. SV separat berechnet.`
                  : "⚠ Einzelveranlagung (§32a Abs. 1 Grundtarif)."
                }
                {isSelbst && " Selbständig: Eingabe = Gewinn nach Betriebsausgaben. Keine SV, kein WK-Pauschbetrag — nur SA-Pauschbetrag (36€)."}
                {kinder > 0 && " Kinderfreibetrag mit Günstigerprüfung (§31). Soli/KiSt immer auf Basis Freibetrag (§32 Abs. 6)."}
                {" "}{splitMode !== "splitting" ? `Fiskalschätzung inkl. Splitting-Effekt (~31% Splittingtarif, Alleinverdiener-Annahme). Modus: ${splitMode === "abschaffen" ? "ersatzlos (1 GFB)" : "Individualbesteuerung (je eigener GFB)"}.` : "Fiskalschätzung ohne Splitting/Kindergeld."}
              </div>
            </div>

            {/* ─── SZENARIEN ─── */}
            <div style={cd}>
              <h3 style={st}>Szenarien</h3>
              {Object.entries(PRE).map(([k, v]) => <button key={k} onClick={() => aPre(k)} style={{
                display: "block", width: "100%", background: pre === k ? C.tag : C.card,
                border: `1px solid ${pre === k ? C.orange : C.border}`, borderRadius: 4,
                padding: "7px 10px", color: pre === k ? C.orange : C.text,
                fontSize: 11, fontFamily: FF, cursor: "pointer", textAlign: "left", marginBottom: 5,
              }}><div style={{ fontWeight: 600 }}>{v.l}</div><div style={{ fontSize: 9, color: C.light, marginTop: 1 }}>{v.d}</div></button>)}
            </div>

            {/* ─── TARIF ANPASSEN ─── */}
            <div style={cd}>
              <h3 style={st}>Tarif anpassen</h3>
              <Sl label="Eingangssteuersatz" value={er} onChange={v => { sER(v); setPre("c"); }} min={.01} max={.45} step={.005} format={fp} />
              <Sl label="Grundfreibetrag" value={gf} onChange={v => { sGF(v); setPre("c"); }} min={8000} max={30000} step={100} format={v => `${f(v)} €`} />
              <Sl label="Ende Progressionszone I" value={z2} onChange={v => { sZ2(v); setPre("c"); }} min={gf} max={40000} step={100} format={v => v <= gf ? "= GFB (1 Zone)" : `${f(v)} €`} />
              <Sl label="Ende Progressionszone II" value={z3} onChange={v => { sZ3(v); setPre("c"); }} min={40000} max={500000} step={1000} format={v => `${f(v)} €`} />
              <Sl label="Spitzensteuersatz" value={sp} onChange={v => { sSP(v); setPre("c"); }} min={.35} max={.55} step={.005} format={fp} />
              <Sl label="Reichensteuersatz" value={rs} onChange={v => { sRS(v); setPre("c"); }} min={.40} max={.60} step={.005} format={fp} />
              <Sl label="Reichensteuer ab" value={z4} onChange={v => { sZ4(v); setPre("c"); }} min={100000} max={500000} step={5000} format={v => `${f(v)} €`} />
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: C.sub }}><input type="checkbox" checked={ns} onChange={e => { sNS(e.target.checked); setPre("c"); }} style={{ accentColor: C.orange }} /> Soli abschaffen</label>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: C.light, marginBottom: 4 }}>Ehegattensplitting:</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[{ k: "splitting", l: "Splitting" }, { k: "abschaffen", l: "Abschaffen" }, { k: "individuell", l: "Individuell" }].map(v =>
                      <button key={v.k} onClick={() => { setSplitMode(v.k); setPre("c"); }} style={{
                        flex: 1, background: splitMode === v.k ? C.tag : C.card,
                        border: `1px solid ${splitMode === v.k ? C.orange : C.border}`,
                        borderRadius: 4, padding: "6px 4px", cursor: "pointer", fontFamily: FF,
                        fontSize: 9, fontWeight: splitMode === v.k ? 600 : 400,
                        color: splitMode === v.k ? C.orange : C.text,
                      }}>{v.l}</button>)}
                  </div>
                  {splitMode === "abschaffen" && <div style={{ fontSize: 8, color: C.red, marginTop: 3 }}>Gesamteinkommen → 1 GFB (unrealistisch hart)</div>}
                  {splitMode === "individuell" && <div style={{ fontSize: 8, color: C.orange, marginTop: 3 }}>Jeder behält eigenen GFB (realistischer Reformvorschlag)</div>}
                </div>
              </div>
            </div>
          </div>}

          {/* ═══════════ RIGHT COLUMN: RESULTS ═══════════ */}
          <div>
            {ss && <div style={{ background: C.tag, borderRadius: 4, padding: "6px 10px", marginBottom: 10, fontSize: 10, color: C.sub, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
              <span>{zusammen ? "Gesamt" : isSelbst ? "Gewinn" : "Brutto"} <b style={{ color: C.text }}>{f(br)} €</b>{zusammen && br2 > 0 ? ` (${Math.round(br2 / br * 100)}% Partner)` : ""} · zvE <b style={{ color: C.text }}>{f(zusammen ? r.zvGes : r.zv)} €</b>{familyStr}{isSelbst ? " · Selbständig" : ""}</span>
              <span><b style={{ color: C.orange }}>{PRE[pre]?.l || "Custom"}</b>{ns ? " · kein Soli" : ""}{splitMode === "abschaffen" ? " · Splitting weg" : splitMode === "individuell" ? " · Individualbesteuerung" : ""}</span>
            </div>}

            {banner && <div style={{ background: "#eef6ff", border: `1px solid #b8d4f0`, borderRadius: 6, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Jemand hat diesen Reformvorschlag mit dir geteilt</div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>Passe dein Brutto-Gehalt links an, um zu sehen was diese Reform für dich bedeuten würde.</div>
              </div>
              <button onClick={() => sBanner(false)} style={{ background: "transparent", border: "none", color: C.light, fontSize: 14, cursor: "pointer", padding: 4 }}>✕</button>
            </div>}

            {tarifWarning && <div style={{ background: "#fef2f2", border: `1px solid #f5c6c6`, borderRadius: 6, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.red }}>⚠ Ungültige Tarifkombination</div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{tarifWarning}</div>
            </div>}

            {splitMode !== "splitting" && <div style={{ background: "#fef9ef", border: "1px solid #e8dcc8", borderRadius: 6, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {splitMode === "abschaffen" ? "Splitting ersatzlos abschaffen" : "Individualbesteuerung"}
              </div>
              {splitMode === "abschaffen" ? <>
                <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.6 }}>
                  <b>Persönlich:</b> Das Gesamteinkommen wird wie bei einer Einzelperson besteuert — nur <b>ein Grundfreibetrag</b> ({f(gf)} €) statt zwei. Maximale Mehrbelastung für Ehepaare.
                </div>
                <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.6, marginTop: 4 }}>
                  <b>Fiskal:</b> SQ modelliert ~31% Splittingtarif-Nutzer (Alleinverdiener-Annahme). Szenario: Gesamteinkommen → 1 GFB. Obere Schätzung — so nicht realistisch umsetzbar.
                </div>
              </> : <>
                <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.6 }}>
                  <b>Persönlich:</b> Jeder Ehepartner wird separat besteuert — beide behalten ihren <b>eigenen Grundfreibetrag</b> ({f(gf)} €). Der Netto-Unterschied zu Splitting hängt von der Einkommensverteilung ab: je ungleicher, desto größer der Effekt.
                </div>
                <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.6, marginTop: 4 }}>
                  <b>Fiskal:</b> SQ modelliert ~31% Splittingtarif-Nutzer (Alleinverdiener-Annahme). Szenario: gewichtete Einkommensaufteilung (22% Alleinverdiener, 39% ~70/30, 36% ~50/50). DIW (2020): ~25,6 Mrd. € Splitting-Effekt p.a.
                </div>
              </>}
              {zusammen && br2 === 0 && <div style={{ fontSize: 10, color: C.orange, marginTop: 8, fontWeight: 600 }}>
                Hinweis: Bei Alleinverdiener (Partner = 0 €) ist die persönliche Steuer bei „Abschaffen" und „Individuell" identisch — der Unterschied zeigt sich erst bei zwei Einkommen. Partner-Anteil oben anpassen.
              </div>}
              {!zusammen && <div style={{ fontSize: 10, color: C.orange, marginTop: 8, fontWeight: 600 }}>
                Hinweis: Du bist in Einzelveranlagung — die Splitting-Reform betrifft deine persönliche Steuer nicht, nur die Fiskalschätzung. Für den persönlichen Effekt auf „Zusammenveranlagung" wechseln.
              </div>}
            </div>}

            {/* HERO */}
            <div style={{ background: nd > 0 ? "#f0f9f2" : nd < 0 ? "#fef2f2" : C.tag, border: `1px solid ${nd > 0 ? "#bbdfc4" : nd < 0 ? "#f5c6c6" : C.border}`, borderRadius: 6, padding: 20, marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.light, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Netto-Differenz pro Jahr{familyStr}</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: nd > 0 ? C.green : nd < 0 ? C.red : C.light, letterSpacing: "-.02em", fontFamily: FM }}>{nd > 0 ? "+" : ""}{f(nd)} €</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{f(Math.abs(nd / 12))} € / Monat {nd > 0 ? "mehr Netto" : nd < 0 ? "weniger Netto" : ""}</div>
              <button onClick={composeTweet} style={{ marginTop: 12, background: C.text, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 11, fontFamily: FF, fontWeight: 600, cursor: "pointer" }}>
                🐦 Dieses Ergebnis auf Twitter teilen
              </button>
            </div>

            {zusammen && r.svB > 0 && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>Splittingvorteil</div>
                <div style={{ fontSize: 9, color: C.light, marginTop: 2 }}>Ersparnis ggü. Grundtarif{br2 === 0 ? " · Alleinverdiener-Modell" : ` · ${f(br - br2)}/${f(br2)} €`}</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.blue, textTransform: "uppercase", letterSpacing: ".06em" }}>Status Quo</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: FM }}>{f(r.svB)} €</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.orange, textTransform: "uppercase", letterSpacing: ".06em" }}>Szenario</div>
                  {splitMode !== "splitting" ? <div style={{ fontSize: 11, fontWeight: 600, color: C.red, fontFamily: FM }}>{splitMode === "abschaffen" ? "abgeschafft" : "Individuell"}</div>
                    : <div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: FM }}>{f(r.svS)} €</div>}
                </div>
              </div>
            </div>}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[{ l: "ESt Status Quo", v: `${f(r.eB)} €`, c: C.blue }, { l: "ESt Szenario", v: `${f(r.eS)} €`, c: C.orange }, { l: "Ø Belastung", v: fp(r.aB), c: C.blue }, { l: "Ø Belastung", v: fp(r.aS), c: C.orange }].map((x, i) =>
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: x.c, fontWeight: 600, marginBottom: 2 }}>{x.l}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FM }}>{x.v}</div>
                </div>)}
            </div>

            {/* CHART */}
            <div style={cd}><h3 style={st}>Grenzsteuersatz & Durchschnittssteuersatz</h3><Chart bp={bp} sp={sp2} zvE={r.zv} zusammen={zusammen} /></div>

            {/* MATH */}
            {math && <div style={{ ...cd, background: "#f8f6f2" }}>
              <h3 style={{ ...st, color: C.blue }}>Berechnungsweg · zvE = {f(r.zv)} €{zusammen ? ` (Splitting: ${f(Math.floor(r.zv / 2))} €)` : ""}</h3>
              {[{ l: "Status Quo", p: bp, e: r.eB, c: C.blue }, { l: "Szenario", p: sp2, e: r.eS, c: C.orange }].map(x => {
                const zForFormula = zusammen ? Math.floor(r.zv / 2) : r.zv;
                return <div key={x.l} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: x.c, fontWeight: 600, marginBottom: 4 }}>{x.l}: {zoneName(zForFormula, x.p)}{zusammen ? " (je Hälfte)" : ""}</div>
                  <pre style={{ fontSize: 10, color: C.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: FM }}>{formulaStr(zForFormula, x.p)}{zusammen ? `\n× 2 = ${f(2 * est(zForFormula, x.p))} €` : ""}</pre>
                </div>;
              })}
              {kinder > 0 && <div style={{ fontSize: 10, color: C.sub, marginBottom: 8, padding: "6px 8px", background: "#f0ece6", borderRadius: 4, lineHeight: 1.6 }}>
                <b>Kinderfreibetrag:</b> {kinder} × {f(zusammen ? KFB_VOLL : KFB_HALB)} € = {f((zusammen ? KFB_VOLL : KFB_HALB) * kinder)} €<br/>
                <b>Kindergeld:</b> {kinder} × 259 €/Monat = {f(KG_JAHR * kinder)} €/Jahr<br/>
                <b>Günstigerprüfung (SQ):</b> {r.fbWinsB ? "Freibetrag günstiger" : "Kindergeld günstiger"}<br/>
                <b>Günstigerprüfung (Sz.):</b> {r.fbWinsS ? "Freibetrag günstiger" : "Kindergeld günstiger"}<br/>
                <i style={{ fontSize: 9 }}>Soli/KiSt immer auf Basis mit Freibetrag (§32 Abs. 6 S. 3)</i>
              </div>}
              <div style={{ fontSize: 10, color: C.sub }}><b>Soli (SQ):</b> {r.sB > 0 ? `min(${f(r.estForSoliB)}×5,5%, (${f(r.estForSoliB)}−18.130)×11,9%) = ${f(r.sB)} €` : `ESt-Basis ≤ 18.130€ → 0€`}{r.sB > 0 && r.estForSoliB * 0.055 > (r.estForSoliB - 18130) * 0.119 ? " ← Milderungszone" : r.sB > 0 ? " ← Voller Satz" : ""}</div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}><b>Soli (Szen.):</b> {ns ? "Abgeschafft → 0€" : r.sS > 0 ? `min(${f(r.estForSoliS)}×5,5%, (${f(r.estForSoliS)}−18.130)×11,9%) = ${f(r.sS)} €${r.estForSoliS * 0.055 > (r.estForSoliS - 18130) * 0.119 ? " ← Milderungszone" : " ← Voller Satz"}` : `ESt-Basis ≤ 18.130€ → 0€`}</div>
              {r.sB > 0 && r.sS > 0 && !ns && (
                (r.estForSoliB * 0.055 <= (r.estForSoliB - 18130) * 0.119) !== (r.estForSoliS * 0.055 <= (r.estForSoliS - 18130) * 0.119)
              ) && <div style={{ fontSize: 9, color: C.orange, marginTop: 6, padding: "6px 8px", background: "#fef9ef", border: "1px solid #e8dcc8", borderRadius: 4, lineHeight: 1.5 }}>
                <b>Hinweis:</b> Status Quo und Szenario befinden sich in unterschiedlichen Soli-Zonen (Milderungszone vs. voller Satz).
                In der Milderungszone beträgt der effektive Soli-Grenzsatz 11,9% statt 5,5% — das kann dazu führen, dass der Netto-Vorteil des Szenarios in bestimmten Einkommensbereichen schrumpft statt zu wachsen.
              </div>}
            </div>}

            {/* TABLE */}
            <div style={cd}>
              <h3 style={st}>Abrechnung{familyStr}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `2px solid ${C.text}` }}>
                  <th style={{ textAlign: "left", padding: "5px 0", color: C.sub, fontWeight: 500 }}>Position</th>
                  <th style={{ textAlign: "right", padding: "5px 0", color: C.blue, fontWeight: 500 }}>Status Quo</th>
                  <th style={{ textAlign: "right", padding: "5px 0", color: C.orange, fontWeight: 500 }}>Szenario</th>
                  <th style={{ textAlign: "right", padding: "5px 0", color: C.sub, fontWeight: 500 }}>Δ</th>
                </tr></thead>
                <tbody>
                {(() => {
                  const rows = [
                    [zusammen ? "Brutto Haushalt" : isSelbst ? "Gewinn" : "Brutto", br, br],
                    ...(!isSelbst ? [["– Sozialversicherung", r.sv.tot + r.sv2.tot, r.sv.tot + r.sv2.tot]] : []),
                    [r.fbWinsB || r.fbWinsS ? "– ESt (inkl. KFB)" : "– Einkommensteuer", r.eB, r.eS],
                    ["– Solidaritätszuschlag", r.sB, r.sS],
                  ];
                  if (kist > 0) rows.push(["– Kirchensteuer", r.kB, r.kS]);
                  if (kinder > 0 && (r.kgB > 0 || r.kgS > 0)) {
                    rows.push(["+ Kindergeld", -r.kgB, -r.kgS]); // negative = positive for display
                  }
                  return rows.map(([l, b, s], i) => {
                    const isKg = l.startsWith("+ Kindergeld");
                    const bv = isKg ? -b : b;
                    const sv2 = isKg ? -s : s;
                    const d = sv2 - bv;
                    return <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "5px 0", color: C.sub }}>{l}</td>
                      <td style={{ textAlign: "right", fontFamily: FM }}>{isKg ? `+${f(bv)}` : f(bv)} €</td>
                      <td style={{ textAlign: "right", fontFamily: FM }}>{isKg ? `+${f(sv2)}` : f(sv2)} €</td>
                      <td style={{ textAlign: "right", color: d > 0.5 ? C.red : d < -0.5 ? C.green : C.light, fontFamily: FM }}>{Math.abs(d) > 0.5 ? `${d > 0 ? "+" : ""}${f(d)}` : "–"}</td>
                    </tr>;
                  });
                })()}
                <tr style={{ borderTop: `2px solid ${C.text}` }}>
                  <td style={{ padding: "6px 0", fontWeight: 700 }}>Netto / Jahr</td>
                  <td style={{ textAlign: "right", color: C.blue, fontWeight: 700, fontFamily: FM }}>{f(r.nB)} €</td>
                  <td style={{ textAlign: "right", color: C.orange, fontWeight: 700, fontFamily: FM }}>{f(r.nS)} €</td>
                  <td style={{ textAlign: "right", color: nd > 0 ? C.green : nd < 0 ? C.red : C.light, fontWeight: 700, fontFamily: FM }}>{nd ? `${nd > 0 ? "+" : ""}${f(nd)}` : "–"}</td>
                </tr>
                <tr><td style={{ color: C.light, fontSize: 9, paddingTop: 2 }}>Netto / Monat</td><td style={{ textAlign: "right", color: C.light, fontSize: 9, fontFamily: FM }}>{f(r.nB / 12)} €</td><td style={{ textAlign: "right", color: C.light, fontSize: 9, fontFamily: FM }}>{f(r.nS / 12)} €</td><td style={{ textAlign: "right", color: C.light, fontSize: 9, fontFamily: FM }}>{nd ? `${nd > 0 ? "+" : ""}${f(nd / 12)}` : "–"}</td></tr>
                </tbody>
              </table>
              {kinder > 0 && <div style={{ fontSize: 8, color: C.light, marginTop: 6, fontStyle: "italic" }}>
                {r.fbWinsB !== r.fbWinsS
                  ? "Günstigerprüfung (§31): SQ und Szenario führen zu unterschiedlichen Ergebnissen."
                  : r.fbWinsB
                    ? "Günstigerprüfung (§31): Kinderfreibetrag ist in beiden Varianten günstiger als Kindergeld."
                    : "Günstigerprüfung (§31): Kindergeld ist in beiden Varianten günstiger. Soli/KiSt trotzdem auf KFB-Basis."
                }
              </div>}
            </div>

            {/* FISCAL */}
            <div style={cd}>
              <h3 style={st}>Fiskalische Wirkung · ~42,5 Mio. Steuerpflichtige</h3>
              <div style={{ textAlign: "center", padding: 14, marginBottom: 12, background: fi.t >= 0 ? "#f0f9f2" : "#fef2f2", borderRadius: 5, border: `1px solid ${fi.t >= 0 ? "#bbdfc4" : "#f5c6c6"}` }}>
                <div style={{ fontSize: 9, color: C.light, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Δ Steueraufkommen / Jahr</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: fi.t >= 0 ? C.green : C.red, fontFamily: FM }}>{fm(fi.t)}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 5, fontSize: 9, color: C.sub }}><span>ESt {fm(fi.de)}</span><span>Soli {fm(fi.ds)}</span></div>
              </div>
              <div style={{ fontSize: 9, color: C.light, marginBottom: 6 }}>Mehr-/Minderbelastung pro Steuerpflichtigen:</div>
              <div style={{ maxHeight: ss ? 260 : 180, overflowY: "auto" }}>
                {fi.bk.filter(b => b.z >= 1e4 && b.dp !== 0).map((b, i) => {
                  const mx2 = Math.max(...fi.bk.map(x => Math.abs(x.dp)), 1);
                  const w = Math.abs(b.dp) / mx2 * 100, m = b.dp > 0;
                  return <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, fontSize: 9 }}>
                    <span style={{ width: 36, textAlign: "right", color: C.sub, flexShrink: 0, fontFamily: FM }}>{b.z >= 1e6 ? `${(b.z / 1e6).toFixed(0)}M` : `${(b.z / 1e3).toFixed(0)}k`}</span>
                    <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                      <div style={{ position: "absolute", [m ? "left" : "right"]: 0, height: "100%", width: `${Math.min(w, 100)}%`, background: m ? C.red : C.green, borderRadius: 2 }} />
                    </div>
                    <span style={{ width: 56, textAlign: "right", color: m ? C.red : C.green, flexShrink: 0, fontFamily: FM }}>{b.dp > 0 ? "+" : ""}{f(b.dp)} €</span>
                    <span style={{ width: 50, textAlign: "right", color: C.border, flexShrink: 0, fontSize: 8 }}>({f(b.n)})</span>
                  </div>;
                })}
              </div>
              <div style={{ fontSize: 8, color: C.light, marginTop: 6 }}>Statische Simulation (kein Verhaltenseffekt). {splitMode !== "splitting" ? `Splitting-Effekt: ~31% der Steuerfälle nutzen Splittingtarif (Destatis LuESt 2021). SQ: Alleinverdiener-Annahme. ${splitMode === "individuell" ? "Szenario: Individualbesteuerung mit gewichteter Einkommensaufteilung (22% Alleinverdiener, 39% StKl III/V ~70/30, 36% IV/IV ~52/48, Destatis/Mikrozensus)." : "Szenario: ersatzlose Streichung (1 GFB)."} DIW (2020) schätzt ~25,6 Mrd. € Mindereinnahmen p.a.` : "Grundtarif für alle Steuerpflichtigen — kein Splitting (~31% nutzen Splittingtarif)."} Kein Kindergeld/KFB (~10 Mio. Steuerpflichtige mit Kindern). Einkommensverteilung: Destatis LuESt 2021 (≈42,5 Mio., nicht inflationsbereinigt auf 2026). Grobe Schätzung — tatsächliche Aufkommenswirkung kann ±10–20% abweichen.</div>
            </div>

            {/* CTA */}
            <div style={{ background: "#f0ece6", border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Hast du einen besseren Vorschlag?</div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>Bau dein eigenes Szenario und teile es — lass andere sehen was deine Reform für ihr Gehalt bedeuten würde.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={composeTweet} style={{ background: C.text, color: "#fff", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 11, fontFamily: FF, fontWeight: 600, cursor: "pointer" }}>🐦 Deinen Vorschlag tweeten</button>
                <button onClick={share} style={{ background: C.card, color: C.sub, border: `1px solid ${C.border}`, borderRadius: 20, padding: "8px 18px", fontSize: 11, fontFamily: FF, fontWeight: 500, cursor: "pointer" }}>{cop ? "✓ Kopiert!" : "🔗 Link kopieren"}</button>
              </div>
            </div>

            {/* DECILES */}
            <div style={cd}>
              <h3 style={st}>Steuerlastverteilung nach Dezilen</h3>
              <div style={{ fontSize: 9, color: C.light, marginBottom: 10 }}>Anteil am Gesamtaufkommen (ESt + Soli) — kumuliert von den höchsten Einkommen abwärts</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                <thead><tr style={{ borderBottom: `2px solid ${C.text}` }}>
                  <th style={{ textAlign: "left", padding: "4px 0", color: C.sub, fontWeight: 500 }}></th>
                  <th style={{ textAlign: "left", padding: "4px 0", color: C.light, fontWeight: 400 }}>zvE-Bereich</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: C.blue, fontWeight: 500 }}>Anteil SQ</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: C.blue, fontWeight: 500, fontSize: 8, opacity: .7 }}>kum. SQ</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: C.orange, fontWeight: 500 }}>Anteil Sz.</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: C.orange, fontWeight: 500, fontSize: 8, opacity: .7 }}>kum. Sz.</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: C.sub, fontWeight: 500 }}>Δ pp</th>
                </tr></thead>
                <tbody>
                {(() => {
                  const reversed = [...deciles].reverse();
                  let cumB = 0, cumS = 0;
                  return reversed.map((d, i) => {
                    cumB += d.pctB; cumS += d.pctS;
                    const dp = (d.pctS - d.pctB) * 100;
                    const isTop = d.i === 10;
                    return <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: isTop ? "#f8f6f2" : "transparent" }}>
                      <td style={{ padding: "4px 0", color: C.text, fontWeight: isTop ? 700 : 500, fontFamily: FM, fontSize: isTop ? 10 : 9 }}>{d.i === 10 ? "Top 10%" : `${d.i}. Dezil`}</td>
                      <td style={{ padding: "4px 0", color: C.light, fontFamily: FM }}>{d.zMin >= 1e6 ? `${(d.zMin/1e6).toFixed(1)}M` : `${(d.zMin/1e3).toFixed(0)}k`}–{d.zMax >= 1e6 ? `${(d.zMax/1e6).toFixed(1)}M` : `${(d.zMax/1e3).toFixed(0)}k`}</td>
                      <td style={{ textAlign: "right", fontFamily: FM }}>{(d.pctB * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: "right", fontFamily: FM, fontWeight: 600, color: C.blue }}>{(cumB * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: "right", fontFamily: FM }}>{(d.pctS * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: "right", fontFamily: FM, fontWeight: 600, color: C.orange }}>{(cumS * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: "right", color: dp > 0.05 ? C.red : dp < -0.05 ? C.green : C.light, fontFamily: FM }}>{dp > 0 ? "+" : ""}{dp.toFixed(1)}</td>
                    </tr>;
                  });
                })()}
                </tbody>
              </table>
              {/* Bars */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, color: C.sub, marginBottom: 6, fontWeight: 600 }}>Kumulierte Steuerlast (von oben nach unten)</div>
                {(() => {
                  const reversed = [...deciles].reverse();
                  let cumB = 0, cumS = 0;
                  return reversed.map((d, i) => {
                    cumB += d.pctB; cumS += d.pctS;
                    const label = d.i === 10 ? "Top 10%" : `Top ${(10 - d.i + 1) * 10}%`;
                    return <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 52, fontSize: 8, color: C.sub, textAlign: "right", flexShrink: 0, fontFamily: FM }}>{label}</span>
                      <div style={{ flex: 1, position: "relative", height: 14, background: C.tag, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "50%", width: `${Math.min(cumB * 100, 100)}%`, background: C.blue, borderRadius: "2px 2px 0 0", opacity: .7 }} />
                        <div style={{ position: "absolute", left: 0, bottom: 0, height: "50%", width: `${Math.min(cumS * 100, 100)}%`, background: C.orange, borderRadius: "0 0 2px 2px", opacity: .7 }} />
                      </div>
                      <span style={{ width: 34, fontSize: 8, color: C.blue, textAlign: "right", flexShrink: 0, fontFamily: FM, fontWeight: 600 }}>{(cumB * 100).toFixed(0)}%</span>
                      <span style={{ width: 34, fontSize: 8, color: C.orange, textAlign: "right", flexShrink: 0, fontFamily: FM, fontWeight: 600 }}>{(cumS * 100).toFixed(0)}%</span>
                    </div>;
                  });
                })()}
                <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 8, color: C.light }}>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: C.blue, borderRadius: 1, marginRight: 3, verticalAlign: "middle", opacity: .7 }}></span>Status Quo</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: C.orange, borderRadius: 1, marginRight: 3, verticalAlign: "middle", opacity: .7 }}></span>Szenario</span>
                </div>
              </div>
              <div style={{ fontSize: 8, color: C.light, marginTop: 8 }}>
                Dezile basierend auf ~42,5 Mio. Steuerpflichtigen, sortiert nach zvE. Kumuliert = "Top X% tragen Y% des Aufkommens". Δ pp = Veränderung in Prozentpunkten.
              </div>
            </div>

            <div style={{ fontSize: 8, color: C.border, lineHeight: 1.5, padding: "4px 0" }}>
              §32a EStG 2026 · {zusammen ? "Splittingtarif" : "Grundtarif"}{kinder > 0 ? ` · ${kinder} Kind${kinder > 1 ? "er" : ""} (KFB/KG §31/§32)` : ""}{alleinerziehend ? " · Alleinerz. §24b" : ""} · {isSelbst ? "Selbständig (keine SV)" : "Angestellt"} · {!isSelbst && <>SV geschätzt · BBG KV {f(SV.bbKV)}€, RV {f(SV.bbRV)}€ · </>}Keine Gewähr
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
