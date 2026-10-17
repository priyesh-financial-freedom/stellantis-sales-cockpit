"use client";

import { useEffect, useMemo, useState } from "react";
import CockpitNavigation from "../../components/CockpitNavigation";
import { JEEP_PRICE_BASELINE, PRICE_LIST_EFFECTIVE_FROM } from "../../lib/jeepPriceList";
import { CITROEN_PRICE_BASELINE, CITROEN_PRICE_LIST_EFFECTIVE_FROM } from "../../lib/citroenPriceList";

const STORAGE_KEY = "stellantis-jeep-price-changes-v1";
const money = value => value == null || value === "" ? "—" : "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dateLabel = value => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const parseDisplayDate = value => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (date.getFullYear() !== Number(yyyy) || date.getMonth() !== Number(mm) - 1 || date.getDate() !== Number(dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
};

export default function PricesPage() {
  const [changes, setChanges] = useState([]);
  const [brand, setBrand] = useState("Jeep");
  const [loaded, setLoaded] = useState(false);
  const [model, setModel] = useState("All");
  const [search, setSearch] = useState("");
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [visibleFields, setVisibleFields] = useState(["gstRate", "dealerMargin", "esp"]);
  const [asOf, setAsOf] = useState(PRICE_LIST_EFFECTIVE_FROM);
  const [asOfText, setAsOfText] = useState("01/10/2026");
  const [showForm, setShowForm] = useState(false);
  const [variantKey, setVariantKey] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [effectiveDateText, setEffectiveDateText] = useState("");
  const [basicPrice, setBasicPrice] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [dealerMargin, setDealerMargin] = useState("");
  const [handlingCharges, setHandlingCharges] = useState("");
  const [ndp, setNdp] = useState("");
  const [esp, setEsp] = useState("");
  const [accessory, setAccessory] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setChanges(JSON.parse(saved));
    } catch { /* Baseline list remains available if local storage is unavailable. */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(changes)); }
    catch { setError("Unable to save changes in this browser. Export or copy the changes before leaving this page."); }
  }, [changes, loaded]);

  const baseline = brand === "Jeep" ? JEEP_PRICE_BASELINE : CITROEN_PRICE_BASELINE;
  const effectiveFrom = brand === "Jeep" ? PRICE_LIST_EFFECTIVE_FROM : CITROEN_PRICE_LIST_EFFECTIVE_FROM;
  const variants = useMemo(() => baseline.map(row => ({
    ...row,
    key: brand === "Jeep" ? row.model + "||" + row.variant : "Citroën||" + row.model + "||" + row.variant + "||" + (row.seating || "") + "||" + (row.option || "") + "||" + (row.vibePack || ""),
    variant: [row.variant, row.seating, row.option, row.vibePack].filter(Boolean).join(" · ")
  })), [baseline, brand]);
  const models = useMemo(() => ["All", ...new Set(baseline.map(row => row.model))], [baseline]);
  const selectedVariant = variants.find(row => row.key === variantKey);

  const pricedRows = useMemo(() => {
    return variants.map(base => {
      const applicable = changes
        .filter(change => change.variantKey === base.key && change.effectiveDate <= asOf)
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      const effectivePrices = applicable.reduce((prices, change) => ({ ...prices, ...change.prices }), {
        basicPrice: base.basicPrice, gstRate: base.gstRate ?? 0.4, dealerMargin: base.dealerMargin, ndp: base.ndp, esp: base.esp, accessoryKitMrp: base.accessoryKitMrp
      });
      const latest = applicable[applicable.length - 1];
      const gstRate = effectivePrices.gstRate ?? 0.4;
      const dealerMargin = effectivePrices.dealerMargin ?? 0;
      const handlingCharges = effectivePrices.handlingCharges ?? base.handlingCharges ?? 1000;
      const gstBeforeNdp = Math.round(effectivePrices.basicPrice * gstRate);
      const totalGst = effectivePrices.totalGst ?? base.totalGst ?? Math.round(gstBeforeNdp + dealerMargin * gstRate + handlingCharges * gstRate);
      return { ...base, ...effectivePrices, gstRate, dealerMargin, handlingCharges, gstBeforeNdp, totalGst, latestChange: latest || null };
    }).filter(row => (model === "All" || row.model === model) &&
      (row.variant + " " + row.model).toLowerCase().includes(search.toLowerCase()));
  }, [variants, changes, asOf, model, search]);

  const upcoming = useMemo(() => [...changes]
    .filter(change => variants.some(row => row.key === change.variantKey) && change.effectiveDate > asOf)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)), [changes, asOf, variants]);

  function openForm() {
    setVariantKey("");
    setEffectiveDate("");
    setBasicPrice("");
    setGstRate("");
    setDealerMargin("");
    setHandlingCharges("");
    setNdp("");
    setEsp("");
    setAccessory("");
    setNote("");
    setError("");
    setShowForm(true);
  }

  function saveChange(event) {
    event.preventDefault();
    setError("");
    if (!selectedVariant || !effectiveDate) {
      setError("Choose a variant and effective date.");
      return;
    }
    if (effectiveDate < effectiveFrom) {
      setError("The effective date cannot be earlier than 1 October 2026.");
      return;
    }
    if ([basicPrice, gstRate, dealerMargin, handlingCharges, ndp, esp, accessory].every(value => value === "")) {
      setError("Enter at least one revised price field.");
      return;
    }
    const collision = changes.some(change => change.variantKey === variantKey && change.effectiveDate === effectiveDate);
    if (collision && !window.confirm("A price change already exists for this variant and date. Add another entry for the same date?")) return;
    const prices = {};
    if (basicPrice !== "") prices.basicPrice = Number(basicPrice);
    if (gstRate !== "") prices.gstRate = Number(gstRate) / 100;
    if (dealerMargin !== "") prices.dealerMargin = Number(dealerMargin);
    if (handlingCharges !== "") prices.handlingCharges = Number(handlingCharges);
    if (ndp !== "") prices.ndp = Number(ndp);
    if (esp !== "") prices.esp = Number(esp);
    if (accessory !== "") prices.accessoryKitMrp = Number(accessory);
    setChanges(previous => [...previous, {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      variantKey, model: selectedVariant.model, variant: selectedVariant.variant,
      effectiveDate, prices, note: note.trim(), createdAt: new Date().toISOString()
    }].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
    setShowForm(false);
  }

  function exportChanges() {
    const blob = new Blob([JSON.stringify({ baselineEffectiveFrom: PRICE_LIST_EFFECTIVE_FROM, changes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jeep-price-change-register.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="cockpit pricesPage">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · PRODUCT INTELLIGENCE</div>
          <h1>{brand} Price List</h1>
          <p className="subtitle">Price snapshot effective 1 October 2026 · {baseline.length} variants</p>
        </div>
        <div className="pricesHeaderActions">
          <span className="pricesEffectiveBadge">Baseline · 01 Oct 2026</span>
          <button type="button" className="primaryButton" onClick={openForm}>Schedule price change</button>
        </div>
      </header>

      <CockpitNavigation active="/prices" />

      <section className="pricesNotice">
        <strong>Effective-dated pricing</strong>
        <span>Record revised prices with a future effective date. The list below shows the latest change effective on or before the selected “Prices as of” date. Citroën prices are based on the uploaded July 2026 workbook, as confirmed effective 1 October 2026.</span>
      </section>

      <section className="pricesFilters">
        <label>Prices as of
          <input type="text" inputMode="numeric" placeholder="DD/MM/YYYY" aria-label="Prices as of (DD/MM/YYYY)" value={asOfText} onChange={event => { setAsOfText(event.target.value); const parsed = parseDisplayDate(event.target.value); if (parsed && parsed >= PRICE_LIST_EFFECTIVE_FROM) setAsOf(parsed); }} />
        </label>
          <label className="pricesBrandSelect">Brand
            <select value={brand} onChange={event => { setBrand(event.target.value); setModel("All"); setSearch(""); setVariantKey(""); }}>
              <option value="Jeep">Jeep</option><option value="Citroën">Citroën</option>
            </select>
          </label>
        <label>Model
          <select value={model} onChange={event => setModel(event.target.value)}>
            {models.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="pricesSearch">Search variant
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search model or variant" />
        </label>
      </section>

      <section className="pricesTableWrap">
        <div className="pricesSectionHeading"><h2>Price list</h2><span>All amounts in INR</span></div>
        <div className="pricesFieldPicker">
          <button type="button" className="secondaryButton pricesFieldPickerButton" aria-expanded={showFieldPicker} onClick={() => setShowFieldPicker(open => !open)}>
            Choose fields to display <span>{visibleFields.length} selected ▾</span>
          </button>
          {showFieldPicker && <div className="pricesFieldPickerMenu">
            <div className="pricesFieldPickerActions"><strong>Displayed fields</strong><button type="button" className="textButton" onClick={() => setVisibleFields(["gstRate","basicPrice","gstBeforeNdp","ndp","dealerMargin","handlingCharges","totalGst","esp","accessoryKitMrp"])}>Select all</button><button type="button" className="textButton" onClick={() => setVisibleFields([])}>Clear</button></div>
            {[
              ["gstRate","GST"],["basicPrice","Basic Price"],["gstBeforeNdp","GST before NDP"],["ndp","NDP"],["dealerMargin","Dealer Margin"],["handlingCharges","Handling Charges"],["totalGst","Total GST"],["esp","ESP"],["accessoryKitMrp","Mandatory Primary Accessory Kit MRP (Inclusive GST)"],["priceStatus","Price status"]
            ].map(([key,label]) => <label className="pricesFieldOption" key={key}><input type="checkbox" checked={visibleFields.includes(key)} onChange={event => setVisibleFields(previous => event.target.checked ? [...previous,key] : previous.filter(field => field !== key))} />{label}</label>)}
          </div>}
        </div>
        <div className="pricesTableScroll">
          <table className="pricesTable">
            <thead><tr><th>Model</th><th>Description / Variant</th>{visibleFields.map(key => <th key={key}>{({gstRate:"GST",basicPrice:"Basic Price",gstBeforeNdp:"GST before NDP",ndp:"NDP",dealerMargin:"Dealer Margin",handlingCharges:"Handling Charges",totalGst:"Total GST",esp:"ESP",accessoryKitMrp:"Mandatory Primary Accessory Kit (MRP Inclusive GST)",priceStatus:"Price status"})[key]}</th>)}</tr></thead>
            <tbody>
              {pricedRows.map(row => <tr key={row.key}>
                <td data-label="Model"><strong>{row.model}</strong></td><td data-label="Description / Variant" className="priceVariantCell">{row.variant}</td>
                {visibleFields.map(key => <td key={key} data-label={({gstRate:"GST",basicPrice:"Basic Price",gstBeforeNdp:"GST before NDP",ndp:"NDP",dealerMargin:"Dealer Margin",handlingCharges:"Handling Charges",totalGst:"Total GST",esp:"ESP",accessoryKitMrp:"Primary Accessory Kit MRP",priceStatus:"Price status"})[key]}>
                  {key==="gstRate" ? ((row.gstRate ?? 0.4)*100).toFixed(0)+"%" :
                   key==="priceStatus" ? (row.latestChange ? <span className="priceChangeTag">Revised · {dateLabel(row.latestChange.effectiveDate)}</span> : <span className="priceBaselineTag">Baseline</span>) :
                   money(row[key])}
                </td>)}
              </tr>)}
              {!pricedRows.length && <tr><td colSpan={2+visibleFields.length} className="pricesEmptyCell">No variants match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricesTableWrap pricesChangeRegister">
        <div className="pricesSectionHeading"><h2>Scheduled price changes</h2><button type="button" className="secondaryButton" onClick={exportChanges} disabled={!changes.length}>Export change register</button></div>
        {changes.length ? <div className="pricesTableScroll"><table className="pricesTable">
          <thead><tr><th>Effective from</th><th>Model / Variant</th><th>Revised fields</th><th>Notes</th><th></th></tr></thead>
          <tbody>{[...changes].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)).map(change => <tr key={change.id}>
            <td>{dateLabel(change.effectiveDate)}{change.effectiveDate > new Date().toISOString().slice(0,10) && <span className="priceChangeTag">Upcoming</span>}</td>
            <td><strong>{change.model}</strong><br />{change.variant}</td>
            <td>{Object.entries(change.prices).map(([key,value]) => <div key={key}>{({basicPrice:"Basic Price",gstRate:"GST",dealerMargin:"Dealer Margin",handlingCharges:"Handling Charges",ndp:"NDP",esp:"ESP",accessoryKitMrp:"Accessory Kit MRP"})[key]}: {money(value)}</div>)}</td>
            <td>{change.note || "—"}</td>
            <td><button type="button" className="textButton" onClick={() => { if (window.confirm("Delete this scheduled change?")) setChanges(previous=>previous.filter(item=>item.id!==change.id)); }}>Delete</button></td>
          </tr>)}</tbody>
        </table></div> : <p className="pricesEmptyCell">No price changes scheduled yet.</p>}
      </section>

      <p className="pricesStorageNote">Price-change entries are currently saved in this browser only. Export the change register for backup; shared, multi-user persistence will require the pricing table to be enabled in the connected database.</p>

      {showForm && <div className="pricesModalBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setShowForm(false);}}>
        <section className="pricesModal" role="dialog" aria-modal="true" aria-labelledby="price-change-title">
          <div className="pricesModalHeading"><div><div className="eyebrow">EFFECTIVE-DATED UPDATE</div><h2 id="price-change-title">Schedule price change</h2></div><button type="button" className="textButton" onClick={()=>setShowForm(false)}>Close</button></div>
          <form onSubmit={saveChange}>
            <label>Model and variant
              <select required value={variantKey} onChange={event=>setVariantKey(event.target.value)}>
                <option value="">Select variant</option>
                {variants.map(row=><option key={row.key} value={row.key}>{row.model} · {row.variant}</option>)}
              </select>
            </label>
            {selectedVariant && <div className="pricesCurrentReference">Current baseline: GST {((selectedVariant.gstRate ?? 0.4)*100).toFixed(0)}% · Dealer Margin {money(selectedVariant.dealerMargin)} · ESP {money(selectedVariant.esp)}</div>}
            <label>Effective from
              <input required type="text" inputMode="numeric" placeholder="DD/MM/YYYY" aria-label="Effective from (DD/MM/YYYY)" value={effectiveDateText} onChange={event=>{ setEffectiveDateText(event.target.value); setEffectiveDate(parseDisplayDate(event.target.value)); }} />
            </label>
            <p className="pricesFormHelp">Fill only the fields that are changing. Blank fields retain the previous effective price.</p>
            <div className="pricesFormGrid">
              <label>GST (%)<input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={event=>setGstRate(event.target.value)} placeholder="No change" /></label>
              <label>Dealer Margin (₹)<input type="number" min="0" step="1" value={dealerMargin} onChange={event=>setDealerMargin(event.target.value)} placeholder="No change" /></label>
              <label>Handling Charges (₹)<input type="number" min="0" step="1" value={handlingCharges} onChange={event=>setHandlingCharges(event.target.value)} placeholder="No change" /></label>
              <label>Basic Price (₹)<input type="number" min="0" step="1" value={basicPrice} onChange={event=>setBasicPrice(event.target.value)} placeholder="No change" /></label>
              <label>NDP (₹)<input type="number" min="0" step="1" value={ndp} onChange={event=>setNdp(event.target.value)} placeholder="No change" /></label>
              <label>ESP (₹)<input type="number" min="0" step="1" value={esp} onChange={event=>setEsp(event.target.value)} placeholder="No change" /></label>
              <label>Accessory Kit MRP (₹)<input type="number" min="0" step="1" value={accessory} onChange={event=>setAccessory(event.target.value)} placeholder="No change" /></label>
            </div>
            <label>Reason / reference (optional)<input value={note} onChange={event=>setNote(event.target.value)} placeholder="e.g. revised price circular reference" /></label>
            {error && <p className="pricesFormError" role="alert">{error}</p>}
            <div className="pricesModalActions"><button type="button" className="secondaryButton" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="primaryButton">Save scheduled change</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
