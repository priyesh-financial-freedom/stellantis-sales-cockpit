"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MODEL_NAMES,
  MODEL_YEARS,
  MODEL_PERIODS,
  buildMonthMatrix,
  loadModelMonthlyData,
} from "../../lib/modelData";

const SALES_TYPES = ["Retail", "Wholesale"];
const BRANDS = ["Jeep", "Citroën"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export default function MonthWiseClient() {
  const [brand, setBrand] = useState("Jeep");
  const [year, setYear] = useState("2026");
  const [salesType, setSalesType] = useState("Retail");
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
        if (active) setError(err.message || "Unable to load month-wise data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => { active = false; };
  }, []);

  const matrix = useMemo(
    () => buildMonthMatrix(rows, { brand, salesType, year }),
    [rows, brand, salesType, year]
  );

  return (
    <main className="cockpit">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · MONTH ANALYSIS</div>
          <h1>Month Wise</h1>
          <p className="subtitle">Monthly model-level Retail and Wholesale performance</p>
        </div>
        <div className="headerStatus">
          <span className={loading ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading data" : error ? "Data error" : "Data connected"}
        </div>
      </header>

      <nav className="cockpitNav">
        <Link href="/">Sales Cockpit</Link>
        <Link href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link href="/model-wise/citroen">Citroën Model Wise</Link>
        <Link className="active" href="/month-wise">Month Wise</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Brand</label>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {BRANDS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
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
            <div className="eyebrow">MONTHLY PERFORMANCE</div>
            <h2>{brand} · {salesType} · {year}</h2>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}

        <div className="tableCard monthWiseCard">
          <div
            className="monthWiseHeader"
            style={{ gridTemplateColumns: "1.1fr repeat(" + matrix.models.length + ", 1fr) 1.1fr" }}
          >
            <div>Month</div>
            {matrix.models.map((model) => <div key={model}>{model}</div>)}
            <div>Total</div>
          </div>

          {matrix.matrix.map((row) => (
            <div
              className="monthWiseRow"
              key={row.month}
              style={{ gridTemplateColumns: "1.1fr repeat(" + matrix.models.length + ", 1fr) 1.1fr" }}
            >
              <div className="scopeName">{row.month}</div>
              {matrix.models.map((model) => (
                <div key={model} data-model={model}>{formatNumber(row[model])}</div>
              ))}
              <div className="scopeName">{formatNumber(row.total)}</div>
            </div>
          ))}

          <div
            className="monthWiseRow monthWiseTotal"
            style={{ gridTemplateColumns: "1.1fr repeat(" + matrix.models.length + ", 1fr) 1.1fr" }}
          >
            <div className="scopeName">TOTAL</div>
            {matrix.models.map((model) => (
              <div key={model} className="scopeName" data-model={model}>{formatNumber(matrix.totals[model])}</div>
            ))}
            <div className="scopeName">{formatNumber(matrix.grandTotal)}</div>
          </div>
        </div>
      </section>

      <footer>
        <span>Stellantis Sales Cockpit</span>
        <span>•</span>
        <span>Month-wise model data: 2021–2026</span>
      </footer>
    </main>
  );
}
