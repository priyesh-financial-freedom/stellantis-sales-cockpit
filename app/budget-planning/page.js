"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import MultiSelect from "../../components/MultiSelect";

const BRANDS = ["Jeep", "Citroën", "SAARC"];
const SALES_TYPES = ["Retail", "Wholesale"];
const VERSIONS = ["F0", "F1", "F2"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const HALVES = ["All", "H1", "H2"];
const YEARS = ["2026", "2027"];
function selectedAll(values) { return !Array.isArray(values) || values.length === 0 || values.includes("All"); }
function monthsForPeriod(period, values) {
  if (period === "Annual" || period === "Custom Period" || selectedAll(values)) return MONTHS.map((_, i) => i + 1);
  const picked = values.filter(v => v !== "All");
  if (period === "Monthly") return picked.map(v => MONTHS.indexOf(v) + 1).filter(n => n > 0);
  if (period === "Quarterly") return picked.flatMap(q => { const start = (Number(q.slice(1)) - 1) * 3 + 1; return [start, start + 1, start + 2]; });
  if (period === "Half-Yearly") return picked.flatMap(h => h === "H1" ? [1,2,3,4,5,6] : [7,8,9,10,11,12]);
  return MONTHS.map((_, i) => i + 1);
}
function periodOptions(period) {
  if (period === "Monthly") return ["All", ...MONTHS];
  if (period === "Quarterly") return QUARTERS;
  if (period === "Half-Yearly") return HALVES;
  return ["All"];
}
function periodBucketFor(period, row) {
  const month = Number(row.sales_month);
  if (period === "Quarterly") return { key: `Q${Math.floor((month - 1) / 3) + 1}`, label: `Q${Math.floor((month - 1) / 3) + 1}`, order: Math.floor((month - 1) / 3) + 1 };
  if (period === "Half-Yearly") return { key: month <= 6 ? "H1" : "H2", label: month <= 6 ? "H1" : "H2", order: month <= 6 ? 1 : 2 };
  if (period === "Annual") return { key: "FY", label: "Full year", order: 1 };
  if (period === "Custom Period") return { key: "CUSTOM", label: "Custom period", order: 1 };
  return { key: String(month), label: MONTHS[month - 1], order: month };
}

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
  const valid = [], errors = [], seen = new Set();
  const addRecord = (raw, line, month, unitsText) => {
    const year = Number(raw.year), version = String(raw.version || "").toUpperCase();
    const brand = String(raw.brand || "").trim();
    const salesType = String(raw.salesType || "").trim();
    const units = Number(unitsText);
    const problems = [];
    if (!Number.isInteger(year) || year < 2024 || year > 2040) problems.push("Year must be 2024–2040");
    if (!VERSIONS.includes(version)) problems.push("Version must be F0, F1 or F2");
    if (!BRANDS.includes(brand)) problems.push("Brand must be Jeep, Citroën or SAARC");
    if (!SALES_TYPES.includes(salesType)) problems.push("Sales Type must be Retail or Wholesale");
    if (!Number.isInteger(month) || month < 1 || month > 12) problems.push("Month must be Jan–Dec (or 1–12 in the legacy format)");
    if (!Number.isFinite(units) || !Number.isInteger(units) || units < 0) problems.push("Monthly units must be a non-negative whole number");
    const key = [year, version, brand, salesType, month].join("|");
    if (seen.has(key)) problems.push("Duplicate budget row for this year, version, brand, sales type and month");
    if (problems.length) errors.push("Row " + line + ": " + problems.join("; "));
    else {
      seen.add(key);
      valid.push({ budget_year: year, budget_version: version, brand, sales_type: salesType, sales_month: month, units, source_file: "Budget CSV upload" });
    }
  };

  // Continue accepting the original six-column long format for backwards compatibility.
  const legacyRequired = ["budget_year", "budget_version", "brand", "sales_type", "sales_month", "units"];
  if (legacyRequired.every(key => headers.includes(key))) {
    const index = Object.fromEntries(legacyRequired.map(key => [key, headers.indexOf(key)]));
    csvRows.slice(1).forEach((cells, i) => {
      if (cells.every(value => !String(value ?? "").trim())) return;
      const units = (cells[index.units] ?? "").trim();
      if (units === "") return;
      const month = Number((cells[index.sales_month] ?? "").trim());
      addRecord({
        year: (cells[index.budget_year] ?? "").trim(),
        version: (cells[index.budget_version] ?? "").trim(),
        brand: (cells[index.brand] ?? "").trim(),
        salesType: (cells[index.sales_type] ?? "").trim(),
      }, i + 2, month, units);
    });
    return { valid, errors };
  }

  // Preferred wide layout: one row per Year / Version / Brand / Sales Type, with Jan–Dec across columns.
  const yearIndex = headers.indexOf("year");
  const versionIndex = headers.indexOf("version");
  const brandIndex = headers.indexOf("brand");
  const salesTypeIndex = headers.indexOf("sales type");
  const monthIndexes = MONTHS.map((month, i) => ({ month, index: headers.indexOf(month.toLowerCase()), number: i + 1 }));
  const missing = [];
  if (yearIndex < 0) missing.push("Year");
  if (versionIndex < 0) missing.push("Version");
  if (brandIndex < 0) missing.push("Brand");
  if (salesTypeIndex < 0) missing.push("Sales Type");
  if (monthIndexes.every(item => item.index < 0)) missing.push("at least one month column (Jan–Dec)");
  if (missing.length) return { valid: [], errors: ["Unrecognized template. Expected columns Year, Version, Brand, Sales Type, Jan–Dec and optional TTL."] };

  csvRows.slice(1).forEach((cells, i) => {
    if (cells.every(value => !String(value ?? "").trim())) return;
    const raw = {
      year: (cells[yearIndex] ?? "").trim(),
      version: (cells[versionIndex] ?? "").trim(),
      brand: (cells[brandIndex] ?? "").trim(),
      salesType: (cells[salesTypeIndex] ?? "").trim(),
    };
    const hasAnyMonth = monthIndexes.some(item => item.index >= 0 && String(cells[item.index] ?? "").trim() !== "");
    if (!hasAnyMonth) return; // Blank template rows can be left unused.
    monthIndexes.forEach(item => {
      if (item.index < 0) return;
      const units = (cells[item.index] ?? "").trim();
      if (units === "") return; // A blank month means no budget entered for that month.
      addRecord(raw, i + 2, item.number, units);
    });
  });
  return { valid, errors };
}

export default function BudgetPlanningPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [years, setYears] = useState(["2026"]);
  const [version, setVersion] = useState("F0");
  const [brands, setBrands] = useState([]);
  const [salesTypes, setSalesTypes] = useState([]);
  const [period, setPeriod] = useState("Monthly");
  const [periodValue, setPeriodValue] = useState(["All"]);
  const [customFrom, setCustomFrom] = useState("2026-01");
  const [customTo, setCustomTo] = useState("2026-12");
  const [activeView, setActiveView] = useState("detail");
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

  const selectedYears = selectedAll(years) ? YEARS : years;
  const selectedBrands = selectedAll(brands) ? BRANDS : brands;
  const selectedSalesTypes = selectedAll(salesTypes) ? SALES_TYPES : salesTypes;
  const selectedMonths = monthsForPeriod(period, periodValue);
  const periodRows = useMemo(() => rows.filter(r => {
    if (!selectedYears.includes(String(r.budget_year))) return false;
    if (!selectedBrands.includes(r.brand) || !selectedSalesTypes.includes(r.sales_type)) return false;
    if (period === "Custom Period") {
      const key = `${r.budget_year}-${String(r.sales_month).padStart(2, "0")}`;
      if (customFrom && key < customFrom) return false;
      if (customTo && key > customTo) return false;
      return true;
    }
    return selectedMonths.includes(Number(r.sales_month));
  }), [rows, selectedYears, selectedBrands, selectedSalesTypes, period, selectedMonths, customFrom, customTo]);
  const filtered = useMemo(() => periodRows.filter(r => r.budget_version === version).sort((a,b) => a.budget_year-b.budget_year || a.sales_month-b.sales_month || a.brand.localeCompare(b.brand) || a.sales_type.localeCompare(b.sales_type)), [periodRows, version]);
  const versionTotals = useMemo(() => VERSIONS.map(v => {
    const matching = periodRows.filter(r => r.budget_version === v);
    return { version: v, total: matching.reduce((sum, r) => sum + Number(r.units || 0), 0), count: matching.length };
  }), [periodRows]);
  const total = filtered.reduce((sum, r) => sum + Number(r.units || 0), 0);
  const presentMonths = new Set(filtered.map(r => `${r.budget_year}-${r.sales_month}`)).size;
  const aggregateRows = useMemo(() => {
    const groups = new Map();
    filtered.forEach(r => {
      const bucket = periodBucketFor(period, r);
      const key = [r.budget_year, bucket.key, r.brand, r.sales_type].join("|");
      if (!groups.has(key)) groups.set(key, { budget_year: r.budget_year, period_key: bucket.key, period_label: bucket.label, period_order: bucket.order, brand: r.brand, sales_type: r.sales_type, units: 0, month_count: 0, version: r.budget_version });
      const item = groups.get(key);
      item.units += Number(r.units || 0);
      item.month_count += 1;
    });
    return [...groups.values()].sort((a,b) => a.budget_year-b.budget_year || a.period_order-b.period_order || a.brand.localeCompare(b.brand) || a.sales_type.localeCompare(b.sales_type));
  }, [filtered, period]);
  const comparisonRows = useMemo(() => {
    const groups = new Map();
    periodRows.forEach(r => {
      const bucket = periodBucketFor(period, r);
      const key = [r.budget_year, bucket.key, r.brand, r.sales_type].join("|");
      if (!groups.has(key)) groups.set(key, { budget_year:r.budget_year, period_key:bucket.key, period_label:bucket.label, period_order:bucket.order, brand:r.brand, sales_type:r.sales_type, F0:null, F1:null, F2:null });
      const item = groups.get(key);
      item[r.budget_version] = (item[r.budget_version] ?? 0) + Number(r.units);
    });
    return [...groups.values()].sort((a,b) => a.budget_year-b.budget_year || a.period_order-b.period_order || a.brand.localeCompare(b.brand) || a.sales_type.localeCompare(b.sales_type));
  }, [periodRows, period]);

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

  const templateHeaders = ["Year", "Version", "Brand", "Sales Type", ...MONTHS, "TTL"];
  const templateRows = [];
  for (const y of [2026, 2027]) {
    const versionsForYear = y === 2026 ? VERSIONS : ["F0"];
    for (const v of versionsForYear) for (const b of BRANDS) for (const t of SALES_TYPES) {
      templateRows.push({ Year:y, Version:v, Brand:b, "Sales Type":t, ...Object.fromEntries(MONTHS.map(m => [m, ""])), TTL:"" });
    }
  }
  function downloadBudgetTemplate(filename = "budget-planning-template.csv") {
    const csv = [templateHeaders.map(csvEscape).join(","), ...templateRows.map(row => templateHeaders.map(header => csvEscape(row[header] ?? "")).join(","))].join("\\r\\n");
    const url = URL.createObjectURL(new Blob(["\\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="cockpit">
    <header className="pageHeader">
      <div><div className="eyebrow">STELLANTIS INDIA · PLANNING</div><h1>Budget Planning</h1><p className="subtitle">Monthly Retail and Wholesale budgets · Jeep, Citroën and SAARC</p><div className="dataFreshness">F0 · Original plan &nbsp; / &nbsp; F1 · Mid-course correction &nbsp; / &nbsp; F2 · Final corrected budget</div></div>
      <div className="headerStatus"><span className="statusDot" />{loading ? "Loading budget data" : "Budget data connected"}</div>
    </header>
    <nav className="cockpitNav">
      <Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link><Link href="/industry">Industry</Link><Link href="/industry/manufacturers">Manufacturer History</Link><Link className="active" href="/budget-planning">Budget Planning</Link><Link href="/data-entry">Data Entry</Link>
    </nav>

    <section className="filters budgetFilters budgetFiltersExpanded">
      <div className="filter"><label>Period</label><select value={period} onChange={e=>{setPeriod(e.target.value);setPeriodValue(["All"]);}}>{PERIODS.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="filter"><label>Period detail</label>{period === "Annual" ? <div className="budgetFilterStatic">Full year</div> : period === "Custom Period" ? <div className="budgetCustomRange"><input aria-label="Custom period start month" type="month" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} /><input aria-label="Custom period end month" type="month" value={customTo} min={customFrom || undefined} onChange={e=>setCustomTo(e.target.value)} /></div> : <MultiSelect label="" options={periodOptions(period)} value={periodValue} onChange={setPeriodValue} />}</div>
      <div className="filter"><MultiSelect label="Budget year" options={["All", ...YEARS]} value={years} onChange={setYears} /></div>
      <div className="filter">{activeView === "detail" ? <><label>Budget version</label><select value={version} onChange={e=>setVersion(e.target.value)}>{VERSIONS.map(v=><option key={v}>{v}</option>)}</select></> : <><label>Budget version</label><div className="budgetFilterStatic">F0 vs F1 vs F2</div></>}</div>
      <div className="filter"><MultiSelect label="Brand / scope" options={["All", ...BRANDS]} value={brands} onChange={setBrands} /></div>
      <div className="filter"><MultiSelect label="Sales type" options={["All", ...SALES_TYPES]} value={salesTypes} onChange={setSalesTypes} /></div>
    </section>
    <div className="budgetViewTabs" role="tablist" aria-label="Budget views">
      <button type="button" role="tab" aria-selected={activeView==="detail"} className={activeView==="detail" ? "active" : ""} onClick={()=>setActiveView("detail")}>Budget detail</button>
      <button type="button" role="tab" aria-selected={activeView==="compare"} className={activeView==="compare" ? "active" : ""} onClick={()=>setActiveView("compare")}>Compare F0 / F1 / F2</button>
    </div>

    <section className="summaryGrid budgetSummary">
      <article className="statCard"><div className="eyebrow">SELECTED BUDGET</div><h2>{activeView === "compare" ? `F0 / F1 / F2 · ${selectedYears.join(", ")}` : `${version} · ${selectedYears.join(", ")}`}</h2><div className="statValue">{activeView === "compare" ? "3 versions" : number(total)}</div><p>Units across selected brands, sales types and the selected period</p></article>
      <article className="statCard"><div className="eyebrow">MONTHS COVERED</div><div className="statValue">{presentMonths} / 12</div><p>Distinct year-month periods covered by the current filters</p></article>
      <article className="statCard"><div className="eyebrow">VERSION COMPARISON</div><div className="versionTotals">{versionTotals.map(item=><div key={item.version}><span>{item.version}</span><strong>{number(item.total)}</strong><small>{item.count ? "Uploaded" : "Not uploaded"}</small></div>)}</div></article>
    </section>

    {activeView === "detail" ? <section className="budgetSection">
      <div className="sectionHeading"><div><h2>Budget detail</h2><p>Month-wise values for the selected period, brands and sales types.</p></div><button className="secondaryButton" type="button" onClick={()=>downloadBudgetTemplate()}>Download budget template</button></div>
      {loadError && <div className="errorBanner">Could not load budget data: {loadError}</div>}
      {message && <div className={message.startsWith("Import failed") ? "errorBanner" : "infoBanner"}>{message}</div>}
      <div className="tableCard budgetTable">
        <div className="budgetTableHeader"><span>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-year" : period === "Annual" ? "Year" : "Period"}</span><span>Brand</span><span>Sales type</span><span>Units</span><span>Version</span></div>
        {loading ? <div className="emptyState">Loading budget data…</div> : aggregateRows.length ? aggregateRows.map((r,i)=><div className="budgetTableRow" key={`${r.budget_year}-${r.period_key}-${r.brand}-${r.sales_type}-${i}`}><span>{period === "Monthly" ? `${r.period_label} ${r.budget_year}` : period === "Annual" ? `FY ${r.budget_year}` : `${r.period_label} ${r.budget_year}`}</span><span>{r.brand}</span><span>{r.sales_type}</span><strong>{number(r.units)}</strong><span>{r.version}</span></div>) : <div className="emptyState">No budget rows uploaded for the selected year, period and filters ({version}).</div>}
        <div className="budgetTableTotal"><strong>TOTAL</strong><span>{aggregateRows.length} rows</span><span></span><strong>{number(total)}</strong><span>{version}</span></div>
      </div>
    </section> : <section className="budgetSection">
      <div className="sectionHeading"><div><h2>Compare budget versions</h2><p>Compare F0, F1 and F2 month-by-month for the selected time frame. Missing versions remain blank rather than being treated as zero.</p></div><button className="secondaryButton" type="button" onClick={()=>downloadCsv("budget-version-comparison.csv", comparisonRows.map(r=>({budget_year:r.budget_year, sales_month:r.sales_month, brand:r.brand, sales_type:r.sales_type, F0:r.F0 ?? "", F1:r.F1 ?? "", F2:r.F2 ?? "", F1_vs_F0:r.F0 == null || r.F1 == null ? "" : r.F1-r.F0, F2_vs_F1:r.F1 == null || r.F2 == null ? "" : r.F2-r.F1})))}>Export comparison CSV</button></div>
      <div className="tableCard budgetTable budgetCompareTable">
        <div className="budgetCompareHeader"><span>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-year" : period === "Annual" ? "Year" : "Period"}</span><span>Brand</span><span>Sales type</span><span>F0</span><span>F1</span><span>F2</span><span>F1 vs F0</span><span>F2 vs F1</span></div>
        {loading ? <div className="emptyState">Loading budget data…</div> : comparisonRows.length ? comparisonRows.map(r=><div className="budgetCompareRow" key={`${r.budget_year}-${r.sales_month}-${r.brand}-${r.sales_type}`}><span>{period === "Monthly" ? `${r.period_label} ${r.budget_year}` : period === "Annual" ? `FY ${r.budget_year}` : `${r.period_label} ${r.budget_year}`}</span><span>{r.brand}</span><span>{r.sales_type}</span><strong>{r.F0 == null ? "—" : number(r.F0)}</strong><strong>{r.F1 == null ? "—" : number(r.F1)}</strong><strong>{r.F2 == null ? "—" : number(r.F2)}</strong><span>{r.F0 == null || r.F1 == null ? "—" : number(r.F1-r.F0)}</span><span>{r.F1 == null || r.F2 == null ? "—" : number(r.F2-r.F1)}</span></div>) : <div className="emptyState">No budget versions match the selected filters.</div>}
      </div>
      <div className="budgetCompareTotals"><strong>Selected-period totals</strong>{VERSIONS.map(v=><span key={v}><b>{v}</b> {number(versionTotals.find(x=>x.version===v)?.total || 0)}</span>)}</div>
    </section>}
    
    <section className="budgetSection">
      <div className="sectionHeading"><div><h2>Upload or update a budget version</h2><p>Download the monthly budget layout, fill in the figures across Jan–Dec, then upload it. Validation runs before anything is saved.</p></div></div>
      <div className="budgetUploadPanel">
        <div className="budgetUploadActions"><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e=>inspectFile(e.target.files?.[0] || null)} /><button className="secondaryButton" type="button" onClick={()=>downloadBudgetTemplate()}>Download budget template</button></div>
        <p className="mutedText">Use the familiar monthly layout: Year, Version, Brand, Sales Type, Jan–Dec and TTL. Enter monthly units in the relevant month columns; leave unused months blank. TTL is for reference and is not imported. The older six-column CSV format is also supported.</p>
        {file && <p className="mutedText">Selected file: <strong>{file.name}</strong></p>}
        {validation && <div className="validationSummary"><strong>{validation.valid.length} valid rows</strong><span>{validation.errors.length} validation errors</span></div>}
        {validation?.errors?.length > 0 && <div className="errorBanner validationErrors">{validation.errors.slice(0,12).map((error,i)=><div key={i}>{error}</div>)}{validation.errors.length>12 && <div>…and {validation.errors.length-12} more errors. Correct the file and upload again.</div>}</div>}
        {validation && validation.errors.length===0 && <div className="infoBanner">Validation passed. Import will update matching rows and preserve other versions.</div>}
        <div className="budgetUploadFooter"><span className="mutedText">2026: F0, F1 and F2 rows. 2027: F0 rows only; add F1/F2 later when available.</span><button className="primaryButton" type="button" disabled={!validation?.valid?.length || validation.errors.length>0 || uploading} onClick={importFile}>{uploading ? "Importing…" : "Validate and import"}</button></div>
      </div>
    </section>
    <footer className="appFooter">Stellantis Sales Cockpit · Budget versions are stored independently; no Retail or Wholesale actuals are overwritten.</footer>
  </main>;
}
