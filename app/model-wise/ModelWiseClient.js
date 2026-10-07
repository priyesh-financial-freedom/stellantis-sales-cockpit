"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MODEL_NAMES,
  MODEL_PERIOD_OPTIONS,
  MODEL_YEARS,
  buildModelSummary,
  buildModelTrend,
  loadModelMonthlyData,
  getModelPeriodLabel,
} from "../../lib/modelData";

const SALES_TYPES = ["Retail", "Wholesale"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function trendDirection(values) {
  const firstHalf = values.slice(0, 6).reduce((sum, value) => sum + value, 0);
  const secondHalf = values.slice(6).reduce((sum, value) => sum + value, 0);
  if (firstHalf === secondHalf) return "→";
  return secondHalf > firstHalf ? "↑" : "↓";
}

function periodSelection(period) {
  if (period === "Month") return MODEL_PERIOD_OPTIONS.filter((item) => item.months.length === 1 && !item.label.startsWith("Q") && !item.label.startsWith("H"));
  if (period === "Quarter") return MODEL_PERIOD_OPTIONS.filter((item) => item.label.startsWith("Q"));
  if (period === "Half-Year") return MODEL_PERIOD_OPTIONS.filter((item) => item.label.startsWith("H"));
  return [];
}

export default function ModelWiseClient({ brand }) {
  const [year, setYear] = useState("2026");
  const [salesType, setSalesType] = useState("Retail");
  const [period, setPeriod] = useState("FY");
  const [periodValue, setPeriodValue] = useState("Jan");
  const [customFrom, setCustomFrom] = useState("Jan");
  const [customTo, setCustomTo] = useState("Dec");
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

  const activePeriod = useMemo(() => {
    if (period === "FY") return "FY";
    if (period === "Custom Range") {
      const from = MODEL_PERIOD_OPTIONS.find((item) => item.label === customFrom);
      const to = MODEL_PERIOD_OPTIONS.find((item) => item.label === customTo);
      if (!from || !to) return "FY";
      const fromMonth = from.months[0];
      const toMonth = to.months[0];
      return {
        label: customFrom + "–" + customTo,
        months: Array.from({ length: Math.max(1, toMonth - fromMonth + 1) }, (_, index) => fromMonth + index),
      };
    }
    return periodValue;
  }, [period, periodValue, customFrom, customTo]);

  const summary = useMemo(() => {
    if (typeof activePeriod === "string") {
      return buildModelSummary(rows, {
        brand,
        salesType,
        year,
        period: activePeriod,
      });
    }
    const models = MODEL_NAMES[brand] || [];
    const totals = Object.fromEntries(models.map((model) => [model, 0]));
    for (const row of rows) {
      if (
        row.brand === brand &&
        row.sales_type === salesType &&
        Number(row.sales_year) === Number(year) &&
        activePeriod.months.includes(Number(row.sales_month)) &&
        totals[row.model_name] !== undefined
      ) {
        totals[row.model_name] += Number(row.units) || 0;
      }
    }
    const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return {
      models: models.map((model) => ({
        model,
        units: totals[model],
        share: grandTotal ? (totals[model] / grandTotal) * 100 : 0,
      })),
      grandTotal,
    };
  }, [rows, brand, salesType, year, activePeriod]);

  const trends = useMemo(() => (
    Object.fromEntries(
      (MODEL_NAMES[brand] || []).map((model) => [
        model,
        buildModelTrend(rows, { brand, salesType, model, year }),
      ])
    )
  ), [rows, brand, salesType, year]);

  const periodOptions = periodSelection(period);
  const periodLabel = period === "Month" ? "Month" : period === "Quarter" ? "Quarter" : "Half-Year";

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
        <Link href="/month-wise">Month Wise</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Period</label>
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value === "Month") setPeriodValue("Jan");
              if (e.target.value === "Quarter") setPeriodValue("Q1");
              if (e.target.value === "Half-Year") setPeriodValue("H1");
            }}
          >
            <option>Month</option>
            <option>Quarter</option>
            <option>Half-Year</option>
            <option>FY</option>
            <option>Custom Range</option>
          </select>
        </div>

        {period === "Custom Range" ? (
          <>
            <div className="filter">
              <label>From Month</label>
              <select value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}>
                {MODEL_PERIOD_OPTIONS.slice(0, 12).map((item) => <option key={item.label}>{item.label}</option>)}
              </select>
            </div>
            <div className="filter">
              <label>To Month</label>
              <select value={customTo} onChange={(e) => setCustomTo(e.target.value)}>
                {MODEL_PERIOD_OPTIONS.slice(0, 12).map((item) => <option key={item.label}>{item.label}</option>)}
              </select>
            </div>
          </>
        ) : period !== "FY" ? (
          <div className="filter">
            <label>{periodLabel}</label>
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {periodOptions.map((item) => <option key={item.label}>{item.label}</option>)}
            </select>
          </div>
        ) : null}

        <div className="filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {MODEL_YEARS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="filter">
          <label>Sales Type</label>
          <select value={salesType} onChange={(e) => setSalesType(e.target.value)}>
            {SALES_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>

      <section className="summary">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">MODEL PERFORMANCE</div>
            <h2>{brand} · {salesType} · {period === "FY" ? "FY" : period === "Custom Range" ? customFrom + "–" + customTo : getModelPeriodLabel(periodValue)} · {year}</h2>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}

        <div className="tableCard modelTableCard">
          <div className="modelTableHeader">
            <div>Model</div>
            <div>Units</div>
            <div>Share</div>
            <div>Trend</div>
          </div>

          {summary.models.map(({ model, units, share }) => (
            <div className="modelTableRow" key={model}>
              <div className="scopeName">{model}</div>
              <div>{formatNumber(units)}</div>
              <div>{share.toFixed(1)}%</div>
              <div className="trendCell">
                <span className="trendArrow">{trendDirection(trends[model] || [])}</span>
                <span className="trendBars">
                  {(trends[model] || []).map((value, index) => (
                    <span
                      key={index}
                      className="trendBar"
                      style={{ height: Math.max(3, Math.min(24, value ? 4 + Math.sqrt(value) * 1.8 : 3)) + "px" }}
                      title={MODEL_PERIOD_OPTIONS[index]?.label + ": " + formatNumber(value)}
                    />
                  ))}
                </span>
              </div>
            </div>
          ))}

          <div className="modelTableRow modelTotalRow">
            <div className="scopeName">TOTAL</div>
            <div>{formatNumber(summary.grandTotal)}</div>
            <div>100.0%</div>
            <div>—</div>
          </div>
        </div>
      </section>

      <footer>
        <span>Stellantis Sales Cockpit</span>
        <span>•</span>
        <span>Model data: 2021–2026 · monthly source records</span>
      </footer>
    </main>
  );
}
