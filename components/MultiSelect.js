"use client";

import { useEffect, useRef, useState } from "react";

export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  placeholder = "Select",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const normalized = Array.isArray(value) ? value : [];
  const cleanOptions = options.filter((option, index, array) => array.indexOf(option) === index);
  const allOptionPresent = cleanOptions.includes(allLabel);
  const allSelected = normalized.length === 0 || normalized.includes(allLabel) || normalized.length === cleanOptions.length;
  const effectiveSelection = allSelected ? [] : normalized.filter(item => item !== allLabel);
  const selectedLabels = allSelected ? [allLabel] : effectiveSelection;

  useEffect(() => {
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function toggle(option) {
    if (option === allLabel) {
      onChange([]);
      return;
    }
    if (effectiveSelection.includes(option)) {
      onChange(effectiveSelection.filter(item => item !== option));
    } else {
      onChange([...effectiveSelection, option]);
    }
  }

  function selectAll() {
    onChange([]);
  }

  const summary =
    selectedLabels.length === 1
      ? selectedLabels[0]
      : allSelected
        ? allLabel
        : `${selectedLabels.length} selected`;

  return (
    <div className="multiSelect" ref={ref}>
      {label && <label>{label}</label>}
      <button
        type="button"
        className={"multiSelectButton" + (open ? " open" : "")}
        onClick={() => !disabled && setOpen(current => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="multiSelectSummary">{summary || placeholder}</span>
        <span className="multiSelectChevron">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="multiSelectMenu" role="listbox" aria-multiselectable="true">
          <div className="multiSelectQuickActions">
            <button type="button" className={allSelected ? "selected" : ""} onClick={selectAll}>
              {allSelected ? "✓ " : ""}{allLabel}
            </button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>

          <div className="multiSelectList">
            {cleanOptions.map(option => {
              const checked = allSelected || normalized.includes(option);
              return (
                <label className={"multiSelectOption" + (checked ? " checked" : "")} key={option}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option)}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>

          <div className="multiSelectFooter">
            <span>{allSelected ? `${cleanOptions.length} selected` : `${normalized.length} selected`}</span>
            <button type="button" className="multiSelectDone" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
