"use client";

import { useState } from "react";
import type { Meal, Slot } from "@/types";

interface MealPlanPanelProps {
  meals: Meal[];
  startDate?: string;
  onChanged: () => void;
}

const SLOTS: Array<{ slot: Slot; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "snack", label: "Snack" },
  { slot: "dinner", label: "Dinner" },
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function SlotSection({
  label,
  dishes,
  busy,
  onAdd,
  onRemove,
}: {
  label: string;
  dishes: string[];
  busy: boolean;
  onAdd: (text: string) => void;
  onRemove: (dish: string) => void;
}) {
  const [entry, setEntry] = useState("");

  function submit() {
    if (!entry.trim()) return;
    onAdd(entry.trim());
    setEntry("");
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label">{label}</div>
      {dishes.length === 0 ? (
        <div className="box">Nothing planned yet.</div>
      ) : (
        dishes.map((dish) => (
          <div className="row meal" key={dish}>
            <span>{dish}</span>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => onRemove(dish)}
              style={{ padding: "2px 8px", fontSize: 10 }}
            >
              ×
            </button>
          </div>
        ))
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          className="text-input"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`Add a ${label.toLowerCase()} dish`}
          style={{ flex: 1 }}
        />
        <button className="btn" disabled={busy || !entry.trim()} onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}

export default function MealPlanPanel({ meals, startDate, onChanged }: MealPlanPanelProps) {
  const [busy, setBusy] = useState(false);

  async function saveMeals(next: Meal[]) {
    setBusy(true);
    try {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: next }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function dishesForSlot(slot: Slot): string[] {
    const seen = new Set<string>();
    const dishes: string[] = [];
    for (const meal of meals) {
      if (meal.slot !== slot) continue;
      const key = normalize(meal.dish);
      if (seen.has(key)) continue;
      seen.add(key);
      dishes.push(meal.dish);
    }
    return dishes;
  }

  function addDish(slot: Slot, text: string) {
    const alreadyThere = meals.some((m) => m.slot === slot && normalize(m.dish) === normalize(text));
    if (alreadyThere) return;

    const newMeal: Meal = {
      id: crypto.randomUUID(),
      date: startDate ?? new Date().toISOString().slice(0, 10),
      slot,
      forWhom: "household",
      dish: text,
      ingredients: [],
    };
    saveMeals([...meals, newMeal]);
  }

  function removeDish(slot: Slot, dish: string) {
    const next = meals.filter((m) => !(m.slot === slot && normalize(m.dish) === normalize(dish)));
    saveMeals(next);
  }

  return (
    <>
      {SLOTS.map(({ slot, label }) => (
        <SlotSection
          key={slot}
          label={label}
          dishes={dishesForSlot(slot)}
          busy={busy}
          onAdd={(text) => addDish(slot, text)}
          onRemove={(dish) => removeDish(slot, dish)}
        />
      ))}
      <div className="note">
        Dishes you type here manually don&rsquo;t come with ingredients, so they won&rsquo;t add
        anything to the grocery list automatically — add matching items on the grocery screen if needed.
      </div>
    </>
  );
}
