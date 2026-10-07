import { supabase } from "./supabase";

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function loadIndustryData() {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("industry_segment_history_v2")
      .select("sales_period,segment,units,period_type")
      .order("sales_period")
      .order("segment")
      .range(from, from + pageSize - 1);

    if (error) throw new Error("Failed loading Industry data: " + error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export function getIndustryYears(rows) {
  return [...new Set(rows.map((row) => Number(String(row.sales_period).slice(0, 4))))].sort((a, b) => b - a);
}

export function getIndustryMonths(rows, year) {
  return [...new Set(
    rows
      .filter((row) => Number(String(row.sales_period).slice(0, 4)) === Number(year) && row.period_type === "MONTHLY")
      .map((row) => Number(String(row.sales_period).slice(5, 7)))
  )].sort((a, b) => a - b);
}

export function getIndustryTotal(rows, year, monthValue) {
  return rows
    .filter((row) => {
      const date = String(row.sales_period);
      if (Number(date.slice(0, 4)) !== Number(year)) return false;
      if (row.segment !== "Industry Total") return false;
      if (Number(year) <= 1996) return row.period_type === "ANNUAL";
      return monthValue === "All" || Number(date.slice(5, 7)) === Number(monthValue);
    })
    .reduce((sum, row) => sum + (Number(row.units) || 0), 0);
}

export function buildIndustryView(rows, year, monthValue) {
  const filtered = rows.filter((row) => {
    const date = String(row.sales_period);
    if (Number(date.slice(0, 4)) !== Number(year)) return false;
    if (Number(year) <= 1996) return row.period_type === "ANNUAL";
    return monthValue === "All" || Number(date.slice(5, 7)) === Number(monthValue);
  });

  const grouped = new Map();
  for (const row of filtered) {
    const segment = String(row.segment || "Unclassified");
    if (segment === "Industry Total") continue;
    grouped.set(segment, (grouped.get(segment) || 0) + (Number(row.units) || 0));
  }

  return [...grouped.entries()]
    .filter(([, units]) => units > 0)
    .map(([segment, units]) => ({ key: segment, segment, units }))
    .sort((a, b) => b.units - a.units);
}

export function formatIndustryNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export const INDUSTRY_PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
export const INDUSTRY_QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
export const INDUSTRY_HALVES = ["All", "H1", "H2"];

export function getPeriodOptions(period) {
  if (period === "Monthly") return ["All", ...MONTHS.slice(0)];
  if (period === "Quarterly") return INDUSTRY_QUARTERS;
  if (period === "Half-Yearly") return INDUSTRY_HALVES;
  if (period === "Annual") return ["All"];
  return [];
}

export function getYearsFromRows(rows) {
  return [...new Set(rows.map((r) => Number(String(r.sales_period).slice(0, 4))))].sort((a, b) => b - a);
}

export function filterHistoryRows(rows, { period, periodValue, year, customFrom = "", customTo = "", key, value }) {
  return rows.filter((r) => {
    const date = String(r.sales_period);
    const y = Number(date.slice(0, 4));
    const m = Number(date.slice(5, 7));
    if (year !== "All" && y !== Number(year)) return false;
    if (key && value !== "All" && r[key] !== value) return false;

    if (period === "Custom Period") {
      if (!customFrom || !customTo) return false;
      return date >= customFrom && date <= customTo;
    }

    if (period === "Annual") {
      return r.period_type === "ANNUAL" || (r.period_type === "MONTHLY" && periodValue === "All");
    }

    if (period === "Monthly") {
      if (periodValue === "All") return r.period_type === "MONTHLY";
      const monthNumber = MONTHS.indexOf(periodValue) + 1;
      return r.period_type === "MONTHLY" && m === monthNumber;
    }

    if (period === "Quarterly") {
      if (r.period_type !== "MONTHLY") return false;
      if (periodValue === "All") return true;
      const q = Math.floor((m - 1) / 3) + 1;
      return periodValue === `Q${q}`;
    }

    if (period === "Half-Yearly") {
      if (r.period_type !== "MONTHLY") return false;
      if (periodValue === "All") return true;
      const h = m <= 6 ? 1 : 2;
      return periodValue === `H${h}`;
    }

    return false;
  });
}

export function aggregateHistory(rows, filters, key, selectedValue) {
  const filtered = filterHistoryRows(rows, { ...filters, key, value: selectedValue });
  const total = filtered.reduce((sum, r) => sum + (Number(r.units) || 0), 0);
  const byPeriod = new Map();
  for (const row of filtered) {
    const period = String(row.sales_period);
    byPeriod.set(period, (byPeriod.get(period) || 0) + (Number(row.units) || 0));
  }
  return { filtered, total, byPeriod };
}
