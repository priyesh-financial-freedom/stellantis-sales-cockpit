"use client";

import React from "react";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MODEL_NAMES, MODEL_YEARS, MODEL_CACHE_KEY, buildModelSummary, loadModelMonthlyData } from "../../lib/modelData";
import { readClientCache } from "../../lib/clientCache";
import MultiSelect from "../../components/MultiSelect";
import { supabase } from "../../lib/supabase";
import CockpitNavigation from "../../components/CockpitNavigation";

const PERIODS = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Custom Period"];
const SALES_TYPES = ["Bookings", "Retail", "Wholesale"];
const MONTH_OPTIONS = ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_OPTIONS = ["All", "Q1", "Q2", "Q3", "Q4"];
const HALF_YEAR_OPTIONS = ["All", "H1", "H2"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function valueClass(status) {
  return status === "ACTUAL / COMPLETE" ? "completedValue" : status === "FUTURE" || status === "INCOMPLETE" ? "futureValue" : "";
}

function statusClass(status) {
  return status === "INCOMPLETE" || status === "FUTURE" ? "incompleteStatus" : "completeStatus";
}

function statusLabel(status) {
  return status === "INCOMPLETE" || status === "FUTURE" ? "Forecast" : "Completed";
}

function periodLabel(period, value, customFrom, customTo) {
  if (period === "Custom Period") return customFrom && customTo ? customFrom + " → " + customTo : "Custom Period";
  return value;
}

function customMonthsForYear(year, from, to) {
  if (!from || !to) return [];
  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    const monthStart = String(year) + "-" + String(month).padStart(2, "0") + "-01";
    const monthEnd = new Date(Date.UTC(Number(year), month, 0)).toISOString().slice(0, 10);
    if (monthEnd >= from && monthStart <= to) months.push(month);
  }
  return months;
}

function periodMonths(period, value, year, cust...[truncated]