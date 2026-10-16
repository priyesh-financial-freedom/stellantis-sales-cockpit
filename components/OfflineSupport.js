"use client";

import { useEffect, useState } from "react";

export default function OfflineSupport() {
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => setReady(true)).catch(() => setReady(false));
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" style={{
      padding: "7px 14px", fontSize: 12, fontWeight: 600, textAlign: "right",
      background: online ? "#edf8f0" : "#fff3e0",
      color: online ? "#176b38" : "#8a4b08",
      borderBottom: "1px solid " + (online ? "#cce8d3" : "#f0d6ad")
    }}>
      {online ? (ready ? "Online · offline support ready" : "Online · preparing offline support") : "Offline · showing locally cached data where available"}
    </div>
  );
}
