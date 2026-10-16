"use client";

import { useState } from "react";
import type { CalorieThresholds, ChildRules, Meal, ProfileId, Slot } from "@/types";
import type { UsualMeal } from "@/lib/taste";
import { dayTotal, formatKcal, loadLevel } from "@/lib/calories";
import { PROFILE_ORDER, mealFor, sharedMeal } from "@/lib/plan";
import { toddlerBadge, toddlerIssues } from "@/lib/toddler";

export interface MealChange {
  date: string;
  slot: Slot;
  who: ProfileId | "household";
  dish: string; // empty clears the meal
  kcal?: number;
  ingredients?: string[];
  source?: "usual" | "manual" | "generated";
}

type Save = (change: { dish: string; kcal?: number; ingredients?: string[]; source?: "usual" | "manual" }) => void;

const SLOT_LABELS: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

// Calories are optional; anything that isn't a sensible number is ignored.
function parseKcal(text: string): number | undefined {
  const n = Math.round(Number(text));
  return text.trim() && n > 0 && n <= 5000 ? n : undefined;
}

function DishEditor({
  initial,
  initialKcal,
  forChild,
  slot,
  placeholder,
  onSave,
  onCancel,
}: {
  initial: string;
  initialKcal?: number;
  forChild: boolean;
  slot: Slot;
  placeholder: string;
  onSave: (dish: string, kcal?: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [kcal, setKcal] = useState(initialKcal ? String(initialKcal) : "");
  const [estimating, setEstimating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const save = () => onSave(value, parseKcal(kcal));

  // Fills the calorie box from the built-in list or the AI model. Always an estimate, always editable.
  async function estimate() {
    if (!value.trim()) return;
    setEstimating(true);
    setHint(null);
    try {
      const res = await fetch("/api/estimate-kcal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: "dish", dish: value, forChild, slot }] }),
      });
      const found = (await res.json()).estimates?.dish as { kcal: number; source: string } | undefined;
      if (found) {
        setKcal(String(found.kcal));
        setHint(found.source === "builtin" ? "From the built-in dish list" : "AI estimate, please check it");
      } else {
        setHint("No estimate this time. Type it in.");
      }
    } catch {
      setHint("Couldn't estimate. Type it in.");
    } finally {
      setEstimating(false);
    }
  }
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
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
      />
      <input
        className="text-input"
        value={kcal}
        inputMode="numeric"
        placeholder="kcal (optional)"
        aria-label="Calories (optional)"
        onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="estimate-row">
        <button type="button" className="link-btn" disabled={estimating || !value.trim()} onClick={estimate}>
          {estimating ? "Estimating…" : "Estimate calories"}
        </button>
        {hint ? <span className="small">{hint}</span> : null}
      </div>
      <div className="dish-editor-actions">
        <button type="button" className="btn sm" onClick={save}>
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
function PlanCell({ who, slot, meal, busy, isChild, onSave }: { who: string; slot: Slot; meal: Meal | undefined; busy: boolean; isChild: boolean; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const tags = [meal?.kcal ? `${formatKcal(meal.kcal)} kcal` : null, meal?.source === "usual" ? "usual" : null, meal?.forWhom === "household" ? "shared" : null].filter(Boolean);

  return (
    <div className="plan-cell">
      <span className="who">{who}</span>
      {editing ? (
        <DishEditor
          initial={meal?.dish ?? ""}
          initialKcal={meal?.kcal}
          forChild={isChild}
          slot={slot}
          placeholder="e.g. oats with banana"
          onCancel={() => setEditing(false)}
          onSave={(dish, kcal) => {
            setEditing(false);
            onSave({ dish, kcal, source: "manual" });
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
  isChild,
  issues,
  onSwap,
  onSave,
}: {
  who: string;
  sub: string;
  meal: Meal | undefined;
  busy: boolean;
  pool?: UsualMeal[];
  isChild: boolean;
  issues?: string[];
  onSwap?: () => void;
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
          initialKcal={meal?.kcal}
          forChild={isChild}
          slot="dinner"
          placeholder="e.g. chicken curry with roti"
          onCancel={() => setEditing(false)}
          onSave={(dish, kcal) => {
            setEditing(false);
            setChoosing(false);
            onSave({ dish, kcal, source: "manual" });
          }}
        />
      ) : (
        <>
          <div className="dinner-head">
            <div className={meal ? "dinner-title" : "plan-empty"}>{meal ? meal.dish : "Not chosen yet"}</div>
            <div className="dinner-actions">
              {onSwap ? (
                <button type="button" className="btn ghost sm" disabled={busy} onClick={onSwap}>
                  {meal ? "Swap" : "Suggest"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy}
                onClick={() => (hasPool ? setChoosing((open) => !open) : setEditing(true))}
              >
                {hasPool ? "Change" : meal ? "Edit" : "Choose"}
              </button>
            </div>
          </div>
          <span className="small">{meal?.kcal ? `${sub} · ${formatKcal(meal.kcal)} kcal` : sub}</span>
          {issues && issues.length > 0 ? <span className="pill amber">{toddlerBadge(issues)}</span> : null}

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

// One person's calories for the day against their target. The child only gets an estimate.
function TotalCell({
  who,
  total,
  missing,
  target,
  thresholds,
  cheat,
}: {
  who: string;
  total: number;
  missing: number;
  target: number | null;
  thresholds: CalorieThresholds;
  cheat: boolean;
}) {
  const level = target && !cheat ? loadLevel(total, target, thresholds) : "ok";
  return (
    <div className="total-cell">
      <span className="total-who">{who}</span>
      <div className="total-figure">
        <strong>{total > 0 ? formatKcal(total) : "–"}</strong>{" "}
        <span className="small">{target ? `/ ${formatKcal(target)}` : "estimate"}</span>
      </div>
      {target ? (
        <div className="bar" role="img" aria-label={`${total} of ${target} kilocalories`}>
          <div className={`bar-fill ${level}`} style={{ width: `${Math.min(100, Math.round((total / target) * 100))}%` }} />
        </div>
      ) : null}
      {missing > 0 ? (
        <span className="small">
          {missing} {missing === 1 ? "meal" : "meals"} without calories
        </span>
      ) : null}
      {cheat && target ? <span className="small">Cheat day, no warnings</span> : null}
    </div>
  );
}

// One day, person by person. Breakfast, lunch and snack come from usual meals;
// dinner is the decision: a family dinner, plus the child's own from his pool.
export default function DayPlan({
  date,
  meals,
  names,
  targets,
  thresholds,
  cheat,
  childRules,
  childDinners,
  busy,
  missingCount,
  estimating,
  onSwap,
  onEstimateMissing,
  onChange,
}: {
  date: string;
  meals: Meal[];
  names: Record<ProfileId, string>;
  targets: Record<ProfileId, number | null>;
  thresholds: CalorieThresholds;
  cheat: boolean;
  childRules?: ChildRules;
  childDinners: UsualMeal[];
  busy: boolean;
  missingCount: number;
  estimating: boolean;
  onSwap: () => void;
  onEstimateMissing: () => void;
  onChange: (change: MealChange) => void;
}) {
  const childDinner = mealFor(meals, date, "dinner", "toddler");
  const familyDinner = sharedMeal(meals, date, "dinner");

  return (
    <div className="card plan-card">
      <div className="plan-grid">
        <div className="plan-colhead" aria-hidden="true" />
        {PROFILE_ORDER.map((who) => (
          <div key={who} className="plan-colhead" aria-hidden="true">
            {names[who]}
            <span className="colhead-sub">
              {targets[who] ? `target ${formatKcal(targets[who]!)} kcal` : who === "toddler" ? "estimate only, no target" : "set up profile for a target"}
            </span>
          </div>
        ))}

        {(["breakfast", "lunch", "snack"] as Slot[]).map((slot) => (
          <div key={slot} className="plan-row">
            <div className="plan-label">{SLOT_LABELS[slot]}</div>
            {PROFILE_ORDER.map((who) => (
              <PlanCell
                key={who}
                who={names[who]}
                slot={slot}
                meal={mealFor(meals, date, slot, who)}
                busy={busy}
                isChild={who === "toddler"}
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
              meal={familyDinner}
              busy={busy}
              isChild={false}
              issues={familyDinner ? toddlerIssues(familyDinner.dish, familyDinner.ingredients, childRules) : []}
              onSwap={onSwap}
              onSave={(change) => onChange({ date, slot: "dinner", who: "household", ...change })}
            />
          </div>
          <DinnerCard
            who={`${names.toddler}'s dinner`}
            sub={`${names.toddler}'s own dinner${childDinners.length > 0 ? ` · ${childDinners.length} usual to pick from` : ""}`}
            meal={childDinner}
            busy={busy}
            pool={childDinners}
            isChild
            onSave={(change) => onChange({ date, slot: "dinner", who: "toddler", ...change })}
          />
        </div>

        <div className="plan-row plan-total">
          <div className="plan-label">Day total</div>
          {PROFILE_ORDER.map((who) => (
            <TotalCell
              key={who}
              who={names[who]}
              {...dayTotal(meals, date, who)}
              target={targets[who]}
              thresholds={thresholds}
              cheat={cheat}
            />
          ))}
        </div>
      </div>

      {missingCount > 0 ? (
        <div className="plan-foot">
          <button type="button" className="link-btn" disabled={busy || estimating} onClick={onEstimateMissing}>
            {estimating ? "Estimating…" : `Estimate the ${missingCount} missing ${missingCount === 1 ? "calorie figure" : "calorie figures"}`}
          </button>
          <span className="small">Estimates, please check them.</span>
        </div>
      ) : null}
    </div>
  );
}
