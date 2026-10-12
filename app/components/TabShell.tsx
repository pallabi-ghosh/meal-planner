"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "./AppData";

const TABS = [
  { href: "/week", label: "Week" },
  { href: "/log", label: "Log" },
  { href: "/grocery", label: "Grocery" },
];

// Three separate tabs; no tab shows another tab's content. On a phone the tab bar
// sits at the bottom, within thumb reach; on wide screens it moves into the header.
export default function TabShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loadError, refresh } = useAppData();

  return (
    <div className="app">
      <header className="app-head">
        <h1>Meal Planner</h1>
        <nav className="tabbar" aria-label="Sections">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tab${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/profiles" className="head-link">
          Profiles and food rules
        </Link>
      </header>

      {loadError ? (
        <div className="error">
          {loadError}{" "}
          <button className="btn ghost" onClick={() => refresh()} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </div>
      ) : null}

      <main>{children}</main>
    </div>
  );
}
