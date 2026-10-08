"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readClientCache } from "../../lib/clientCache";
import MultiSelect from "../../components/MultiSelect";
import {
  INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS,
  filterHistoryRows, formatIndustryNumber, getIndustryYears, loadIndustryData, INDUSTRY_CACHE_KEY
} from "../../lib/industryData";

export default function IndustryPage() {
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState("Monthly");
  const [segmentSelection, setSegmentSelection] = useState([]);
  const [periodValue, setPeriodValue] = useState(["All"]);
  const [year, setYear] = useState(["2026"]);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    let active = true;
    const cached = readClientCache(INDUSTRY_CACHE_KEY);

    if (cached?.data?.length) {
      setData(cached.data);
      setCachedAt(cached.cachedAt);
      setLoading(false);
      setRefreshing(true);
      const years = getIndustryYears(cached.data);
      if (years.length) setYear([String(years[0])]);
    }

    loadIndustryData().then(rows => {
      if (!active) return;
      setData(rows);
      setCachedAt(Date.now());
      setRefreshing(false);
      const years = getIndustryYears(rows);
      if (years.length) setYear([String(years[0])]);
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
  const yearLabel = year.length === 0 ? "All" : year.length === 1 ? year[0] : String(year.length) + " Years Selected";
  const periodOptions = useMemo(() => {
    if (period === "Monthly") return ["All", ...MONTHS];
    if (period === "Quarterly") return INDUSTRY_QUARTERS;
    if (period === "Half-Yearly") return INDUSTRY_HALVES;
    if (period === "Annual") return ["All"];
    return [];
  }, [period]);

  function changePeriod(next) {
    setPeriod(next);
    setPeriodValue(["All"]);
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

  const selectedMonthSegments = useMemo(() => {
    if (!selectedMonth) return [];
    const rows = data.filter(r => String(r.sales_period) === selectedMonth && r.segment !== "Industry Total");
    const totalRow = data.find(r => String(r.sales_period) === selectedMonth && r.segment === "Industry Total");
    const totalUnits = Number(totalRow?.units || 0);
    return rows.map(r => ({ name: r.segment, units: Number(r.units || 0), share: totalUnits ? (Number(r.units || 0) / totalUnits) * 100 : 0 })).filter(r => r.units > 0).sort((a, b) => b.units - a.units);
  }, [data, selectedMonth]);

  const selectedMonthTotal = useMemo(() => {
    if (!selectedMonth) return 0;
    return Number(data.find(r => String(r.sales_period) === selectedMonth && r.segment === "Industry Total")?.units || 0);
  }, [data, selectedMonth]);

  const label = period === "Monthly" ? (periodValue.includes("All") ? "All / YTD" : periodValue.join(", "))
    : period === "Quarterly" ? (periodValue.includes("All") ? "All / YTD" : periodValue.join(", "))
    : period === "Half-Yearly" ? (periodValue.includes("All") ? "All / YTD" : periodValue.join(", "))
    : period === "Annual" ? "Annual" : "Custom Period";

  function exportIndustry() {
    const rows = selectedRows.map(row => ({
      sales_period: row.sales_period,
      segment: row.segment,
      units: row.units,
    }));

    if (segmentSelection.length === 0) {
      rows.push(...totalRows.map(row => ({
        sales_period: row.sales_period,
        segment: "Industry Total",
        units: row.units,
      })));
    }

    const csvEscape = value => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = [
      ["sales_period", "segment", "units"].join(","),
      ...rows.map(row => [row.sales_period, row.segment, row.units].map(csvEscape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `industry-${yearLabel.replace(/\s+/g, "-")}-${period.toLowerCase().replace(/\s+/g, "-")}-${periodValue.includes("All") ? "all" : periodValue.join("-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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
      <div className="filter"><MultiSelect label="Segment" options={segments} value={segmentSelection} onChange={setSegmentSelection} /></div>
      <div className="filter"><label>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period"}</label>
        {period === "Custom Period" ? <div className="customDates"><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}/></div>
        : <MultiSelect label={period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period"} options={periodOptions} value={periodValue} onChange={setPeriodValue} />}
      </div>
      <div className="filter"><MultiSelect label="Year" options={years.filter(x => x !== "All")} value={year} onChange={setYear} /></div>
    </section>

    <section className="industrySummaryGrid">
      <div className="queryCard"><div className="eyebrow">{segmentSelection.length === 0 ? "INDUSTRY TIV" : "SEGMENT TIV"}</div><h2>{segmentSelection.length === 0 ? "Industry" : segmentLabel}</h2><strong className="industryHeadline">{formatIndustryNumber(segmentSelection.length === 0 ? total : grouped.reduce((s,r)=>s+r.units,0))}</strong><p>{label} · {yearLabel}</p></div>
      <div className="queryCard"><div className="eyebrow">DATA SCOPE</div><h2>Segment history</h2><p>1991–1996 annual · 1997 onward monthly · source IND.xlsx</p></div>
    </section>

    {error && <div className="errorBanner">{error}</div>}
    <section><div className="sectionHeading"><div><h2>Industry by segment</h2><p className="subtitle">Select one or more segments to analyse them together.</p></div><button type="button" className="secondaryButton" onClick={exportIndustry} disabled={loading || (!selectedRows.length && !totalRows.length)}>Export CSV</button></div>
      <div className="tableCard">
        {breakdownRows.length ? (
          <>
            <div className="industryBreakdownHeader"><div>Year</div><div>Period</div><div>{segmentSelection.length === 0 ? "Industry" : "Segment"}</div><div>Units</div><div>Share</div></div>
            {breakdownRows.map(r => (
              <div className={"industryBreakdownRow" + (period === "Monthly" ? " clickableIndustryRow" : "")} key={r.key} onClick={period === "Monthly" ? () => setSelectedMonth(r.year + "-" + String(MONTHS.indexOf(r.period) + 1).padStart(2, "0") + "-01") : undefined}>
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
    {selectedMonth && (
      <div className="industryMonthOverlay" onClick={e => { if (e.target === e.currentTarget) setSelectedMonth(null); }}>
        <section className="industryMonthSheet" role="dialog" aria-modal="true" aria-labelledby="industryMonthTitle">
          <div className="industryMonthHandle" />
          <div className="industryMonthHeader">
            <div>
              <div className="eyebrow">SEGMENT BREAKUP</div>
              <h2 id="industryMonthTitle">{MONTHS[Number(selectedMonth.slice(5, 7)) - 1]} {selectedMonth.slice(0, 4)}</h2>
              <p>Industry TIV · {formatIndustryNumber(selectedMonthTotal)} units</p>
            </div>
            <button type="button" className="industryMonthClose" onClick={() => setSelectedMonth(null)} aria-label="Close segment breakup">×</button>
          </div>
          <div className="industryMonthList">
            {selectedMonthSegments.length ? selectedMonthSegments.map(row => (
              <div className="industryMonthRow" key={row.name}>
                <div className="industryMonthSegment">{row.name}</div>
                <div className="industryMonthUnits">{formatIndustryNumber(row.units)}</div>
                <div className="industryMonthShare">{row.share.toFixed(1)}%</div>
              </div>
            )) : <div className="industryEmpty">No segment data is available for this month.</div>}
          </div>
          <div className="industryMonthFooter">
            <span>Total Industry</span>
            <strong>{formatIndustryNumber(selectedMonthTotal)}</strong>
            <strong>100%</strong>
          </div>
        </section>
      </div>
    )}

    <footer><span>Industry filters mirror the Sales Cockpit period structure.</span><span>Historical Industry: 1991 onward</span></footer>
  </main>;
}
