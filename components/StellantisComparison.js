"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { loadModelMonthlyData } from "../lib/modelData";
import { readClientCacheAsync, writeClientCache } from "../lib/clientCache";

const YEARS = [2024, 2025, 2026];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BOOKING_CACHE = "stellantis-brand-bookings-comparison-v1";
const SAARC_CACHE = "stellantis-saarc-comparison-v1";

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function normalizeYears(year) {
  const values = Array.isArray(year) ? year : [year];
  if (!values.length || values.includes("All")) return YEARS;
  return values.map(Number).filter(value => YEARS.includes(value));
}

function monthsFor(period, periodValue, year, customFrom, customTo) {
  if (period === "Custom Period") {
    if (!customFrom || !customTo) return [];
    return MONTHS.map((_, i) => i + 1).filter(month => {
      const start = year + "-" + String(month).padStart(2, "0") + "-01";
      const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      return end >= customFrom && start <= customTo;
    });
  }
  const values = Array.isArray(periodValue) ? periodValue : [periodValue];
  if (period === "Annual" || !values.length || values.includes("All")) return MONTHS.map((_, i) => i + 1);
  if (period === "Monthly") return values.map(value => typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : MONTHS.indexOf(value) + 1).filter(month => month >= 1 && month <= 12);
  if (period === "Quarterly") return values.flatMap(value => {
    const q = Number(String(value).replace("Q", ""));
    return q >= 1 && q <= 4 ? [1, 2, 3].map(offset => (q - 1) * 3 + offset) : [];
  });
  if (period === "Half-Yearly") return values.flatMap(value => value === "H1" ? [1,2,3,4,5,6] : value === "H2" ? [7,8,9,10,11,12] : []);
  return MONTHS.map((_, i) => i + 1);
}

function buildBuckets(period, periodValue, years, customFrom, customTo) {
  const selectedValues = Array.isArray(periodValue) ? periodValue : [periodValue];
  const all = !selectedValues.length || selectedValues.includes("All");
  const buckets = [];
  for (const year of years) {
    if (period === "Monthly" || period === "Custom Period") {
      const months = monthsFor(period, periodValue, year, customFrom, customTo);
      for (const month of months) {
        const dateStart = year + "-" + String(month).padStart(2, "0") + "-01";
        const dateEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        if (period === "Custom Period" && (dateEnd < customFrom || dateStart > customTo)) continue;
        buckets.push({ year, label: MONTHS[month - 1], months: [month], start: period === "Custom Period" && customFrom > dateStart ? customFrom : dateStart, end: period === "Custom Period" && customTo < dateEnd ? customTo : dateEnd });
      }
    } else if (period === "Quarterly") {
      const qs = all ? ["Q1","Q2","Q3","Q4"] : selectedValues;
      for (const q of qs) {
        const n = Number(String(q).replace("Q", ""));
        if (n < 1 || n > 4) continue;
        const months = [1,2,3].map(offset => (n - 1) * 3 + offset);
        buckets.push({ year, label: q, months, start: year + "-" + String(months[0]).padStart(2,"0") + "-01", end: new Date(Date.UTC(year, months[2], 0)).toISOString().slice(0,10) });
      }
    } else if (period === "Half-Yearly") {
      const hs = all ? ["H1","H2"] : selectedValues;
      for (const h of hs) {
        const months = h === "H1" ? [1,2,3,4,5,6] : [7,8,9,10,11,12];
        buckets.push({ year, label: h, months, start: year + (h === "H1" ? "-01-01" : "-07-01"), end: year + (h === "H1" ? "-06-30" : "-12-31") });
      }
    } else {
      buckets.push({ year, label: "Full Year", months: MONTHS.map((_,i)=>i+1), start: year + "-01-01", end: year + "-12-31" });
    }
  }
  return buckets;
}

function sumModel(rows, brand, metric, year, months) {
  return rows.reduce((sum, row) => sum + (
    row.brand === brand &&
    row.sales_type === metric &&
    Number(row.sales_year) === year &&
    months.includes(Number(row.sales_month))
      ? Number(row.units) || 0 : 0
  ), 0);
}

function sumBookings(rows, brand, year, months) {
  return rows.reduce((sum, row) => sum + (
    row.brand === brand &&
    Number(row.sales_year) === year &&
    months.includes(Number(row.sales_month))
      ? Number(row.units) || 0 : 0
  ), 0);
}

function sumSaarc(rows, metric, start, end) {
  return rows.reduce((sum, row) => (
    row.sales_date >= start && row.sales_date <= end
      ? sum + (Number(row[metric.toLowerCase()]) || 0)
      : sum
  ), 0);
}

function valueStatus(bucket) {
  const today = new Date().toISOString().slice(0, 10);
  if (bucket.start > today) return "futureValue";
  if (bucket.end < today) return "completedValue";
  return "futureValue";
}

export default function StellantisComparison({
  period = "Monthly",
  periodValue = ["All"],
  year = ["2026"],
  customFrom = "",
  customTo = "",
  salesTypes = ["Retail"],
}) {
  const [modelRows, setModelRows] = useState([]);
  const [bookingRows, setBookingRows] = useState([]);
  const [saarcRows, setSaarcRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [models, bookingCache, saarcCache] = await Promise.all([
          loadModelMonthlyData(),
          readClientCacheAsync(BOOKING_CACHE),
          readClientCacheAsync(SAARC_CACHE),
        ]);
        if (active) {
          setModelRows(models || []);
          if (bookingCache?.data) setBookingRows(bookingCache.data);
          if (saarcCache?.data) setSaarcRows(saarcCache.data);
        }
        const [bookingsResult, saarcResult] = await Promise.all([
          supabase.from("sales_cockpit_brand_monthly_bookings")
            .select("brand,sales_year,sales_month,units")
            .in("brand", ["Jeep", "Citroën"])
            .order("sales_year", { ascending: true })
            .order("sales_month", { ascending: true }),
          supabase.from("sales_cockpit_daily")
            .select("brand,sales_date,retail,wholesale")
            .eq("brand", "SAARC")
            .gte("sales_date", "2024-01-01")
            .lte("sales_date", "2026-12-31")
            .order("sales_date", { ascending: true }),
        ]);
        if (bookingsResult.error) throw bookingsResult.error;
        if (saarcResult.error) throw saarcResult.error;
        const bookings = bookingsResult.data || [];
        const saarc = saarcResult.data || [];
        await Promise.all([writeClientCache(BOOKING_CACHE, bookings), writeClientCache(SAARC_CACHE, saarc)]);
        if (active) {
          setBookingRows(bookings);
          setSaarcRows(saarc);
          setError("");
        }
      } catch (err) {
        if (active) setError("Some comparison data could not be refreshed. Showing available cached data where possible.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const comparisonRows = useMemo(() => {
    const years = normalizeYears(year);
    const buckets = buildBuckets(period, periodValue, years, customFrom, customTo);
    const metrics = [...new Set((salesTypes || []).filter(Boolean))];
    return buckets.flatMap(bucket => metrics.map(metric => {
      const jeep = metric === "Bookings"
        ? sumBookings(bookingRows, "Jeep", bucket.year, bucket.months)
        : sumModel(modelRows, "Jeep", metric, bucket.year, bucket.months);
      const citroen = metric === "Bookings"
        ? sumBookings(bookingRows, "Citroën", bucket.year, bucket.months)
        : sumModel(modelRows, "Citroën", metric, bucket.year, bucket.months);
      const saarc = metric === "Bookings" ? null : sumSaarc(saarcRows, metric, bucket.start, bucket.end);
      return { ...bucket, metric, jeep, citroen, saarc, total: jeep + citroen + (saarc || 0) };
    }));
  }, [modelRows, bookingRows, saarcRows, period, periodValue, year, customFrom, customTo, salesTypes]);

  if (!salesTypes?.length) return null;

  return (
    <section className="stellantisComparison">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">STELLANTIS OVERALL</div>
          <h2>Brand-wise comparison · {period}</h2>
          <p className="subtitle">Jeep + Citroën + SAARC, using the same period and sales metric selection</p>
        </div>
        <span className="saarcRecordCount">{loading ? "Loading comparison…" : "Consolidated view"}</span>
      </div>
      {error && <p className="saarcNotice" role="status">{error}</p>}
      <div className="stellantisComparisonScroll" role="region" aria-label="Stellantis brand comparison" tabIndex={0}>
        <table className="stellantisComparisonTable">
          <thead>
            <tr><th scope="col">Period</th><th scope="col">Metric</th><th scope="col">Jeep</th><th scope="col">Citroën</th><th scope="col">SAARC</th><th scope="col">Stellantis Total</th></tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => (
              <tr key={row.year + "-" + row.label + "-" + row.metric}>
                <th scope="row">{row.label}{normalizeYears(year).length > 1 ? " '" + String(row.year).slice(-2) : ""}</th>
                <td>{row.metric}</td>
                <td className={valueStatus(row)}>{formatNumber(row.jeep)}</td>
                <td className={valueStatus(row)}>{formatNumber(row.citroen)}</td>
                <td className={row.saarc === null ? "comparisonNotApplicable" : valueStatus(row)}>{row.saarc === null ? "—" : formatNumber(row.saarc)}</td>
                <td className={"stellantisComparisonTotal " + valueStatus(row)}>{formatNumber(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="comparisonNote">Bookings are brand-level for Jeep and Citroën; SAARC bookings are not captured in the current source and are therefore excluded from the total. SAARC Retail and Wholesale are included in Stellantis Total.</p>
    </section>
  );
}
