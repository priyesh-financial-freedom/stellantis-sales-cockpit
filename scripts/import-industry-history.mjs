import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const indPath = process.argv[2] || path.join(root, "IND.xlsx");
const compPath = process.argv[3] || path.join(root, "comp.xlsx");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
const supabase = createClient(url, key);
const BATCH = 500;

function cleanHeader(v) { return String(v ?? "").trim().replace(/^["']|["']$/g, "").replace(/\\n/g, " "); }
function periodFromHeader(v) {
  const raw = cleanHeader(v);
  const annual = raw.match(/Total\\s*-\\s*(199[1-6])/i);
  if (annual) return { date: `${annual[1]}-01-01`, period_type: "ANNUAL" };
  const monthly = raw.match(/^(Jan|Feb|March|April|May|June|July|Aug|Sep|Oct|Nov|Dec)[']?(\\d{2})$/i);
  if (!monthly) return null;
  const months = {Jan:"01",Feb:"02",March:"03",April:"04",May:"05",June:"06",July:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"};
  const key = monthly[1][0].toUpperCase() + monthly[1].slice(1).toLowerCase();
  return { date: `20${monthly[2]}-${months[key]}-01`, period_type: "MONTHLY" };
}
function readSheet(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  const wb = xlsx.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return { sheetName: wb.SheetNames[0], rows: xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) };
}
function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; }
function canonicalSegment(raw) {
  const map = {"A HATCH":"A-Hatch","B HATCH":"B-Hatch","C HATCH":"C-Hatch","B SEDAN <4m":"B-Sedan (<4m)","B SEDAN >4m":"B-Sedan","C SEDAN":"C-Sedan","D SEDAN":"D-Sedan","E SEDAN":"E-Sedan","F SEDAN":"F-Sedan","C-Cp/Cb":"C-Cp/Cb","D-Cp/Cb":"D-Cp/Cb","E-Cp/Cb":"E-Cp/Cb","A SUV":"A-SUV","B SUV <4m":"B-SUV (<4m)","B SUV >4m":"B-SUV","C SUV":"C-SUV","D SUV":"D-SUV","E SUV":"E-SUV","F SUV":"F-SUV","A MPV":"A-MPV","B MPV":"B-MPV","C MPV":"C-MPV","D MPV":"D-MPV","E MPV":"E-MPV","B Van":"B-Van","D VAN":"D-Van","E WAGON":"E-Wagon","Others":"Others"};
  return map[String(raw ?? "").trim()] || String(raw ?? "").trim();
}
async function insertBatched(table, rows) {
  const conflict = table.includes("manufacturer") ? "sales_period,manufacturer,record_type" : "sales_period,segment";
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
    if (error) throw new Error(`${table} batch ${i}-${i + batch.length}: ${error.message}`);
    console.log(`${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
}
function parseHistory(file, kind) {
  const { sheetName, rows } = readSheet(file);
  const headerRow = kind === "manufacturer" ? 0 : 2;
  const headers = rows[headerRow] || [];
  const startRow = kind === "manufacturer" ? 1 : 4;
  const out = [];
  for (let r = startRow; r < rows.length; r++) {
    const name = rows[r]?.[0];
    if (name === null || name === undefined || String(name).trim() === "") continue;
    const label = String(name).trim();
    const recordType = kind === "manufacturer" && label === "TOTAL" ? "TOTAL" : "MANUFACTURER";
    for (let c = 1; c < headers.length; c++) {
      const period = periodFromHeader(headers[c]);
      if (!period) continue;
      if (kind === "manufacturer") out.push({sales_period:period.date,manufacturer:label,units:toInt(rows[r]?.[c]),period_type:period.period_type,record_type:recordType,source_workbook:path.basename(file),source_sheet:sheetName});
      else out.push({sales_period:period.date,segment:canonicalSegment(label),units:toInt(rows[r]?.[c]),period_type:period.period_type,source_workbook:path.basename(file),source_sheet:sheetName});
    }
  }
  return out;
}
const segmentRows = parseHistory(indPath, "segment");
const manufacturerRows = parseHistory(compPath, "manufacturer");
console.log(`Prepared ${segmentRows.length} segment observations and ${manufacturerRows.length} manufacturer observations.`);
await insertBatched("industry_segment_history_v2", segmentRows);
await insertBatched("industry_manufacturer_history_v2", manufacturerRows);
console.log("Industry history import completed.");
