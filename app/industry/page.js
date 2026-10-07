"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INDUSTRY_PERIODS,
  INDUSTRY_VIEWS,
  INDUSTRY_YEARS,
  SEGMENT_LENSES,
  MONTHS,
  buildIndustryView,
  formatIndustryNumber,
  loadIndustryModels,
  loadIndustryYear,
} from "../../lib/industryData";

const PERIOD_OPTIONS = {
  Monthly: ["All", ...MONTHS],
  Quarterly: ["All", "Q1", "Q2", "Q3", "Q4"],
  "Half-Yearly": ["All", "H1", "H2"],
  Annual: ["All"],
};

export default function IndustryPage() {
  const [period, setPeriod] = useState("Monthly");
  const [periodValue, setPeriodValue] = useState("All");
  const [year, setYear] = useState("2026");
  const [view, setView] = useState("Industry");
  const [segmentLens, setSegmentLens] = useState("Stellantis Segment");
  const [models, setModels] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadIndustryModels()
      .then((data) => { if (active) setModels(data); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadIndustryYear(Number(year))
      .then((data) => { if (active) setMonthlyRows(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year]);

  const rows = useMemo(
    () => buildIndustryView(models, monthlyRows, { period, periodValue, view, segmentLens }),
    [models, monthlyRows, period, periodValue, view, segmentLens]
  );

  const total = rows.reduce((sum, row) => sum + row.units, 0);
  const pending = models.filter((model) => model.validation_status !== "VALIDATED").length;

  function handlePeriodChange(next) {
    setPeriod(next);
    setPeriodValue("All");
  }

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div>
          <h1>Industry</h1>
          <p className="subtitle">Indian passenger vehicle industry TIV, segments, brands and models</p>
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
          <label>Period</label>
          <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
            {INDUSTRY_PERIODS.filter((item) => item !== "Custom Period").map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>{period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period"}</label>
          <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
            {PERIOD_OPTIONS[period].map((item, index) => (
              <option key={item} value={period === "Monthly" && index > 0 ? String(index) : item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {INDUSTRY_YEARS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>View</label>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            {INDUSTRY_VIEWS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Segment Lens</label>
          <select value={segmentLens} onChange={(e) => setSegmentLens(e.target.value)} disabled={view !== "Segment"}>
            {SEGMENT_LENSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>

      <section className="industrySummaryGrid">
        <div className="queryCard">
          <div className="eyebrow">SELECTED VIEW</div>
          <h2>{view === "Industry" ? "Industry TIV" : view}</h2>
          <strong className="industryHeadline">{formatIndustryNumber(total)}</strong>
          <p>
            {period} · {periodValue === "All" ? "Full selected period" : periodValue} · {year}
          </p>
        </div>
        <div className="queryCard">
          <div className="eyebrow">CLASSIFICATION</div>
          <h2>{pending ? "Validation pending" : "Validated"}</h2>
          <p>
            {pending
              ? pending + " model classifications are awaiting validation against the 2024–26 source files."
              : "Model classifications are validated."}
          </p>
        </div>
      </section>

      {error ? <div className="errorBanner">{error}</div> : null}

      <section>
        <div className="sectionHeading">
          <div>
            <h2>{view === "Industry" ? "Industry overview" : view + " performance"}</h2>
            <p className="subtitle">Source framework: Master-Sep26. Summary and subtotal rows are calculated, not stored.</p>
          </div>
        </div>

        <div className="tableCard">
          <div className="industryTableHeader">
            <div>{view === "Industry" ? "View" : view}</div>
            <div>Units</div>
            <div>Share</div>
            <div>Models</div>
            <div>Validation</div>
          </div>

          {rows.length ? rows.slice(0, 100).map((row) => (
            <div className="industryTableRow" key={row.key}>
              <div className="scopeName">{row.label}</div>
              <div>{formatIndustryNumber(row.units)}</div>
              <div>{total ? ((row.units / total) * 100).toFixed(1) + "%" : "—"}</div>
              <div>{row.modelCount || "—"}</div>
              <div className="statusText">
                {row.validationStatus ? row.validationStatus : "Derived"}
              </div>
            </div>
          )) : (
            <div className="industryEmpty">
              {loading ? "Loading..." : "No Industry data has been imported yet. The database foundation is ready for the Master-Sep26 import."}
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>Industry framework is independent of Sales Cockpit.</span>
        <span>2024–26 classification validation will be applied when those source files are uploaded.</span>
      </footer>
    </main>
  );
}
