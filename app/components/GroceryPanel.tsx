"use client";

import { useState } from "react";

interface GroceryItemData {
  id?: string;
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

interface DuplicateMatch {
  index: number;
  existingText: string;
  newText: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// A starting point to edit, not a guess to trust outright — quantities are freeform
// text ("box of eggs"), so there's no reliable arithmetic to do automatically.
function suggestCombinedText(existingText: string, newText: string): string {
  if (normalize(existingText) === normalize(newText)) {
    return `2 × ${existingText}`;
  }
  return `${existingText} + ${newText}`;
}

export default function GroceryPanel({ grocery, onChanged }: GroceryPanelProps) {
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [duplicateEditValue, setDuplicateEditValue] = useState("");

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

  // Matched by position in the currently-rendered array, not by name — two items
  // can legitimately share a name (e.g. two "egg" entries), so name alone isn't a
  // safe identifier for which row was actually clicked.
  function toggleHaveIt(index: number) {
    const next = grocery.map((item, i) => (i === index ? { ...item, fromPantry: !item.fromPantry } : item));
    saveList(next);
  }

  function removeItem(index: number) {
    saveList(grocery.filter((_, i) => i !== index));
  }

  function appendNewEntry(text: string) {
    const next = [
      ...grocery,
      {
        id: crypto.randomUUID(),
        name: text,
        quantity: "",
        category: "Uncategorised",
        estPriceDKK: 8,
        fromPantry: false,
      },
    ];
    saveList(next);
  }

  function addItem() {
    const text = entry.trim();
    if (!text) return;

    const matchIndex = grocery.findIndex((item) => normalize(item.name) === normalize(text));
    if (matchIndex !== -1) {
      // Don't silently create a second "egg" row — ask what they actually mean.
      const existingText = grocery[matchIndex].name;
      setDuplicate({ index: matchIndex, existingText, newText: text });
      setDuplicateEditValue(suggestCombinedText(existingText, text));
      return;
    }

    setEntry("");
    appendNewEntry(text);
  }

  function resolveDuplicateUpdate() {
    if (!duplicate || !duplicateEditValue.trim()) return;
    const finalText = duplicateEditValue.trim();
    const next = grocery.map((item, i) => (i === duplicate.index ? { ...item, name: finalText } : item));
    setEntry("");
    setDuplicate(null);
    saveList(next);
  }

  function resolveDuplicateAddAnyway() {
    if (!duplicate) return;
    const text = duplicate.newText;
    setEntry("");
    setDuplicate(null);
    appendNewEntry(text);
  }

  function cancelDuplicate() {
    setDuplicate(null);
    setDuplicateEditValue("");
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
          {grocery.map((item, index) => (
            <div
              className="row"
              key={item.id ?? `${item.name}-${index}`}
              style={item.fromPantry ? { opacity: 0.45, textDecoration: "line-through" } : undefined}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={item.fromPantry}
                  onChange={() => toggleHaveIt(index)}
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
                  onClick={() => removeItem(index)}
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

      {duplicate ? (
        <div className="ovr">
          <div className="label" style={{ marginTop: 0, color: "var(--blue)" }}>
            &ldquo;{duplicate.existingText}&rdquo; is already on the list
          </div>
          <div className="small" style={{ marginBottom: 8 }}>
            Edit this to the real combined amount, then update the existing line — or add your new entry as a separate line instead.
          </div>
          <input
            value={duplicateEditValue}
            onChange={(e) => setDuplicateEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") resolveDuplicateUpdate();
            }}
            style={{ width: "100%", fontFamily: "inherit", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1.5px solid var(--line)", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn" disabled={busy || !duplicateEditValue.trim()} onClick={resolveDuplicateUpdate}>
              Update existing to this
            </button>
            <button className="btn ghost" disabled={busy} onClick={resolveDuplicateAddAnyway}>
              Add as new line
            </button>
            <button className="btn ghost" disabled={busy} onClick={cancelDuplicate}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
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
      )}

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost" disabled={sending || grocery.length === 0} onClick={sendList}>
          {sending ? "Sending…" : "Send list by email"}
        </button>
        {sendStatus ? <span className="small">{sendStatus}</span> : null}
      </div>
    </>
  );
}
