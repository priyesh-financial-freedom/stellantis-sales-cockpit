import { supabase } from "./supabase";

const YEARS = [2023, 2024, 2025, 2026];

export const METRIC_FIELDS = {
  TD: "test_drives",
  Bookings: "bookings",
  Retail: "retail",
  Wholesale: "wholesale",
};

const METRIC_KEYS = Object.values(METRIC_FIELDS);

function startOfYear(year) {
  return `${year}-01-01`;
}

function endOfYear(year) {
  return `${year}-12-31`;
}

export async function loadSalesData() {
  const results = [];

  for (const year of YEARS) {
    const { data, error } = await supabase
      .from("sales_cockpit_daily")
      .select("brand,sales_date,test_drives,bookings,retail,wholesale")
      .gte("sales_date", startOfYear(year))
      .lte("sales_date", endOfYear(year))
      .order("sales_date", { ascending: true });

    if (error) {
      throw new Error(`Failed loading ${year} sales data: ${error.message}`);
    }

    results.push(...(data || []));
  }

  return results;
}

function dateParts(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function selectedYears(year) {
  return year === "All" ? YEARS : [Number(year)];
}

function matchesPeriod(row, period, periodValue, year, customFrom, customTo) {
  const { year: rowYear, month } = dateParts(row.sales_date);

  if (year !== "All" && rowYear !== Number(year)) return false;

  if (period === "Custom Period") {
    if (!customFrom || !customTo) return false;
    return row.sales_date >= customFrom && row.sales_date <= customTo;
  }

  if (period === "Annual") return true;
  if (period === "Monthly") {
    return periodValue === "All" || month === Number(periodValue);
  }
  if (period === "Quarterly") {
    return periodValue === "All" || Math.ceil(month / 3) === Number(periodValue.slice(1));
  }
  if (period === "Half-Yearly") {
    return periodValue === "All" || (month <= 6 ? periodValue === "H1" : periodValue === "H2");
  }

  return true;
}

function intervalFor(year, period, value) {
  if (period === "Annual") return [`${year}-01-01`, `${year}-12-31`];

  if (period === "Monthly") {
    if (value === "All") return [`${year}-01-01`, `${year}-12-31`];
    const month = Number(value);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return [`${year}-${String(month).padStart(2, "0")}-01`, end];
  }

  if (period === "Quarterly") {
    if (value === "All") return [`${year}-01-01`, `${year}-12-31`];
    const quarter = Number(value.slice(1));
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const end = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
    return [
      `${year}-${String(startMonth).padStart(2, "0")}-01`,
      end,
    ];
  }

  if (period === "Half-Yearly") {
    if (value === "All") return [`${year}-01-01`, `${year}-12-31`];
    return value === "H1"
      ? [`${year}-01-01`, `${year}-06-30`]
      : [`${year}-07-01`, `${year}-12-31`];
  }

  return null;
}

export function getSelectionStatus(period, periodValue, year, customFrom, customTo) {
  const today = new Date().toISOString().slice(0, 10);

  if (period === "Custom Period") {
    if (!customFrom || !customTo) return "NO DATA";
    if (customFrom > today) return "FUTURE";
    if (customTo >= today) return "INCOMPLETE";
    return "ACTUAL / COMPLETE";
  }

  const intervals = selectedYears(year)
    .map((selectedYear) => intervalFor(selectedYear, period, periodValue))
    .filter(Boolean);

  if (intervals.some(([start]) => start > today)) return "FUTURE";
  if (intervals.some(([start, end]) => start <= today && end >= today)) {
    return "INCOMPLETE";
  }

  return "ACTUAL / COMPLETE";
}

function blankTotals() {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
}

function blankRecorded() {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, false]));
}

export function buildSalesView(rows, selection) {
  const scopes = ["Jeep", "Citroën", "SAARC"];
  const totals = Object.fromEntries(
    scopes.map((scope) => [scope, { ...blankTotals(), recorded: blankRecorded() }])
  );

  for (const row of rows) {
    if (!totals[row.brand]) continue;
    if (
      !matchesPeriod(
        row,
        selection.period,
        selection.periodValue,
        selection.year,
        selection.customFrom,
        selection.customTo
      )
    ) {
      continue;
    }

    for (const key of METRIC_KEYS) {
      if (row[key] !== null && row[key] !== undefined) {
        totals[row.brand][key] += Number(row[key]) || 0;
        totals[row.brand].recorded[key] = true;
      }
    }
  }

  totals["Stellantis Total"] = {
    ...blankTotals(),
    recorded: blankRecorded(),
  };

  for (const key of METRIC_KEYS) {
    for (const scope of scopes) {
      totals["Stellantis Total"][key] += totals[scope][key];
      totals["Stellantis Total"].recorded[key] =
        totals["Stellantis Total"].recorded[key] || totals[scope].recorded[key];
    }
  }

  const status = getSelectionStatus(
    selection.period,
    selection.periodValue,
    selection.year,
    selection.customFrom,
    selection.customTo
  );

  return { totals, status };
}

export function aggregateSales(rows) {
  return buildSalesView(rows, {
    period: "Annual",
    periodValue: "All",
    year: "All",
  }).totals;
}

function comparisonYear(year) {
  return year === "All" ? 2026 : Number(year);
}

function comparisonSelection(selection, relation) {
  if (selection.period === "Custom Period") return null;

  const currentYear = comparisonYear(selection.year);
  let currentValue = selection.periodValue;
  let currentPeriod = selection.period;

  if (currentPeriod === "Annual" || currentValue === "All") {
    if (relation === "previous" || relation === "ly") {
      return {
        ...selection,
        year: String(currentYear - 1),
        period: currentPeriod,
        periodValue: currentValue,
      };
    }
    return {
      ...selection,
      year: String(currentYear),
      period: currentPeriod,
      periodValue: currentValue,
    };
  }

  if (relation === "ly") {
    return {
      ...selection,
      year: String(currentYear - 1),
      period: currentPeriod,
      periodValue: currentValue,
    };
  }

  if (relation === "previous") {
    if (currentPeriod === "Monthly") {
      const month = Number(currentValue);
      if (month === 1) {
        return { ...selection, year: String(currentYear - 1), periodValue: "12" };
      }
      return { ...selection, year: String(currentYear), periodValue: String(month - 1) };
    }

    if (currentPeriod === "Quarterly") {
      const quarter = Number(currentValue.slice(1));
      if (quarter === 1) {
        return { ...selection, year: String(currentYear - 1), periodValue: "Q4" };
      }
      return { ...selection, year: String(currentYear), periodValue: `Q${quarter - 1}` };
    }

    if (currentPeriod === "Half-Yearly") {
      return currentValue === "H1"
        ? { ...selection, year: String(currentYear - 1), periodValue: "H2" }
        : { ...selection, year: String(currentYear), periodValue: "H1" };
    }
  }

  return null;
}

export function buildComparison(rows, selection) {
  const currentSelection = {
    ...selection,
    year: String(comparisonYear(selection.year)),
  };
  const previousSelection = comparisonSelection(selection, "previous");
  const lySelection = comparisonSelection(selection, "ly");

  const current = buildSalesView(rows, currentSelection);
  const previous = previousSelection ? buildSalesView(rows, previousSelection) : null;
  const ly = lySelection ? buildSalesView(rows, lySelection) : null;

  const brandSelection = {
    ...currentSelection,
    year: String(comparisonYear(selection.year)),
  };
  const brandView = buildSalesView(rows, brandSelection);

  return {
    current,
    previous,
    ly,
    brandView,
    currentSelection,
    previousSelection,
    lySelection,
  };
}
