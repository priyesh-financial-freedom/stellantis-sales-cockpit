"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("stellantis-sales-cockpit-theme");
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const enabled = saved ? saved === "dark" : prefersDark;
      setDark(enabled);
      document.documentElement.dataset.theme = enabled ? "dark" : "light";
    } catch {
      document.documentElement.dataset.theme = "light";
    }
    setReady(true);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("stellantis-sales-cockpit-theme", next ? "dark" : "light");
    } catch {
      // The current page still changes theme if browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      data-ready={ready ? "true" : "false"}
    >
      <span className="themeToggleIcon" aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
