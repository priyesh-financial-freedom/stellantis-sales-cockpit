"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { MODEL_NAMES, MODEL_YEARS, MODEL_PERIODS } from "../../lib/modelData";

const BRANDS = ["Jeep", "Citroën", "SAARC"];
const MODEL_BRANDS = ["Jeep", "Citroën"];
const SALES_TYPES = ["Retail", "Wholesale"];
const DATASETS = ["Daily Sales", "Model Monthly"];

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function toCsv(rows, columns) {
  return [
    columns.map((column) => csvEscape(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(",")),
  ].join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((r) => r.some((value) => value !== "")).map((r) =>
    Object.fromEntries(headers.map((header, index) => [header, (r[index] || "").trim()]))
  );
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DataEntryPage() {
  const [dataset, setDataset] = useState("Daily Sales");
  const [brand, setBrand] = useState("Jeep");
  const [salesType, setSalesType] = useState("Retail");
  const [date, setDate] = useState(todayString());
  const [testDrives, setTestDrives] = useState("");
  const [bookings, setBookings] = useState("");
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [model, setModel] = useState(MODEL_NAMES.Jeep[0]);
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("Oct");
  const [units, setUnits] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);
  const fileRef = useRef(null);

  const models = MODEL_NAMES[brand] || [];

  useEffect(() => {
    if (dataset === "Model Monthly" && !MODEL_BRANDS.includes(brand)) setBrand("Jeep");
  }, [dataset, brand]);

  useEffect(() => {
    if (!models.includes(model)) setModel(models[0]);
  }, [brand, model]);

  async function loadRecent() {
    if (dataset === "Daily Sales") {
      const result = await supabase.from("sales_cockpit_daily")
        .select("brand,sales_date,test_drives,bookings,retail,wholesale")
        .eq("brand", brand).order("sales_date", { ascending: false }).limit(10);
      if (!result.error) setRecent(result.data || []);
    } else {
      const result = await supabase.from("sales_cockpit_model_monthly")
        .select("brand,sales_type,model_name,sales_year,sales_month,units")
        .eq("brand", brand).eq("sales_type", salesType)
        .order("sales_year", { ascending: false }).order("sales_month", { ascending: false }).limit(10);
      if (!result.error) setRecent(result.data || []);
    }
  }

  useEffect(() => { loadRecent(); }, [dataset, brand, salesType]);

  async function save() {
    try {
      setSaving(true); setError(""); setMessage("");
      if (dataset === "Daily Sales") {
        if (!date) throw new Error("Please select a date.");
        const payload = { brand, sales_date: date, test_drives: numberOrNull(testDrives), bookings: numberOrNull(bookings), retail: numberOrNull(retail), wholesale: numberOrNull(wholesale) };
        if (!Object.values(payload).slice(2).some((value) => value !== null)) throw new Error("Enter at least one sales metric.");
        const found = await supabase.from("sales_cockpit_daily").select("id").eq("brand", brand).eq("sales_date", date).maybeSingle();
        if (found.error) throw found.error;
        if (found.data?.id) {
          const result = await supabase.from("sales_cockpit_daily").update(payload).eq("id", found.data.id);
          if (result.error) throw result.error;
          setMessage("Daily sales record updated.");
        } else {
          const result = await supabase.from("sales_cockpit_daily").insert(payload);
          if (result.error) throw result.error;
          setMessage("Daily sales record added.");
        }
      } else {
        const salesMonth = MODEL_PERIODS.indexOf(month) + 1;
        const numericUnits = numberOrNull(units);
        if (!salesMonth || numericUnits === null) throw new Error("Please enter a valid month and units.");
        const found = await supabase.from("sales_cockpit_model_monthly").select("id")
          .eq("brand", brand).eq("sales_type", salesType).eq("model_name", model)
          .eq("sales_year", Number(year)).eq("sales_month", salesMonth).maybeSingle();
        if (found.error) throw found.error;
        const payload = { brand, sales_type: salesType, model_name: model, sales_year: Number(year), sales_month: salesMonth, units: numericUnits };
        if (found.data?.id) {
          const result = await supabase.from("sales_cockpit_model_monthly").update(payload).eq("id", found.data.id);
          if (result.error) throw result.error;
          setMessage("Model monthly record updated.");
        } else {
          const result = await supabase.from("sales_cockpit_model_monthly").insert(payload);
          if (result.error) throw result.error;
          setMessage("Model monthly record added.");
        }
      }
      await loadRecent();
    } catch (err) {
      setError(err.message || "Unable to save data.");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    try {
      setError("");
      const start = year + "-01-01";
      const end = year + "-12-31";
      if (dataset === "Daily Sales") {
        const result = await supabase.from("sales_cockpit_daily")
          .select("brand,sales_date,test_drives,bookings,retail,wholesale")
          .eq("brand", brand).gte("sales_date", start).lte("sales_date", end).order("sales_date");
        if (result.error) throw result.error;
        downloadCsv("stellantis-daily-sales-" + brand + "-" + year + ".csv", toCsv(result.data || [], [
          { key: "brand", label: "brand" }, { key: "sales_date", label: "sales_date" },
          { key: "test_drives", label: "test_drives" }, { key: "bookings", label: "bookings" },
          { key: "retail", label: "retail" }, { key: "wholesale", label: "wholesale" },
        ]));
      } else {
        const result = await supabase.from("sales_cockpit_model_monthly")
          .select("brand,sales_type,model_name,sales_year,sales_month,units")
          .eq("brand", brand).eq("sales_type", salesType).eq("sales_year", Number(year)).order("sales_month");
        if (result.error) throw result.error;
        downloadCsv("stellantis-model-monthly-" + brand + "-" + salesType + "-" + year + ".csv", toCsv(result.data || [], [
          { key: "brand", label: "brand" }, { key: "sales_type", label: "sales_type" },
          { key: "model_name", label: "model_name" }, { key: "sales_year", label: "sales_year" },
          { key: "sales_month", label: "sales_month" }, { key: "units", label: "units" },
        ]));
      }
      setMessage("Export completed.");
    } catch (err) {
      setError(err.message || "Export failed.");
    }
  }

  async function importData(file) {
    if (!file) return;
    try {
      setSaving(true); setError(""); setMessage("");
      const imported = parseCsv(await file.text());
      if (!imported.length) throw new Error("The CSV contains no data rows.");
      let count = 0;

      for (const row of imported) {
        if (dataset === "Daily Sales") {
          if (!BRANDS.includes(row.brand) || !row.sales_date) throw new Error("Daily CSV requires valid brand and sales_date.");
          const payload = { brand: row.brand, sales_date: row.sales_date, test_drives: numberOrNull(row.test_drives), bookings: numberOrNull(row.bookings), retail: numberOrNull(row.retail), wholesale: numberOrNull(row.wholesale) };
          const found = await supabase.from("sales_cockpit_daily").select("id").eq("brand", payload.brand).eq("sales_date", payload.sales_date).maybeSingle();
          if (found.error) throw found.error;
          if (found.data?.id) {
            const result = await supabase.from("sales_cockpit_daily").update(payload).eq("id", found.data.id);
            if (result.error) throw result.error;
          } else {
            const result = await supabase.from("sales_cockpit_daily").insert(payload);
            if (result.error) throw result.error;
          }
        } else {
          const salesMonth = Number(row.sales_month);
          if (!BRANDS.includes(row.brand) || !SALES_TYPES.includes(row.sales_type) || !row.model_name || !row.sales_year || salesMonth < 1 || salesMonth > 12) {
            throw new Error("Model monthly CSV has invalid required fields.");
          }
          const payload = { brand: row.brand, sales_type: row.sales_type, model_name: row.model_name, sales_year: Number(row.sales_year), sales_month: salesMonth, units: numberOrNull(row.units) };
          const found = await supabase.from("sales_cockpit_model_monthly").select("id")
            .eq("brand", payload.brand).eq("sales_type", payload.sales_type).eq("model_name", payload.model_name)
            .eq("sales_year", payload.sales_year).eq("sales_month", payload.sales_month).maybeSingle();
          if (found.error) throw found.error;
          if (found.data?.id) {
            const result = await supabase.from("sales_cockpit_model_monthly").update(payload).eq("id", found.data.id);
            if (result.error) throw result.error;
          } else {
            const result = await supabase.from("sales_cockpit_model_monthly").insert(payload);
            if (result.error) throw result.error;
          }
        }
        count += 1;
      }
      setMessage(count + " record" + (count === 1 ? "" : "s") + " imported.");
      await loadRecent();
    } catch (err) {
      setError(err.message || "Import failed.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const columns = dataset === "Daily Sales" ? ["Date", "TD", "Bookings", "Retail", "Wholesale"] : ["Model", "Year", "Month", "Units"];
  const recentRows = useMemo(() => recent, [recent]);

  return (
    <main className="cockpit">
      <header className="header">
        <div><div className="eyebrow">STELLANTIS INDIA · DATA MANAGEMENT</div><h1>Data Entry</h1><p className="subtitle">Enter, import and export Sales Cockpit data</p></div>
        <div className="headerStatus"><span className="statusDot" /> Data connected</div>
      </header>

      <nav className="cockpitNav">
        <Link href="/">Sales Cockpit</Link>
        <Link href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link href="/model-wise/citroen">Citroën Model Wise</Link>
        <Link className="active" href="/data-entry">Data Entry</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter"><label>Data Set</label><select value={dataset} onChange={(e) => setDataset(e.target.value)}>{DATASETS.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="filter"><label>Brand</label><select value={brand} onChange={(e) => setBrand(e.target.value)}>{(dataset === "Daily Sales" ? BRANDS : MODEL_BRANDS).map((item) => <option key={item}>{item}</option>)}</select></div>
        {dataset === "Model Monthly" && <div className="filter"><label>Sales Type</label><select value={salesType} onChange={(e) => setSalesType(e.target.value)}>{SALES_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>}
        <div className="filter"><label>Year</label><select value={year} onChange={(e) => setYear(e.target.value)}>{MODEL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></div>
      </section>

      <section className="dataEntryActions">
        <div><div className="eyebrow">IMPORT / EXPORT</div><h2>Manage data</h2><p className="subtitle">CSV import updates a matching record or creates a new one.</p></div>
        <div className="actionButtons">
          <button type="button" className="secondaryButton" onClick={exportData}>Export CSV</button>
          <button type="button" className="secondaryButton" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </div>
      </section>

      <section className="entryCard">
        <div className="sectionHeading"><div><div className="eyebrow">MANUAL ENTRY</div><h2>{dataset}</h2></div></div>
        {dataset === "Daily Sales" ? (
          <div className="entryGrid">
            <div className="filter"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="filter"><label>Brand</label><select value={brand} onChange={(e) => setBrand(e.target.value)}>{BRANDS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Test Drives</label><input type="number" min="0" value={testDrives} onChange={(e) => setTestDrives(e.target.value)} placeholder="Blank = no entry" /></div>
            <div className="filter"><label>Bookings</label><input type="number" min="0" value={bookings} onChange={(e) => setBookings(e.target.value)} placeholder="Blank = no entry" /></div>
            <div className="filter"><label>Retail</label><input type="number" min="0" value={retail} onChange={(e) => setRetail(e.target.value)} placeholder="Blank = no entry" /></div>
            <div className="filter"><label>Wholesale</label><input type="number" min="0" value={wholesale} onChange={(e) => setWholesale(e.target.value)} placeholder="Blank = no entry" /></div>
          </div>
        ) : (
          <div className="entryGrid">
            <div className="filter"><label>Brand</label><select value={brand} onChange={(e) => setBrand(e.target.value)}>{BRANDS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Sales Type</label><select value={salesType} onChange={(e) => setSalesType(e.target.value)}>{SALES_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Model</label><select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Year</label><select value={year} onChange={(e) => setYear(e.target.value)}>{MODEL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Month</label><select value={month} onChange={(e) => setMonth(e.target.value)}>{MODEL_PERIODS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Units</label><input type="number" min="0" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
          </div>
        )}
        <div className="entryFooter"><div className="messageArea">{message && <span className="successMessage">{message}</span>}{error && <span className="errorMessage">{error}</span>}</div><button type="button" className="primaryButton" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Record"}</button></div>
      </section>

      <section className="tableCard recentDataCard">
        <div className="sectionHeading"><div><div className="eyebrow">RECENT RECORDS</div><h2>Latest {dataset.toLowerCase()}</h2></div></div>
        <div className="recentTable">
          <div className="recentHeader">{columns.map((column) => <div key={column}>{column}</div>)}</div>
          {recentRows.map((row, index) => dataset === "Daily Sales" ? (
            <div className="recentRow" key={row.brand + row.sales_date + index}><div>{row.sales_date}</div><div>{row.test_drives ?? "—"}</div><div>{row.bookings ?? "—"}</div><div>{row.retail ?? "—"}</div><div>{row.wholesale ?? "—"}</div></div>
          ) : (
            <div className="recentRow" key={row.model_name + row.sales_year + row.sales_month + index}><div>{row.model_name}</div><div>{row.sales_year}</div><div>{MODEL_PERIODS[row.sales_month - 1]}</div><div>{row.units ?? "—"}</div></div>
          ))}
        </div>
      </section>

      <footer><span>Stellantis Sales Cockpit</span><span>•</span><span>Data entry and CSV import/export</span></footer>
    </main>
  );
}
