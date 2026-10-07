"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readClientCache } from "../../lib/clientCache";
import {
  INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS,
  filterHistoryRows, formatIndustryNumber, getIndustryYears, loadIndustryData, INDUSTRY_CACHE_KEY
} from "../../lib/industryData";

export default function IndustryPage() {
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState("Monthly");
  const [segmentSelection, setSegmentSelection] = useState([]);
  const [segmentMenuOpen, setSegmentMenuOpen] = useState(false);
  const [periodValue, setPeriodValue] = useState("All");
  const [year, setYear] = useState("2026");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);

  useEffect(() => {
    let active = true;
    const cached = readClientCache(INDUSTRY_CACHE_KEY);

    if (cached?.data?.length) {
      setData(cached.data);
      setCachedAt(cached.cachedAt);
      setLoading(false);
      setRefreshing(true);
      const years = getIndustryYears(cached.data);
      if (years.length) setYear(String(years[0]));
    }

    loadIndustryData().then(rows => {
      if (!active) return;
      setData(rows);
      setCachedAt(Date.now());
      setRefreshing(false);
      const years = getIndustryYears(rows);
      if (years.length) setYear(String(years[0]));
    }).catch(err => {
      if (!active) return;
      setRefreshing(false);
      if (!cached?.data?.length) setError(err.message);
    }).finally(() => active && setLoading(false));

    return () => { active = false; };
  }, []);

  const years = useMemo(() => ["All", ...getIndustryYears(data).map(String)], [data]);
  const segments = useMemo(() => [...new Set(data.map(r => r.segment).filter(s => s && s !== "Industry Total"))].sort(), [data]);
  const suvSegments = useMemo(() => segments.filter(s => s.toUpperCase().includes("SUV")), [segments]);
  const segmentLabel = segmentSelection.length === 0 ? "All"
    : segmentSelection.length === 1 ? segmentSelection[0]
    : String(segmentSelection.length) + " Segments Selected";
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
    data.filter(r => r.segment !== "Industry Total" && (
      segmentSelection.length === 0 || segmentSelection.includes(r.segment)
    )),
    filters
  ), [data, period, periodValue, year, customFrom, customTo, segmentSelection]);

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

  const breakdownRows = useMemo(() => {
    const map = new Map();

    for (const row of (segmentSelection.length === 0 ? totalRows : selectedRows)) {
      const date = String(row.sales_period);
      const yearLabel = date.slice(0, 4);
      const month = Number(date.slice(5, 7));
      let periodKey = date;
      let periodLabel = date;

      if (period === "Monthly") {
        periodLabel = MONTHS[month - 1] || date;
      } else if (period === "Quarterly") {
        periodKey = `Q${Math.floor((month - 1) / 3) + 1}`;
        periodLabel = periodKey;
      } else if (period === "Half-Yearly") {
        periodKey = month <= 6 ? "H1" : "H2";
        periodLabel = periodKey;
      } else if (period === "Annual") {
        periodKey = yearLabel;
        periodLabel = yearLabel;
      } else {
        periodKey = date;
        periodLabel = date;
      }

      const key = `${yearLabel}-${periodKey}`;
      map.set(key, {
        year: yearLabel,
        period: periodLabel,
        units: (map.get(key)?.units || 0) + Number(row.units || 0),
      });
    }

    const totalByPeriod = new Map();

    if (segmentSelection.length > 0) {
      for (const row of totalRows) {
        const date = String(row.sales_period);
        const yearLabel = date.slice(0, 4);
        const month = Number(date.slice(5, 7));
        let periodKey = date;

        if (period === "Monthly") {
          periodKey = date;
        } else if (period === "Quarterly") {
          periodKey = `Q${Math.floor((month - 1) / 3) + 1}`;
        } else if (period === "Half-Yearly") {
          periodKey = month <= 6 ? "H1" : "H2";
        } else if (period === "Annual") {
          periodKey = yearLabel;
        }

        totalByPeriod.set(
          `${yearLabel}-${periodKey}`,
          (totalByPeriod.get(`${yearLabel}-${periodKey}`) || 0) + Number(row.units || 0)
        );
      }
    }

    return [...map.entries()]
      .map(([key, value]) => ({
        key,
        year: value.year,
        period: value.period,
        units: value.units,
        total: segmentSelection.length === 0 ? value.units : (totalByPeriod.get(key) || 0),
      }))
      .filter(row => row.units > 0)
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [selectedRows, totalRows, segmentSelection, period]);

  const label = period === "Monthly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Quarterly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Half-Yearly" ? (periodValue === "All" ? "All / YTD" : periodValue)
    : period === "Annual" ? "Annual" : "Custom Period";

  return <main className="cockpit">
    <header className="header">
      <div><div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div><h1>Industry</h1><p className="subtitle">Indian passenger vehicle industry TIV by segment</p>{cachedAt && <div className="dataFreshness">{refreshing ? "Showing cached data · refreshing in background" : "Updated " + new Date(cachedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>}</div>
      <div className="headerStatus"><span className={(loading || refreshing) ? "statusDot loadingDot" : "statusDot"} />{loading ? "Loading industry data" : refreshing ? "Refreshing industry data" : error ? "Data error" : "Industry data connected"}</div>
    </header>
    <nav className="cockpitNav">
      <Link href="/">Sales Cockpit</Link><Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link>
      <Link className="active" href="/industry">Industry</Link><Link href="/industry/manufacturers">Manufacturer History</Link><Link href="/data-entry">Data Entry</Link>
    </nav>

    <section className="filters">
      <div className="filter"><label>Period</label><select value={period} onChange={e => changePeriod(e.target.value)}>{INDUSTRY_PERIODS.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="filter segmentFilter">
        <label>Segment</label>
        <div className="segmentMultiSelect">
          <button type="button" className={"segmentSelectButton" + (segmentMenuOpen ? " open" : "")} onClick={() => setSegmentMenuOpen(open => !open)} aria-expanded={segmentMenuOpen} aria-haspopup="listbox">
            <span>{segmentLabel}</span><span className="segmentSelectChevron">{segmentMenuOpen ? "⌃" : "⌄"}</span>
          </button>
          {segmentMenuOpen && (
            <div className="segmentMenu" role="listbox" aria-label="Segment selection" aria-multiselectable="true">
              <div className="segmentMenuQuickActions">
                <button type="button" className={segmentSelection.length === 0 ? "selected" : ""} onClick={() => setSegmentSelection([])}>
                  {segmentSelection.length === 0 ? "✓ " : ""}All
                </button>
                {suvSegments.length > 0 && (
                  <button type="button" className={segmentSelection.length === suvSegments.length && suvSegments.every(s => segmentSelection.includes(s)) ? "selected" : ""} onClick={() => setSegmentSelection(suvSegments)}>
                    SUVs
                  </button>
                )}
              </div>
              <div className="segmentMenuList">
                {segments.map(name => {
                  const checked = segmentSelection.includes(name);
                  return (
                    <label className={"segmentOption" + (checked ? " checked" : "")} key={name}>
                      <input type="checkbox" checked={checked} onChange={() => setSegmentSelection(current => checked ? current.filter(item => item !== name) : [...current, name])} />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="segmentMenuFooter">
                <button type="button" className="segmentClearButton" onClick={() => setSegmentSelection([])}>All</button>
                <button type="button" className="segmentDoneButton" onClick={() => setSegmentMenuOpen(false)}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="filter"><label>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period"}</label>
        {period === "Custom Period" ? <div className="customDates"><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}/></div>
        : <select value={periodValue} onChange={e => setPeriodValue(e.target.value)}>{periodOptions.map(x => <option key={x}>{x}</option>)}</select>}
      </div>
      <div className="filter"><label>Year</label><select value={year} onChange={e => setYear(e.target.value)}>{years.map(x => <option key={x}>{x}</option>)}</select></div>
    </section>

    <section className="industrySummaryGrid">
      <div className="queryCard"><div className="eyebrow">{segmentSelection.length === 0 ? "INDUSTRY TIV" : "SEGMENT TIV"}</div><h2>{segmentSelection.length === 0 ? "Industry" : segmentLabel}</h2><strong className="industryHeadline">{formatIndustryNumber(segmentSelection.length === 0 ? total : grouped.reduce((s,r)=>s+r.units,0))}</strong><p>{label} · {year}</p></div>
      <div className="queryCard"><div className="eyebrow">DATA SCOPE</div><h2>Segment history</h2><p>1991–1996 annual · 1997 onward monthly · source IND.xlsx</p></div>
    </section>

    {error && <div className="errorBanner">{error}</div>}
    <section><div className="sectionHeading"><div><h2>Industry by segment</h2><p className="subtitle">Select one or more segments to analyse them together.</p></div></div>
      <div className="tableCard">
        {breakdownRows.length ? (
          <>
            <div className="industryBreakdownHeader"><div>Year</div><div>Period</div><div>{segmentSelection.length === 0 ? "Industry" : "Segment"}</div><div>Units</div><div>Share</div></div>
            {breakdownRows.map(r => (
              <div className="industryBreakdownRow" key={r.key}>
                <div className="scopeName">{r.year}</div>
                <div className="scopeName">{r.period}</div>
                <div className="scopeName">{segmentSelection.length === 0 ? "Industry" : segmentLabel}</div>
                <div>{formatIndustryNumber(r.units)}</div>
                <div>{r.total ? ((r.units / r.total) * 100).toFixed(1) + "%" : "—"}</div>
              </div>
            ))}
          </>
        ) : grouped.length ? (
          <>
            <div className="industryTableHeader"><div>Segment</div><div>Units</div><div>Share</div></div>
            {grouped.map(r => <div className="industryTableRow" key={r.name}><div className="scopeName">{r.name}</div><div>{formatIndustryNumber(r.units)}</div><div>{total ? ((r.units/total)*100).toFixed(1)+"%" : "—"}</div></div>)}
          </>
        ) : <div className="industryEmpty">{loading ? "Loading..." : "No Industry data is available for the selected filters."}</div>}
      </div>
    </section>
    <footer><span>Industry filters mirror the Sales Cockpit period structure.</span><span>Historical Industry: 1991 onward</span></footer>
  </main>;
}