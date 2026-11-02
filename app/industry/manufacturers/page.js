"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readClientCacheAsync, writeClientCache } from "../../../lib/clientCache";
import { supabase } from "../../../lib/supabase";
import { INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS, filterHistoryRows } from "../../../lib/industryData";
import MultiSelect from "../../../components/MultiSelect";
import CockpitNavigation from "../../../components/CockpitNavigation";

const MANUFACTURER_CACHE_KEY = "industry-manufacturer-history-v1";

const fmt = value => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

export default function ManufacturerHistoryPage() {
  const [rows,setRows]=useState([]), [period,setPeriod]=useState("Monthly"), [manufacturerSelection,setManufacturerSelection]=useState([]), [periodValue,setPeriodValue]=useState(["All"]), [year,setYear]=useState(["2026"]), [customFrom,setCustomFrom]=useState(""), [customTo,setCustomTo]=useState(""), [loading,setLoading]=useState(true), [error,setError]=useState("");

  const [refreshing,setRefreshing]=useState(false), [cachedAt,setCachedAt]=useState(null);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const cached = await readClientCacheAsync(MANUFACTURER_CACHE_KEY);
      if (active && cached?.data?.length) {
        setRows(cached.data);
        setCachedAt(cached.cachedAt);
        setLoading(false);
        setRefreshing(true);
        const ys = [...new Set(cached.data.map(r => String(r.sales_period).slice(0, 4)))].sort((a, b) => b.localeCompare(a));
        if (ys.length) setYear([ys[0]]);
      }

      try {
        const out = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("industry_manufacturer_history_v2")
            .select("sales_period,manufacturer,units,period_type,record_type")
            .eq("record_type", "MANUFACTURER").order("sales_period").order("manufacturer")
            .range(from, from + 999);
          if (error) throw error;
          out.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        await writeClientCache(MANUFACTURER_CACHE_KEY, out);
        if (!active) return;
        setRows(out);
        setCachedAt(Date.now());
        setRefreshing(false);
        const ys = [...new Set(out.map(r => String(r.sales_period).slice(0, 4)))].sort((a, b) => b.localeCompare(a));
        if (ys.length) setYear([ys[0]]);
      } catch (error) {
        if (active) {
          setRefreshing(false);
          if (!cached?.data?.length) setError(error?.message || "Unable to load manufacturer history.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => { active = false; };
  }, []);

  const years=useMemo(()=>["All",...[...new Set(rows.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a))],[rows]);
  const manufacturers=useMemo(()=>["All",...[...new Set(rows.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b))],[rows]);
  const options=useMemo(()=>period==="Monthly"?["All",...MONTHS]:period==="Quarterly"?INDUSTRY_QUARTERS:period==="Half-Yearly"?INDUSTRY_HALVES:period==="Annual"?["All"]:[],[period]);
  const filters={period,periodValue,year,customFrom,customTo};
  const allManufacturerRows=useMemo(()=>filterHistoryRows(rows,{...filters,key:"manufacturer",value:"All"}),[rows,period,periodValue,year,customFrom,customTo]);
  const selectedManufacturers = manufacturerSelection.length ? manufacturerSelection : manufacturers.slice(1);
  const manufacturerLabel = manufacturerSelection.length === 0 ? "All" : manufacturerSelection.length === 1 ? manufacturerSelection[0] : `${manufacturerSelection.length} selected`;
  const filtered=useMemo(
    ()=>allManufacturerRows.filter(row => selectedManufacturers.includes(row.manufacturer)),
    [allManufacturerRows, manufacturerSelection, manufacturers]
  );
  const grouped=useMemo(()=>{const m=new Map();for(const r of filtered)m.set(r.manufacturer,(m.get(r.manufacturer)||0)+Number(r.units||0));const total=[...m.values()].reduce((a,b)=>a+b,0);return [...m.entries()].map(([manufacturer,units])=>({manufacturer,units,share:total?units/total*100:0})).filter(r=>r.units>0).sort((a,b)=>b.units-a.units)},[filtered]);
  const total=grouped.reduce((s,r)=>s+r.units,0);
  function rowStatus(row) {
    const now = new Date();
    const yearNumber = Number(row.year);
    let startMonth = 1;
    let endMonth = 12;
    if (period === "Monthly") {
      const monthIndex = MONTHS.indexOf(row.label);
      if (monthIndex >= 0) startMonth = endMonth = monthIndex + 1;
    } else if (period === "Quarterly" && /^Q[1-4]$/.test(row.label)) {
      startMonth = (Number(row.label.slice(1)) - 1) * 3 + 1;
      endMonth = startMonth + 2;
    } else if (period === "Half-Yearly" && /^H[12]$/.test(row.label)) {
      startMonth = row.label === "H1" ? 1 : 7;
      endMonth = row.label === "H1" ? 6 : 12;
    } else if (period === "Custom Period") {
      if (!customFrom || !customTo) return "FORECAST";
      return customTo < now.toISOString().slice(0,10) ? "COMPLETED" : "FORECAST";
    }
    const periodEnd = new Date(yearNumber, endMonth, 0);
    return periodEnd < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? "COMPLETED" : "FORECAST";
  }

  const breakdownRows=useMemo(()=>{
    const source=filtered;
    const denominator=manufacturerSelection.length > 0 ? allManufacturerRows : null;
    const map=new Map();
    const totals=new Map();

    const periodKey=(row)=>{
      const date=String(row.sales_period);
      const y=date.slice(0,4);
      const m=Number(date.slice(5,7));
      if(period==="Monthly") return {key:`${y}-${date}`,label:MONTHS[m-1]||date,year:y};
      if(period==="Quarterly"){const q=`Q${Math.floor((m-1)/3)+1}`;return {key:`${y}-${q}`,label:q,year:y};}
      if(period==="Half-Yearly"){const h=m<=6?"H1":"H2";return {key:`${y}-${h}`,label:h,year:y};}
      if(period==="Annual") return {key:y,label:y,year:y};
      return {key:date,label:date,year:y};
    };

    for(const row of source){
      const p=periodKey(row);
      map.set(p.key,{key:p.key,year:p.year,label:p.label,units:(map.get(p.key)?.units||0)+Number(row.units||0)});
    }

    if(denominator){
      for(const row of denominator){
        const p=periodKey(row);
        totals.set(p.key,(totals.get(p.key)||0)+Number(row.units||0));
      }
    }

    return [...map.values()].filter(r=>r.units>0).map(r=>({...r,total:manufacturerSelection.length===0?r.units:(totals.get(r.key)||0)})).sort((a,b)=>a.key.localeCompare(b.key));
  },[filtered,allManufacturerRows,manufacturerSelection,period]);

  const matrixPeriodKey = row => {
    const date = String(row.sales_period);
    const y = date.slice(0, 4);
    const m = Number(date.slice(5, 7));
    if (period === "Annual" || row.period_type === "ANNUAL") return { key: y, label: y, sort: y + "-00" };
    if (period === "Quarterly") {
      const q = "Q" + Math.floor((m - 1) / 3 + 1);
      return { key: y + "-" + q, label: q + "'" + y.slice(2), sort: y + "-" + String(Math.floor((m - 1) / 3 + 1)).padStart(2, "0") };
    }
    if (period === "Half-Yearly") {
      const h = m <= 6 ? "H1" : "H2";
      return { key: y + "-" + h, label: h + "'" + y.slice(2), sort: y + "-" + (h === "H1" ? "01" : "07") };
    }
    return { key: y + "-" + String(m).padStart(2, "0"), label: MONTHS[m - 1] + "'" + y.slice(2), sort: y + "-" + String(m).padStart(2, "0") };
  };
  const matrixSource = period === "Annual"
    ? rows.filter(r => (year.includes("All") || year.includes(String(r.sales_period).slice(0,4))) && (r.period_type === "ANNUAL" || r.period_type === "MONTHLY"))
    : allManufacturerRows;
  const matrixColumns = useMemo(() => {
    const map = new Map();
    for (const row of matrixSource) {
      const p = matrixPeriodKey(row);
      map.set(p.key, p);
    }
    return [...map.values()].sort((a,b) => a.sort.localeCompare(b.sort));
  }, [matrixSource, period]);
  const matrixRows = useMemo(() => {
    const map = new Map();
    for (const row of matrixSource) {
      if (manufacturerSelection.length && !manufacturerSelection.includes(row.manufacturer)) continue;
      const p = matrixPeriodKey(row);
      const key = row.manufacturer;
      if (!map.has(key)) map.set(key, { manufacturer: key, values: {} });
      const item = map.get(key);
      item.values[p.key] = (item.values[p.key] || 0) + Number(row.units || 0);
    }
    return [...map.values()].sort((a,b) => {
      const totalA = Object.values(a.values).reduce((s,v)=>s+v,0);
      const totalB = Object.values(b.values).reduce((s,v)=>s+v,0);
      return totalB-totalA || a.manufacturer.localeCompare(b.manufacturer);
    });
  }, [matrixSource, period]);
  const matrixTotals = useMemo(() => {
    const values = {};
    for (const row of matrixSource) {
      const p = matrixPeriodKey(row);
      values[p.key] = (values[p.key] || 0) + Number(row.units || 0);
    }
    return values;
  }, [matrixSource, period]);
  const matrixYtd = item => Object.values(item.values).reduce((sum,value)=>sum+value,0);

  const yearLabel=year.length===0?"All":year.length===1?year[0]:String(year.length)+" selected";
  const label=period==="Custom Period"?"Custom Period":period==="Annual"?"Annual":periodValue.includes("All")?"All / YTD":periodValue.join(", ");

  function changePeriod(v){setPeriod(v);setPeriodValue("All");}

  function exportManufacturer() {
    const header = ["Manufacturer", ...matrixColumns.map(p => p.label), "YTD"];
    const lines = [header, ...matrixRows.map(item => [item.manufacturer, ...matrixColumns.map(p => item.values[p.key] ?? ""), matrixYtd(item)]), ["INDUSTRY TOTAL", ...matrixColumns.map(p => matrixTotals[p.key] ?? ""), Object.values(matrixTotals).reduce((s,v)=>s+v,0)]];
    const csvEscape = value => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = lines.map(row => row.map(csvEscape).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `manufacturer-matrix-${yearLabel}-${period.toLowerCase().replace(/\\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="cockpit">
    <header className="header"><div><div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div><h1>Manufacturer History</h1><p className="subtitle">Historical manufacturer movement — 1991 onward</p>{cachedAt&&<div className="dataFreshness">{refreshing?"Showing cached data · refreshing in background":"Updated "+new Date(cachedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>}</div><div className="headerStatus"><span className={loading?"statusDot loadingDot":"statusDot"}/>{loading?"Loading manufacturer history":refreshing?"Refreshing manufacturer history":error?"Data error":"Historical data connected"}</div></header>
    <CockpitNavigation active={"/industry/manufacturers"} />
    <section className="filters">
      <div className="filter"><label>Period</label><select value={period} onChange={e=>changePeriod(e.target.value)}>{INDUSTRY_PERIODS.map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="filter"><MultiSelect label="Manufacturer" options={manufacturers.slice(1)} value={manufacturerSelection} onChange={setManufacturerSelection} /></div>
      <div className="filter">{period==="Custom Period"?<><label>Custom Period</label><div className="customDates"><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></div></>:<MultiSelect label={period==="Monthly"?"Month":period==="Quarterly"?"Quarter":"Half-Year"} options={options} value={periodValue} onChange={setPeriodValue} />}</div>
      <div className="filter"><MultiSelect label="Year" options={years.filter(x=>x!=="All")} value={year} onChange={setYear} /></div>
    </section>
    <section className="industrySummaryGrid"><div className="queryCard"><div className="eyebrow">MANUFACTURER TIV</div><h2>{manufacturerLabel}</h2><strong className="industryHeadline">{fmt(total)}</strong><p>{label} · {yearLabel}</p></div><div className="queryCard"><div className="eyebrow">HISTORICAL LAYER</div><h2>1991 → 2026</h2><p>Annual 1991–1996 · monthly 1997 onward.</p></div></section>
    {error&&<div className="errorBanner">{error}</div>}
    <section>
      <div className="sectionHeading">
        <div><h2>Manufacturer-wise monthly movement</h2><p className="subtitle">Each manufacturer on one row · monthly volumes across columns · ranked by selected-period sales</p></div>
        <button type="button" className="secondaryButton" onClick={exportManufacturer} disabled={loading || !matrixRows.length}>Export Matrix CSV</button>
      </div>
      <div className="manufacturerMatrixCard">
        {matrixColumns.length ? <div className="manufacturerMatrixScroll">
          <table className="manufacturerMatrix">
            <thead><tr><th>Manufacturer</th>{matrixColumns.map(p=><th key={p.key}>{p.label}</th>)}<th className="manufacturerMatrixYtd">YTD / Total</th></tr></thead>
            <tbody>
              {matrixRows.map(item=><tr key={item.manufacturer}>
                <th scope="row">{item.manufacturer}</th>
                {matrixColumns.map(p=><td key={p.key}>{item.values[p.key] == null ? "—" : fmt(item.values[p.key])}</td>)}
                <td className="manufacturerMatrixYtd">{fmt(matrixYtd(item))}</td>
              </tr>)}
            </tbody>
            <tfoot><tr><th>INDUSTRY TOTAL</th>{matrixColumns.map(p=><td key={p.key}>{fmt(matrixTotals[p.key] || 0)}</td>)}<td className="manufacturerMatrixYtd">{fmt(Object.values(matrixTotals).reduce((s,v)=>s+v,0))}</td></tr></tfoot>
          </table>
        </div> : <div className="industryEmpty">{loading ? "Loading..." : "No manufacturer data is available for the selected filters."}</div>}
      </div>
      <p className="manufacturerMatrixNote">Missing periods are shown as dashes, not zero. The YTD / Total column sums the periods currently included in the selection.</p>
    </section>
    <footer><span>Manufacturer filters mirror the Sales Cockpit period structure.</span><span>1991–1996 annual · 1997 onward monthly</span></footer>
  </main>;
}