"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { MODEL_NAMES, MODEL_YEARS, MODEL_PERIODS } from "../../lib/modelData";
import { clearClientCache } from "../../lib/clientCache";
import { SALES_CACHE_KEY } from "../../lib/salesData";
import { MODEL_CACHE_KEY } from "../../lib/modelData";
import MultiSelect from "../../components/MultiSelect";

const BRANDS = ["Jeep", "Citroën", "SAARC"];
const MODEL_BRANDS = ["Jeep", "Citroën"];
const SALES_TYPES = ["All", "Retail", "Wholesale"];
const DATASETS = ["Daily Sales", "Model Monthly", "Industry History", "Manufacturer History", "Retail Sales"];

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

function htmlEscape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadExcel(filename, rows, columns, title) {
  // Excel-compatible formatted workbook using an HTML table.
  const tableRows = rows.map(row =>
    "<tr>" + columns.map(column => "<td>" + htmlEscape(row[column.key]) + "</td>").join("") + "</tr>"
  ).join("");
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; }
h1 { font-size: 18px; margin-bottom: 6px; }
table { border-collapse: collapse; width: 100%; }
th { background: #176da8; color: #fff; font-weight: bold; text-align: left; }
th, td { border: 1px solid #cfd6dd; padding: 6px 8px; white-space: nowrap; }
tr:nth-child(even) td { background: #f5f8fa; }
</style>
</head>
<body>
<h1>${htmlEscape(title)}</h1>
<table>
<thead><tr>${columns.map(column => "<th>" + htmlEscape(column.label) + "</th>").join("")}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body>
</html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pdfSafeText(value) {
  return String(value === null || value === undefined ? "" : value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function downloadPdf(filename, rows, columns, title, subtitle) {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 28;
  const usableWidth = pageWidth - margin * 2;
  const rowHeight = 18;
  const headerHeight = 22;
  const top = 96;
  const bottom = 30;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - top - bottom - headerHeight) / rowHeight));

  const widths = columns.map((column, index) => {
    const maxLength = Math.max(
      String(column.label).length,
      ...rows.slice(0, 500).map(row => String(row[column.key] ?? "").length)
    );
    return Math.max(55, Math.min(index === columns.length - 1 ? 180 : 220, maxLength * 4.1 + 18));
  });
  const widthTotal = widths.reduce((sum, value) => sum + value, 0);
  const scale = usableWidth / widthTotal;
  const scaledWidths = widths.map(value => value * scale);

  function truncate(value, maxChars) {
    const text = String(value ?? "");
    return text.length > maxChars ? text.slice(0, Math.max(1, maxChars - 1)) + "..." : text;
  }

  const pages = [];
  for (let start = 0; start < rows.length || (start === 0 && rows.length === 0); start += rowsPerPage) {
    const pageRows = rows.slice(start, start + rowsPerPage);
    const commands = [];

    commands.push("0.12 0.43 0.66 rg");
    commands.push(`BT /F1 16 Tf 1 0 0 1 ${margin} ${pageHeight - 34} Tm (${pdfSafeText(title)}) Tj ET`);
    commands.push("0.35 0.39 0.43 rg");
    commands.push(`BT /F1 8 Tf 1 0 0 1 ${margin} ${pageHeight - 50} Tm (${pdfSafeText(subtitle)}) Tj ET`);

    let x = margin;
    let y = pageHeight - top;
    commands.push("0.12 0.43 0.66 rg");
    commands.push("BT /F1 8 Tf");
    columns.forEach((column, index) => {
      const cell = truncate(column.label, Math.max(8, Math.floor(scaledWidths[index] / 4.3)));
      commands.push(`1 0 0 1 ${x + 5} ${y} Tm (${pdfSafeText(cell)}) Tj`);
      x += scaledWidths[index];
    });
    commands.push("ET");
    commands.push(`0.12 0.43 0.66 RG 0.5 w ${margin} ${y - 5} m ${pageWidth - margin} ${y - 5} l S`);
    y -= headerHeight;

    pageRows.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 0) {
        commands.push(`0.96 0.98 0.99 rg ${margin} ${y - 13} ${usableWidth} 18 re f`);
      }
      commands.push("0.15 0.17 0.19 rg");
      commands.push("BT /F1 7 Tf");
      x = margin;
      columns.forEach((column, index) => {
        const maxChars = Math.max(8, Math.floor(scaledWidths[index] / 4.0));
        const cell = truncate(row[column.key], maxChars);
        commands.push(`1 0 0 1 ${x + 5} ${y} Tm (${pdfSafeText(cell)}) Tj`);
        x += scaledWidths[index];
      });
      commands.push("ET");
      commands.push(`0.85 0.88 0.90 RG 0.35 w ${margin} ${y - 5} m ${pageWidth - margin} ${y - 5} l S`);
      y -= rowHeight;
    });

    const pageNumber = pages.length + 1;
    commands.push("0.40 0.43 0.46 rg");
    commands.push(`BT /F1 7 Tf 1 0 0 1 ${pageWidth - 90} 18 Tm (Page ${pageNumber}) Tj ET`);
    pages.push(commands.join("\n"));
    if (!rows.length) break;
  }

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  const fontObject = 4 + pages.length * 2;
  objects[1] = `<< /Type /Pages /Kids [${pages.map((_, i) => (4 + i * 2) + " 0 R").join(" ")}] /Count ${pages.length} >>`;

  pages.forEach((stream, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    objects[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObject - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
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

function formatMonthYear(value) {
  const text = String(value ?? "");
  const match = text.match(/^(\\d{4})-(\\d{2})/);
  if (!match) return text;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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

  // Filter selections are independent from manual-entry fields so multiple
  // records can be exported without changing the record being entered.
  const [filterBrands, setFilterBrands] = useState(["Jeep"]);
  const [filterSalesTypes, setFilterSalesTypes] = useState(["Retail"]);
  const [filterModels, setFilterModels] = useState(["Compass"]);
  const [filterYears, setFilterYears] = useState(["2025"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);
  const fileRef = useRef(null);

  const models = MODEL_NAMES[brand] || [];
  const filterModelOptions = useMemo(() => {
    const selectedBrands = filterBrands.length ? filterBrands : MODEL_BRANDS;
    return [...new Set(selectedBrands.flatMap(item => MODEL_NAMES[item] || []))];
  }, [filterBrands]);
  const exportOnly = dataset === "Industry History" || dataset === "Manufacturer History" || dataset === "Retail Sales";

  useEffect(() => {
    if (dataset === "Model Monthly" && !MODEL_BRANDS.includes(brand)) setBrand("Jeep");
    if (dataset !== "Model Monthly" && !BRANDS.includes(brand) && brand !== "All") setBrand("Jeep");
  }, [dataset, brand]);

  useEffect(() => {
    if (!models.includes(model)) setModel(models[0]);
  }, [brand, model]);

  async function loadRecent() {
    if (exportOnly) { setRecent([]); return; }
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
      if (exportOnly) throw new Error("Import is available for Daily Sales and Model Monthly only.");
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
      if (dataset === "Daily Sales") clearClientCache(SALES_CACHE_KEY);
      else clearClientCache(MODEL_CACHE_KEY);
      await loadRecent();
    } catch (err) {
      setError(err.message || "Unable to save data.");
    } finally {
      setSaving(false);
    }
  }

  async function getExportPayload() {
    const selectedYears = filterYears.length ? filterYears.map(Number) : MODEL_YEARS.map(Number);
    const selectedBrands = filterBrands.length ? filterBrands : BRANDS;
    const selectedSalesTypes = filterSalesTypes.length ? filterSalesTypes : SALES_TYPES.filter(item => item !== "All");
    const selectedModels = filterModels.length ? filterModels : filterModelOptions;
    const yearList = selectedYears.sort((a, b) => a - b);
    const yearLabel = yearList.length === 1 ? yearList[0] : "multi";
    const brandLabel = selectedBrands.length === 1 ? selectedBrands[0] : "multi";
    const startDate = Math.min(...yearList) + "-01-01";
    const endDate = Math.max(...yearList) + "-12-31";

    if (dataset === "Industry History") {
      const result = await supabase.from("industry_segment_history_v2")
        .select("sales_period,segment,units,period_type,source_workbook,source_sheet")
        .gte("sales_period", startDate).lte("sales_period", endDate)
        .order("sales_period").order("segment");
      if (result.error) throw result.error;
      return {
        filename: "industry-history-" + yearLabel,
        title: "Stellantis India — Industry History",
        subtitle: "Years: " + yearLabel + " · Segment-level industry TIV",
        rows: (result.data || []).map((row) => ({
          ...row,
          sales_period: formatMonthYear(row.sales_period),
        })),
        columns: [
          { key: "sales_period", label: "Month" },
          { key: "segment", label: "Segment" },
          { key: "units", label: "Units" },
          { key: "period_type", label: "Period Type" },
          { key: "source_workbook", label: "Source Workbook" },
          { key: "source_sheet", label: "Source Sheet" },
        ],
      };
    }

    if (dataset === "Manufacturer History") {
      const result = await supabase.from("industry_manufacturer_history_v2")
        .select("sales_period,manufacturer,units,period_type,record_type,source_workbook,source_sheet")
        .gte("sales_period", startDate).lte("sales_period", endDate)
        .order("sales_period").order("manufacturer");
      if (result.error) throw result.error;
      return {
        filename: "manufacturer-history-" + yearLabel,
        title: "Stellantis India — Manufacturer History",
        subtitle: "Years: " + yearLabel + " · Manufacturer-level industry TIV",
        rows: (result.data || []).map((row) => ({
          ...row,
          sales_period: formatMonthYear(row.sales_period),
        })),
        columns: [
          { key: "sales_period", label: "Month" },
          { key: "manufacturer", label: "Manufacturer" },
          { key: "units", label: "Units" },
          { key: "period_type", label: "Period Type" },
          { key: "record_type", label: "Record Type" },
          { key: "source_workbook", label: "Source Workbook" },
          { key: "source_sheet", label: "Source Sheet" },
        ],
      };
    }

    if (dataset === "Retail Sales") {
      const query = supabase.from("sales_cockpit_daily")
        .select("brand,sales_date,retail")
        .gte("sales_date", startDate).lte("sales_date", endDate)
        .order("sales_date");
      const result = selectedBrands.length === BRANDS.length ? await query : await query.in("brand", selectedBrands);
      if (result.error) throw result.error;
      return {
        filename: "retail-sales-" + brandLabel + "-" + yearLabel,
        title: "Stellantis India — Retail Sales",
        subtitle: "Brands: " + brandLabel + " · Years: " + yearLabel,
        rows: result.data || [],
        columns: [
          { key: "brand", label: "Brand" },
          { key: "sales_date", label: "Date" },
          { key: "retail", label: "Retail" },
        ],
      };
    }

    if (dataset === "Daily Sales") {
      const query = supabase.from("sales_cockpit_daily")
        .select("brand,sales_date,test_drives,bookings,retail,wholesale")
        .gte("sales_date", startDate).lte("sales_date", endDate).order("sales_date");
      const result = selectedBrands.length === BRANDS.length ? await query : await query.in("brand", selectedBrands);
      if (result.error) throw result.error;
      return {
        filename: "stellantis-daily-sales-" + brandLabel + "-" + yearLabel,
        title: "Stellantis India — Daily Sales",
        subtitle: "Brands: " + brandLabel + " · Years: " + yearLabel,
        rows: result.data || [],
        columns: [
          { key: "brand", label: "Brand" },
          { key: "sales_date", label: "Date" },
          { key: "test_drives", label: "Test Drives" },
          { key: "bookings", label: "Bookings" },
          { key: "retail", label: "Retail" },
          { key: "wholesale", label: "Wholesale" },
        ],
      };
    }

    let query = supabase.from("sales_cockpit_model_monthly")
      .select("brand,sales_type,model_name,sales_year,sales_month,units")
      .in("sales_year", selectedYears).order("sales_year").order("sales_month");
    if (selectedBrands.length && selectedBrands.length < MODEL_BRANDS.length) query = query.in("brand", selectedBrands);
    if (selectedSalesTypes.length && selectedSalesTypes.length < SALES_TYPES.filter(item => item !== "All").length) query = query.in("sales_type", selectedSalesTypes);
    if (selectedModels.length && selectedModels.length < filterModelOptions.length) query = query.in("model_name", selectedModels);
    const result = await query;
    if (result.error) throw result.error;
    return {
      filename: "stellantis-model-monthly-" + brandLabel + "-" + (selectedSalesTypes.length === 1 ? selectedSalesTypes[0] : "multi") + "-" + yearLabel,
      title: "Stellantis India — Model Monthly Sales",
      subtitle: "Brands: " + brandLabel + " · Sales Type: " + (selectedSalesTypes.length === 1 ? selectedSalesTypes[0] : "Multiple") + " · Years: " + yearLabel,
      rows: result.data || [],
      columns: [
        { key: "brand", label: "Brand" },
        { key: "sales_type", label: "Sales Type" },
        { key: "model_name", label: "Model" },
        { key: "sales_year", label: "Year" },
        { key: "sales_month", label: "Month" },
        { key: "units", label: "Units" },
      ],
    };
  }

  async function exportData(format) {
    try {
      setError("");
      const payload = await getExportPayload();
      if (format === "csv") {
        downloadCsv(payload.filename + ".csv", toCsv(payload.rows, payload.columns));
      } else if (format === "excel") {
        downloadExcel(payload.filename + ".xls", payload.rows, payload.columns, payload.title);
      } else {
        downloadPdf(payload.filename + ".pdf", payload.rows, payload.columns, payload.title, payload.subtitle);
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
          if (!MODEL_BRANDS.includes(row.brand) || !SALES_TYPES.includes(row.sales_type) || !row.model_name || !row.sales_year || salesMonth < 1 || salesMonth > 12) {
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
      if (dataset === "Daily Sales") clearClientCache(SALES_CACHE_KEY);
      else clearClientCache(MODEL_CACHE_KEY);
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
        {dataset !== "Industry History" && dataset !== "Manufacturer History" && (
          <div className="filter">
            <MultiSelect
              label="Brand"
              options={dataset === "Model Monthly" ? MODEL_BRANDS : BRANDS}
              value={filterBrands}
              onChange={setFilterBrands}
            />
          </div>
        )}
        {dataset === "Model Monthly" && (
          <>
            <div className="filter"><MultiSelect label="Sales Type" options={SALES_TYPES.filter(item => item !== "All")} value={filterSalesTypes} onChange={setFilterSalesTypes} /></div>
            <div className="filter"><MultiSelect label="Model" options={filterModelOptions} value={filterModels} onChange={setFilterModels} /></div>
          </>
        )}
        <div className="filter"><MultiSelect label="Year" options={MODEL_YEARS.map(String)} value={filterYears} onChange={setFilterYears} /></div>
      </section>

      <section className="dataEntryActions">
        <div><div className="eyebrow">IMPORT / EXPORT</div><h2>Manage data</h2><p className="subtitle">CSV import updates a matching record or creates a new one. Historical Industry and Manufacturer datasets are export-only.</p></div>
        <div className="actionButtons">
          <button type="button" className="secondaryButton" onClick={() => exportData("csv")}>Export CSV</button>
          <button type="button" className="secondaryButton" onClick={() => exportData("excel")}>Export Excel</button>
          <button type="button" className="secondaryButton" onClick={() => exportData("pdf")}>Export PDF</button>
          <button type="button" className="secondaryButton" onClick={() => fileRef.current?.click()} disabled={exportOnly}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </div>
      </section>

      <section className="entryCard">
        <div className="sectionHeading"><div><div className="eyebrow">MANUAL ENTRY</div><h2>{dataset}</h2></div></div>
        {exportOnly ? (
          <div className="dataScopeNotice">
            <h3>{dataset}</h3>
            <p>This historical dataset is maintained as a read-only analytical source. Use <strong>Export CSV</strong>, <strong>Export Excel</strong> or <strong>Export PDF</strong> to download the selected year.</p>
          </div>
        ) : dataset === "Daily Sales" ? (
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
            <div className="filter"><label>Sales Type</label><select value={salesType} onChange={(e) => setSalesType(e.target.value)}>{SALES_TYPES.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Model</label><select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Year</label><select value={year} onChange={(e) => setYear(e.target.value)}>{MODEL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Month</label><select value={month} onChange={(e) => setMonth(e.target.value)}>{MODEL_PERIODS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="filter"><label>Units</label><input type="number" min="0" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
          </div>
        )}
        <div className="entryFooter"><div className="messageArea">{message && <span className="successMessage">{message}</span>}{error && <span className="errorMessage">{error}</span>}</div><button type="button" className="primaryButton" disabled={saving || exportOnly || brand === "All" || salesType === "All"} onClick={save}>{saving ? "Saving..." : "Save Record"}</button></div>
      </section>

      {!exportOnly && <section className="tableCard recentDataCard">
        <div className="sectionHeading"><div><div className="eyebrow">RECENT RECORDS</div><h2>Latest {dataset.toLowerCase()}</h2></div></div>
        <div className="recentTable">
          <div className="recentHeader">{columns.map((column) => <div key={column}>{column}</div>)}</div>
          {recentRows.map((row, index) => dataset === "Daily Sales" ? (
            <div className="recentRow" key={row.brand + row.sales_date + index}><div>{row.sales_date}</div><div>{row.test_drives ?? "—"}</div><div>{row.bookings ?? "—"}</div><div>{row.retail ?? "—"}</div><div>{row.wholesale ?? "—"}</div></div>
          ) : (
            <div className="recentRow" key={row.model_name + row.sales_year + row.sales_month + index}><div>{row.model_name}</div><div>{row.sales_year}</div><div>{MODEL_PERIODS[row.sales_month - 1]}</div><div>{row.units ?? "—"}</div></div>
          ))}
        </div>
      </section>}

      <footer><span>Stellantis Sales Cockpit</span><span>•</span><span>Data entry and CSV import/export</span></footer>
    </main>
  );
}
