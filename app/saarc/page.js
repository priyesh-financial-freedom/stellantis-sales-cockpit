"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { readClientCacheAsync, writeClientCache } from "../../lib/clientCache";
import CockpitNavigation from "../../components/CockpitNavigation";

const YEARS = ["2024", "2025", "2026"];
const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual"];
const METRICS = [
  { key: "retail", label: "Retail" },
  { key: "wholesale", label: "Wholesale" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CACHE_KEY = "saarc-sales-performance-v2";

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function buckets(period) {
  if (period === "Quarterly") return ["Q1", "Q2", "Q3", "Q4"];
  if (period === "Half-Yearly") return ["H1", "H2"];
  if (period === "Annual") return ["Full Year"];
  return MONTHS;
}

function bucketIndex(period, month) {
  if (period === "Quarterly") return Math.floor((month - 1) / 3);
  if (period === "Half-Yearly") return month <= 6 ? 0 : 1;
  if (period === "Annual") return 0;
  return month - 1;
}

function periodEndMonth(period, index) {
  if (period === "Quarterly") return (index + 1) * 3;
  if (period === "Half-Yearly") return (index + 1) * 6;
  if (period === "Annual") return 12;
  return index + 1;
}

export default function SaarcSalesPerformancePage() {
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState("2026");
  const [period, setPeriod] = useState("Monthly");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const cached = await readClientCacheAsync(CACHE_KEY);
      if (active && cached?.data?.length) {
        setRows(cached.data);
        setCachedAt(cached.cachedAt);
        setLoading(false);
        setRefreshing(true);
      }
      try {
        const { data, error: queryError } = await supabase
          .from("sales_cockpit_daily")
          .select("brand,sales_date,retail,wholesale")
          .eq("brand", "SAARC")
          .gte("sales_date", "2024-01-01")
          .lte("sales_date", "2026-12-31")
          .order("sales_date", { ascending: true });
        if (queryError) throw queryError;
        const fresh = data || [];
        await writeClientCache(CACHE_KEY, fresh);
        if (active) {
          setRows(fresh);
          setCachedAt(new Date().toISOString());
          setError("");
        }
      } catch (err) {
        if (active && !cached?.data?.length) setError(err?.message || "Unable to load SAARC sales data.");
        else if (active) setError("Offline mode: showing the last cached SAARC sales data.");
      } finally {
        if (active) { setLoading(false); setRefreshing(false); }
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const selectedRows = useMemo(() => rows.filter(row => String(row.sales_date || "").slice(0, 4) === year), [rows, year]);
  const periods = buckets(period);
  const matrix = useMemo(() => {
    const values = Object.fromEntries(METRICS.map(metric => [metric.key, periods.map(() => 0)]));
    for (const row of selectedRows) {
      const month = Number(String(row.sales_date || "").slice(5, 7));
      if (!month || month < 1 || month > 12) continue;
      const index = bucketIndex(period, month);
      for (const metric of METRICS) values[metric.key][index] += Number(row[metric.key]) || 0;
    }
    return values;
  }, [selectedRows, periods, period]);

  const hasData = selectedRows.length > 0;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthClass = index => (Number(year) < currentYear || (Number(year) === currentYear && periodEndMonth(period, index) < currentMonth)) ? "completeStatus" : "futureValue";
  const totals = useMemo(() => Object.fromEntries(METRICS.map(metric => [
    metric.key, matrix[metric.key].reduce((sum, value) => sum + value, 0),
  ])), [matrix]);

  return (
    <main className="cockpit saarcPage">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · REGIONAL PERFORMANCE</div>
          <h1>SAARC Sales Performance</h1>
          <p className="subtitle">Monthly Retail and Wholesale performance across the SAARC business</p>
          {cachedAt && <div className="dataFreshness">{refreshing ? "Refreshing data…" : "Updated " + new Date(cachedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
        <div className="headerStatus"><span className={"statusDot" + (loading || refreshing ? " loadingDot" : "")} />{loading ? "Loading data" : error ? "Cached / offline data" : "Data connected"}</div>
      </header>

      <CockpitNavigation active="/saarc" />

      <section className="filters saarcFilters" aria-label="SAARC performance filters">
        <div className="filter">
          <label htmlFor="saarc-period">Period</label>
          <select id="saarc-period" value={period} onChange={event => setPeriod(event.target.value)}>
            {PERIODS.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="saarc-year">Year</label>
          <select id="saarc-year" value={year} onChange={event => setYear(event.target.value)}>
            {YEARS.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>

      {error && <p className="saarcNotice" role="status">{error}</p>}
      <section className="sectionHeading saarcSectionHeading">
        <div>
          <div className="eyebrow">SAARC · {period.toUpperCase()} VIEW</div>
          <h2>Regional sales movement · {year}</h2>
        </div>
        <div className="saarcRecordCount">{selectedRows.length.toLocaleString("en-IN")} source records</div>
      </section>

      <section className="tableCard saarcTableCard">
        <div className="saarcTableScroll" role="region" aria-label="SAARC monthly sales matrix" tabIndex={0}>
          <table className="saarcMatrix">
            <thead>
              <tr><th scope="col">Sales metric</th>{periods.map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col">Total</th></tr>
            </thead>
            <tbody>
              {METRICS.map(metric => (
                <tr key={metric.key}>
                  <th scope="row">{metric.label}</th>
                  {matrix[metric.key].map((value, index) => <td key={periods[index]} className={monthClass(index)}>{formatNumber(value)}</td>)}
                  <td className="saarcTotalCell">{formatNumber(totals[metric.key])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">Retail + Wholesale</th>{periods.map((_, index) => <td key={index} className={monthClass(index)}>{formatNumber(METRICS.reduce((sum, metric) => sum + matrix[metric.key][index], 0))}</td>)}<td className="saarcTotalCell">{formatNumber(METRICS.reduce((sum, metric) => sum + totals[metric.key], 0))}</td></tr>
            </tfoot>
          </table>
        </div>
        {!loading && !hasData && <p className="saarcEmpty">No SAARC daily sales records are available for {year}.</p>}
      </section>

      <p className="saarcDataNote">Data source: SAARC records in sales_cockpit_daily. This source currently stores SAARC as one consolidated brand and does not contain a country field; country-wise analysis will require country-level source data.</p>
      <footer className="saarcFooter">Stellantis Sales Cockpit · SAARC regional sales</footer>
    </main>
  );
}
