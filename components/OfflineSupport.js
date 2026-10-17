"use client";

import { useEffect, useState } from "react";
import { loadSalesData } from "../lib/salesData";
import { loadIndustryData } from "../lib/industryData";
import { loadModelMonthlyData } from "../lib/modelData";
import { readClientCacheAsync, writeClientCache } from "../lib/clientCache";
import { supabase } from "../lib/supabase";

export default function OfflineSupport() {
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    // Next.js client-side links request RSC payloads, which are not interchangeable
    // with cached HTML. When offline, use a normal document navigation so the
    // service worker can serve the cached route HTML instead.
    const forceOfflineDocumentNavigation = (event) => {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      window.location.assign(destination.href);
    };
    document.addEventListener("click", forceOfflineDocumentNavigation, true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => setReady(true)).catch(() => setReady(false));
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("click", forceOfflineDocumentNavigation, true);
    };
  }, []);

  async function prepareOffline() {
    if (!navigator.onLine || preparing) return;
    setPreparing(true);
    setMessage("Refreshing datasets for offline use…");
    try {
      const [sales, industry, model] = await Promise.all([
        loadSalesData(),
        loadIndustryData(),
        loadModelMonthlyData(),
      ]);

      const manufacturerRows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("industry_manufacturer_history_v2")
          .select("sales_period,manufacturer,units,period_type,record_type")
          .eq("record_type", "MANUFACTURER")
          .order("sales_period").order("manufacturer")
          .range(from, from + 999);
        if (error) throw error;
        manufacturerRows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      await writeClientCache("industry-manufacturer-history-v1", manufacturerRows);

      const { data: budgets, error: budgetError } = await supabase.from("sales_cockpit_budgets")
        .select("id,budget_year,budget_version,brand,sales_type,sales_month,units,source_file,updated_at")
        .order("budget_year", { ascending: false }).order("sales_month", { ascending: true });
      if (budgetError) throw budgetError;
      await writeClientCache("budget-planning-v1", budgets || []);

      const required = [
        ["sales-data-v1", sales.length],
        ["industry-segment-history-v1", industry.length],
        ["model-monthly-data-v1", model.length],
        ["industry-manufacturer-history-v1", manufacturerRows.length],
        ["budget-planning-v1", (budgets || []).length],
      ];
      const storedChecks = await Promise.all(required.map(async ([key, count]) => {
        const stored = await readClientCacheAsync(key);
        return { key, count, ok: count === 0 || Boolean(stored && stored.data.length === count) };
      }));
      const failed = storedChecks.filter(item => !item.ok);
      if (failed.length) {
        throw new Error("Some datasets could not be saved by this browser. Check available device storage and retry.");
      }
      setMessage("Offline data refreshed successfully. Cached " + required.map(([key, count]) => count.toLocaleString("en-IN") + " rows").join(" · ") + ". Keep this app installed and open it periodically while online to refresh.");
    } catch (error) {
      setMessage("Offline preparation incomplete: " + (error?.message || "Unable to refresh all datasets."));
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div role="status" aria-live="polite" style={{
      padding: "7px 14px", fontSize: 12, fontWeight: 600,
      background: online ? "#edf8f0" : "#fff3e0",
      color: online ? "#176b38" : "#8a4b08",
      borderBottom: "1px solid " + (online ? "#cce8d3" : "#f0d6ad")
    }}>
      <div style={{display:"flex", gap:12, alignItems:"center", justifyContent:"space-between", flexWrap:"wrap"}}>
        <span>{online ? (ready ? "Online · offline support ready" : "Online · preparing offline support") : "Offline · showing locally cached data where available"}</span>
        {online && <button type="button" onClick={prepareOffline} disabled={preparing} style={{
          border:"1px solid currentColor", borderRadius:6, padding:"5px 9px",
          background:"transparent", color:"inherit", cursor:preparing?"wait":"pointer",
          fontWeight:700, fontSize:12
        }}>{preparing ? "Preparing…" : "Refresh offline data"}</button>}
      </div>
      {message && <div style={{fontWeight:500, marginTop:5}}>{message}</div>}
    </div>
  );
}
