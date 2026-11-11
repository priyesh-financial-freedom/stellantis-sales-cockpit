"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import CockpitNavigation from "../../components/CockpitNavigation";

const BRANDS = ["Citroën", "Jeep"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 11 }, (_, index) => 2025 + index);
const fmt = (value) => value == null ? "—" : Number(value).toLocaleString("en-IN");
const sum = (values) => {
  const present = values.filter((value) => value != null);
  return present.length ? present.reduce((total, value) => total + Number(value), 0) : null;
};
const pct = (retail, rto) => retail == null || rto == null || rto === 0 ? null : (retail / rto) * 100;
const gap = (rto, retail) => rto == null || retail == null ? null : rto - retail;

export default function RtoRetailPage() {
  const [year, setYear] = useState(2026);
  const [rtoRows, setRtoRows] = useState([]);
  const [retailRows, setRetailRows] = useState([]);
  const [brand, setBrand] = useState("Jeep");
  const [month, setMonth] = useState(10);
  const [units, setUnits] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [rtoResult, retailResult] = await Promise.all([
        supabase.from("sales_cockpit_monthly_rto")
          .select("brand,sales_year,sales_month,units,updated_at")
          .eq("sales_year", year).order("sales_month"),
        supabase.from("sales_cockpit_model_monthly")
          .select("brand,sales_type,sales_year,sales_month,units")
          .eq("sales_year", year).eq("sales_type", "Retail")
          .in("brand", BRANDS).order("sales_month").range(0, 4999),
      ]);
      if (rtoResult.error) throw rtoResult.error;
      if (retailResult.error) throw retailResult.error;
      setRtoRows(rtoResult.data || []);
      setRetailRows(retailResult.data || []);
    } catch (err) {
      setError(err.message || "Unable to load RTO vs Retail data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  const data = useMemo(() => {
    const rto = Object.fromEntries(BRANDS.map((item) => [item, Array(12).fill(null)]));
    const retail = Object.fromEntries(BRANDS.map((item) => [item, Array(12).fill(null)]));
    rtoRows.forEach((row) => {
      const index = Number(row.sales_month) - 1;
      if (rto[row.brand] && index >= 0 && index < 12) rto[row.brand][index] = Number(row.units);
    });
    const retailSums = {};
    retailRows.forEach((row) => {
      const index = Number(row.sales_month) - 1;
      if (!retail[row.brand] || index < 0 || index > 11) return;
      const key = row.brand + "|" + index;
      retailSums[key] = (retailSums[key] || 0) + (Number(row.units) || 0);
      retail[row.brand][index] = retailSums[key];
    });
    return { rto, retail };
  }, [rtoRows, retailRows]);

  const totalRto = useMemo(() => MONTHS.map((_, index) => sum(BRANDS.map((item) => data.rto[item][index]))), [data]);
  const totalRetail = useMemo(() => MONTHS.map((_, index) => sum(BRANDS.map((item) => data.retail[item][index]))), [data]);

  async function saveRto() {
    const numericUnits = units === "" ? null : Number(units);
    if (!Number.isInteger(numericUnits) || numericUnits < 0) {
      setError("Enter a valid non-negative whole-number RTO figure.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await supabase.from("sales_cockpit_monthly_rto").upsert({
        brand, sales_year: year, sales_month: Number(month), units: numericUnits,
        source: "Manual month-end RTO entry", updated_at: new Date().toISOString(),
      }, { onConflict: "brand,sales_year,sales_month" });
      if (result.error) throw result.error;
      setMessage(brand + " " + MONTHS[month - 1] + " " + year + " RTO saved / updated.");
      setUnits("");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Unable to save the RTO figure.");
    } finally {
      setSaving(false);
    }
  }

  function renderBrandRows(item) {
    const rto = data.rto[item];
    const retail = data.retail[item];
    const totalRtoValue = sum(rto);
    const totalRetailValue = sum(retail);
    return (
      <tbody key={item} className="rtoBrandBlock">
        <tr className="rtoBrandHeading"><th colSpan={15}>{item}</th></tr>
        <tr><th scope="row">RTO</th>{rto.map((value, index) => <td key={index}>{fmt(value)}</td>)}<td className="rtoTotalCell">{fmt(totalRtoValue)}</td></tr>
        <tr><th scope="row">Retail</th>{retail.map((value, index) => <td key={index}>{fmt(value)}</td>)}<td className="rtoTotalCell">{fmt(totalRetailValue)}</td></tr>
        <tr className="rtoAchievementRow"><th scope="row">Achievement</th>{MONTHS.map((_, index) => <td key={index}>{pct(retail[index], rto[index]) == null ? "—" : pct(retail[index], rto[index]).toFixed(0) + "%"}</td>)}<td className="rtoTotalCell">{pct(totalRetailValue, totalRtoValue) == null ? "—" : pct(totalRetailValue, totalRtoValue).toFixed(0) + "%"}</td></tr>
        <tr className="rtoGapRow"><th scope="row">Gap</th>{MONTHS.map((_, index) => <td key={index}>{fmt(gap(rto[index], retail[index]))}</td>)}<td className="rtoTotalCell">{fmt(gap(totalRtoValue, totalRetailValue))}</td></tr>
      </tbody>
    );
  }

  return (
    <main className="cockpit rtoRetailPage">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · MONTH-END PERFORMANCE</div>
          <h1>RTO vs Retail</h1>
          <p className="subtitle">Monthly registration performance against retail for Jeep and Citroën</p>
        </div>
        <div className="headerStatus"><span className={"statusDot" + (loading || refreshing ? " loadingDot" : "")} />{loading ? "Loading data" : refreshing ? "Refreshing data" : error ? "Data issue" : "Data connected"}</div>
      </header>

      <CockpitNavigation active="/rto-retail" />

      <section className="rtoIntro">
        <strong>One source of truth for Retail</strong>
        <p>Enter month-end RTO figures here. Retail is linked directly to the Jeep and Citroën Model Wise dashboards (Model Monthly → Retail); it is not entered or stored again. Achievement = Retail ÷ RTO. Gap = RTO − Retail.</p>
      </section>

      <section className="filters rtoYearFilter">
        <div className="filter"><label htmlFor="rto-year">Calendar year</label><select id="rto-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{YEARS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="rtoRefresh"><button type="button" className="secondaryButton" onClick={() => loadData(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh figures"}</button></div>
      </section>

      <section className="entryCard rtoEntryCard">
        <div className="sectionHeading"><div><div className="eyebrow">MONTH-END INPUT</div><h2>Enter RTO</h2></div></div>
        <div className="entryGrid">
          <div className="filter"><label htmlFor="rto-brand">Brand</label><select id="rto-brand" value={brand} onChange={(event) => setBrand(event.target.value)}>{BRANDS.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="filter"><label htmlFor="rto-month">Month</label><select id="rto-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></div>
          <div className="filter"><label htmlFor="rto-units">Month-end RTO units</label><input id="rto-units" type="number" min="0" step="1" inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} placeholder="Enter RTO total" /></div>
        </div>
        <div className="entryFooter"><div className="messageArea">{message && <span className="successMessage">{message}</span>}{error && <span className="errorMessage">{error}</span>}</div><button type="button" className="primaryButton" onClick={saveRto} disabled={saving || units === ""}>{saving ? "Saving…" : "Save / Update RTO"}</button></div>
      </section>

      <section className="tableCard rtoPerformanceCard">
        <div className="sectionHeading"><div><div className="eyebrow">MONTHLY COMPARISON</div><h2>{year} · RTO and Retail</h2></div></div>
        {error && <div className="errorBanner">{error}</div>}
        {loading ? <p className="subtitle">Loading monthly figures…</p> : (
          <div className="rtoTableScroll" role="region" aria-label={year + " monthly RTO versus Retail"} tabIndex={0}>
            <table className="rtoTable">
              <thead><tr><th>Brand</th><th>Measure</th>{MONTHS.map((item) => <th key={item}>{String(year).slice(-2)}-{item}</th>)}<th>Total</th></tr></thead>
              {BRANDS.map(renderBrandRows)}
              <tbody className="rtoTotalBlock">
                <tr className="rtoBrandHeading"><th colSpan={15}>Stellantis Total</th></tr>
                <tr><th scope="row">RTO</th>{totalRto.map((value, index) => <td key={index}>{fmt(value)}</td>)}<td className="rtoTotalCell">{fmt(sum(totalRto))}</td></tr>
                <tr><th scope="row">Retail</th>{totalRetail.map((value, index) => <td key={index}>{fmt(value)}</td>)}<td className="rtoTotalCell">{fmt(sum(totalRetail))}</td></tr>
                <tr className="rtoAchievementRow"><th scope="row">Achievement</th>{MONTHS.map((_, index) => <td key={index}>{pct(totalRetail[index], totalRto[index]) == null ? "—" : pct(totalRetail[index], totalRto[index]).toFixed(0) + "%"}</td>)}<td className="rtoTotalCell">{pct(sum(totalRetail), sum(totalRto)) == null ? "—" : pct(sum(totalRetail), sum(totalRto)).toFixed(0) + "%"}</td></tr>
                <tr className="rtoGapRow"><th scope="row">Gap</th>{MONTHS.map((_, index) => <td key={index}>{fmt(gap(totalRto[index], totalRetail[index]))}</td>)}<td className="rtoTotalCell">{fmt(gap(sum(totalRto), sum(totalRetail)))}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="rtoFootnote">Retail figures are read live from the Model Wise dashboard data. A dash indicates that no figure has been entered or loaded for that month; it is not treated as zero.</p>
      </section>

      <footer><span>Stellantis Sales Cockpit</span><span>•</span><span>RTO entered monthly · Retail linked to Model Wise</span></footer>
    </main>
  );
}
