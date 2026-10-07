import { supabase } from "./supabase";

export const INDUSTRY_YEARS = [2024, 2025, 2026];
export const INDUSTRY_PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
export const INDUSTRY_VIEWS = ["Industry", "Segment", "Brand", "Model"];
export const SEGMENT_LENSES = ["Stellantis Segment", "IHS Segment"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthStart(year, month) {
  return year + "-" + String(month).padStart(2, "0") + "-01";
}

function monthEnd(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export async function loadIndustryModels() {
  const { data, error } = await supabase
    .from("industry_model_master")
    .select("id,brand,model_name,old_segment,stellantis_segment,ihs_segment,validation_status")
    .eq("active", true)
    .order("brand")
    .order("model_name");

  if (error) throw new Error("Failed loading Industry model master: " + error.message);
  return data || [];
}

export async function loadIndustryYear(year) {
  const monthRequests = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return supabase
      .from("industry_model_monthly")
      .select("model_id,sales_month,units")
      .gte("sales_month", monthStart(year, month))
      .lte("sales_month", monthEnd(year, month))
      .order("model_id");
  });

  const responses = await Promise.all(monthRequests);
  const results = [];

  responses.forEach((response, index) => {
    if (response.error) {
      const month = index + 1;
      throw new Error(
        "Failed loading Industry " + year + "-" + String(month).padStart(2, "0") + ": " + response.error.message
      );
    }
    results.push(...(response.data || []));
  });

  return results;
}

function periodMonths(period, periodValue) {
  if (period === "Annual") return Array.from({ length: 12 }, (_, i) => i + 1);
  if (period === "Monthly") return periodValue === "All" ? Array.from({ length: 12 }, (_, i) => i + 1) : [Number(periodValue)];
  if (period === "Quarterly") {
    if (periodValue === "All") return Array.from({ length: 12 }, (_, i) => i + 1);
    const q = Number(periodValue.slice(1));
    return [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
  }
  if (period === "Half-Yearly") {
    if (periodValue === "All") return Array.from({ length: 12 }, (_, i) => i + 1);
    return periodValue === "H1" ? [1,2,3,4,5,6] : [7,8,9,10,11,12];
  }
  return [];
}

export function buildIndustryView(models, monthlyRows, selection) {
  const modelMap = new Map(models.map((model) => [model.id, model]));
  const months = periodMonths(selection.period, selection.periodValue);
  const totals = new Map();

  for (const row of monthlyRows) {
    const month = Number(String(row.sales_month).slice(5, 7));
    if (!months.includes(month)) continue;

    const model = modelMap.get(row.model_id);
    if (!model) continue;

    const key =
      selection.view === "Model" ? String(model.id) :
      selection.view === "Brand" ? model.brand :
      selection.view === "Segment" ? (selection.segmentLens === "IHS Segment" ? model.ihs_segment : model.stellantis_segment) :
      "Industry";

    const current = totals.get(key) || { key, units: 0, modelCount: 0 };
    current.units += Number(row.units) || 0;
    totals.set(key, current);
  }

  if (selection.view !== "Model") {
    for (const item of totals.values()) item.modelCount = models.filter((model) => {
      const key =
        selection.view === "Brand" ? model.brand :
        selection.view === "Segment" ? (selection.segmentLens === "IHS Segment" ? model.ihs_segment : model.stellantis_segment) :
        "Industry";
      return key === item.key;
    }).length;
  }

  return Array.from(totals.values())
    .map((item) => {
      const model = selection.view === "Model" ? modelMap.get(Number(item.key)) : null;
      return {
        ...item,
        label: model ? model.brand + " · " + model.model_name : item.key,
        validationStatus: model?.validation_status || null,
      };
    })
    .sort((a, b) => b.units - a.units);
}

export function formatIndustryNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export { MONTHS };
