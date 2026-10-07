import { supabase } from "./supabase";

const YEARS = [2024, 2025, 2026];

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
      .select(
        "brand,sales_date,test_drives,bookings,retail,wholesale"
      )
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

export function aggregateSales(rows) {
  const totals = {
    Jeep: {
      test_drives: 0,
      bookings: 0,
      retail: 0,
      wholesale: 0,
    },
    Citroën: {
      test_drives: 0,
      bookings: 0,
      retail: 0,
      wholesale: 0,
    },
    SAARC: {
      test_drives: 0,
      bookings: 0,
      retail: 0,
      wholesale: 0,
    },
  };

  for (const row of rows) {
    if (!totals[row.brand]) continue;

    totals[row.brand].test_drives += row.test_drives ?? 0;
    totals[row.brand].bookings += row.bookings ?? 0;
    totals[row.brand].retail += row.retail ?? 0;
    totals[row.brand].wholesale += row.wholesale ?? 0;
  }

  totals["Stellantis Total"] = {
    test_drives:
      totals.Jeep.test_drives +
      totals.Citroën.test_drives +
      totals.SAARC.test_drives,

    bookings:
      totals.Jeep.bookings +
      totals.Citroën.bookings +
      totals.SAARC.bookings,

    retail:
      totals.Jeep.retail +
      totals.Citroën.retail +
      totals.SAARC.retail,

    wholesale:
      totals.Jeep.wholesale +
      totals.Citroën.wholesale +
      totals.SAARC.wholesale,
  };

  return totals;
}
