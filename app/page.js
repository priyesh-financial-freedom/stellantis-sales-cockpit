"use client";

import { useMemo, useState } from "react";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SCOPES = ["All", "Jeep", "Citroën", "SAARC"];
const YEARS = ["All", "2024", "2025", "2026"];
const METRICS = ["All", "TD", "Bookings", "Retail", "Wholesale"];

const MONTHS = [
  "All",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const HALF_YEARS = ["All", "H1", "H2"];

const sampleRows = [
  { scope: "Jeep", td: 0, bookings: 0, retail: 0, wholesale: 0, status: "INCOMPLETE" },
  { scope: "Citroën", td: 0, bookings: 0, retail: 0, wholesale: 0, status: "INCOMPLETE" },
  { scope: "SAARC", td: 0, bookings: 0, retail: 0, wholesale: 0, status: "INCOMPLETE" },
  { scope: "Stellantis Total", td: 0, bookings: 0, retail: 0, wholesale: 0, status: "INCOMPLETE" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export default function Home() {
  const [period, setPeriod] = useState("Monthly");
  const [scope, setScope] = useState("All");
  const [periodValue, setPeriodValue] = useState("All");
  const [year, setYear] = useState("2026");
  const [metric, setMetric] = useState("All");

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

  const displayedRows =
    scope === "All"
      ? sampleRows
      : sampleRows.filter((row) => row.scope === scope);

  const metricColumns =
    metric === "All"
      ? [
          ["TD", "td"],
          ["Bookings", "bookings"],
          ["Retail", "retail"],
          ["Wholesale", "wholesale"],
        ]
      : [[metric, metric.toLowerCase()]];

  function handlePeriodChange(value) {
    setPeriod(value);

    if (value === "Monthly") setPeriodValue("All");
    if (value === "Quarterly") setPeriodValue("All");
    if (value === "Half-Yearly") setPeriodValue("All");
    if (value === "Annual") setPeriodValue("All");
    if (value === "Custom Period") setPeriodValue("");
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
          <span className="statusDot" />
          Data connected
        </div>
      </header>

      <section className="filters">
        <div className="filter">
          <label>Period</label>
          <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
            {PERIODS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Scope / Brand</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>{periodLabel}</label>

          {period === "Custom Period" ? (
            <div className="customDates">
              <input
                type="date"
                value={periodValue?.split("|")[0] || ""}
                onChange={(e) =>
                  setPeriodValue(`${e.target.value}|${periodValue?.split("|")[1] || ""}`)
                }
              />
              <input
                type="date"
                value={periodValue?.split("|")[1] || ""}
                onChange={(e) =>
                  setPeriodValue(`${periodValue?.split("|")[0] || ""}|${e.target.value}`)
                }
              />
            </div>
          ) : (
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {periodOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          )}
        </div>

        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {YEARS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="summary">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">MANAGEMENT VIEW</div>
            <h2>
              {period} · {scope} · {periodValue || "Custom Period"} · {year}
            </h2>
          </div>

          <span className="incompleteLegend">
            <span className="legendDot" />
            Incomplete / Forecast
          </span>
        </div>

        <div className="tableCard">
          <div className="tableHeader">
            <div>Scope</div>
            {metricColumns.map(([label]) => (
              <div key={label}>{label}</div>
            ))}
            <div>Status</div>
          </div>

          {displayedRows.map((row) => (
            <div className="tableRow" key={row.scope}>
              <div className="scopeName">{row.scope}</div>

              {metricColumns.map(([label, key]) => (
                <div
                  key={label}
                  className={row.status !== "ACTUAL / COMPLETE" ? "futureValue" : ""}
                >
                  {formatNumber(row[key])}
                </div>
              ))}

              <div className="statusText">{row.status}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="managementGrid">
        <div className="queryCard">
          <div className="eyebrow">MANAGEMENT QUERIES</div>
          <h2>Ask about the data</h2>
          <p>
            Ask questions such as highest-ever retail, best month this year,
            or growth versus last year.
          </p>

          <div className="queryInput">
            <input placeholder="e.g. What was Compass's highest-ever retail month?" />
            <button type="button">Ask</button>
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
          <p>Compare Jeep and Citroën or the selected period against prior periods.</p>

          <div className="comparisonItems">
            <div>
              <span>Current vs previous</span>
              <strong>—</strong>
            </div>
            <div>
              <span>Current vs LY</span>
              <strong>—</strong>
            </div>
            <div>
              <span>Jeep vs Citroën</span>
              <strong>—</strong>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <span>Stellantis Sales Cockpit</span>
        <span>•</span>
        <span>Supabase data engine</span>
      </footer>
    </main>
  );
}
