"use client";

import { useState } from "react";
import type { Meal, ProfileId, Slot } from "@/types";
import type { UsualMeal } from "@/lib/taste";
import { PROFILE_ORDER, mealFor, sharedMeal } from "@/lib/plan";

export interface MealChange {
  date: string;
  slot: Slot;
  who: ProfileId | "household";
  dish: string; // empty clears the meal
  ingredients?: string[];
  source?: "usual" | "manual";
}

type Save = (change: { dish: string; ingredients?: string[]; source?: "usual" | "manual" }) => void;

const SLOT_LABELS: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

function DishEditor({
  initial,
  placeholder,
  onSave,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onSave: (dish: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="dish-editor">
      <input
        className="text-input"
        value={value}
        placeholder={placeholder}
        maxLength={80}
        autoFocus
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(value);
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="dish-editor-actions">
        <button type="button" className="btn sm" onClick={() => onSave(value)}>
          {value.trim() ? "Save" : "Clear"}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// A compact meal cell: the dish, a quiet footer with its tags and an Edit link.
function PlanCell({ who, meal, busy, onSave }: { who: string; meal: Meal | undefined; busy: boolean; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const tags = [meal?.source === "usual" ? "usual" : null, meal?.forWhom === "household" ? "shared" : null].filter(Boolean);

  return (
    <div className="plan-cell">
      <span className="who">{who}</span>
      {editing ? (
        <DishEditor
          initial={meal?.dish ?? ""}
          placeholder="e.g. oats with banana"
          onCancel={() => setEditing(false)}
          onSave={(dish) => {
            setEditing(false);
            onSave({ dish, source: "manual" });
          }}
        />
      ) : (
        <>
          <div className={meal ? "plan-dish" : "plan-empty"}>{meal ? meal.dish : "Nothing planned"}</div>
          <div className="cell-foot">
            <span className="small">{tags.join(" · ")}</span>
            <button type="button" className="link-btn" disabled={busy} onClick={() => setEditing(true)}>
              {meal ? "Edit" : "+ Add"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// A dinner card. The family dinner is typed; the child's comes from his pool.
function DinnerCard({
  who,
  sub,
  meal,
  busy,
  pool,
  onSave,
}: {
  who: string;
  sub: string;
  meal: Meal | undefined;
  busy: boolean;
  pool?: UsualMeal[];
  onSave: Save;
}) {
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const hasPool = Boolean(pool && pool.length > 0);

  return (
    <div className="plan-cell dinner">
      <span className="who">{who}</span>
      {editing ? (
        <DishEditor
          initial={meal?.dish ?? ""}
          placeholder="e.g. chicken curry with roti"
          onCancel={() => setEditing(false)}
          onSave={(dish) => {
            setEditing(false);
            setChoosing(false);
            onSave({ dish, source: "manual" });
          }}
        />
      ) : (
        <>
          <div className="dinner-head">
            <div className={meal ? "dinner-title" : "plan-empty"}>{meal ? meal.dish : "Not chosen yet"}</div>
            <button
              type="button"
              className="btn ghost sm"
              disabled={busy}
              onClick={() => (hasPool ? setChoosing((open) => !open) : setEditing(true))}
            >
              {hasPool ? "Change" : meal ? "Edit" : "Choose"}
            </button>
          </div>
          <span className="small">{sub}</span>

          {hasPool && choosing ? (
            <div className="pool" aria-label="Usual dinners">
              {pool!.map((option) => (
                <button
                  key={option.dish}
                  type="button"
                  className={`chip${meal?.dish === option.dish ? " on" : ""}`}
                  disabled={busy}
                  aria-pressed={meal?.dish === option.dish}
                  onClick={() => {
                    setChoosing(false);
                    onSave({ dish: option.dish, ingredients: option.ingredients, source: "usual" });
                  }}
                >
                  {option.dish}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setEditing(true)}>
                Something else
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// One day, person by person. Breakfast, lunch and snack come from usual meals;
// dinner is the decision: a family dinner, plus the child's own from his pool.
export default function DayPlan({
  date,
  meals,
  names,
  childDinners,
  busy,
  onChange,
}: {
  date: string;
  meals: Meal[];
  names: Record<ProfileId, string>;
  childDinners: UsualMeal[];
  busy: boolean;
  onChange: (change: MealChange) => void;
}) {
  const childDinner = mealFor(meals, date, "dinner", "toddler");

  return (
    <div className="card plan-card">
      <div className="plan-grid">
        <div className="plan-colhead" aria-hidden="true" />
        {PROFILE_ORDER.map((who) => (
          <div key={who} className="plan-colhead" aria-hidden="true">
            {names[who]}
          </div>
        ))}

        {(["breakfast", "lunch", "snack"] as Slot[]).map((slot) => (
          <div key={slot} className="plan-row">
            <div className="plan-label">{SLOT_LABELS[slot]}</div>
            {PROFILE_ORDER.map((who) => (
              <PlanCell
                key={who}
                who={names[who]}
                meal={mealFor(meals, date, slot, who)}
                busy={busy}
                onSave={(change) => onChange({ date, slot, who, ...change })}
              />
            ))}
          </div>
        ))}

        <div className="plan-row">
          <div className="plan-label">Dinner</div>
          <div className="plan-span-2">
            <DinnerCard
              who="Family dinner"
              sub="Family dinner · the one decision each day"
              meal={sharedMeal(meals, date, "dinner")}
              busy={busy}
              onSave={(change) => onChange({ date, slot: "dinner", who: "household", ...change })}
            />
          </div>
          <DinnerCard
            who={`${names.toddler}'s dinner`}
            sub={`${names.toddler}'s own dinner${childDinners.length > 0 ? ` · ${childDinners.length} usual to pick from` : ""}`}
            meal={childDinner}
            busy={busy}
            pool={childDinners}
            onSave={(change) => onChange({ date, slot: "dinner", who: "toddler", ...change })}
          />
        </div>
      </div>
    </div>
  );
}
