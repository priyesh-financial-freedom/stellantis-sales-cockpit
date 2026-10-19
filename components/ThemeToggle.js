"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "stellantis-sales-cockpit-theme";
const MODES = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

export default function ThemeToggle() {
  const [mode, setMode] = useState("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved = "system";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") saved = stored;
    } catch { /* Use system preference when browser storage is unavailable. */ }
    setMode(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const applyTheme = () => {
      const resolved = mode === "system" ? (media?.matches ? "dark" : "light") : mode;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    if (mode === "system" && media) {
      media.addEventListener?.("change", applyTheme);
      return () => media.removeEventListener?.("change", applyTheme);
    }
  }, [mode, ready]);

  function chooseMode(nextMode) {
    setMode(nextMode);
    try { window.localStorage.setItem(STORAGE_KEY, nextMode); }
    catch { /* The current page still changes theme if storage is unavailable. */ }
  }

  return (
    <div className="themeModePicker cockpitMenuThemeToggle" role="group" aria-label="Appearance mode" data-ready={ready ? "true" : "false"}>
      <span className="themeModeLabel">Appearance</span>
      <div className="themeModeOptions">
        {MODES.map(option => (
          <button
            key={option.value}
            type="button"
            className={"themeModeOption" + (mode === option.value ? " active" : "")}
            onClick={() => chooseMode(option.value)}
            aria-pressed={mode === option.value}
            title={option.label + " mode"}
          >
            <span className="themeModeIcon" aria-hidden="true">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
