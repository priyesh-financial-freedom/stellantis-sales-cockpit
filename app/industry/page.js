"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS,
  filterHistoryRows, formatIndustryNumber, getIndustryYears, loadIndustryData
} from "../../lib/industryData";

export default function IndustryPage() {
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState("Monthly");
  const [segment, setSegment] = useState("All");
  const [periodValue, setPeriodValue] = useState("All");
  const [year, setYear] = useState("2026");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadIndustryData().then(rows => {
      if (!active) return;
      setData(rows);
      const years = getIndustryYears(rows);
      if (years.length) setYear(String(years[0]));
    }).catch(err => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const years = useMemo(() => ["All", ...getIndustryYears(data).map(String)], [data]);
  const segments = useMemo(() => ["All", ...[...new Set(data.map(r => r.segment).filter(s => s && s !== "Industry Total"))].sort()], [data]);
  const periodOptions = useMemo(() => {
    if (period === "Monthly") return ["All", ...MONTHS];
    if (period === "Quarterly") return INDUSTRY_QUARTERS;
    if (period === "Half-Yearly") return INDUSTRY_HALVES;
    if (period === "Annual") return ["All"];
    return [];
  }, [period]);

  function changePeriod(next) {
    setPeriod(next);
    setPeriodValue("All");
  }

  const filters = { period, periodValue, year, customFrom, customTo };
  const selectedRows = useMemo(() => filterHistoryRows(
    data.filter(r => r.segment !== "Industry Total"),
    { ...filters, key: "segment", value: segment }
  ), [data, period, periodValue, year, customFrom, customTo, segment]);

  const totalRows = useMemo(() => filterHistoryRows(
    data.filter(r => r.segment === "Industry Total"),
    { ...filters, key: "segment", value: "Industry Total" }
  ), [data, period, periodValue, year, customFrom, customTo]);

  const total = totalRows.reduce((s, r) => s + Number(r.units || 0), 0);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of selectedRows) map.set(r.segment, (map.get(r.segment) || 0) + Number(r.units || 0));
    return [...map.entries()].filter(([, units]) => units > 0).map(([name, units]) => ({name, units}))
      .sort((a,b) => b.units-a.units);
  }, [selectedRows]);

  const label = period === "Monthly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Quarterly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Half-Yearly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Annual" ? "Annual" : "Custom Period";

  return <main className="cockpit">
    <header className="header">
      <div><div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div><h1>Industry</h1><p className="subtitle">Indian passenger vehicle industry TIV by segment</p></div>
      <div className="headerStatus"><span className={loading ? "statusDot loadingDot" : "statusDot"} />{loading ? "Loading industry data" : error ? "Data error" : "Industry data connected"}</div>
    </header>
    <nav className="cockpitNav">
      <Link href="/">Sales Cockpit</Link><Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link>
      <Link className="active" href="/industry">Industry</Link><Link href="/industry/manufacturers">Manufacturer History</Link><Link href="/data-entry">Data Entry</Link>
    </nav>

    <section className="filters">
      <div className="filter"><label>Period</label><select value={period} onChange={e => changePeriod(e.target.value)}>{INDUSTRY_PERIODS.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="filter"><label>Segment</label><select value={segment} onChange={e => setSegment(e.target.value)}>{segments.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="filter"><label>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period"}</label>
        {period === "Custom Period" ? <div className="customDates"><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}/></div>
        : <select value={periodValue} onChange={e => setPeriodValue(e.target.value)}>{periodOptions.map(x => <option key={x}>{x}</option>)}</select>}
      </div>
      <div className="filter"><label>Year</label><select value={year} onChange={e => setYear(e.target.value)}>{years.map(x => <option key={x}>{x}</option>)}</select></div>
    </section>

    <section className="industrySummaryGrid">
      <div className="queryCard"><div className="eyebrow">{segment === "All" ? "INDUSTRY TIV" : "SEGMENT TIV"}</div><h2>{segment === "All" ? "Industry" : segment}</h2><strong className="industryHeadline">{formatIndustryNumber(segment === "All" ? total : grouped.reduce((s,r)=>s+r.units,0))}</strong><p>{label} · {year}</p></div>
      <div className="queryCard"><div className="eyebrow">DATA SCOPE</div><h2>Segment history</h2><p>1991–1996 annual · 1997 onward monthly · source IND.xlsx</p></div>
    </section>

    {error && <div className="errorBanner">{error}</div>}
    <section><div className="sectionHeading"><div><h2>Industry by segment</h2><p className="subtitle">Select a segment above to isolate its movement.</p></div></div>
      <div className="tableCard">
        <div className="industryTableHeader"><div>Segment</div><div>Units</div><div>Share</div></div>
        {grouped.length ? grouped.map(r => <div className="industryTableRow" key={r.name}><div className="scopeName">{r.name}</div><div>{formatIndustryNumber(r.units)}</div><div>{total ? ((r.units/total)*100).toFixed(1)+"%" : "—"}</div></div>) : <div className="industryEmpty">{loading ? "Loading..." : "No Industry data is available for the selected filters."}</div>}
      </div>
    </section>
    <footer><span>Industry filters mirror the Sales Cockpit period structure.</span><span>Historical Industry: 1991 onward</span></footer>
  </main>;
}