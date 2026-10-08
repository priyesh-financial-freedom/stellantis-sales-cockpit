"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readClientCache, writeClientCache } from "../../../lib/clientCache";
import { supabase } from "../../../lib/supabase";
import { INDUSTRY_HALVES, INDUSTRY_PERIODS, INDUSTRY_QUARTERS, MONTHS, filterHistoryRows } from "../../../lib/industryData";
import MultiSelect from "../../../components/MultiSelect";

const MANUFACTURER_CACHE_KEY = "industry-manufacturer-history-v1";

const fmt = value => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

export default function ManufacturerHistoryPage() {
  const [rows,setRows]=useState([]), [period,setPeriod]=useState("Monthly"), [manufacturerSelection,setManufacturerSelection]=useState([]), [periodValue,setPeriodValue]=useState(["All"]), [year,setYear]=useState(["2026"]), [customFrom,setCustomFrom]=useState(""), [customTo,setCustomTo]=useState(""), [loading,setLoading]=useState(true), [error,setError]=useState("");

  const [refreshing,setRefreshing]=useState(false), [cachedAt,setCachedAt]=useState(null);

  useEffect(()=>{ 
    let active=true;
    const cached=readClientCache(MANUFACTURER_CACHE_KEY);
    if(cached?.data?.length){
      setRows(cached.data); setCachedAt(cached.cachedAt); setLoading(false); setRefreshing(true);
      const ys=[...new Set(cached.data.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a));
      if(ys.length)setYear([ys[0]]);
    }
    async function loadAll(){
      const out=[];
      for(let from=0;;from+=1000){
        const {data,error}=await supabase.from("industry_manufacturer_history_v2").select("sales_period,manufacturer,units,period_type,record_type").eq("record_type","MANUFACTURER").order("sales_period").order("manufacturer").range(from,from+999);
        if(error) throw error;
        out.push(...(data||[]));
        if(!data||data.length<1000) break;
      }
      return out;
    }
    loadAll().then(x=>{
      if(!active)return;
      setRows(x); writeClientCache(MANUFACTURER_CACHE_KEY,x); setCachedAt(Date.now()); setRefreshing(false);
      const ys=[...new Set(x.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a));
      if(ys.length)setYear([ys[0]]);
    }).catch(e=>{if(active){setRefreshing(false);if(!cached?.data?.length)setError(e.message)}}).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[]);

  const years=useMemo(()=>["All",...[...new Set(rows.map(r=>String(r.sales_period).slice(0,4)))].sort((a,b)=>b.localeCompare(a))],[rows]);
  const manufacturers=useMemo(()=>["All",...[...new Set(rows.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b))],[rows]);
  const options=useMemo(()=>period==="Monthly"?["All",...MONTHS]:period==="Quarterly"?INDUSTRY_QUARTERS:period==="Half-Yearly"?INDUSTRY_HALVES:period==="Annual"?["All"]:[],[period]);
  const filters={period,periodValue,year,customFrom,customTo};
  const allManufacturerRows=useMemo(()=>filterHistoryRows(rows,{...filters,key:"manufacturer",value:"All"}),[rows,period,periodValue,year,customFrom,customTo]);
  const selectedManufacturers = manufacturerSelection.length ? manufacturerSelection : manufacturers.slice(1);
  const manufacturerLabel = manufacturerSelection.length === 0 ? "All" : manufacturerSelection.length === 1 ? manufacturerSelection[0] : `${manufacturerSelection.length} selected`;
  const yearLabel = year.length === 0 ? "All" : year.length === 1 ? year[0] : `${year.length} selected`;
  const filtered=useMemo(
    ()=>allManufacturerRows.filter(row => selectedManufacturers.includes(row.manufacturer)),
    [allManufacturerRows, manufacturerSelection, manufacturers]
  );
  const grouped=useMemo(()=>{const m=new Map();for(const r of filtered)m.set(r.manufacturer,(m.get(r.manufacturer)||0)+Number(r.units||0));const total=[...m.values()].reduce((a,b)=>a+b,0);return [...m.entries()].map(([manufacturer,units])=>({manufacturer,units,share:total?units/total*100:0})).filter(r=>r.units>0).sort((a,b)=>b.units-a.units)},[filtered]);
  const total=grouped.reduce((s,r)=>s+r.units,0);

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

  const label=period==="Custom Period"?"Custom Period":period==="Annual"?"Annual":periodValue.includes("All")?"All / YTD":periodValue.join(", ");

  function changePeriod(v){setPeriod(v);setPeriodValue(["All"]);}

  function exportManufacturer() {
    const source = filtered;
    const rows = source.map(row => ({
      sales_period: row.sales_period,
      manufacturer: row.manufacturer,
      units: row.units,
    }));
    const csvEscape = value => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = [
      ["sales_period", "manufacturer", "units"].join(","),
      ...rows.map(row => [row.sales_period, row.manufacturer, row.units].map(csvEscape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `manufacturer-${yearLabel}-${period.toLowerCase().replace(/\s+/g, "-")}-${manufacturerSelection.length === 0 ? "all" : manufacturerSelection.join("-").replace(/\s+/g, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="cockpit">
    <header className="header"><div><div className="eyebrow">STELLANTIS INDIA · INDUSTRY INTELLIGENCE</div><h1>Manufacturer History</h1><p className="subtitle">Historical manufacturer movement — 1991 onward</p>{cachedAt&&<div className="dataFreshness">{refreshing?"Showing cached data · refreshing in background":"Updated "+new Date(cachedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>}</div><div className="headerStatus"><span className={loading?"statusDot loadingDot":"statusDot"}/>{loading?"Loading manufacturer history":refreshing?"Refreshing manufacturer history":error?"Data error":"Historical data connected"}</div></header>
    <nav className="cockpitNav"><Link href="/">Sales Cockpit</Link><Link href="/model-wise/jeep">Jeep Model Wise</Link><Link href="/model-wise/citroen">Citroën Model Wise</Link><Link href="/industry">Industry</Link><Link className="active" href="/industry/manufacturers">Manufacturer History</Link><Link href="/data-entry">Data Entry</Link></nav>
    <section className="filters">
      <div className="filter"><label>Period</label><select value={period} onChange={e=>changePeriod(e.target.value)}>{INDUSTRY_PERIODS.map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="filter"><MultiSelect label="Manufacturer" options={manufacturers.slice(1)} value={manufacturerSelection} onChange={setManufacturerSelection} /></div>
      <div className="filter">{period==="Custom Period"?<><label>Custom Period</label><div className="customDates"><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></div></>:<MultiSelect label={period==="Monthly"?"Month":period==="Quarterly"?"Quarter":"Half-Year"} options={options} value={periodValue} onChange={setPeriodValue} />}</div>
      <div className="filter"><MultiSelect label="Year" options={years.filter(x=>x!=="All")} value={year} onChange={setYear} /></div>
    </section>
    <section className="industrySummaryGrid"><div className="queryCard"><div className="eyebrow">MANUFACTURER TIV</div><h2>{manufacturerLabel}</h2><strong className="industryHeadline">{fmt(total)}</strong><p>{label} · {yearLabel}</p></div><div className="queryCard"><div className="eyebrow">HISTORICAL LAYER</div><h2>1991 → 2026</h2><p>Annual 1991–1996 · monthly 1997 onward.</p></div></section>
    {error&&<div className="errorBanner">{error}</div>}
    <section><div className="sectionHeading"><div><h2>Manufacturer movement</h2><p className="subtitle">Source: comp.xlsx · Master-Sep26</p></div><button type="button" className="secondaryButton" onClick={exportManufacturer} disabled={loading || !filtered.length}>Export CSV</button></div><div className="tableCard">
      {breakdownRows.length ? <>
        <div className="industryBreakdownHeader"><div>Year</div><div>Period</div><div>{manufacturerSelection.length===0?"Industry":"Manufacturer"}</div><div>Units</div><div>Share</div></div>
        {breakdownRows.map(r=><div className="industryBreakdownRow" key={r.key}>
          <div>{r.year}</div><div>{r.label}</div><div className="scopeName">{manufacturerSelection.length===0?"Industry":manufacturerLabel}</div><div>{fmt(r.units)}</div><div>{r.total?((r.units/r.total)*100).toFixed(1)+"%":"—"}</div>
        </div>)}
      </> : <div className="industryEmpty">{loading?"Loading...":"No manufacturer data is available for the selected filters."}</div>}
    </div></section>
    <footer><span>Manufacturer filters mirror the Sales Cockpit period structure.</span><span>1991–1996 annual · 1997 onward monthly</span></footer>
  </main>;
}