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
  const [expandedModels,setExpandedModels] = useState({});
  const [expandedVariants,setExpandedVariants] = useState({});
  const [showMobileFilters,setShowMobileFilters] = useState(false);
  const brands = ["All","Jeep","Citroën"];
  const models = useMemo(()=>["All",...new Set(RETAIL_VARIANTS.filter(r=>brand==="All"||r.brand===brand).map(r=>r.model))],[brand]);
  const activeMonthByBrand = useMemo(()=>{
    const result = new Map();
    for (const b of ["Jeep","Citroën"]) {
      const active = MONTHS.map((_,i)=>RETAIL_VARIANTS.some(r=>r.brand===b&&(r.months[i]??0)>0)?i:-1).filter(i=>i>=0);
      result.set(b,active.length?Math.max(...active):-1);
    }
    return result;
  },[]);
  const activeMonth = brand==="All"
    ? Math.max(activeMonthByBrand.get("Jeep")??-1,activeMonthByBrand.get("Citroën")??-1)
    : (activeMonthByBrand.get(brand)??-1);
  const monthIndexes = useMemo(()=>{
    const activeLimit = activeMonth;
    let requested;
    if(period==="Monthly") requested = periodValue==="All" ? MONTHS.map((_,i)=>i) : [Number(periodValue)];
    else if(period==="Quarterly") { const start=Number(periodValue)*3; requested=[start,start+1,start+2]; }
    else if(period==="Half-Yearly") { const start=Number(periodValue)*6; requested=[start,start+1,start+2,start+3,start+4,start+5]; }
    else if(period==="Annual") requested=MONTHS.map((_,i)=>i);
    else { const start=Math.min(Number(fromMonth),Number(toMonth)), end=Math.max(Number(fromMonth),Number(toMonth)); requested=MONTHS.map((_,i)=>i).filter(i=>i>=start&&i<=end); }
    return requested.filter(i=>i<=activeLimit);
  },[period,periodValue,fromMonth,toMonth,activeMonth]);
  const rows = useMemo(()=>RETAIL_VARIANTS.filter(r=>(brand==="All"||r.brand===brand)&&(model==="All"||r.model===model)&&(`${r.variant} ${r.model}`).toLowerCase().includes(variantSearch.toLowerCase())).map(r=>({...r,total:monthIndexes.reduce((sum,i)=>sum+(r.months[i]??0),0)})).filter(r=>r.total>0).sort((a,b)=>a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model)||a.variant.localeCompare(b.variant)),[brand,model,variantSearch,monthIndexes]);
  const rollingContribution = useMemo(()=>{
    // A month is considered available for the rolling window when the source
    // contains positive retail activity across the dataset. Trailing zero-filled
    // months must not displace the latest genuinely populated months.
    const activeMonths = MONTHS.map((_,i)=>({
      index:i,
      total:RETAIL_VARIANTS.reduce((sum,r)=>sum+(r.months[i]??0),0)
    })).filter(m=>m.total>0).map(m=>m.index).slice(-3);
    const totals = new Map();
    RETAIL_VARIANTS.forEach(r=>{
      const key = r.brand+"|"+r.model;
      const value = activeMonths.reduce((sum,i)=>sum+(r.months[i]??0),0);
      totals.set(key,(totals.get(key)||0)+value);
    });
    return {indexes:activeMonths,totals};
  },[]);
  const contributionFor = r => {
    const key = r.brand+"|"+r.model;
    const indexes = rollingContribution.indexes;
    const value = indexes.reduce((sum,i)=>sum+(r.months[i]??0),0);
    const denominator = rollingContribution.totals.get(key)||0;
    const pct = denominator>0 ? value/denominator*100 : 0;
    return {pct,tier:pct<10?"low":pct<=25?"mid":"high",months:indexes.map(i=>MONTHS[i])};
  };
  const grandTotal = rows.reduce((sum,r)=>sum+r.total,0);
  const comparisonPeriods = useMemo(() => {
    if (period === "Monthly") return MONTHS.map((label,i)=>({label,indexes:[i]})).filter(p=>p.indexes[0]<=activeMonth);
    if (period === "Quarterly") return ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"].map((label,q)=>({label,indexes:[q*3,q*3+1,q*3+2].filter(i=>i<=activeMonth)})).filter(p=>p.indexes.length>0);
    if (period === "Half-Yearly") return ["H1 (Jan–Jun)","H2 (Jul–Dec)"].map((label,h)=>({label,indexes:Array.from({length:6},(_,i)=>h*6+i).filter(i=>i<=activeMonth)})).filter(p=>p.indexes.length>0);
    if (period === "Annual") return [{label:"Year to date",indexes:MONTHS.map((_,i)=>i).filter(i=>i<=activeMonth)}];
    return monthIndexes.map(i=>({label:MONTHS[i],indexes:[i]}));
  },[period,monthIndexes,activeMonth]);
  const comparisonRows = useMemo(()=>RETAIL_VARIANTS.filter(r=>(brand==="All"||r.brand===brand)&&(model==="All"||r.model===model)&&((r.variant+" "+r.model).toLowerCase().includes(variantSearch.toLowerCase()))).map(r=>({...r,periodTotals:comparisonPeriods.map(p=>p.indexes.reduce((sum,i)=>sum+(r.months[i]??0),0))})).filter(r=>r.periodTotals.some(value=>value>0)).sort((a,b)=>a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model)||a.variant.localeCompare(b.variant)),[brand,model,variantSearch,comparisonPeriods]);
  const groupedComparisonRows = useMemo(()=>{
    const groups = new Map();
    comparisonRows.forEach(r=>{
      const key = r.brand+"|"+r.model;
      if(!groups.has(key)) groups.set(key,{key,brand:r.brand,model:r.model,rows:[]});
      groups.get(key).rows.push(r);
    });
    return [...groups.values()];
  },[comparisonRows]);
  const periodLabel = period==="Monthly"?(periodValue==="All"?"All months":MONTHS[Number(periodValue)]):period==="Quarterly"?["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"][Number(periodValue)]:period==="Half-Yearly"?["H1 (Jan–Jun)","H2 (Jul–Dec)"][Number(periodValue)]:period==="Annual"?"Full year":"Custom range";
  return <main className="pageShell pricesPage variantRetailPage">
    <header className="pageHeader"><div><h1>Variant-wise Retail</h1><p className="subtitle">Monthly variant retail performance · Jeep and Citroën · 2026</p></div></header>
    <CockpitNavigation active="Variant-wise Retail" />
    <section className="pricesNotice"><strong>Retail data only</strong><span>Monthly retail volumes by model and variant. Blank source cells are shown as unavailable (—); reported zeroes remain zero. Months after the latest month with positive retail activity for the selected brand are hidden.</span></section>
    <button type="button" className="variantFiltersToggle" aria-expanded={showMobileFilters} onClick={()=>setShowMobileFilters(v=>!v)}><span>Filters</span><span>{[period,brand,model].join(" · ")}</span><strong>{showMobileFilters?"Hide −":"Edit +"} </strong></button>
    <section className={"pricesFilters variantRetailFilters"+(showMobileFilters?" isOpen":"")}>
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
    <section className="variantRetailSummary"><div><span>Period</span><strong>{periodLabel}</strong></div><div><span>Variants shown</span><strong>{rows.length}</strong></div><div><span>Retail in selected period</span><strong>{fmt(grandTotal)}</strong></div></section>
    <div className="contributionLegend"><span className="low"><i/>Red: under 10%</span><span className="mid"><i/>Orange: 10%–25%</span><span className="high"><i/>Deep green: over 25%</span><span>Share of that model’s retail across its latest 3 populated months</span></div>
    <section className="variantComparePanel">
      <div className="variantCompareHeading"><div><h2>Variant performance</h2><p className="variantCompareHelp">Tap a variant to inspect period changes.</p></div></div>
      <div className="variantModelGroups">
        {groupedComparisonRows.map(group=>{
          const expanded=expandedModels[group.key]!==false;
          return <section className="variantModelGroup" key={group.key}>
            <button type="button" className="variantModelToggle" aria-expanded={expanded} onClick={()=>setExpandedModels(prev=>({...prev,[group.key]:!expanded}))}><span className="variantModelName">{group.model}</span><span className="variantModelMeta">{group.rows.length} variants</span><span className="variantModelChevron">{expanded?"−":"+"}</span></button>
            {expanded&&<div className="variantModelMatrix">
              <div className="variantMatrixScrollHint">Swipe sideways to see all periods →</div>
              <div className="variantMatrixHeader" style={{gridTemplateColumns:`minmax(168px,2.2fr) repeat(${comparisonPeriods.length},minmax(42px,.6fr)) minmax(64px,.8fr)`}}><span>Variant</span>{comparisonPeriods.map(p=><span key={p.label}>{p.label.replace(/ \([^)]*\)/g,"")}</span>)}<span>Mix</span></div>
              {group.rows.map(r=>{
                const contribution=contributionFor(r);
                const variantKey=group.key+"|"+r.variant;
                const detailOpen=!!expandedVariants[variantKey];
                return <div className="variantMatrixEntry" key={variantKey}>
                  <button type="button" className="variantMatrixRow" style={{gridTemplateColumns:`minmax(168px,2.2fr) repeat(${comparisonPeriods.length},minmax(42px,.6fr)) minmax(64px,.8fr)`}} onClick={()=>setExpandedVariants(prev=>({...prev,[variantKey]:!prev[variantKey]}))} aria-expanded={detailOpen}>
                    <span className="variantMatrixVariant">{r.variant}</span>{r.periodTotals.map((value,i)=><span className="variantMatrixNumber" key={comparisonPeriods[i].label}>{fmt(value)}</span>)}<span className={"variantMatrixMix mix-"+contribution.tier}><i/>{contribution.pct.toFixed(1)}%</span>
                  </button>
                  {detailOpen&&<div className="variantExpandedDetail"><div className="variantExpandedPeriods">{comparisonPeriods.map((p,i)=><span key={p.label}><small>{p.label}</small><strong>{fmt(r.periodTotals[i])}</strong></span>)}</div>
                    {comparisonPeriods.length>1&&<div className="variantPeriodChanges">{comparisonPeriods.slice(1).map((p,i)=>{const previous=r.periodTotals[i],current=r.periodTotals[i+1],delta=current-previous;const pct=previous===0?null:delta/previous*100;return <span key={p.label}>{comparisonPeriods[i].label.replace(/ \([^)]*\)/g,"")} → {p.label.replace(/ \([^)]*\)/g,"")}: <strong className={delta>0?"trendUp":delta<0?"trendDown":""}>{delta>0?"+":""}{fmt(delta)}{pct==null?"":" ("+(pct>0?"+":"")+pct.toFixed(1)+"%)"}</strong></span>;})}</div>}
                    <div className="variantMixDetail">Rolling 3-month model mix: <strong className={"mix-"+contribution.tier}>{contribution.pct.toFixed(1)}%</strong></div></div>}
                </div>;
              })}
            </div>}
          </section>;
        })}
        {!groupedComparisonRows.length&&<p className="pricesEmptyCell">No variants match these filters.</p>}
      </div>
      <div className="pricesTableScroll variantCompareDesktopTable"><table className="pricesTable variantCompareTable"><thead><tr><th>Brand</th><th>Model</th><th>Variant</th>{comparisonPeriods.map(p=><th key={p.label}>{p.label}</th>)}</tr></thead><tbody>{comparisonRows.map(r=><tr className={"contribution-"+contributionFor(r).tier} key={"compare|"+r.brand+"|"+r.model+"|"+r.variant}><td>{r.brand}</td><td><strong>{r.model}</strong></td><td className="priceVariantCell">{r.variant}</td>{r.periodTotals.map((value,i)=><td key={comparisonPeriods[i].label}>{fmt(value)}</td>)}</tr>)}{!comparisonRows.length&&<tr><td colSpan={comparisonPeriods.length+3} className="pricesEmptyCell">No variants match these filters.</td></tr>}</tbody></table></div>
    </section>
    <section className="pricesTableWrap"><div className="pricesSectionHeading"><h2>Variant retail matrix</h2><span>Units · {year}</span></div><div className="pricesTableScroll"><table className="pricesTable variantRetailTable"><thead><tr><th>Brand</th><th>Model</th><th>Variant</th>{monthIndexes.map(i=><th key={i}>{MONTHS[i]}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((r,i)=><tr className={"contribution-"+contributionFor(r).tier} key={r.brand+"|"+r.model+"|"+r.variant}><td data-label="Brand">{r.brand}</td><td data-label="Model"><strong>{r.model}</strong></td><td data-label="Variant" className={"priceVariantCell contributionCell contribution-"+contributionFor(r,r.total).tier}>{r.variant}<small>{contributionFor(r,r.total).pct.toFixed(1)}% of model</small></td>{monthIndexes.map(m=><td key={m} data-label={MONTHS[m]}>{fmt(r.months[m])}</td>)}<td data-label="Total"><strong>{fmt(r.total)}</strong></td></tr>)}{!rows.length&&<tr><td colSpan={monthIndexes.length+4} className="pricesEmptyCell">No variants match these filters.</td></tr>}</tbody></table></div></section>
    <p className="pricesStorageNote">Source: uploaded 2026 variant-wise retail workbooks. Monthly figures are preserved as supplied. Period totals sum available numeric monthly values; blanks are excluded from the sum and displayed as —.</p>
  </main>;
}
