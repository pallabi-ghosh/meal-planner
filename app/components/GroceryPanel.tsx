"use client";

import { useState } from "react";

interface GroceryItemData {
  name: string;
  quantity: string;
  category: string;
  estPriceDKK: number;
  fromPantry: boolean;
}

interface GroceryPanelProps {
  grocery: GroceryItemData[];
  onChanged: () => void;
}

export default function GroceryPanel({ grocery, onChanged }: GroceryPanelProps) {
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function saveList(next: GroceryItemData[]) {
    setBusy(true);
    try {
      await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grocery: next }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function toggleHaveIt(itemName: string) {
    const next = grocery.map((item) =>
      item.name === itemName ? { ...item, fromPantry: !item.fromPantry } : item
    );
    saveList(next);
  }

  function removeItem(itemName: string) {
    saveList(grocery.filter((item) => item.name !== itemName));
  }

  function addItem() {
    if (!entry.trim()) return;
    const next = [
      ...grocery,
      {
        name: entry.trim(),
        quantity: "",
        category: "Uncategorised",
        estPriceDKK: 8,
        fromPantry: false,
      },
    ];
    setEntry("");
    saveList(next);
  }

  async function sendList() {
    setSending(true);
    setSendStatus(null);
    try {
      const res = await fetch("/api/send-list", { method: "POST" });
      const data = await res.json();
      setSendStatus(data.ok ? "Sent!" : data.message ?? "Failed to send.");
    } catch (e) {
      setSendStatus("Failed to send: " + (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const total = grocery.filter((item) => !item.fromPantry).reduce((sum, item) => sum + item.estPriceDKK, 0);

  return (
    <>
      <div className="label">Grocery list (this week)</div>
      {grocery.length === 0 ? (
        <div className="box">No items yet — add what you need below, or generate a week to prefill it.</div>
      ) : (
        <>
          {grocery.map((item) => (
            <div
              className="row"
              key={item.name}
              style={item.fromPantry ? { opacity: 0.45, textDecoration: "line-through" } : undefined}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={item.fromPantry}
                  onChange={() => toggleHaveIt(item.name)}
                  disabled={busy}
                  title="Already have it at home"
                />
                {item.name}
                {item.quantity ? ` — ${item.quantity}` : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="small">{item.fromPantry ? "have it" : `${item.estPriceDKK} DKK`}</span>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => removeItem(item.name)}
                  style={{ padding: "2px 8px", fontSize: 10 }}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
          <div className="tot">
            <span>TOTAL</span>
            <span>{total} DKK</span>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          placeholder="e.g. box of eggs, 6 avocados, 2 packets of milk"
          style={{ flex: 1, fontFamily: "inherit", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1.5px solid var(--line)" }}
        />
        <button className="btn" disabled={busy || !entry.trim()} onClick={addItem}>
          Add
        </button>
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost" disabled={sending || grocery.length === 0} onClick={sendList}>
          {sending ? "Sending…" : "Send list by email"}
        </button>
        {sendStatus ? <span className="small">{sendStatus}</span> : null}
      </div>
    </>
  );
}
