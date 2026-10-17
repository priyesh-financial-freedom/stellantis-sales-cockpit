"use client";

import { useState } from "react";
import Link from "next/link";

const groups = [
  {
    title: "Stellantis India",
    items: [
      { label: "Jeep Model Wise", href: "/model-wise/jeep" },
      { label: "Citroën Model Wise", href: "/model-wise/citroen" },
      { label: "Budget Planning", href: "/budget-planning" },
      { label: "Stellantis Network", href: "/stellantis-network" },
      { label: "Prices", href: "/prices" },
    ],
  },
  {
    title: "Industry",
    items: [
      { label: "Industry", href: "/industry" },
      { label: "Manufacturer History", href: "/industry/manufacturers" },
    ],
  },
  {
    title: "Data Entry",
    items: [{ label: "Data Entry", href: "/data-entry" }],
  },
];

export default function CockpitNavigation({ active }) {
  const [expandedGroup, setExpandedGroup] = useState(null);

  return (
    <nav className="cockpitNavGroups" aria-label="Main navigation">
      {groups.map((group, index) => {
        const expanded = expandedGroup === index;
        const panelId = "cockpit-nav-panel-" + index;
        return (
          <section className={"cockpitNavGroup" + (expanded ? " expanded" : "")} key={group.title}>
            <button
              type="button"
              className="cockpitNavGroupHeader"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpandedGroup(expanded ? null : index)}
            >
              <span className="cockpitNavGroupTitle">{group.title}</span>
              <span className={"cockpitNavChevron" + (expanded ? " open" : "")} aria-hidden="true">⌄</span>
            </button>
            {expanded && (
              <div className="cockpitNavGroupLinks" id={panelId}>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active === item.href ? "active" : ""}
                    aria-current={active === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </nav>
  );
}
