"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MONTHS,
  buildIndustryView,
  formatIndustryNumber,
  getIndustryMonths,
  getIndustryTotal,
  getIndustryYears,
  loadIndustryData,
} from "../../lib/industryData";

export default function IndustryPage() {
  const [data, setData] = useState([]);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadIndustryData()
      .then((rows) => {
        if (!active) return;
        setData(rows);
        const years = getIndustryYears(rows);
        if (years.length) setYear(String(years[0]));
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const years = useMemo(() => getIndustryYears(data), [data]);
  const availableMonths = useMemo(() => getIndustryMonths(data, Number(year)), [data, year]);
  const rows = useMemo(() => buildIndustryView(data, Number(year), month), [data, year, month]);
  const total = useMemo(() => getIndustryTotal(data, Number(year), month), [data, year, month]);
  const selectedMonthLabel = month === "All" ? "YTD" : month === "Annual" ? "Annual" : MONTHS[Number(month) - 1];

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div>
          <h1>Industry</h1>
          <p className="subtitle">Indian passenger vehicle industry TIV by segment</p>
        </div>
        <div className="headerStatus">
          <span className={loading ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading industry data" : error ? "Data error" : "Industry data connected"}
        </div>
      </header>

      <nav className="cockpitNav">
        <Link href="/">Sales Cockpit</Link>
        <Link href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link href="/model-wise/citroen">Citroën Model Wise</Link>
        <Link className="active" href="/industry">Industry</Link>
        <Link href="/data-entry">Data Entry</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => { setYear(e.target.value); setMonth("All"); }} disabled={!years.length}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={!year}>
            <option value="All">All / YTD</option>
            {availableMonths.map((item) => (
              <option key={item} value={String(item)}>{MONTHS[item - 1]}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="industrySummaryGrid">
        <div className="queryCard">
          <div className="eyebrow">{month === "All" ? "YTD INDUSTRY TIV" : "INDUSTRY TIV"}</div>
          <h2>{year || "Industry"}</h2>
          <strong className="industryHeadline">{formatIndustryNumber(total)}</strong>
          <p>{selectedMonthLabel} · Total passenger vehicle industry</p>
        </div>

        <div className="queryCard">
          <div className="eyebrow">DATA SCOPE</div>
          <h2>Segment only</h2>
          <p>Month-wise industry totals are maintained by segment. No brand, model or classification layer is stored here.</p>
        </div>
      </section>

      {error ? <div className="errorBanner">{error}</div> : null}

      <section>
        <div className="sectionHeading">
          <div>
            <h2>Industry by segment</h2>
            <p className="subtitle">Source: India TIV Sep26.xlsx · 2026 Sep sheet</p>
          </div>
        </div>

        <div className="tableCard">
          <div className="industryTableHeader">
            <div>Segment</div>
            <div>Units</div>
            <div>Share</div>
          </div>

          {rows.length ? rows.map((row) => (
            <div className="industryTableRow" key={row.key}>
              <div className="scopeName">{row.bodyshape} · {row.segment}</div>
              <div>{formatIndustryNumber(row.units)}</div>
              <div>{total ? ((row.units / total) * 100).toFixed(1) + "%" : "—"}</div>
            </div>
          )) : (
            <div className="industryEmpty">
              {loading ? "Loading..." : "No Industry segment data is available for the selected period."}
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>Industry is intentionally lightweight and independent of Sales Cockpit.</span>
        <span>The source Excel remains the detailed backup.</span>
      </footer>
    </main>
  );
}
