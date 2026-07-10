"use client";

import { useEffect, useState } from "react";
import GenerateButton from "./components/GenerateButton";
import LogPanel from "./components/LogPanel";
import GroceryPanel from "./components/GroceryPanel";
import type { SeedData } from "@/types";

const SLOT_BADGE: Record<string, string> = {
  breakfast: "B",
  lunch: "L",
  snack: "S",
  dinner: "D",
};

const SLOT_ORDER = ["breakfast", "lunch", "snack", "dinner"];

interface MealData {
  id?: string;
  date: string;
  slot: string;
  forWhom: string;
  dish: string;
  ingredients: string[];
}

interface WeekData {
  startDate: string;
  meals: MealData[];
  budgetTargetDKK?: number;
  estimatedCostDKK?: number;
}

interface GroceryItemData {
  id?: string;
  name: string;
  quantity: string;
  category: string;
  estPriceDKK: number;
  fromPantry: boolean;
}

interface MealLogData {
  mealId: string;
  eater: string;
  ate: "yes" | "substituted";
  actualDish?: string;
}

interface GenerationResponse {
  ok: boolean;
  week?: WeekData;
  grocery?: GroceryItemData[];
  message?: string;
}

function dayLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.toLocaleDateString("en-GB", { weekday: "long" })} · ${date}`;
}

export default function Home() {
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [grocery, setGrocery] = useState<GroceryItemData[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLogData[]>([]);
  const [preferencesData, setPreferencesData] = useState<SeedData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshAll() {
    const [weekRes, prefRes] = await Promise.all([fetch("/api/week"), fetch("/api/preferences")]);
    const weekJson = await weekRes.json();
    const prefJson = (await prefRes.json()) as SeedData;
    setWeekData(weekJson.week);
    setGrocery(weekJson.grocery ?? []);
    setMealLogs(weekJson.mealLogs ?? []);
    setPreferencesData(prefJson);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function handleGenerated(data: GenerationResponse) {
    if (data.ok) {
      setErrorMessage(null);
      refreshAll();
    } else {
      setErrorMessage(data.message ?? "Generation failed.");
    }
  }

  const dayGroups = weekData?.meals.reduce<Record<string, MealData[]>>((acc, meal) => {
    if (!acc[meal.date]) acc[meal.date] = [];
    acc[meal.date].push(meal);
    return acc;
  }, {}) ?? {};

  const sortedDates = Object.keys(dayGroups).sort();
  const groceryTotal = grocery.filter((item) => !item.fromPantry).reduce((sum, item) => sum + item.estPriceDKK, 0);
  const hardRules = preferencesData?.preferences.filter((p) => p.kind === "hardRule") ?? [];
  const otherPrefs = preferencesData?.preferences.filter((p) => p.kind !== "hardRule") ?? [];

  function prefLabel(pref: SeedData["preferences"][number]): string {
    if (!pref.acceptCount && !pref.rejectCount) return pref.text;
    return `${pref.text} (✓${pref.acceptCount ?? 0}/✗${pref.rejectCount ?? 0})`;
  }

  return (
    <main style={{ padding: 28 }}>
      <h1>MEAL PLANNER — v1</h1>
      <div className="sub">grounded in your real week · grocery = the commitment · schedule = flexible</div>

      <div className="grid">
        {/* SCREEN 1 — WEEK VIEW */}
        <div className="screen">
          <div className="scr-head">
            <span>① WEEK VIEW</span>
            <span className="scr-tag">home</span>
          </div>
          <div className="scr-body">
            {preferencesData && preferencesData.pantryCarryover.length > 0 ? (
              <div className="pantry">
                🥬 PANTRY CARRYOVER: {preferencesData.pantryCarryover.map((p) => p.name).join(", ")}
              </div>
            ) : null}

            <div className="budget">
              {grocery.length > 0
                ? `EST. SHOP THIS WEEK: ${groceryTotal} DKK`
                : preferencesData
                ? `TARGET: ~${preferencesData.household.budgetTargetDKK} DKK · ceiling ${preferencesData.household.budgetCeilingDKK} DKK`
                : "Loading…"}
            </div>

            {sortedDates.length === 0 ? (
              <div className="box">No week generated yet. Click generate below to build one.</div>
            ) : (
              sortedDates.map((date) => (
                <div key={date}>
                  <div className="label">{dayLabel(date)}</div>
                  {dayGroups[date]
                    .slice()
                    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
                    .map((meal, index) => (
                      <div className="row meal" key={meal.id ?? `${date}-${meal.slot}-${index}`}>
                        <span>
                          {meal.dish}
                          {meal.forWhom !== "household" ? (
                            <span className="kid">{meal.forWhom}</span>
                          ) : null}
                        </span>
                        <span className="small">{SLOT_BADGE[meal.slot] ?? meal.slot}</span>
                      </div>
                    ))}
                </div>
              ))
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <GenerateButton onGenerated={handleGenerated} />
              <a href="#grocery" className="btn ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                View grocery list →
              </a>
            </div>
            <div className="note">Tap-to-swap isn&rsquo;t built yet — log substitutions in Screen ② instead.</div>

            {errorMessage ? <div className="error">{errorMessage}</div> : null}
          </div>
        </div>

        {/* SCREEN 2 — LOG / OVERRIDE */}
        <div className="screen">
          <div className="scr-head">
            <span>② LOG / OVERRIDE</span>
            <span className="scr-tag">the feedback loop</span>
          </div>
          <div className="scr-body">
            <LogPanel meals={weekData?.meals ?? []} mealLogs={mealLogs} onLogged={refreshAll} />
          </div>
        </div>

        {/* SCREEN 3 — GROCERY + PREFS */}
        <div className="screen" id="grocery">
          <div className="scr-head">
            <span>③ GROCERY + PREFS</span>
            <span className="scr-tag">yours to edit</span>
          </div>
          <div className="scr-body">
            <GroceryPanel grocery={grocery} onChanged={refreshAll} />

            <div className="label">What I&rsquo;ve learned about you</div>
            <div className="box" style={{ borderColor: "var(--accent)" }}>
              {hardRules.map((pref) => (
                <span className="chip on" key={pref.text}>
                  {prefLabel(pref)}
                </span>
              ))}
              {otherPrefs.map((pref) => (
                <span className="chip" key={pref.text}>
                  {prefLabel(pref)}
                </span>
              ))}
            </div>
            <div className="small">
              Editable via Screen ②&rsquo;s &ldquo;push your own suggestion&rdquo; box. Accept/reject
              counts update as you log meals.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
