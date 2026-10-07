import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import segmentRows from "../../../scripts/data/industry-segment-history.json";
import manufacturerRows from "../../../scripts/data/industry-manufacturer-history.json";

const TOKEN = "industry-import-20261007-7f4c2d9a";
const BATCH = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function upsert(table, rows, conflict) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: conflict });
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
  }
}

export async function GET(request) {
  if (new URL(request.url).searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const segments = segmentRows.map(r => ({
    sales_period: r.d,
    segment: r.s,
    units: r.u,
    period_type: r.t,
    source_workbook: "IND.xlsx",
    source_sheet: "Sheet2"
  }));

  const manufacturers = manufacturerRows.map(r => ({
    sales_period: r.d,
    manufacturer: r.m,
    units: r.u,
    period_type: r.t,
    record_type: r.r,
    source_workbook: "comp.xlsx",
    source_sheet: "Master-Sep26"
  }));

  try {
    await upsert("industry_segment_history_v2", segments, "sales_period,segment");
    await upsert("industry_manufacturer_history_v2", manufacturers, "sales_period,manufacturer,record_type");
    return NextResponse.json({
      ok: true,
      segmentRows: segments.length,
      manufacturerRows: manufacturers.length,
      through: "2026-09-01"
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}