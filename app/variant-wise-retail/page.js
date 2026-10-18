"use client";
import { useMemo, useState } from "react";
import CockpitNavigation from "../../components/CockpitNavigation";
import { MONTHS, RETAIL_VARIANTS } from "../../lib/variantRetailData";

const fmt = value => value == null ? "—" : Number(value).toLocaleString("en-IN");
const periods = ["Monthly","Quarterly","Half-Yearly","Annual","Custom Range"];
const monthOptions = MONTHS.map((name,index)=>({name,index}));
export default function VariantWiseRetailPage() {
  const [brand,setBrand] = useState("All");
  const [year,setYear] = useState("2026");
  const [model,setModel] = useState("All");
  const [variantSearch,setVariantSearch] = useState("");
  const [period,setPeriod] = useState("Monthly");
  const [periodValue,setPeriodValue] = useState("All");
  const [fromMonth,setFromMonth] = useState("0");
  const [toMonth,setToMonth] = useState("8");
  const brands = ["All","Jeep","Citroën"];
  const models = useMemo(()=>["All",...new Set(RETAIL_VARIANTS.filter(r=>brand==="All"||r.brand===brand).map(r=>r.model))],[brand]);
  const monthIndexes = useMemo(()=>{
    if(period==="Monthly") return periodValue==="All" ? MONTHS.map((_,i)=>i) : [Number(periodValue)];
    if(period==="Quarterly") { const start=Number(periodValue)*3; return [start,start+1,start+2]; }
    if(period==="Half-Yearly") { const start=Number(periodValue)*6; return [start,start+1,start+2,start+3,start+4,start+5]; }
    if(period==="Annual") return MONTHS.map((_,i)=>i);
    const start=Math.min(Number(fromMonth),Number(toMonth)), end=Math.max(Number(fromMonth),Number(toMonth));
    return MONTHS.map((_,i)=>i).filter(i=>i>=start&&i<=end);
  },[period,periodValue,fromMonth,toMonth]);
  const rows = useMemo(()=>RETAIL_VARIANTS.filter(r=>(brand==="All"||r.brand===brand)&&(model==="All"||r.model===model)&&(`${r.variant} ${r.model}`).toLowerCase().includes(variantSearch.toLowerCase())).map(r=>({...r,total:monthIndexes.reduce((sum,i)=>sum+(r.months[i]??0),0)})).sort((a,b)=>a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model)||a.variant.localeCompare(b.variant)),[brand,model,variantSearch,monthIndexes]);
  const grandTotal = rows.reduce((sum,r)=>sum+r.total,0);
  const comparisonPeriods = useMemo(() => {
    if (period === "Monthly") return MONTHS.map((label,i)=>({label,indexes:[i]}));
    if (period === "Quarterly") return ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"].map((label,q)=>({label,indexes:[q*3,q*3+1,q*3+2]}));
    if (period === "Half-Yearly") return ["H1 (Jan–Jun)","H2 (Jul–Dec)"].map((label,h)=>({label,indexes:Array.from({length:6},(_,i)=>h*6+i)}));
    if (period === "Annual") return [{label:"Full year 2026",indexes:MONTHS.map((_,i)=>i)}];
    return monthIndexes.map(i=>({label:MONTHS[i],indexes:[i]}));
  },[period,monthIndexes]);
  const comparisonRows = useMemo(()=>RETAIL_VARIANTS.filter(r=>(brand==="All"||r.brand===brand)&&(model==="All"||r.model===model)&&((r.variant+" "+r.model).toLowerCase().includes(variantSearch.toLowerCase()))).map(r=>({...r,periodTotals:comparisonPeriods.map(p=>p.indexes.reduce((sum,i)=>sum+(r.months[i]??0),0))})).sort((a,b)=>a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model)||a.variant.localeCompare(b.variant)),[brand,model,variantSearch,comparisonPeriods]);
  const periodLabel = period==="Monthly"?(periodValue==="All"?"All months":MONTHS[Number(periodValue)]):period==="Quarterly"?["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"][Number(periodValue)]:period==="Half-Yearly"?["H1 (Jan–Jun)","H2 (Jul–Dec)"][Number(periodValue)]:period==="Annual"?"Full year":"Custom range";
  return <main className="pageShell pricesPage variantRetailPage">
    <header className="pageHeader"><div><h1>Variant-wise Retail</h1><p className="subtitle">Monthly variant retail performance · Jeep and Citroën · 2026</p></div></header>
    <CockpitNavigation active="Variant-wise Retail" />
    <section className="pricesNotice"><strong>Retail data only</strong><span>Monthly retail volumes by model and variant. Blank source cells are shown as unavailable (—); reported zeroes remain zero. October–December values are not assumed where the source is blank.</span></section>
    <section className="pricesFilters variantRetailFilters">
      <label>Period type<select value={period} onChange={e=>{setPeriod(e.target.value);setPeriodValue(e.target.value==="Monthly"?"All":"0");}}>{periods.map(p=><option key={p}>{p}</option>)}</select></label>
      {period==="Monthly"&&<label>Month<select value={periodValue} onChange={e=>setPeriodValue(e.target.value)}><option value="All">All months</option>{monthOptions.map(m=><option key={m.index} value={m.index}>{m.name}</option>)}</select></label>}
      {period==="Quarterly"&&<label>Quarter<select value={periodValue} onChange={e=>setPeriodValue(e.target.value)}>{["Q1 — Jan–Mar","Q2 — Apr–Jun","Q3 — Jul–Sep","Q4 — Oct–Dec"].map((p,i)=><option key={p} value={i}>{p}</option>)}</select></label>}
      {period==="Half-Yearly"&&<label>Half-year<select value={periodValue} onChange={e=>setPeriodValue(e.target.value)}><option value="0">H1 — Jan–Jun</option><option value="1">H2 — Jul–Dec</option></select></label>}
      {period==="Annual"&&<label>Year<select value={year} onChange={e=>setYear(e.target.value)}><option>2026</option></select></label>}
      {period==="Custom Range"&&<><label>From month<select value={fromMonth} onChange={e=>setFromMonth(e.target.value)}>{monthOptions.map(m=><option key={m.index} value={m.index}>{m.name}</option>)}</select></label><label>To month<select value={toMonth} onChange={e=>setToMonth(e.target.value)}>{monthOptions.map(m=><option key={m.index} value={m.index}>{m.name}</option>)}</select></label></>}
      <label>Brand<select value={brand} onChange={e=>{setBrand(e.target.value);setModel("All");}}>{brands.map(b=><option key={b}>{b}</option>)}</select></label>
      <label>Model<select value={model} onChange={e=>setModel(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select></label>
      <label>Search variant<input value={variantSearch} onChange={e=>setVariantSearch(e.target.value)} placeholder="Type variant name"/></label>
    </section>
    <section className="variantComparePanel">
      <div className="variantCompareHeading"><div><h2>Period comparison</h2><p>Automatically follows the period type selected above and compares all periods using the same brand, model and variant filters.</p></div></div>
      <div className="variantCompareMobileCards">{comparisonRows.map(r=><article className="variantCompareMobileCard" key={"mobile|"+r.brand+"|"+r.model+"|"+r.variant}><div className="variantCompareMobileIdentity"><span>{r.brand}</span><strong>{r.model}</strong><b>{r.variant}</b></div><div className="variantCompareMobileValues">{comparisonPeriods.map((p,i)=><div key={p.label}><span>{p.label}</span><strong>{fmt(r.periodTotals[i])}</strong></div>)}</div></article>)}{!comparisonRows.length&&<p className="pricesEmptyCell">No variants match these filters.</p>}</div><div className="pricesTableScroll variantCompareDesktopTable"><table className="pricesTable variantCompareTable"><thead><tr><th>Brand</th><th>Model</th><th>Variant</th>{comparisonPeriods.map(p=><th key={p.label}>{p.label}</th>)}</tr></thead><tbody>{comparisonRows.map(r=><tr key={"compare|"+r.brand+"|"+r.model+"|"+r.variant}><td>{r.brand}</td><td><strong>{r.model}</strong></td><td className="priceVariantCell">{r.variant}</td>{r.periodTotals.map((value,i)=><td key={comparisonPeriods[i].label}>{fmt(value)}</td>)}</tr>)}{!comparisonRows.length&&<tr><td colSpan={comparisonPeriods.length+3} className="pricesEmptyCell">No variants match these filters.</td></tr>}</tbody></table></div>
    </section>
    <section className="variantRetailSummary"><div><span>Period</span><strong>{periodLabel}</strong></div><div><span>Variants shown</span><strong>{rows.length}</strong></div><div><span>Retail in selected period</span><strong>{fmt(grandTotal)}</strong></div></section>
    <section className="pricesTableWrap"><div className="pricesSectionHeading"><h2>Variant retail matrix</h2><span>Units · {year}</span></div><div className="pricesTableScroll"><table className="pricesTable variantRetailTable"><thead><tr><th>Brand</th><th>Model</th><th>Variant</th>{monthIndexes.map(i=><th key={i}>{MONTHS[i]}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.brand+"|"+r.model+"|"+r.variant}><td data-label="Brand">{r.brand}</td><td data-label="Model"><strong>{r.model}</strong></td><td data-label="Variant" className="priceVariantCell">{r.variant}</td>{monthIndexes.map(m=><td key={m} data-label={MONTHS[m]}>{fmt(r.months[m])}</td>)}<td data-label="Total"><strong>{fmt(r.total)}</strong></td></tr>)}{!rows.length&&<tr><td colSpan={monthIndexes.length+4} className="pricesEmptyCell">No variants match these filters.</td></tr>}</tbody></table></div></section>
    <p className="pricesStorageNote">Source: uploaded 2026 variant-wise retail workbooks. Monthly figures are preserved as supplied. Period totals sum available numeric monthly values; blanks are excluded from the sum and displayed as —.</p>
  </main>;
}
