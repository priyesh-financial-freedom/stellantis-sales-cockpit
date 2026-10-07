"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS, filterHistoryRows } from "../../../lib/industryData";

const fmt = value => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

export default function ManufacturerHistoryPage() {
  const [rows,setRows]=useState([]), [period,setPeriod]=useState("Monthly"), [manufacturer,setManufacturer]=useState("All"), [periodValue,setPeriodValue]=useState("All"), [year,setYear]=useState("2026"), [customFrom,setCustomFrom]=useState(""), [customTo,setCustomTo]=useState(""), [loading,setLoading]=useState(true), [error,setError]=useState("");

  useEffect(()=>{ let active=true; async function loadAll(){const out=[]; for(let from=0;;from+=1000){const {data,error}=await supabase.from("industry_manufacturer_history_v2").select("sales_period,manufacturer,units,period_type,record_type").eq("record_type","MANUFACTURER").order("sales_period").order("manufacturer").range(from,from+999); if(error) throw error; out.push(...(data||[])); if(!data||data.length<1000) break;} return out;} loadAll().then(x=>{if(!active)return;setRows(x); const ys=[...new Set(x.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a)); if(ys.length)setYear(ys[0]);}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false)); return()=>{active=false};},[]);

  const years=useMemo(()=>["All",...[...new Set(rows.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a))],[rows]);
  const manufacturers=useMemo(()=>["All",...[...new Set(rows.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b))],[rows]);
  const options=useMemo(()=>period==="Monthly"?["All",...MONTHS]:period==="Quarterly"?INDUSTRY_QUARTERS:period==="Half-Yearly"?INDUSTRY_HALVES:period==="Annual"?["All"]:[],[period]);
  const filters={period,periodValue,year,customFrom,customTo};
  const filtered=useMemo(()=>filterHistoryRows(rows,{...filters,key:"manufacturer",value:manufacturer}),[rows,period,periodValue,year,customFrom,customTo,manufacturer]);
  const grouped=useMemo(()=>{const m=new Map();for(const r of filtered)m.set(r.manufacturer,(m.get(r.manufacturer)||0)+Number(r.units||0));const total=[...m.values()].reduce((a,b)=>a+b,0);return [...m.entries()].map(([manufacturer,units])=>({manufacturer,units,share:total?units/total*100:0})).filter(r=>r.units>0).sort((a,b)=>b.units-a.units)},[filtered]);
  const total=grouped.reduce((s,r)=>s+r.units,0);
  const label=period==="Custom Period"?"Custom Period":period==="Annual"?"Annual":periodValue==="All"?"All / YTD":periodValue;

  function changePeriod(v){setPeriod(v);setPeriodValue("All");}

  return <main className="cockpit">
    <header className="header"><div><div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div><h1>Manufacturer History</h1><p className="subtitle">Historical manufacturer movement — 1991 onward</p></div><div className="headerStatus"><span className={loading?"statusDot loadingDot":"statusDot"}/>{loading?"Loading manufacturer history":error?"Data error":"Historical data connected"}</div></header>
    <nav className="cockpitNav"><Link href="/">Sales Cockpit</Link><Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link><Link href="/industry">Industry</Link><Link className="active" href="/industry/manufacturers">Manufacturer History</Link><Link href="/data-entry">Data Entry</Link></nav>
    <section className="filters">
      <div className="filter"><label>Period</label><select value={period} onChange={e=>changePeriod(e.target.value)}>{INDUSTRY_PERIODS.map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="filter"><label>Manufacturer</label><select value={manufacturer} onChange={e=>setManufacturer(e.target.value)}>{manufacturers.map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="filter"><label>{period==="Monthly"?"Month":period==="Quarterly"?"Quarter":"Half-Year"}</label>{period==="Custom Period"?<div className="customDates"><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></div>:<select value={periodValue} onChange={e=>setPeriodValue(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select>}</div>
      <div className="filter"><label>Year</label><select value={year} onChange={e=>setYear(e.target.value)}>{years.map(x=><option key={x}>{x}</option>)}</select></div>
    </section>
    <section className="industrySummaryGrid"><div className="queryCard"><div className="eyebrow">MANUFACTURER TIV</div><h2>{manufacturer}</h2><strong className="industryHeadline">{fmt(total)}</strong><p>{label} · {year}</p></div><div className="queryCard"><div className="eyebrow">HISTORICAL LAYER</div><h2>1991 → 2026</h2><p>Annual 1991–1996 · monthly 1997 onward.</p></div></section>
    {error&&<div className="errorBanner">{error}</div>}
    <section><div className="sectionHeading"><div><h2>Manufacturer movement</h2><p className="subtitle">Source: comp.xlsx · Master-Sep26</p></div></div><div className="tableCard"><div className="industryTableHeader"><div>Manufacturer</div><div>Units</div><div>Share</div></div>{grouped.length?grouped.map(r=><div className="industryTableRow" key={r.manufacturer}><div className="scopeName">{r.manufacturer}</div><div>{fmt(r.units)}</div><div>{r.share.toFixed(1)}%</div></div>):<div className="industryEmpty">{loading?"Loading...":"No manufacturer data is available for the selected filters."}</div>}</div></section>
    <footer><span>Manufacturer filters mirror the Sales Cockpit period structure.</span><span>1991–1996 annual · 1997 onward monthly</span></footer>
  </main>;
}