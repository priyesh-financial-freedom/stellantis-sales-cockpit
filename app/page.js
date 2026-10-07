"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSalesView, loadSalesData } from "../lib/salesData";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SCOPES = ["All", "Jeep", "Citroën", "SAARC"];
const YEARS = ["All", "2024", "2025", "2026"];
const METRICS = ["All", "TD", "Bookings", "Retail", "Wholesale"];

const MONTHS = [
  "All", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const HALF_YEARS = ["All", "H1", "H2"];

const metricMap = {
  TD: ["TD", "test_drives"],
  Bookings: ["Bookings", "bookings"],
  Retail: ["Retail", "retail"],
  Wholesale: ["Wholesale", "wholesale"],
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function valueClass(status, value) {
  if (status === "FUTURE") return "futureValue";
  if (status === "INCOMPLETE" && Number(value) > 0) return "futureValue";
  return "";
}

function statusClass(status) {
  return status === "INCOMPLETE" || status === "FUTURE" ? "futureValue" : "";
}

function periodDisplay(period, value, customFrom, customTo) {
  if (period === "Custom Period") {
    return customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom Period";
  }
  if (period === "Monthly" && value !== "All") {
    return MONTHS[Number(value)] || value;
  }
  return value;
}

export default function Home() {
  const [period, setPeriod] = useState("Monthly");
  const [scope, setScope] = useState("All");
  const [periodValue, setPeriodValue] = useState("All");
  const [year, setYear] = useState("2026");
  const [metric, setMetric] = useState("All");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        const data = await loadSalesData();
        if (active) setRows(data);
      } catch (err) {
        if (active) setError(err.message || "Unable to load sales data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const periodOptions = useMemo(() => {
    if (period === "Monthly") return MONTHS;
    if (period === "Quarterly") return QUARTERS;
    if (period === "Half-Yearly") return HALF_YEARS;
    if (period === "Annual") return ["All"];
    return [];
  }, [period]);

  const periodLabel =
    period === "Monthly"
      ? "Month"
      : period === "Quarterly"
        ? "Quarter"
        : period === "Half-Yearly"
          ? "Half-Year"
          : "Period";

  const selection = useMemo(
    () => ({ period, periodValue, year, customFrom, customTo }),
    [period, periodValue, year, customFrom, customTo]
  );

  const view = useMemo(
    () => buildSalesView(rows, selection),
    [rows, selection]
  );

  const displayedScopes = scope === "All"
    ? ["Jeep", "Citroën", "SAARC", "Stellantis Total"]
    : [scope];

  const breakdownOptions = useMemo(() => {
    if (period !== "Monthly" && period !== "Quarterly" && period !== "Half-Yearly") return [];
    if (period === "Monthly") return MONTHS.slice(1).map((label, index) => ({ label, value: String(index + 1) }));
    if (period === "Quarterly") return QUARTERS.slice(1).map((label) => ({ label, value: label }));
    return HALF_YEARS.slice(1).map((label) => ({ label, value: label }));
  }, [period]);

  const showBreakdown = periodValue === "All" && breakdownOptions.length > 0;
  const breakdownViews = useMemo(() => {
    if (!showBreakdown) return [];
    return breakdownOptions.map((option) => ({
      ...option,
      view: buildSalesView(rows, { period, periodValue: option.value, year, customFrom, customTo }),
    }));
  }, [showBreakdown, breakdownOptions, rows, period, year, customFrom, customTo]);
  const metricColumns = metric === "All"
    ? Object.values(metricMap)
    : [metricMap[metric]];

  function handlePeriodChange(value) {
    setPeriod(value);
    setPeriodValue("All");
    if (value !== "Custom Period") {
      setCustomFrom("");
      setCustomTo("");
    }
  }

  function renderMetric(scopeName, label, key) {
    const item = view.totals[scopeName];
    if (!item?.recorded[key]) return "—";
    return formatNumber(item[key]);
  }

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA</div>
          <h1>Sales Cockpit</h1>
          <p className="subtitle">
            Management view of Test Drives, Bookings, Retail and Wholesale
          </p>
        </div>
        <div className="headerStatus">
          <span className={loading ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading data" : error ? "Data error" : "Data connected"}
        </div>
      </header>

      <section className="filters">
        <div className="filter">
          <label>Period</label>
          <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
            {PERIODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Scope / Brand</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>{periodLabel}</label>
          {period === "Custom Period" ? (
            <div className="customDates">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          ) : (
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {periodOptions.map((item, index) => (
                <option key={item} value={period === "Monthly" && index > 0 ? index : item}>
                  {item}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {YEARS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>

      <section className="summary">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">MANAGEMENT VIEW</div>
            <h2>
              {period} · {scope} · {periodDisplay(period, periodValue, customFrom, customTo)} · {year}
            </h2>
          </div>
          <span className="incompleteLegend">
            <span className="legendDot" />
            Incomplete / Forecast
          </span>
        </div>

        {error && <div className="errorBanner">{error}</div>}

        <div className="tableCard">
          {showBreakdown ? (
            <>
              <div
                className="tableHeader"
                style={{ gridTemplateColumns: `1.1fr 1.6fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
              >
                <div>Period</div>
                <div>Scope</div>
                {metricColumns.map(([label]) => <div key={label}>{label}</div>)}
                <div>Status</div>
              </div>

              {breakdownViews.flatMap(({ label, view: periodView }) =>
                displayedScopes.map((scopeName) => (
                  <div
                    className="tableRow"
                    key={`${label}-${scopeName}`}
                    style={{ gridTemplateColumns: `1.1fr 1.6fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
                  >
                    <div className="scopeName">{label}</div>
                    <div className="scopeName">{scopeName}</div>
                    {metricColumns.map(([metricLabel, key]) => {
                      const item = periodView.totals[scopeName];
                      const itemStatus = item?.recorded[key] ? periodView.status : "NO DATA";
                      return (
                        <div key={metricLabel} className={valueClass(itemStatus, item?.[key])}>
                          {item?.recorded[key] ? formatNumber(item[key]) : "—"}
                        </div>
                      );
                    })}
                    <div className={statusClass(periodView.status) + " statusText"}>
                      {periodView.status}
                    </div>
                  </div>
                ))
              )}

              <div
                className="tableRow totalRow"
                style={{ gridTemplateColumns: `1.1fr 1.6fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
              >
                <div className="scopeName">TOTAL</div>
                <div className="scopeName">{scope === "All" ? "Stellantis Total" : scope}</div>
                {metricColumns.map(([label, key]) => {
                  const item = view.totals[scope === "All" ? "Stellantis Total" : scope];
                  const itemStatus = item?.recorded[key] ? view.status : "NO DATA";
                  return (
                    <div key={label} className={valueClass(itemStatus, item?.[key])}>
                      {item?.recorded[key] ? formatNumber(item[key]) : "—"}
                    </div>
                  );
                })}
                <div className={statusClass(view.status) + " statusText"}>{view.status}</div>
              </div>
            </>
          ) : (
            <>
              <div
                className="tableHeader"
                style={{ gridTemplateColumns: `2fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
              >
                <div>Scope</div>
                {metricColumns.map(([label]) => <div key={label}>{label}</div>)}
                <div>Status</div>
              </div>

              {displayedScopes.map((scopeName) => (
                <div
                  className="tableRow"
                  key={scopeName}
                  style={{ gridTemplateColumns: `2fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
                >
                  <div className="scopeName">{scopeName}</div>
                  {metricColumns.map(([label, key]) => {
                    const item = view.totals[scopeName];
                    const itemStatus = item?.recorded[key]
                      ? view.status
                      : "NO DATA";
                    return (
                      <div key={label} className={valueClass(itemStatus, item?.[key])}>
                        {renderMetric(scopeName, label, key)}
                      </div>
                    );
                  })}
                  <div className={statusClass(view.status) + " statusText"}>
                    {view.status}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="managementGrid">
        <div className="queryCard">
          <div className="eyebrow">MANAGEMENT QUERIES</div>
          <h2>Ask about the data</h2>
          <p>
            Query intelligence will use the same underlying sales data and active filters.
          </p>
          <div className="queryInput">
            <input disabled placeholder="Management query engine — next step" />
            <button type="button" disabled>Ask</button>
          </div>
          <div className="quickQueries">
            <button type="button">Highest-ever retail</button>
            <button type="button">Highest-ever wholesale</button>
            <button type="button">Best model this year</button>
            <button type="button">Best month ever</button>
          </div>
        </div>

        <div className="comparisonCard">
          <div className="eyebrow">COMPARISON</div>
          <h2>Management comparison</h2>
          <p>Comparison engine will use the selected period and metric.</p>
          <div className="comparisonItems">
            <div><span>Current vs previous</span><strong>—</strong></div>
            <div><span>Current vs LY</span><strong>—</strong></div>
            <div><span>Jeep vs Citroën</span><strong>—</strong></div>
          </div>
        </div>
      </section>

      <footer>
        <span>Stellantis Sales Cockpit</span>
        <span>•</span>
        <span>Year-by-year Supabase loading</span>
      </footer>
    </main>
  );
}
