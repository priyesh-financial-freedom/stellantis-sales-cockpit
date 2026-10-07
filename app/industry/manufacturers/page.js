"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const fmt = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);
const monthLabel = (date) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(date));

export default function ManufacturerHistoryPage() {
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState("");
  const [period, setPeriod] = useState("YTD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAll() {
      const pageSize = 1000;
      const allRows = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error: queryError } = await supabase
          .from("industry_manufacturer_history_v2")
          .select("sales_period,manufacturer,units,period_type,record_type")
          .eq("record_type", "MANUFACTURER")
          .order("sales_period", { ascending: true })
          .order("manufacturer", { ascending: true })
          .range(from, from + pageSize - 1);
        if (queryError) throw new Error(queryError.message);
        allRows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return allRows;
    }

    loadAll()
      .then((allRows) => {
        if (!active) return;
        setRows(allRows);
        const years = [...new Set(allRows.map((r) => String(r.sales_period).slice(0, 4)))].sort((a,b) => b.localeCompare(a));
        setYear(years[0] || "");
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const years = useMemo(() => [...new Set(rows.map((r) => String(r.sales_period).slice(0, 4)))].sort((a,b) => b.localeCompare(a)), [rows]);
  const yearRows = useMemo(() => rows.filter((r) => String(r.sales_period).slice(0,4) === year), [rows, year]);

  const availableMonths = useMemo(() => {
    return [...new Set(yearRows.filter((r) => r.period_type === "MONTHLY").map((r) => String(r.sales_period).slice(0,7)))].sort();
  }, [yearRows]);

  const filtered = useMemo(() => {
    if (!year) return [];
    if (Number(year) <= 1996) return yearRows;
    if (period === "YTD") return yearRows.filter((r) => r.period_type === "MONTHLY");
    return yearRows.filter((r) => r.sales_period.slice(0,7) === period);
  }, [yearRows, year, period]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      map.set(row.manufacturer, (map.get(row.manufacturer) || 0) + Number(row.units || 0));
    }
    const total = [...map.values()].reduce((a,b) => a+b, 0);
    return [...map.entries()].map(([manufacturer, units]) => ({ manufacturer, units, share: total ? units / total * 100 : 0 }))
      .sort((a,b) => b.units - a.units);
  }, [filtered]);

  const total = grouped.reduce((sum, r) => sum + r.units, 0);

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div>
          <h1>Manufacturer History</h1>
          <p className="subtitle">Historical manufacturer movement — 1991 onward</p>
        </div>
        <div className="headerStatus">
          <span className={loading ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading manufacturer history" : error ? "Data error" : "Historical data connected"}
        </div>
      </header>

      <nav className="cockpitNav">
        <Link href="/">Sales Cockpit</Link>
        <Link href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link href="/model-wise/citroen">Citroën Model Wise</Link>
        <Link href="/industry">Industry</Link>
        <Link className="active" href="/industry/manufacturers">Manufacturer History</Link>
        <Link href="/data-entry">Data Entry</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => { setYear(e.target.value); setPeriod("YTD"); }}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="filter">
          <label>Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={Number(year) <= 1996 || !year}>
            {Number(year) <= 1996 ? <option value="YTD">Annual</option> : <>
              <option value="YTD">YTD</option>
              {availableMonths.map((item) => <option key={item} value={item}>{monthLabel(item + "-01")}</option>)}
            </>}
          </select>
        </div>
      </section>

      <section className="industrySummaryGrid">
        <div className="queryCard">
          <div className="eyebrow">{Number(year) <= 1996 ? "ANNUAL INDUSTRY" : period === "YTD" ? "YTD INDUSTRY" : "MONTH INDUSTRY"}</div>
          <h2>{year || "—"}</h2>
          <strong className="industryHeadline">{fmt(total)}</strong>
          <p>{Number(year) <= 1996 ? "Annual manufacturer total" : period === "YTD" ? "Cumulative manufacturer movement" : "Monthly manufacturer movement"}</p>
        </div>
        <div className="queryCard">
          <div className="eyebrow">HISTORICAL LAYER</div>
          <h2>1991 → 2026</h2>
          <p>Source manufacturer names are preserved exactly as supplied. This history is independent of the segment classification master.</p>
        </div>
      </section>

      {error ? <div className="errorBanner">{error}</div> : null}

      <section>
        <div className="sectionHeading">
          <div>
            <h2>Manufacturer movement</h2>
            <p className="subtitle">Source: comp.xlsx · Master-Sep26</p>
          </div>
        </div>
        <div className="tableCard">
          <div className="industryTableHeader">
            <div>Manufacturer</div>
            <div>Units</div>
            <div>Share</div>
          </div>
          {grouped.length ? grouped.map((row) => (
            <div className="industryTableRow" key={row.manufacturer}>
              <div className="scopeName">{row.manufacturer}</div>
              <div>{fmt(row.units)}</div>
              <div>{row.share.toFixed(1)}%</div>
            </div>
          )) : (
            <div className="industryEmpty">{loading ? "Loading..." : "No manufacturer history has been imported yet."}</div>
          )}
          {grouped.length ? (
            <div className="industryTableRow industryTotalRow">
              <div>Total</div>
              <div>{fmt(total)}</div>
              <div>100.0%</div>
            </div>
          ) : null}
        </div>
      </section>

      <footer>
        <span>Historical manufacturer data is preserved as a separate analytical layer.</span>
        <span>1991–1996 annual · 1997 onward monthly</span>
      </footer>
    </main>
  );
}
