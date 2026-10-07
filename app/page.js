"use client";

import { useEffect, useMemo, useState } from "react";
import { buildComparison, buildSalesView, getScopeStatus, loadSalesData } from "../lib/salesData";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SCOPES = ["All", "Jeep", "Citroën", "SAARC"];
const YEARS = ["All", "2024", "2025", "2026"];
const METRICS = ["All", "Retail + Wholesale", "TD", "Bookings", "Retail", "Wholesale"];

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
  return status === "INCOMPLETE" || status === "FUTURE"
    ? "incompleteStatus"
    : "completeStatus";
}

function statusLabel(status) {
  return status === "INCOMPLETE" || status === "FUTURE"
    ? "INCOMPLETE"
    : "COMPLETE";
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

  function handlePeriodChange(nextPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod === "Monthly") setPeriodValue("All");
    else if (nextPeriod === "Quarterly") setPeriodValue("All");
    else if (nextPeriod === "Half-Yearly") setPeriodValue("All");
    else setPeriodValue("All");
  }

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

  const showBreakdown =
    (periodValue === "All" && breakdownOptions.length > 0) || year === "All";

  const breakdownViews = useMemo(() => {
    if (!showBreakdown) return [];

    const years = year === "All" ? ["2024", "2025", "2026"] : [year];

    if (periodValue === "All" && breakdownOptions.length > 0) {
      return years.flatMap((selectedYear) =>
        breakdownOptions.map((option) => ({
          label: option.label,
          yearLabel: selectedYear,
          view: buildSalesView(rows, {
            period,
            periodValue: option.value,
            year: selectedYear,
            customFrom,
            customTo,
          }),
        }))
      );
    }

    if (year === "All") {
      return years.map((selectedYear) => ({
        label: periodDisplay(period, periodValue, customFrom, customTo),
        yearLabel: selectedYear,
        view: buildSalesView(rows, {
          period,
          periodValue,
          year: selectedYear,
          customFrom,
          customTo,
        }),
      }));
    }

    return [];
  }, [showBreakdown, breakdownOptions, rows, period, periodValue, year, customFrom, customTo]);
  const metricColumns = metric === "All"
    ? Object.values(metricMap)
    : metric === "Retail + Wholesale"
      ? [metricMap.Retail, metricMap.Wholesale]
      : [metricMap[metric]];

  const comparison = useMemo(
    () => buildComparison(rows, selection),
    [rows, selection]
  );

  const comparisonMetrics = metricColumns;
  const requiredMetricKeys = metricColumns.map(([, key]) => key);

  function renderMetric(scopeName, label, key) {
    const item = view.totals[scopeName];
    return item?.recorded[key] ? formatNumber(item[key]) : "—";
  }

  function comparisonScopeName() {
    return scope === "All" ? "Stellantis Total" : scope;
  }

  function comparisonDelta(currentValue, compareValue) {
    if (currentValue === null || compareValue === null || currentValue === undefined || compareValue === undefined) {
      return null;
    }
    return Number(currentValue) - Number(compareValue);
  }

  function comparisonPercent(currentValue, compareValue) {
    if (currentValue === null || compareValue === null || currentValue === undefined || compareValue === undefined || Number(compareValue) === 0) {
      return null;
    }
    return ((Number(currentValue) - Number(compareValue)) / Number(compareValue)) * 100;
  }

  function comparisonPeriodLabel(relation) {
    const target = relation === "previous" ? comparison.previousSelection : comparison.lySelection;
    if (!target) return "Not available";
    return `${target.period} · ${periodDisplay(target.period, target.periodValue, target.customFrom, target.customTo)} · ${target.year}`;
  }

  function renderComparisonBlock(title, relation, currentView, compareView, scopeName) {
    if (!compareView) {
      return (
        <div className="comparisonBlock">
          <div className="comparisonBlockHeader">
            <div>
              <strong>{title}</strong>
              <span>Not available for this selection</span>
            </div>
          </div>
        </div>
      );
    }

    const currentItem = currentView?.totals?.[scopeName];
    const compareItem = compareView?.totals?.[scopeName];

    return (
      <div className="comparisonBlock">
        <div className="comparisonBlockHeader">
          <div>
            <strong>{title}</strong>
            <span>
              Current: {periodDisplay(period, periodValue, customFrom, customTo)} · {comparison.currentSelection.year}
              {" · "}
              {relation === "previous" ? comparisonPeriodLabel("previous") : comparisonPeriodLabel("ly")}
            </span>
          </div>
        </div>
        {comparisonMetrics.map(([label, key]) => {
          const currentValue = currentItem?.recorded[key] ? Number(currentItem[key]) : null;
          const compareValue = compareItem?.recorded[key] ? Number(compareItem[key]) : null;
          const delta = comparisonDelta(currentValue, compareValue);
          const percent = comparisonPercent(currentValue, compareValue);
          const currentStatus = currentItem?.recorded[key] ? currentView.status : "NO DATA";

          return (
            <div className="comparisonMetricRow" key={label}>
              <span>{label}</span>
              <strong className={valueClass(currentStatus, currentValue)}>{currentValue === null ? "—" : formatNumber(currentValue)}</strong>
              <span className="comparisonVs">{compareValue === null ? "—" : formatNumber(compareValue)}</span>
              <span className={delta !== null && delta < 0 ? "negativeChange" : "positiveChange"}>
                {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatNumber(delta)}`}
              </span>
              <span className={percent !== null && percent < 0 ? "negativeChange" : "positiveChange"}>
                {percent === null ? "—" : `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`}
              </span>
            </div>
          );
        })}
        <div className="comparisonMetricLabels">
          <span>Metric</span><span>Current</span><span>Compare</span><span>Change</span><span>%</span>
        </div>
      </div>
    );
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

      <nav className="cockpitNav">
        <a className="active" href="/">Sales Cockpit</a>
        <a href="/model-wise/jeep">Jeep Model Wise</a>
        <a href="/model-wise/citroen">Citroën Model Wise</a>
        <a href="/data-entry">Data Entry</a>
      </nav>

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
                style={{ gridTemplateColumns: `0.8fr 1.1fr 1.4fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
              >
                <div>Year</div>
                <div>Period</div>
                <div>Scope</div>
                {metricColumns.map(([label]) => <div key={label}>{label}</div>)}
                <div>Status</div>
              </div>

              {breakdownViews.flatMap(({ label, yearLabel, view: periodView }) =>
                displayedScopes.map((scopeName) => {
                  const breakdownSelection = {
                    period,
                    periodValue: period === "Monthly"
                      ? String(MONTHS.indexOf(label))
                      : label,
                    year: yearLabel,
                    customFrom,
                    customTo,
                  };
                  const scopeStatus = scopeName === "Stellantis Total"
                    ? periodView.status
                    : getScopeStatus(rows, breakdownSelection, scopeName, requiredMetricKeys);
                  return (
                  <div
                    className="tableRow breakdownRow"
                    key={`${yearLabel}-${label}-${scopeName}`}
                    style={{ gridTemplateColumns: `0.8fr 1.1fr 1.4fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
                  >
                    <div className="scopeName">{yearLabel}</div>
                    <div className="scopeName">{label}</div>
                    <div className="scopeName">{scopeName}</div>
                    {metricColumns.map(([metricLabel, key]) => {
                      const item = periodView.totals[scopeName];
                      const itemStatus = item?.recorded[key] ? periodView.status : "NO DATA";
                      return (
                        <div
                          key={metricLabel}
                          data-label={metricLabel}
                          className={valueClass(itemStatus, item?.[key])}
                        >
                          {item?.recorded[key] ? formatNumber(item[key]) : "—"}
                        </div>
                      );
                    })}
                    <div className={statusClass(scopeStatus) + " statusText"}>
                      {statusLabel(scopeStatus)}
                    </div>
                  </div>
                  );
                })
              )}

              <div
                className="tableRow totalRow breakdownRow"
                style={{ gridTemplateColumns: `0.8fr 1.1fr 1.4fr repeat(${metricColumns.length}, 1fr) 1.25fr` }}
              >
                <div className="scopeName">TOTAL</div>
                <div className="scopeName">All periods / years</div>
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
                <div className={statusClass(view.status) + " statusText"}>{statusLabel(view.status)}</div>
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
                  className="tableRow standardRow"
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
          <p>Comparisons use the active period, year, scope and metric selection.</p>
          {renderComparisonBlock(
            "Current vs previous",
            "previous",
            comparison.current,
            comparison.previous,
            comparisonScopeName()
          )}
          {renderComparisonBlock(
            "Current vs last year",
            "ly",
            comparison.current,
            comparison.ly,
            comparisonScopeName()
          )}

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
