"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MODEL_NAMES, MODEL_YEARS, buildModelSummary, loadModelMonthlyData } from "../../lib/modelData";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SALES_TYPES = ["Retail", "Wholesale"];
const MONTH_OPTIONS = ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_OPTIONS = ["All", "Q1", "Q2", "Q3", "Q4"];
const HALF_YEAR_OPTIONS = ["All", "H1", "H2"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function valueClass(status, value) {
  if (status === "FUTURE") return "futureValue";
  if (status === "INCOMPLETE" && Number(value) > 0) return "futureValue";
  return "";
}

function statusClass(status) {
  return status === "INCOMPLETE" || status === "FUTURE" ? "incompleteStatus" : "completeStatus";
}

function statusLabel(status) {
  return status === "INCOMPLETE" || status === "FUTURE" ? "INCOMPLETE" : "COMPLETE";
}

function periodLabel(period, value, customFrom, customTo) {
  if (period === "Custom Period") return customFrom && customTo ? customFrom + " → " + customTo : "Custom Period";
  return value;
}

function customMonthsForYear(year, from, to) {
  if (!from || !to) return [];
  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    const monthStart = String(year) + "-" + String(month).padStart(2, "0") + "-01";
    const monthEnd = new Date(Date.UTC(Number(year), month, 0)).toISOString().slice(0, 10);
    if (monthEnd >= from && monthStart <= to) months.push(month);
  }
  return months;
}

function periodMonths(period, value, year, customFrom, customTo) {
  if (period === "Custom Period") return customMonthsForYear(year, customFrom, customTo);
  if (period === "Monthly") {
    return value === "All" ? Array.from({ length: 12 }, (_, i) => i + 1) : [Number(value)];
  }
  if (period === "Quarterly") {
    if (value === "All") return Array.from({ length: 12 }, (_, i) => i + 1);
    const q = Number(value.slice(1));
    return [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
  }
  if (period === "Half-Yearly") {
    return value === "All"
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : value === "H1" ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  }
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function intervalFor(period, value, year) {
  const y = Number(year);
  if (period === "Annual") return [y + "-01-01", y + "-12-31"];
  if (period === "Monthly") {
    const month = Number(value);
    const end = new Date(Date.UTC(y, month, 0)).toISOString().slice(0, 10);
    return [y + "-" + String(month).padStart(2, "0") + "-01", end];
  }
  if (period === "Quarterly") {
    const q = Number(value.slice(1));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const end = new Date(Date.UTC(y, endMonth, 0)).toISOString().slice(0, 10);
    return [y + "-" + String(startMonth).padStart(2, "0") + "-01", end];
  }
  if (period === "Half-Yearly") return value === "H1" ? [y + "-01-01", y + "-06-30"] : [y + "-07-01", y + "-12-31"];
  return null;
}

function getStatus(period, value, year, customFrom, customTo) {
  const today = new Date().toISOString().slice(0, 10);
  if (year === "All") {
    const statuses = MODEL_YEARS.map((y) => getStatus(period, value, String(y), customFrom, customTo));
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }
  if (period === "Custom Period") {
    if (!customFrom || !customTo) return "NO DATA";
    if (customFrom > today) return "FUTURE";
    if (customTo >= today) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }
  if (period === "Monthly" && value === "All") {
    const statuses = Array.from({ length: 12 }, (_, i) => getStatus("Monthly", String(i + 1), year));
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }
  if (period === "Quarterly" && value === "All") {
    const statuses = ["Q1", "Q2", "Q3", "Q4"].map((q) => getStatus("Quarterly", q, year));
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }
  if (period === "Half-Yearly" && value === "All") {
    const statuses = ["H1", "H2"].map((h) => getStatus("Half-Yearly", h, year));
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }
  const interval = intervalFor(period, value, year);
  if (!interval) return "ACTUAL / COMPLETE";
  if (interval[0] > today) return "FUTURE";
  if (interval[0] <= today && interval[1] >= today) return "INCOMPLETE";
  return "ACTUAL / COMPLETE";
}

function sumPeriod(rows, brand, salesType, year, months, model) {
  return rows
    .filter((row) =>
      row.brand === brand &&
      row.sales_type === salesType &&
      Number(row.sales_year) === Number(year) &&
      months.includes(Number(row.sales_month)) &&
      row.model_name === model
    )
    .reduce((sum, row) => sum + (Number(row.units) || 0), 0);
}

export default function ModelWiseClient({ brand }) {
  const [year, setYear] = useState("2026");
  const [salesType, setSalesType] = useState("Retail");
  const [selectedModel, setSelectedModel] = useState("All");
  const [period, setPeriod] = useState("Annual");
  const [periodValue, setPeriodValue] = useState("All");
  const [customFrom, setCustomFrom] = useState("2026-01-01");
  const [customTo, setCustomTo] = useState("2026-12-31");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        const data = await loadModelMonthlyData();
        if (active) setRows(data);
      } catch (err) {
        if (active) setError(err.message || "Unable to load model data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => { active = false; };
  }, []);

  const periodOptions = useMemo(() => {
    if (period === "Monthly") return MONTH_OPTIONS;
    if (period === "Quarterly") return QUARTER_OPTIONS;
    if (period === "Half-Yearly") return HALF_YEAR_OPTIONS;
    return ["All"];
  }, [period]);

  const periodSelectorLabel = period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period";
  const allModels = MODEL_NAMES[brand] || [];
  const models = selectedModel === "All" ? allModels : allModels.filter((model) => model === selectedModel);
  const detailYears = year === "All" ? MODEL_YEARS.map(String) : [year];

  const breakdownOptions = useMemo(() => {
    if (period === "Monthly") return MONTH_OPTIONS.slice(1).map((label, i) => ({ label, value: String(i + 1) }));
    if (period === "Quarterly") return QUARTER_OPTIONS.slice(1).map((label) => ({ label, value: label }));
    if (period === "Half-Yearly") return HALF_YEAR_OPTIONS.slice(1).map((label) => ({ label, value: label }));
    return [];
  }, [period]);

  const showPeriodBreakdown = period !== "Annual" && period !== "Custom Period" && periodValue === "All";
  const showYearBreakdown = year === "All";
  const showBreakdown = showPeriodBreakdown || showYearBreakdown;

  const breakdownRows = useMemo(() => {
    if (!showBreakdown) return [];
    if (showPeriodBreakdown) {
      return detailYears.flatMap((y) =>
        breakdownOptions.map((option) => ({
          year: y,
          label: option.label,
          value: option.value,
          months: period === "Monthly"
            ? [Number(option.value)]
            : period === "Quarterly"
              ? periodMonths("Quarterly", option.value, Number(y), customFrom, customTo)
              : periodMonths("Half-Yearly", option.value, Number(y), customFrom, customTo),
          status: getStatus(period, option.value, y),
        }))
      );
    }
    return detailYears.map((y) => ({
      year: y,
      label: period === "Annual" ? "FY" : periodLabel(period, periodValue, customFrom, customTo),
      value: periodValue,
      months: periodMonths(period, periodValue, Number(y), customFrom, customTo),
      status: getStatus(period, periodValue, y),
    }));
  }, [showBreakdown, showPeriodBreakdown, detailYears, breakdownOptions, period, periodValue, customFrom, customTo]);

  const totalValue = useMemo(() => {
    const totals = Object.fromEntries(models.map((model) => [model, 0]));
    for (const y of detailYears) {
      for (const model of models) {
        totals[model] += sumPeriod(
          rows,
          brand,
          salesType,
          y,
          periodMonths(period, periodValue, Number(y), customFrom, customTo),
          model
        );
      }
    }
    return totals;
  }, [rows, brand, salesType, detailYears, models, period, periodValue, customFrom, customTo]);

  const totalGrand = Object.values(totalValue).reduce((sum, value) => sum + value, 0);

  const summary = useMemo(() => {
    if (showBreakdown) return null;

    let result;
    if (period !== "Custom Period") {
      result = buildModelSummary(rows, {
        brand,
        salesType,
        year,
        period: period === "Annual" ? "FY" : periodValue,
      });
    } else {
      const totals = Object.fromEntries(allModels.map((model) => [model, 0]));
      for (const model of allModels) {
        totals[model] = sumPeriod(
          rows,
          brand,
          salesType,
          year,
          periodMonths("Custom Period", "All", Number(year), customFrom, customTo),
          model
        );
      }
      const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
      result = {
        models: allModels.map((model) => ({
          model,
          units: totals[model],
          share: grandTotal ? (totals[model] / grandTotal) * 100 : 0,
        })),
        grandTotal,
      };
    }

    if (selectedModel === "All") return result;
    const selected = result.models.find((item) => item.model === selectedModel);
    return {
      models: selected ? [{ ...selected, share: 100 }] : [],
      grandTotal: selected?.units || 0,
    };
  }, [rows, brand, salesType, year, period, periodValue, showBreakdown, allModels, selectedModel, customFrom, customTo]);

  const title = period === "Custom Period"
    ? customFrom + " → " + customTo
    : period === "Annual" ? "FY" : periodLabel(period, periodValue, customFrom, customTo);

  function renderBreakdownRow(row) {
    const values = models.map((model) => sumPeriod(rows, brand, salesType, row.year, row.months, model));
    const total = values.reduce((sum, value) => sum + value, 0);
    return (
      <div className="modelBreakdownRow" key={row.year + "-" + row.label} style={{ gridTemplateColumns: "0.8fr 1.1fr repeat(" + models.length + ", 1fr) 1fr 1.2fr" }}>
        <div className="scopeName">{row.year}</div>
        <div className="scopeName">{row.label}</div>
        {values.map((value, i) => <div key={models[i]} className={valueClass(row.status, value)}>{formatNumber(value)}</div>)}
        <div className={valueClass(row.status, total)}>{formatNumber(total)}</div>
        <div className={statusClass(row.status) + " statusText"}>{statusLabel(row.status)}</div>
      </div>
    );
  }

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · MODEL ANALYSIS</div>
          <h1>{brand} Model Wise</h1>
          <p className="subtitle">Model-level Retail and Wholesale performance from monthly source data</p>
        </div>
        <div className="headerStatus">
          <span className={loading ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading data" : error ? "Data error" : "Data connected"}
        </div>
      </header>

      <nav className="cockpitNav">
        <Link href="/">Sales Cockpit</Link>
        <Link className={brand === "Jeep" ? "active" : ""} href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link className={brand === "Citroën" ? "active" : ""} href="/model-wise/citroen">Citroën Model Wise</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Period</label>
          <select value={period} onChange={(e) => {
            const next = e.target.value;
            setPeriod(next);
            setPeriodValue("All");
          }}>
            {PERIODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>{periodSelectorLabel}</label>
          {period === "Custom Period" ? (
            <div className="customDates">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          ) : (
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {periodOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        </div>

        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option>All</option>
            {MODEL_YEARS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Sales Type</label>
          <select value={salesType} onChange={(e) => setSalesType(e.target.value)}>
            {SALES_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="filter">
          <label>Model</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option>All</option>
            {allModels.map((model) => <option key={model}>{model}</option>)}
          </select>
        </div>
      </section>

      <section className="summary">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">MODEL PERFORMANCE</div>
            <h2>{brand} · {selectedModel} · {salesType} · {title} · {year}</h2>
          </div>
          <span className="incompleteLegend"><span className="legendDot" />Incomplete / Forecast</span>
        </div>

        {error && <div className="errorBanner">{error}</div>}

        <div className="tableCard modelTableCard">
          {showBreakdown ? (
            <>
              <div className="modelBreakdownHeader" style={{ gridTemplateColumns: "0.8fr 1.1fr repeat(" + models.length + ", 1fr) 1fr 1.2fr" }}>
                <div>Year</div>
                <div>Period</div>
                {models.map((model) => <div key={model}>{model}</div>)}
                <div>Total</div>
                <div>Status</div>
              </div>
              {breakdownRows.map(renderBreakdownRow)}
              <div className="modelBreakdownRow modelTotalRow" style={{ gridTemplateColumns: "0.8fr 1.1fr repeat(" + models.length + ", 1fr) 1fr 1.2fr" }}>
                <div className="scopeName">TOTAL</div>
                <div className="scopeName">All periods / years</div>
                {models.map((model) => (
                  <div key={model} className={"scopeName " + valueClass(getStatus(period, periodValue, year, customFrom, customTo), totalValue[model])}>
                    {formatNumber(totalValue[model])}
                  </div>
                ))}
                <div className={"scopeName " + valueClass(getStatus(period, periodValue, year, customFrom, customTo), totalGrand)}>
                  {formatNumber(totalGrand)}
                </div>
                <div className={statusClass(getStatus(period, periodValue, year, customFrom, customTo)) + " statusText"}>{statusLabel(getStatus(period, periodValue, year, customFrom, customTo))}</div>
              </div>
            </>
          ) : (
            <>
              <div className="modelTableHeader">
                <div>Model</div>
                <div>Units</div>
                <div>Share</div>
              </div>
              <div className="modelTableHeader">
                <div>Model</div>
                <div>Units</div>
                <div>Share</div>
                <div>Status</div>
              </div>
              {summary?.models.map(({ model, units, share }) => (
                <div className="modelTableRow" key={model}>
                  <div className="scopeName">{model}</div>
                  <div className={valueClass(getStatus(period, periodValue, year, customFrom, customTo), units)}>{formatNumber(units)}</div>
                  <div>{share.toFixed(1)}%</div>
                  <div className={statusClass(getStatus(period, periodValue, year, customFrom, customTo)) + " statusText"}>{statusLabel(getStatus(period, periodValue, year, customFrom, customTo))}</div>
                </div>
              ))}
              <div className="modelTableRow modelTotalRow">
                <div className="scopeName">TOTAL</div>
                <div className={valueClass(getStatus(period, periodValue, year, customFrom, customTo), summary?.grandTotal)}>{formatNumber(summary?.grandTotal)}</div>
                <div>100.0%</div>
                <div className={statusClass(getStatus(period, periodValue, year, customFrom, customTo)) + " statusText"}>{statusLabel(getStatus(period, periodValue, year, customFrom, customTo))}</div>
              </div>
            </>
          )}
        </div>
      </section>

      <footer>
        <span>Stellantis Sales Cockpit</span><span>•</span><span>Model data: 2021–2026 · monthly source records</span>
      </footer>
    </main>
  );
}
