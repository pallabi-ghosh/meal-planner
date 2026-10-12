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
// sits at the bottom, within thumb reach.
export default function TabShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loadError, refresh } = useAppData();

  return (
    <div className="app">
      <header className="app-head">
        <h1>Meal Planner</h1>
      </header>

      {loadError ? (
        <div className="error">
          {loadError}{" "}
          <button className="btn ghost" onClick={() => refresh()} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </div>
      ) : null}

      <main className="app-body">{children}</main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab${pathname.startsWith(tab.href) ? " active" : ""}`}
            aria-current={pathname.startsWith(tab.href) ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
