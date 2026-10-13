"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const BRANDS = ["Jeep", "Citroën", "SAARC"];
const SALES_TYPES = ["Retail", "Wholesale"];
const VERSIONS = ["F0", "F1", "F2"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLUMNS = [
  { key: "budget_year", label: "budget_year" },
  { key: "budget_version", label: "budget_version" },
  { key: "brand", label: "brand" },
  { key: "sales_type", label: "sales_type" },
  { key: "sales_month", label: "sales_month" },
  { key: "units", label: "units" },
];

function number(value) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
function csvEscape(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }
function downloadCsv(filename, rows) {
  const csv = [COLUMNS.map(c => c.label).join(","), ...rows.map(row => COLUMNS.map(c => csvEscape(row[c.key] ?? "")).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function parseCsv(text) {
  const rows = []; let row = [], field = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field.trim()); field = ""; }
    else if (ch === "\n") { row.push(field.trim()); if (row.some(v => v !== "")) rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  row.push(field.trim()); if (row.some(v => v !== "")) rows.push(row);
  return rows;
}
function validateRows(csvRows) {
  if (!csvRows.length) return { valid: [], errors: ["The file is empty."] };
  const headers = csvRows[0].map(v => v.trim().toLowerCase());
  const required = COLUMNS.map(c => c.key);
  const missing = required.filter(key => !headers.includes(key));
  if (missing.length) return { valid: [], errors: ["Missing required columns: " + missing.join(", ")] };
  const index = Object.fromEntries(required.map(key => [key, headers.indexOf(key)]));
  const valid = [], errors = [], seen = new Set();
  csvRows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const raw = Object.fromEntries(required.map(key => [key, (cells[index[key]] ?? "").trim()]));
    const year = Number(raw.budget_year), month = Number(raw.sales_month), units = Number(raw.units);
    const version = raw.budget_version.toUpperCase(), brand = raw.brand, salesType = raw.sales_type;
    const problems = [];
    if (!Number.isInteger(year) || year < 2024 || year > 2040) problems.push("budget_year must be 2024–2040");
    if (!VERSIONS.includes(version)) problems.push("budget_version must be F0, F1 or F2");
    if (!BRANDS.includes(brand)) problems.push("brand must be Jeep, Citroën or SAARC");
    if (!SALES_TYPES.includes(salesType)) problems.push("sales_type must be Retail or Wholesale");
    if (!Number.isInteger(month) || month < 1 || month > 12) problems.push("sales_month must be 1–12");
    if (!Number.isFinite(units) || !Number.isInteger(units) || units < 0) problems.push("units must be a non-negative whole number");
    const key = [year, version, brand, salesType, month].join("|");
    if (seen.has(key)) problems.push("duplicate budget row in this file");
    if (problems.length) errors.push("Row " + line + ": " + problems.join("; "));
    else { seen.add(key); valid.push({ budget_year: year, budget_version: version, brand, sales_type: salesType, sales_month: month, units, source_file: "CSV upload" }); }
  });
  return { valid, errors };
}

export default function BudgetPlanningPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [year, setYear] = useState("2026");
  const [version, setVersion] = useState("F0");
  const [brand, setBrand] = useState("All");
  const [salesType, setSalesType] = useState("All");
  const [file, setFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    const { data, error } = await supabase.from("sales_cockpit_budgets")
      .select("id,budget_year,budget_version,brand,sales_type,sales_month,units,source_file,updated_at")
      .order("budget_year", { ascending: false }).order("sales_month", { ascending: true });
    if (error) setLoadError(error.message);
    else setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => String(r.budget_year) === year && r.budget_version === version && (brand === "All" || r.brand === brand) && (salesType === "All" || r.sales_type === salesType)).sort((a,b) => a.sales_month-b.sales_month || a.brand.localeCompare(b.brand) || a.sales_type.localeCompare(b.sales_type)), [rows, year, version, brand, salesType]);
  const versionTotals = useMemo(() => VERSIONS.map(v => {
    const matching = rows.filter(r => String(r.budget_year) === year && r.budget_version === v && (brand === "All" || r.brand === brand) && (salesType === "All" || r.sales_type === salesType));
    return { version: v, total: matching.reduce((sum, r) => sum + Number(r.units || 0), 0), count: matching.length };
  }), [rows, year, brand, salesType]);
  const total = filtered.reduce((sum, r) => sum + Number(r.units || 0), 0);
  const presentMonths = new Set(filtered.map(r => r.sales_month)).size;

  async function inspectFile(nextFile) {
    setFile(nextFile); setMessage(""); setValidation(null);
    if (!nextFile) return;
    if (!/\.csv$/i.test(nextFile.name)) {
      setValidation({ valid: [], errors: ["Please upload a CSV file using the Budget Planning template."] }); return;
    }
    const parsed = validateRows(parseCsv(await nextFile.text()));
    setValidation(parsed);
  }
  async function importFile() {
    if (!validation?.valid?.length || validation.errors.length) return;
    setUploading(true); setMessage("");
    const payload = validation.valid.map(r => ({ ...r, source_file: file?.name || "CSV upload" }));
    const { error } = await supabase.from("sales_cockpit_budgets").upsert(payload, { onConflict: "budget_year,budget_version,brand,sales_type,sales_month" });
    if (error) setMessage("Import failed: " + error.message);
    else {
      setMessage("Imported " + payload.length + " monthly budget rows successfully. Existing rows for the same year, version, brand, sales type and month were updated.");
      setFile(null); setValidation(null); if (fileRef.current) fileRef.current.value = ""; await load();
    }
    setUploading(false);
  }

  const templateRows = [];
  for (const y of [2026, 2027]) for (const v of VERSIONS) for (const b of BRANDS) for (const t of SALES_TYPES) for (let m=1;m<=12;m++) {
    templateRows.push({ budget_year:y, budget_version:v, brand:b, sales_type:t, sales_month:m, units:"" });
  }

  return <main className="appShell">
    <header className="pageHeader">
      <div><div className="eyebrow">STELLANTIS INDIA · PLANNING</div><h1>Budget Planning</h1><p className="subtitle">Monthly Retail and Wholesale budgets · Jeep, Citroën and SAARC</p><div className="dataFreshness">F0 · Original plan &nbsp; / &nbsp; F1 · Mid-course correction &nbsp; / &nbsp; F2 · Final corrected budget</div></div>
      <div className="headerStatus"><span className="statusDot" />{loading ? "Loading budget data" : "Budget data connected"}</div>
    </header>
    <nav className="cockpitNav">
      <Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link><Link href="/industry">Industry</Link><Link href="/industry/manufacturers">Manufacturer History</Link><Link className="active" href="/budget-planning">Budget Planning</Link><Link href="/data-entry">Data Entry</Link>
    </nav>

    <section className="filters budgetFilters">
      <div className="filter"><label>Budget year</label><select value={year} onChange={e=>setYear(e.target.value)}><option>2026</option><option>2027</option></select></div>
      <div className="filter"><label>Budget version</label><select value={version} onChange={e=>setVersion(e.target.value)}>{VERSIONS.map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="filter"><label>Brand / scope</label><select value={brand} onChange={e=>setBrand(e.target.value)}><option>All</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></div>
      <div className="filter"><label>Sales type</label><select value={salesType} onChange={e=>setSalesType(e.target.value)}><option>All</option>{SALES_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
    </section>

    <section className="summaryGrid budgetSummary">
      <article className="statCard"><div className="eyebrow">SELECTED BUDGET</div><h2>{version} · {year}</h2><div className="statValue">{number(total)}</div><p>Units across selected brands, sales types and uploaded months</p></article>
      <article className="statCard"><div className="eyebrow">MONTHS COVERED</div><div className="statValue">{presentMonths} / 12</div><p>Distinct months with uploaded records for the current filters</p></article>
      <article className="statCard"><div className="eyebrow">VERSION COMPARISON</div><div className="versionTotals">{versionTotals.map(item=><div key={item.version}><span>{item.version}</span><strong>{number(item.total)}</strong><small>{item.count ? "Uploaded" : "Not uploaded"}</small></div>)}</div></article>
    </section>

    <section className="budgetSection">
      <div className="sectionHeading"><div><h2>Monthly budget detail</h2><p>One row per month, brand and sales type. Budget versions remain separate.</p></div><button className="secondaryButton" type="button" onClick={()=>downloadCsv("budget-template.csv",templateRows)}>Download CSV template</button></div>
      {loadError && <div className="errorBanner">Could not load budget data: {loadError}</div>}
      {message && <div className={message.startsWith("Import failed") ? "errorBanner" : "infoBanner"}>{message}</div>}
      <div className="tableCard budgetTable">
        <div className="budgetTableHeader"><span>Month</span><span>Brand</span><span>Sales type</span><span>Units</span><span>Version</span></div>
        {loading ? <div className="emptyState">Loading budget data…</div> : filtered.length ? filtered.map(r=><div className="budgetTableRow" key={r.id}><span>{MONTHS[r.sales_month-1]} {r.budget_year}</span><span>{r.brand}</span><span>{r.sales_type}</span><strong>{number(r.units)}</strong><span>{r.budget_version}</span></div>) : <div className="emptyState">No budget rows uploaded for {year} {version} with these filters.</div>}
        <div className="budgetTableTotal"><strong>TOTAL</strong><span>{filtered.length} rows</span><span></span><strong>{number(total)}</strong><span>{version}</span></div>
      </div>
    </section>

    <section className="budgetSection">
      <div className="sectionHeading"><div><h2>Upload or update a budget version</h2><p>Upload a completed CSV template. Validation runs before anything is saved.</p></div></div>
      <div className="budgetUploadPanel">
        <div className="budgetUploadActions"><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e=>inspectFile(e.target.files?.[0] || null)} /><button className="secondaryButton" type="button" onClick={()=>downloadCsv("budget-empty-template.csv",[])}>Download empty template</button></div>
        <p className="mutedText">Required columns: budget_year, budget_version, brand, sales_type, sales_month, units. Month must be 1–12; units must be a non-negative whole number.</p>
        {file && <p className="mutedText">Selected file: <strong>{file.name}</strong></p>}
        {validation && <div className="validationSummary"><strong>{validation.valid.length} valid rows</strong><span>{validation.errors.length} validation errors</span></div>}
        {validation?.errors?.length > 0 && <div className="errorBanner validationErrors">{validation.errors.slice(0,12).map((error,i)=><div key={i}>{error}</div>)}{validation.errors.length>12 && <div>…and {validation.errors.length-12} more errors. Correct the file and upload again.</div>}</div>}
        {validation && validation.errors.length===0 && <div className="infoBanner">Validation passed. Import will update matching rows and preserve other versions.</div>}
        <div className="budgetUploadFooter"><span className="mutedText">2026 supports F0/F1/F2. 2027 starts with F0; F1/F2 can be uploaded later.</span><button className="primaryButton" type="button" disabled={!validation?.valid?.length || validation.errors.length>0 || uploading} onClick={importFile}>{uploading ? "Importing…" : "Validate and import"}</button></div>
      </div>
    </section>
    <footer className="appFooter">Stellantis Sales Cockpit · Budget versions are stored independently; no Retail or Wholesale actuals are overwritten.</footer>
  </main>;
}
