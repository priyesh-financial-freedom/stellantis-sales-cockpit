"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MODEL_NAMES, MODEL_YEARS, MODEL_CACHE_KEY, buildModelSummary, loadModelMonthlyData } from "../../lib/modelData";
import { readClientCache } from "../../lib/clientCache";
import MultiSelect from "../../components/MultiSelect";
import { supabase } from "../../lib/supabase";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SALES_TYPES = ["Bookings", "Retail", "Wholesale"];
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
  const values = Array.isArray(value) ? value : [value];
  if (period === "Custom Period") return customMonthsForYear(year, customFrom, customTo);
  if (values.length === 0 || values.includes("All")) return Array.from({ length: 12 }, (_, i) => i + 1);
  if (period === "Monthly") return [...new Set(values.map(item => Number(item) || MONTH_OPTIONS.indexOf(item)))].filter(month => month >= 1 && month <= 12);
  if (period === "Quarterly") return [...new Set(values.flatMap(item => {
    const q = Number(String(item).slice(1));
    return [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
  }))];
  if (period === "Half-Yearly") return [...new Set(values.flatMap(item => item === "H1" ? [1,2,3,4,5,6] : [7,8,9,10,11,12]))];
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function intervalFor(period, value, year) {
  const y = Number(year);
  if (period === "Annual") return [y + "-01-01", y + "-12-31"];
  if (period === "Monthly") {
    const month = Number(value) || MONTH_OPTIONS.indexOf(value);
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
  const years = Array.isArray(year) ? year : [year];
  const values = Array.isArray(value) ? value : [value];

  // Multi-select filters use an empty array or "All" to represent the full set.
  // Normalize those states before calling intervalFor(), which expects scalar values.
  const normalizedYears = years.length === 0 || years.includes("All")
    ? MODEL_YEARS.map(String)
    : years.map(String);
  const normalizedValues = values.length === 0 || values.includes("All")
    ? ["All"]
    : values;

  const statusValues = normalizedYears.flatMap((y) =>
    normalizedValues.map((v) => getStatusScalar(period, v, y, customFrom, customTo, today))
  );

  if (statusValues.includes("FUTURE")) return "FUTURE";
  if (statusValues.includes("INCOMPLETE")) return "INCOMPLETE";
  return "ACTUAL / COMPLETE";
}

function getStatusScalar(period, value, year, customFrom, customTo, today) {
  if (period === "Custom Period") {
    if (!customFrom || !customTo) return "NO DATA";
    if (customFrom > today) return "FUTURE";
    if (customTo >= today) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }

  if (period === "Monthly" && value === "All") {
    const statuses = Array.from({ length: 12 }, (_, i) =>
      getStatusScalar("Monthly", String(i + 1), year, customFrom, customTo, today)
    );
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }

  if (period === "Quarterly" && value === "All") {
    const statuses = ["Q1", "Q2", "Q3", "Q4"].map((q) =>
      getStatusScalar("Quarterly", q, year, customFrom, customTo, today)
    );
    if (statuses.includes("FUTURE")) return "FUTURE";
    if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }

  if (period === "Half-Yearly" && value === "All") {
    const statuses = ["H1", "H2"].map((h) =>
      getStatusScalar("Half-Yearly", h, year, customFrom, customTo, today)
    );
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
  const years = Array.isArray(year) ? year.map(Number) : [Number(year)];
  const salesTypes = Array.isArray(salesType) ? salesType : [salesType];
  return rows
    .filter((row) =>
      row.brand === brand &&
      (salesTypes.length === 0 || salesTypes.includes(row.sales_type)) &&
      (years.length === 0 || years.includes(Number(row.sales_year))) &&
      months.includes(Number(row.sales_month)) &&
      row.model_name === model
    )
    .reduce((sum, row) => sum + (Number(row.units) || 0), 0);
}

export default function ModelWiseClient({ brand }) {
  const [year, setYear] = useState(["2026"]);
  const [salesType, setSalesType] = useState(["Retail"]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [period, setPeriod] = useState("Annual");
  const [periodValue, setPeriodValue] = useState(["All"]);
  const [customFrom, setCustomFrom] = useState("2026-01-01");
  const [customTo, setCustomTo] = useState("2026-12-31");
  const [rows, setRows] = useState([]);
  const [legacyBookings, setLegacyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);

  useEffect(() => {
    let active = true;
    const cached = readClientCache(MODEL_CACHE_KEY);

    if (cached?.data?.length) {
      setRows(cached.data);
      setCachedAt(cached.cachedAt);
      setLoading(false);
      setRefreshing(true);
    }

    async function fetchData() {
      try {
        setError("");
        if (!cached?.data?.length) setLoading(true);
        const data = await loadModelMonthlyData();
        if (active) {
          setRows(data);
          setCachedAt(Date.now());
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err) {
        if (active) {
          setLoading(false);
          setRefreshing(false);
          if (!cached?.data?.length) setError(err.message || "Unable to load model data.");
        }
      }
    }

    fetchData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLegacyBookings() {
      try {
        const { data, error } = await supabase
          .from("sales_cockpit_daily")
          .select("brand,sales_date,bookings")
          .eq("brand", brand)
          .gte("sales_date", "2024-01-01")
          .lte("sales_date", "2026-12-31")
          .order("sales_date", { ascending: true });
        if (error) throw error;
        if (active) setLegacyBookings((data || []).map((row) => {
          const [sales_year, sales_month] = row.sales_date.split("-").map(Number);
          return { sales_year, sales_month, units: Number(row.bookings) || 0 };
        }));
      } catch {
        if (active) setLegacyBookings([]);
      }
    }
    loadLegacyBookings();
    return () => { active = false; };
  }, [brand]);

  const periodOptions = useMemo(() => {
    if (period === "Monthly") return MONTH_OPTIONS;
    if (period === "Quarterly") return QUARTER_OPTIONS;
    if (period === "Half-Yearly") return HALF_YEAR_OPTIONS;
    return ["All"];
  }, [period]);

  const periodSelectorLabel = period === "Monthly" ? "Month" : period === "Quarterly" ? "Quarter" : period === "Half-Yearly" ? "Half-Year" : "Period";
  const allModels = MODEL_NAMES[brand] || [];
  const models = selectedModels.length === 0 ? allModels : allModels.filter((model) => selectedModels.includes(model));
  const modelLabel = selectedModels.length === 0 ? "All" : selectedModels.length === 1 ? selectedModels[0] : `${selectedModels.length} selected`;
  const detailYears = year.length === 0 ? MODEL_YEARS.map(String) : year.map(String);

  const breakdownOptions = useMemo(() => {
    if (period === "Monthly") return MONTH_OPTIONS.slice(1).map((label, i) => ({ label, value: String(i + 1) }));
    if (period === "Quarterly") return QUARTER_OPTIONS.slice(1).map((label) => ({ label, value: label }));
    if (period === "Half-Yearly") return HALF_YEAR_OPTIONS.slice(1).map((label) => ({ label, value: label }));
    return [];
  }, [period]);

  const showPeriodBreakdown = period !== "Annual" && period !== "Custom Period" && periodValue.includes("All") && periodValue.length === 1;
  const showYearBreakdown = year.length === 0;
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

  const legacyBookingRows = useMemo(() => {
    if (salesType.length > 0 && !salesType.includes("Bookings")) return [];
    const selectedYearValues = year.length === 0 || year.includes("All") ? MODEL_YEARS.map(String) : year.map(String);
    return legacyBookings
      .filter(row => selectedYearValues.includes(String(row.sales_year)))
      .filter(row => periodMonths(period, periodValue, row.sales_year, customFrom, customTo).includes(row.sales_month))
      .sort((a, b) => a.sales_year - b.sales_year || a.sales_month - b.sales_month);
  }, [legacyBookings, salesType, year, period, periodValue, customFrom, customTo]);

  const summary = useMemo(() => {
    if (showBreakdown) return null;

    let result;
    if (period !== "Custom Period") {
      const modelsForSummary = selectedModels.length === 0 ? allModels : allModels.filter(model => selectedModels.includes(model));
      const summaryTotals = Object.fromEntries(modelsForSummary.map(model => [model, 0]));
      for (const y of detailYears) {
        for (const model of modelsForSummary) {
          summaryTotals[model] += sumPeriod(rows, brand, salesType, y, periodMonths(period === "Annual" ? "Annual" : period, period === "Annual" ? ["All"] : periodValue, Number(y), customFrom, customTo), model);
        }
      }
      const summaryGrandTotal = Object.values(summaryTotals).reduce((sum, value) => sum + value, 0);
      result = {
        models: modelsForSummary.map(model => ({
          model,
          units: summaryTotals[model],
          share: summaryGrandTotal ? (summaryTotals[model] / summaryGrandTotal) * 100 : 0,
        })),
        grandTotal: summaryGrandTotal,
      };
    } else {
      const totals = Object.fromEntries((selectedModels.length === 0 ? allModels : allModels.filter(model => selectedModels.includes(model))).map((model) => [model, 0]));
      for (const model of Object.keys(totals)) {
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
        models: Object.keys(totals).map((model) => ({
          model,
          units: totals[model],
          share: grandTotal ? (totals[model] / grandTotal) * 100 : 0,
        })),
        grandTotal,
      };
    }

    return result;
  }, [rows, brand, salesType, year, period, periodValue, showBreakdown, allModels, selectedModels, customFrom, customTo]);

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
        {values.map((value, i) => (
          <div
            key={models[i]}
            className={valueClass(row.status, value) + " modelBreakdownValue"}
            data-model={models[i]}
          >
            {formatNumber(value)}
          </div>
        ))}
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
          <p className="subtitle">Monthly model-level Bookings, Retail and Wholesale performance</p>
          {cachedAt && <div className="dataFreshness">{refreshing ? "Showing cached data · refreshing in background" : "Updated " + new Date(cachedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
        <div className="headerStatus">
          <span className={(loading || refreshing) ? "statusDot loadingDot" : "statusDot"} />
          {loading ? "Loading data" : refreshing ? "Refreshing data" : error ? "Data error" : "Data connected"}
        </div>
      </header>

      <nav className="cockpitNav">
        <Link className={brand === "Jeep" ? "active" : ""} href="/model-wise/jeep">Jeep Model Wise</Link>
        <Link className={brand === "Citroën" ? "active" : ""} href="/model-wise/citroen">Citroën Model Wise</Link>
        <Link href="/industry">Industry</Link>
        <Link href="/data-entry">Data Entry</Link>
      </nav>

      <section className="filters modelFilters">
        <div className="filter">
          <label>Period</label>
          <select value={period} onChange={(e) => {
            const next = e.target.value;
            setPeriod(next);
            setPeriodValue(["All"]);
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
            <MultiSelect label={periodSelectorLabel} options={periodOptions} value={periodValue} onChange={setPeriodValue} />
          )}
        </div>

        <div className="filter">
          <label>Year</label>
          <MultiSelect label="Year" options={MODEL_YEARS.map(String)} value={year} onChange={setYear} />
        </div>

        <div className="filter">
          <label>Sales Type</label>
          <MultiSelect label="Sales Type" options={SALES_TYPES} value={salesType} onChange={setSalesType} />
        </div>
        <div className="filter">
          <MultiSelect label="Model" options={allModels} value={selectedModels} onChange={setSelectedModels} />
        </div>
      </section>

      <section className="summary">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">MODEL PERFORMANCE</div>
            <h2>{brand} · {modelLabel} · {salesType.length === 0 ? "All" : salesType.join(", ")} · {title} · {year.length === 0 ? "All" : year.join(", ")}</h2>
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

      {(salesType.length === 0 || salesType.includes("Bookings")) && legacyBookingRows.length > 0 && (
        <section className="summary">
          <div className="sectionHeading">
            <div>
              <div className="eyebrow">HISTORICAL BOOKINGS</div>
              <h2>{brand} · Brand-level monthly bookings</h2>
              <p className="subtitle">Rolled up from the existing daily records. These are brand totals, not model-level allocations.</p>
            </div>
          </div>
          <div className="tableCard">
            <div className="modelBreakdownHeader" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>Year</div><div>Month</div><div>Bookings</div>
            </div>
            {legacyBookingRows.map((row) => (
              <div className="modelBreakdownRow" key={row.sales_year + "-" + row.sales_month} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div>{row.sales_year}</div>
                <div>{MONTH_OPTIONS[row.sales_month]}</div>
                <div>{formatNumber(row.units)}</div>
              </div>
            ))}
            <div className="modelBreakdownRow modelTotalRow" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="scopeName">TOTAL</div><div>Selected periods</div><div>{formatNumber(legacyBookingRows.reduce((sum, row) => sum + row.units, 0))}</div>
            </div>
          </div>
        </section>
      )}

      <footer>
        <span>Stellantis Sales Cockpit</span><span>•</span><span>Model data: 2021–2026 · monthly source records</span>
      </footer>
    </main>
  );
}
