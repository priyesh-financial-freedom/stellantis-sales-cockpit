"use client";

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
  return (
    <nav className="cockpitNavGroups" aria-label="Main navigation">
      {groups.map((group) => (
        <section className="cockpitNavGroup" key={group.title}>
          <div className="cockpitNavGroupTitle">{group.title}</div>
          <div className="cockpitNavGroupLinks">
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
        </section>
      ))}
    </nav>
  );
}
