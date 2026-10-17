"use client";

import { useEffect, useMemo, useState } from "react";
import CockpitNavigation from "../../components/CockpitNavigation";
import { JEEP_PRICE_BASELINE, PRICE_LIST_EFFECTIVE_FROM } from "../../lib/jeepPriceList";

const STORAGE_KEY = "stellantis-jeep-price-changes-v1";
const money = value => value == null || value === "" ? "—" : "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dateLabel = value => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toDisplayDate = value => value ? value.split("-").reverse().join("/") : "";
const parseDisplayDate = value => {
  const match = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(value.trim());
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (date.getFullYear() !== Number(yyyy) || date.getMonth() !== Number(mm) - 1 || date.getDate() !== Number(dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
};

export default function PricesPage() {
  const [changes, setChanges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [model, setModel] = useState("All");
  const [search, setSearch] = useState("");
  const [asOf, setAsOf] = useState(PRICE_LIST_EFFECTIVE_FROM);\n  const [asOfText, setAsOfText] = useState("01/10/2026");
  const [showForm, setShowForm] = useState(false);
  const [variantKey, setVariantKey] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");\n  const [effectiveDateText, setEffectiveDateText] = useState("");
  const [basicPrice, setBasicPrice] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [dealerMargin, setDealerMargin] = useState("");
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

  const models = useMemo(() => ["All", ...new Set(JEEP_PRICE_BASELINE.map(row => row.model))], []);
  const variants = useMemo(() => JEEP_PRICE_BASELINE.map(row => ({ ...row, key: row.model + "||" + row.variant })), []);
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
      return { ...base, ...effectivePrices, latestChange: latest || null };
    }).filter(row => (model === "All" || row.model === model) &&
      (row.variant + " " + row.model).toLowerCase().includes(search.toLowerCase()));
  }, [variants, changes, asOf, model, search]);

  const upcoming = useMemo(() => [...changes]
    .filter(change => change.effectiveDate > asOf)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)), [changes, asOf]);

  function openForm() {
    setVariantKey("");
    setEffectiveDate("");
    setBasicPrice("");
    setGstRate("");
    setDealerMargin("");
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
    if (effectiveDate < PRICE_LIST_EFFECTIVE_FROM) {
      setError("The effective date cannot be earlier than 1 October 2026.");
      return;
    }
    if ([basicPrice, gstRate, dealerMargin, ndp, esp, accessory].every(value => value === "")) {
      setError("Enter at least one revised price field.");
      return;
    }
    const collision = changes.some(change => change.variantKey === variantKey && change.effectiveDate === effectiveDate);
    if (collision && !window.confirm("A price change already exists for this variant and date. Add another entry for the same date?")) return;
    const prices = {};
    if (basicPrice !== "") prices.basicPrice = Number(basicPrice);
    if (gstRate !== "") prices.gstRate = Number(gstRate) / 100;
    if (dealerMargin !== "") prices.dealerMargin = Number(dealerMargin);
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
          <h1>Jeep Price List</h1>
          <p className="subtitle">Price snapshot effective 1 October 2026 · {JEEP_PRICE_BASELINE.length} variants</p>
        </div>
        <div className="pricesHeaderActions">
          <span className="pricesEffectiveBadge">Baseline · 01 Oct 2026</span>
          <button type="button" className="primaryButton" onClick={openForm}>Schedule price change</button>
        </div>
      </header>

      <CockpitNavigation active="/prices" />

      <section className="pricesNotice">
        <strong>Effective-dated pricing</strong>
        <span>Record revised prices with a future effective date. The list below shows the latest change effective on or before the selected “Prices as of” date.</span>
      </section>

      <section className="pricesFilters">
        <label>Prices as of
          <input type="text" inputMode="numeric" placeholder="DD/MM/YYYY" aria-label="Prices as of (DD/MM/YYYY)" value={asOfText} onChange={event => { setAsOfText(event.target.value); const parsed = parseDisplayDate(event.target.value); if (parsed && parsed >= PRICE_LIST_EFFECTIVE_FROM) setAsOf(parsed); }} />
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

      <section className="pricesSummary">
        <div><span>Models</span><strong>{new Set(pricedRows.map(row => row.model)).size}</strong></div>
        <div><span>Variants shown</span><strong>{pricedRows.length}</strong></div>
        <div><span>Scheduled changes after selected date</span><strong>{upcoming.length}</strong></div>
      </section>

      <section className="pricesTableWrap">
        <div className="pricesSectionHeading"><h2>Price list</h2><span>All amounts in INR</span></div>
        <div className="pricesTableScroll">
          <table className="pricesTable">
            <thead><tr><th>Model</th><th>Variant</th><th>GST</th><th>Dealer Margin</th><th>ESP</th><th>Price status</th></tr></thead>
            <tbody>
              {pricedRows.map(row => <tr key={row.key}>
                <td data-label="Model"><strong>{row.model}</strong></td><td data-label="Variant" className="priceVariantCell">{row.variant}</td>
                <td data-label="GST">{((row.gstRate ?? 0.4) * 100).toFixed(0)}%</td><td data-label="Dealer Margin">{money(row.dealerMargin)}</td><td data-label="ESP" className="pricesEsp">{money(row.esp)}</td>
                <td data-label="Price status">{row.latestChange ? <span className="priceChangeTag">Revised · {dateLabel(row.latestChange.effectiveDate)}</span> : <span className="priceBaselineTag">Baseline</span>}</td>
              </tr>)}
              {!pricedRows.length && <tr><td colSpan="6" className="pricesEmptyCell">No variants match these filters.</td></tr>}
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
            <td>{Object.entries(change.prices).map(([key,value]) => <div key={key}>{({basicPrice:"Basic Price",gstRate:"GST",dealerMargin:"Dealer Margin",ndp:"NDP",esp:"ESP",accessoryKitMrp:"Accessory Kit MRP"})[key]}: {money(value)}</div>)}</td>
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
