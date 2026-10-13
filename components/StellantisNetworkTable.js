"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const PAGE_SIZES = [25, 50, 100, 228];
const formatNumber = value => value === null || value === undefined || value === "" ? "—" : Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value)) : String(value);

export default function StellantisNetworkTable({ columns, records, sourceTotals, sourceFile }) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [formatFilter, setFormatFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [facilityFilter, setFacilityFilter] = useState("All");
  const [sortKey, setSortKey] = useState(0);
  const [sortDirection, setSortDirection] = useState("asc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const brandOptions = useMemo(() => [...new Set(records.map(row => String(row[1] ?? "").trim()).filter(Boolean))].sort(), [records]);
  const formatOptions = useMemo(() => [...new Set(records.map(row => String(row[8] ?? "").trim()).filter(Boolean))].sort(), [records]);
  const cityOptions = useMemo(() => [...new Set(records.map(row => String(row[5] ?? "").trim()).filter(Boolean))].sort(), [records]);
  const facilityOptions = useMemo(() => [...new Set(records.flatMap(row => [row[6], row[7]]).map(value => String(value ?? "").trim()).filter(Boolean))].sort(), [records]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter(row => {
      if (brandFilter !== "All" && String(row[1] ?? "").trim() !== brandFilter) return false;
      if (formatFilter !== "All" && String(row[8] ?? "").trim() !== formatFilter) return false;
      if (cityFilter !== "All" && String(row[5] ?? "").trim() !== cityFilter) return false;
      if (facilityFilter !== "All" && String(row[6] ?? "").trim() !== facilityFilter && String(row[7] ?? "").trim() !== facilityFilter) return false;
      if (needle && !row.some(value => String(value ?? "").toLowerCase().includes(needle))) return false;
      return true;
    }).sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = Number(av), bn = Number(bv);
      let result;
      if (av !== "" && av !== null && av !== undefined && bv !== "" && bv !== null && bv !== undefined && Number.isFinite(an) && Number.isFinite(bn)) result = an - bn;
      else result = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [records, search, brandFilter, formatFilter, cityFilter, facilityFilter, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function changeFilter(setter, value) { setter(value); setPage(1); }
  function sortBy(index) {
    if (sortKey === index) setSortDirection(value => value === "asc" ? "desc" : "asc");
    else { setSortKey(index); setSortDirection("asc"); }
  }
  function exportCsv() {
    const escape = value => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = [columns.map(escape).join(","), ...filtered.map(row => row.map(escape).join(","))].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "STLA_Dealer_Network_10_Oct_2026_filtered.csv"; anchor.click();
    URL.revokeObjectURL(url);
  }

  const cell = { padding: "10px 12px", borderBottom: "1px solid var(--network-border, #e5e7eb)", whiteSpace: "nowrap", fontSize: 13, textAlign: "left" };
  const control = { width: "100%", minWidth: 0, padding: "10px 11px", border: "1px solid var(--network-border, #d6d9df)", borderRadius: 8, background: "var(--network-control-bg, #fff)", color: "var(--network-text, #20242b)", fontSize: 14 };
  const panel = { border: "1px solid var(--network-border, #e0e2e6)", borderRadius: 12, background: "var(--network-panel, #fff)", padding: 16 };

  return <main className="cockpit">
    <header className="pageHeader">
      <div>
        <div className="eyebrow">STELLANTIS INDIA · NETWORK</div>
        <h1>Stellantis Network</h1>
        <p className="subtitle">Dealer and touchpoint register · source snapshot: 10 October 2026</p>
        <div className="dataFreshness">Source: {sourceFile} · Source labels and values are preserved as provided.</div>
      </div>
      <div className="headerStatus"><span className="statusDot" />{records.length.toLocaleString("en-IN")} source records</div>
    </header>

    <nav className="cockpitNav">
      <Link href="/model-wise/jeep">Jeep Model Wise</Link>
      <Link href="/model-wise/citroen">Citroën Model Wise</Link>
      <Link href="/industry">Industry</Link>
      <Link href="/industry/manufacturers">Manufacturer History</Link>
      <Link href="/budget-planning">Budget Planning</Link>
      <Link href="/data-entry">Data Entry</Link>
      <Link className="active" href="/stellantis-network">Stellantis Network</Link>
    </nav>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 20 }}>
      <article style={panel}><div className="eyebrow">NETWORK ROWS</div><div style={{ fontSize: 28, fontWeight: 750, marginTop: 7 }}>{records.length.toLocaleString("en-IN")}</div><div className="subtitle" style={{ marginTop: 5, marginBottom: 0 }}>Dealer/location records, excluding the source totals row</div></article>
      <article style={panel}><div className="eyebrow">CITROËN TOUCHPOINT TOTAL</div><div style={{ fontSize: 28, fontWeight: 750, marginTop: 7 }}>{formatNumber(sourceTotals?.[10])}</div><div className="subtitle" style={{ marginTop: 5, marginBottom: 0 }}>Value shown in the workbook totals row</div></article>
      <article style={panel}><div className="eyebrow">JEEP TOUCHPOINT TOTAL</div><div style={{ fontSize: 28, fontWeight: 750, marginTop: 7 }}>{formatNumber(sourceTotals?.[11])}</div><div className="subtitle" style={{ marginTop: 5, marginBottom: 0 }}>Value shown in the workbook totals row</div></article>
    </section>

    <section style={{ ...panel, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div><h2 style={{ margin: 0 }}>Dealer register</h2><p className="subtitle" style={{ margin: "5px 0 0" }}>Search, filter, sort and review all source columns. SBH is retained as the source format label.</p></div>
        <button className="secondaryButton" type="button" onClick={exportCsv}>Export filtered CSV</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
        <input aria-label="Search all dealer network columns" placeholder="Search all columns…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} style={control} />
        <select aria-label="Filter by brand" value={brandFilter} onChange={event => changeFilter(setBrandFilter, event.target.value)} style={control}><option>All</option>{brandOptions.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by format" value={formatFilter} onChange={event => changeFilter(setFormatFilter, event.target.value)} style={control}><option>All</option>{formatOptions.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by city" value={cityFilter} onChange={event => changeFilter(setCityFilter, event.target.value)} style={control}><option>All cities</option>{cityOptions.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by facility type" value={facilityFilter} onChange={event => changeFilter(setFacilityFilter, event.target.value)} style={control}><option>All facility types</option>{facilityOptions.map(value => <option key={value}>{value}</option>)}</select>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10, fontSize: 13, color: "var(--muted, #6b7078)" }}>
        <span>Showing {filtered.length ? ((currentPage - 1) * pageSize + 1).toLocaleString("en-IN") : 0}–{Math.min(currentPage * pageSize, filtered.length).toLocaleString("en-IN")} of {filtered.length.toLocaleString("en-IN")} matching rows</span>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>Rows per page <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} style={{ ...control, width: 100 }}>{PAGE_SIZES.map(size => <option value={size} key={size}>{size === 228 ? "All" : size}</option>)}</select></label>
      </div>
      <div style={{ overflow: "auto", maxWidth: "100%", border: "1px solid var(--network-border, #e5e7eb)", borderRadius: 8 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 1650, width: "100%", color: "var(--network-text, #20242b)" }}>
          <thead><tr>{columns.map((column, index) => <th key={column} style={{ ...cell, position: "sticky", top: 0, zIndex: 1, background: "var(--network-header, #f3f5f8)", color: "var(--muted, #5e6570)", textTransform: "uppercase", fontSize: 11, letterSpacing: .35, cursor: "pointer" }}><button type="button" onClick={() => sortBy(index)} style={{ border: 0, padding: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}>{column}{sortKey === index ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead>
          <tbody>{visible.map((row, rowIndex) => <tr key={String(row[0] ?? rowIndex) + "-" + rowIndex}>{row.map((value, colIndex) => <td key={colIndex} style={{ ...cell, background: rowIndex % 2 ? "var(--network-row-alt, #fafbfc)" : "var(--network-panel, #fff)", fontWeight: colIndex === 0 ? 600 : 400 }}>{value === null || value === undefined || value === "" ? "—" : String(value)}</td>)}</tr>)}
          {visible.length === 0 && <tr><td colSpan={columns.length} style={{ ...cell, padding: 24, textAlign: "center" }}>No network rows match the selected filters.</td></tr>}</tbody>
          {currentPage === pageCount && filtered.length === records.length && <tfoot><tr>{columns.map((column, index) => <td key={column} style={{ ...cell, background: "var(--network-total, #eaf0f8)", fontWeight: 750 }}>{sourceTotals && sourceTotals[index] !== null && sourceTotals[index] !== undefined && sourceTotals[index] !== "" ? String(sourceTotals[index]) : index === 4 ? "Source total" : ""}</td>)}</tr></tfoot>}
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 14 }}>
        <button className="secondaryButton" type="button" disabled={currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
        <span style={{ fontSize: 13, minWidth: 95, textAlign: "center" }}>Page {currentPage} of {pageCount}</span>
        <button className="secondaryButton" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</button>
      </div>
    </section>
    <p className="subtitle">Data source is a point-in-time workbook snapshot. No records have been deduplicated, reclassified or inferred. Touchpoint totals are reproduced from the workbook, not interpreted as verified sales-only locations.</p>
  </main>;
}
