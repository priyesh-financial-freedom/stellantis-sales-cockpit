import { supabase } from "./supabase";

export const INDUSTRY_PERIODS = ["Monthly"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const INDUSTRY_TOTAL = "Industry Total";

export async function loadIndustryData() {
  const { data, error } = await supabase
    .from("industry_segment_monthly")
    .select("sales_month,segment,bodyshape,units")
    .order("sales_month")
    .order("bodyshape")
    .order("segment");

  if (error) throw new Error("Failed loading Industry data: " + error.message);
  return data || [];
}

export function getIndustryYears(rows) {
  return [...new Set(rows.map((row) => Number(String(row.sales_month).slice(0, 4))))].sort((a, b) => b - a);
}

export function getIndustryMonths(rows, year) {
  if (Number(year) <= 1996) return ["Annual"];\n\n  const available = new Set(
    rows
      .filter((row) => Number(String(row.sales_month).slice(0, 4)) === Number(year)
      .map((row) => Number(String(row.sales_month).slice(5, 7)))
  );
  return [...available].sort((a, b) => a - b);
}

export function getIndustryTotal(rows, year, monthValue) {
  return rows
    .filter((row) => {
      if (row.segment !== INDUSTRY_TOTAL) return false;
      const date = String(row.sales_month);
      if (Number(date.slice(0, 4)) !== Number(year)) return false;
      return monthValue === "All" || monthValue === "Annual" || Number(date.slice(5, 7)) === Number(monthValue);
    })
    .reduce((sum, row) => sum + (Number(row.units) || 0), 0);
}

export function buildIndustryView(rows, year, monthValue) {
  const filtered = rows.filter((row) => {
    const date = String(row.sales_month);
    if (Number(date.slice(0, 4)) !== Number(year)) return false;
    if (row.segment === INDUSTRY_TOTAL) return false;
    return monthValue === "All" || Number(date.slice(5, 7)) === Number(monthValue);
  });

  const grouped = new Map();

  for (const row of filtered) {
    const key = String(row.bodyshape || "Other") + " · " + String(row.segment || "Unclassified");
    const current = grouped.get(key) || {
      key,
      bodyshape: row.bodyshape || "Other",
      segment: row.segment || "Unclassified",
      units: 0,
    };
    current.units += Number(row.units) || 0;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.units - a.units);
}

export function formatIndustryNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export { MONTHS };
