"use client";

import { useEffect, useState } from "react";
import type { ProfileId, ProfileKind, Slot } from "@/types";
import { emptyUsualMeals, type DayType, type UsualMeal, type UsualMeals } from "@/lib/taste";

const DAY_LABELS: Record<DayType, string> = { any: "Any day", weekday: "Weekdays", weekend: "Weekends" };
const SLOT_LABELS: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

function AddMealForm({
  slot,
  avoid,
  onSave,
  onCancel,
}: {
  slot: Slot;
  avoid: string[];
  onSave: (meal: UsualMeal) => void;
  onCancel: () => void;
}) {
  const [dish, setDish] = useState("");
  const [dayType, setDayType] = useState<DayType>("any");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientText, setIngredientText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  function addIngredient(value: string) {
    const name = value.trim().toLowerCase();
    if (!name || ingredients.includes(name)) return;
    setIngredients((current) => [...current, name]);
  }

  async function suggest() {
    setSuggesting(true);
    setHint(null);
    try {
      const res = await fetch("/api/suggest-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish }),
      });
      const data = await res.json();
      if (data.ok) {
        // Drop anything the person's food rules rule out (e.g. salt for a child).
        const allowed = (data.ingredients as string[]).filter(
          (name) => !avoid.some((word) => name.toLowerCase().includes(word))
        );
        setIngredients((current) => [...new Set([...current, ...allowed])]);
      } else {
        setHint(data.message ?? "No suggestion this time. Type the ingredients in.");
      }
    } catch {
      setHint("Couldn't get a suggestion. Type the ingredients in.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="ovr">
      <div className="field">
        <label htmlFor={`dish-${slot}`}>New {slot} dish</label>
        <input
          id={`dish-${slot}`}
          className="text-input"
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          maxLength={80}
          placeholder="e.g. milk, rice and banana, mashed"
        />
      </div>

      <div className="field">
        <span style={{ color: "var(--muted)", fontSize: 12 }}>When</span>
        <div className="seg" role="group" aria-label="When">
          {(Object.keys(DAY_LABELS) as DayType[]).map((value) => (
            <button
              key={value}
              type="button"
              className={dayType === value ? "on" : ""}
              aria-pressed={dayType === value}
              onClick={() => setDayType(value)}
            >
              {DAY_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`ingredient-${slot}`}>Ingredients</label>
        <div>
          {ingredients.length === 0 ? <span className="small">None yet</span> : null}
          {ingredients.map((name) => (
            <button
              key={name}
              type="button"
              className="chip on"
              aria-label={`Remove ${name}`}
              onClick={() => setIngredients((current) => current.filter((i) => i !== name))}
            >
              {name} &times;
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id={`ingredient-${slot}`}
            className="text-input"
            style={{ flex: 1, minWidth: 0 }}
            value={ingredientText}
            placeholder="Add one"
            onChange={(e) => setIngredientText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addIngredient(ingredientText);
                setIngredientText("");
              }
            }}
          />
          <button
            type="button"
            className="btn ghost"
            disabled={!ingredientText.trim()}
            onClick={() => {
              addIngredient(ingredientText);
              setIngredientText("");
            }}
          >
            Add
          </button>
        </div>
        <button type="button" className="btn ghost" style={{ marginTop: 8 }} disabled={!dish.trim() || suggesting} onClick={suggest}>
          {suggesting ? "Suggesting…" : "Suggest ingredients"}
        </button>
        {hint ? <div className="small" style={{ marginTop: 6 }}>{hint}</div> : null}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn"
          style={{ flex: 2 }}
          disabled={!dish.trim()}
          onClick={() => onSave({ dish: dish.trim(), dayType, ingredients })}
        >
          Save {slot}
        </button>
      </div>
    </div>
  );
}

// Usual meals are the defaults the week is prefilled from. They live in the
// person's taste file, and every change is saved straight away.
export default function UsualMealsEditor({
  profileId,
  kind,
  avoid = [],
}: {
  profileId: ProfileId;
  kind: ProfileKind;
  avoid?: string[]; // ingredient words to leave out of suggestions, from the person's food rules
}) {
  const [meals, setMeals] = useState<UsualMeals | null>(null);
  const [adding, setAdding] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Adults decide dinner on the Week tab; the child's dinner is a pool to pick from.
  const slots: Slot[] = kind === "child" ? ["breakfast", "lunch", "snack", "dinner"] : ["breakfast", "lunch", "snack"];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/taste/${profileId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMeals(data.usualMeals ?? emptyUsualMeals());
      })
      .catch(() => {
        if (!cancelled) setMessage("Couldn't load usual meals. Check the Mac is on and reload.");
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  async function persist(next: UsualMeals) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/taste/${profileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usualMeals: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message ?? "Couldn't save.");
        return;
      }
      setMeals(data.usualMeals);
      setAdding(null);
    } catch {
      setMessage("Couldn't reach the planner. Check the Mac is on and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!meals) return <div>{message ?? "Loading…"}</div>;

  return (
    <>
      <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
        {kind === "child"
          ? "Add what he normally eats once. The week fills in from this, and the grocery list is built from it."
          : "These fill in breakfast, lunch and snacks each day. Dinner is decided on the Week tab."}
      </div>

      {slots.map((slot) => (
        <div key={slot} style={{ marginBottom: 16 }}>
          <div className="label">
            {SLOT_LABELS[slot]}
            {kind === "child" && slot === "dinner" ? " — pick one each day" : ""}
          </div>

          {meals[slot].length === 0 ? <div className="box">Nothing added yet.</div> : null}
          {meals[slot].map((meal) => (
            <div className="row" key={meal.dish}>
              <span>
                <strong style={{ fontWeight: 500 }}>{meal.dish}</strong>
                <span className="small" style={{ display: "block" }}>
                  {DAY_LABELS[meal.dayType]}
                  {meal.ingredients.length ? ` · ${meal.ingredients.join(", ")}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                aria-label={`Remove ${meal.dish}`}
                onClick={() => persist({ ...meals, [slot]: meals[slot].filter((m) => m.dish !== meal.dish) })}
              >
                &times;
              </button>
            </div>
          ))}

          {adding === slot ? (
            <AddMealForm
              slot={slot}
              avoid={avoid}
              onCancel={() => setAdding(null)}
              onSave={(meal) => persist({ ...meals, [slot]: [...meals[slot].filter((m) => m.dish.toLowerCase() !== meal.dish.toLowerCase()), meal] })}
            />
          ) : (
            <button type="button" className="btn ghost" style={{ width: "100%" }} disabled={busy} onClick={() => setAdding(slot)}>
              + Add a {slot} dish
            </button>
          )}
        </div>
      ))}

      {message ? <div className="error">{message}</div> : null}
    </>
  );
}
