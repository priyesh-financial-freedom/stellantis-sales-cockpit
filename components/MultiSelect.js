"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function MultiSelect({
  label,
  options = [],
  value,
  onChange,
  allLabel = "All",
  placeholder = "Select",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const normalized = Array.isArray(value) ? value : [];
  const cleanOptions = useMemo(
    () => options.filter((option, index, array) => array.indexOf(option) === index),
    [options]
  );
  // An empty value is the established app-wide representation of "All".
  const allSelected = normalized.length === 0 || normalized.includes(allLabel) || normalized.length >= cleanOptions.length;
  const effectiveSelection = allSelected ? [] : normalized.filter(item => item !== allLabel);
  const draftAll = draft.length === 0 || draft.includes(allLabel) || draft.length >= cleanOptions.length;
  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? cleanOptions.filter(option => option.toLocaleLowerCase().includes(query)) : cleanOptions;
  }, [cleanOptions, search]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) closeWithoutApply();
    };
    const handleKey = event => {
      if (event.key === "Escape") closeWithoutApply();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer, { passive: true });
    document.addEventListener("keydown", handleKey);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 80);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  function openPanel() {
    if (disabled) return;
    setDraft(effectiveSelection);
    setSearch("");
    setOpen(true);
  }

  function closeWithoutApply() {
    setOpen(false);
    setSearch("");
  }

  function toggle(option) {
    if (draftAll) {
      // Expand the implicit "All" selection, then remove the unchecked option.
      setDraft(cleanOptions.filter(item => item !== option));
      return;
    }
    setDraft(current =>
      current.includes(option)
        ? current.filter(item => item !== option)
        : [...current, option]
    );
  }

  function selectAll() {
    setDraft([]);
  }

  function resetSelection() {
    // Empty selection is the app's established default state: show All.
    setDraft([]);
  }

  function applySelection() {
    onChange(draftAll ? [] : draft);
    setOpen(false);
    setSearch("");
  }

  const selectedCount = draftAll ? cleanOptions.length : draft.length;
  const summary = allSelected
    ? allLabel
    : effectiveSelection.length === 1
      ? effectiveSelection[0]
      : `${effectiveSelection.length} selected`;

  return (
    <div className="multiSelect" ref={rootRef}>
      {label && <label>{label}</label>}
      <button
        type="button"
        className={"multiSelectButton" + (open ? " open" : "")}
        onClick={open ? closeWithoutApply : openPanel}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="multiSelectSummary">{summary || placeholder}</span>
        <span className="multiSelectChevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <>
          <button type="button" className="multiSelectBackdrop" aria-label="Close filter" onClick={closeWithoutApply} />
          <section className="multiSelectMenu" role="dialog" aria-label={label || "Filter options"}>
            <div className="multiSelectPanelHeader">
              <div className="multiSelectPanelTitle">{label || "Select options"}</div>
              <button type="button" className="multiSelectClose" onClick={closeWithoutApply} aria-label="Close">×</button>
            </div>

            <div className="multiSelectSearch">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={`Search ${(label || "options").toLowerCase()}...`}
                aria-label={`Search ${label || "options"}`}
              />
              {search && <button type="button" onClick={() => setSearch("")}>Clear</button>}
            </div>

            <div className="multiSelectQuickActions">
              <button type="button" className={draftAll ? "selected" : ""} onClick={selectAll}>
                {draftAll ? "✓ " : ""}All
              </button>
              <button type="button" onClick={resetSelection}>Reset</button>
              <span className="multiSelectCount">{selectedCount} of {cleanOptions.length} selected</span>
            </div>

            <div className="multiSelectList" role="group" aria-label="Available options">
              {visibleOptions.length ? visibleOptions.map(option => {
                const checked = draftAll || draft.includes(option);
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
              }) : <div className="multiSelectNoResults">No matching options</div>}
            </div>

            <div className="multiSelectFooter">
              <span>{selectedCount} selected</span>
              <div className="multiSelectFooterActions">
                <button type="button" className="multiSelectCancel" onClick={closeWithoutApply}>Cancel</button>
                <button type="button" className="multiSelectDone" onClick={applySelection}>Apply</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
