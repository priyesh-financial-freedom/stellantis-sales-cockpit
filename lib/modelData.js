import { supabase } from "./supabase";
import { writeClientCache } from "./clientCache";

export const MODEL_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
export const MODEL_CACHE_KEY = "model-monthly-data-v1";

export const MODEL_NAMES = {
  Jeep: ["Compass", "Meridian", "GC", "Wrangler"],
  Citroën: ["C5", "C3", "eC3", "Aircross", "Basalt"],
};

export const MODEL_PERIODS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MODEL_MONTH_NUMBERS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export const MODEL_PERIOD_OPTIONS = [
  { label: "Jan", months: [1] },
  { label: "Feb", months: [2] },
  { label: "Mar", months: [3] },
  { label: "Apr", months: [4] },
  { label: "May", months: [5] },
  { label: "Jun", months: [6] },
  { label: "Jul", months: [7] },
  { label: "Aug", months: [8] },
  { label: "Sep", months: [9] },
  { label: "Oct", months: [10] },
  { label: "Nov", months: [11] },
  { label: "Dec", months: [12] },
  { label: "Q1", months: [1, 2, 3] },
  { label: "Q2", months: [4, 5, 6] },
  { label: "Q3", months: [7, 8, 9] },
  { label: "Q4", months: [10, 11, 12] },
  { label: "H1", months: [1, 2, 3, 4, 5, 6] },
  { label: "H2", months: [7, 8, 9, 10, 11, 12] },
  { label: "FY", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

export async function loadModelMonthlyData() {
  const results = [];

  for (const year of MODEL_YEARS) {
    const { data, error } = await supabase
      .from("sales_cockpit_model_monthly")
      .select("brand,sales_type,model_name,sales_year,sales_month,units")
      .eq("sales_year", year)
      .order("sales_year", { ascending: true })
      .order("sales_month", { ascending: true });

    if (error) {
      throw new Error(`Failed loading model data for ${year}: ${error.message}`);
    }

    results.push(...(data || []));
  }

  writeClientCache(MODEL_CACHE_KEY, results);
  return results;
}

function periodDefinition(period) {
  if (Array.isArray(period)) {
    const months = [...new Set(period.flatMap(value => periodDefinition(value)?.months || MODEL_PERIOD_OPTIONS.at(-1).months))];
    return { months };
  }
  return MODEL_PERIOD_OPTIONS.find((item) => item.label === period) || null;
}

export function filterModelRows(rows, { brand, salesType, year, period }) {
  const definition = periodDefinition(period);
  const months = definition?.months || MODEL_PERIOD_OPTIONS.at(-1).months;

  return rows.filter((row) => (
    ((Array.isArray(brand) ? brand : [brand]).length === 0 || (Array.isArray(brand) ? brand : [brand]).includes(row.brand)) &&
    ((Array.isArray(salesType) ? salesType : [salesType]).length === 0 || (Array.isArray(salesType) ? salesType : [salesType]).includes(row.sales_type)) &&
    ((Array.isArray(year) ? year : [year]).length === 0 || (Array.isArray(year) ? year : [year]).includes("All") || (Array.isArray(year) ? year : [year]).map(Number).includes(Number(row.sales_year))) &&
    months.includes(Number(row.sales_month))
  ));
}

export function buildModelSummary(rows, { brand, salesType, year, period }) {
  const models = MODEL_NAMES[brand] || [];
  const filtered = filterModelRows(rows, { brand, salesType, year, period });
  const totals = Object.fromEntries(models.map((model) => [model, 0]));

  for (const row of filtered) {
    if (totals[row.model_name] !== undefined) {
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
}

export function buildModelTrend(rows, { brand, salesType, model, year }) {
  return MODEL_PERIODS.map((month, index) => {
    const row = rows.find(
      (item) =>
        item.brand === brand &&
        item.sales_type === salesType &&
        item.model_name === model &&
        Number(item.sales_year) === Number(year) &&
        Number(item.sales_month) === index + 1
    );
    return Number(row?.units) || 0;
  });
}

export function buildMonthMatrix(rows, { brand, salesType, year }) {
  const models = MODEL_NAMES[brand] || [];
  const matrix = MODEL_PERIODS.map((month, index) => {
    const values = Object.fromEntries(models.map((model) => [model, 0]));

    for (const row of rows) {
      if (
        row.brand === brand &&
        row.sales_type === salesType &&
        Number(row.sales_year) === Number(year) &&
        Number(row.sales_month) === index + 1 &&
        values[row.model_name] !== undefined
      ) {
        values[row.model_name] = Number(row.units) || 0;
      }
    }

    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    return { month, ...values, total };
  });

  const totals = Object.fromEntries(models.map((model) => [
    model,
    matrix.reduce((sum, row) => sum + row[model], 0),
  ]));

  return { matrix, models, totals, grandTotal: Object.values(totals).reduce((sum, value) => sum + value, 0) };
}

export function getModelPeriodLabel(period) {
  if (period === "FY") return "Full Year";
  if (period.startsWith("Q")) return `Quarter ${period.slice(1)}`;
  if (period.startsWith("H")) return `Half-Year ${period.slice(1)}`;
  return period;
}
