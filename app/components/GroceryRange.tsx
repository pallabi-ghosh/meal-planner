"use client";

import { useCallback, useEffect, useState } from "react";
import type { PantryStock } from "@/types";
import type { RangeItem } from "@/lib/groceryRange";
import { CATEGORY_ORDER } from "@/lib/grocery";

// What to buy for a range of days, with tick-off. Starts with the finalised days.
export default function GroceryRange({ defaultFrom, defaultTo, hasFinalised }: { defaultFrom: string; defaultTo: string; hasFinalised: boolean }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [items, setItems] = useState<RangeItem[]>([]);
  const [pantry, setPantry] = useState<PantryStock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryEntry, setPantryEntry] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/grocery/range?from=${from}&to=${to}`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Couldn't build the list.");
        return;
      }
      setError(null);
      setItems(data.items as RangeItem[]);
      setPantry(data.pantry as PantryStock[]);
    } catch {
      setError("Couldn't reach the planner. Check the Mac is on and try again.");
    }
  }, [from, to]);

  useEffect(() => {
    if (from && to) load();
  }, [from, to, load]);

  async function post(url: string, body: unknown) {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } finally {
      await load();
    }
  }

  const toggle = (item: RangeItem) => {
    // Show the tick straight away; the reload confirms it.
    setItems((current) => current.map((i) => (i.key === item.key ? { ...i, bought: !i.bought } : i)));
    post("/api/grocery/bought", { name: item.name, bought: !item.bought, from, to });
  };

  const addPantry = () => {
    const name = pantryEntry.trim();
    if (!name) return;
    setPantryEntry("");
    post("/api/pantry", { name });
  };

  const boughtCount = items.filter((i) => i.bought).length;
  const groups = CATEGORY_ORDER.map((category) => ({ category, entries: items.filter((i) => i.category === category) })).filter((g) => g.entries.length > 0);

  return (
    <div className="g-layout">
      <aside className="g-side">
      <div className="card g-card">
        <div className="g-range">
          <div>
            <label className="small" htmlFor="g-from">From</label>
            <input id="g-from" type="date" className="text-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="small" htmlFor="g-to">To</label>
            <input id="g-to" type="date" className="text-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="small">
          {hasFinalised
            ? "Starts with your finalised days. "
            : "No days are finalised yet, so this shows the whole week. "}
          Items already bought or in the pantry are left out.
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {items.length > 0 ? (
        <div className="card g-card">
          <div className="g-progress-label">
            <strong>
              {boughtCount} of {items.length} bought
            </strong>
          </div>
          <div className="bar" role="img" aria-label={`${boughtCount} of ${items.length} bought`}>
            <div className="bar-fill" style={{ width: `${Math.round((boughtCount / items.length) * 100)}%` }} />
          </div>
        </div>
      ) : !error ? (
        <div className="card g-card small">
          Nothing to buy for these days. Choose dinners in Week (and finalise them), or pick other dates. Dinners need
          ingredients to appear here.
        </div>
      ) : null}

      <div className="card g-card">
        <button type="button" className="g-pantry-head" aria-expanded={pantryOpen} onClick={() => setPantryOpen((open) => !open)}>
          <span>In the pantry</span>
          <span className="small">
            {pantry.length} {pantry.length === 1 ? "item" : "items"} {pantryOpen ? "⌃" : "›"}
          </span>
        </button>
        {pantryOpen ? (
          <div className="g-pantry">
            {pantry.map((item) => (
              <div key={item.id} className="g-row">
                <span className="g-name">{item.name}</span>
                <button type="button" className="link-btn" onClick={() => post("/api/pantry", { remove: item.id })}>
                  Remove
                </button>
              </div>
            ))}
            <div className="g-add">
              <input
                className="text-input"
                value={pantryEntry}
                placeholder="e.g. rice, olive oil"
                aria-label="Add a pantry item"
                onChange={(e) => setPantryEntry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPantry()}
              />
              <button type="button" className="btn sm" disabled={!pantryEntry.trim()} onClick={addPantry}>
                Add
              </button>
            </div>
          </div>
        ) : null}
      </div>
      </aside>

      <div className="g-main">
        {groups.length > 0 ? (
          <div className="card g-list">
            {groups.map(({ category, entries }) => (
              <section key={category} className="g-section">
                <div className="g-cat">{category}</div>
                <div className="g-items">
                  {entries.map((item) => (
                    <label key={item.key} className={`g-row${item.bought ? " done" : ""}`}>
                      <input type="checkbox" checked={item.bought} onChange={() => toggle(item)} />
                      <span className="g-name">{item.name}</span>
                      <span className="g-qty">{item.quantity}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
