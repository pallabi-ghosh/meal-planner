"use client";

import { useState } from "react";
import GenerateButton from "./components/GenerateButton";
import seed from "@/data/seed-preferences.json";
import type { SeedData } from "@/types";

const seedData = seed as SeedData;

const SLOT_BADGE: Record<string, string> = {
  breakfast: "B",
  lunch: "L",
  snack: "S",
  dinner: "D",
};

const SLOT_ORDER = ["breakfast", "lunch", "snack", "dinner"];

interface GenerationResponse {
  ok: boolean;
  week?: {
    startDate: string;
    meals: Array<{
      date: string;
      slot: string;
      forWhom: string;
      dish: string;
      ingredients: string[];
    }>;
    budgetTargetDKK?: number;
    estimatedCostDKK?: number;
  };
  grocery?: Array<{
    name: string;
    quantity: string;
    category: string;
    estPriceDKK: number;
    fromPantry: boolean;
  }>;
  message?: string;
}

function dayLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.toLocaleDateString("en-GB", { weekday: "long" })} · ${date}`;
}

export default function Home() {
  const [result, setResult] = useState<GenerationResponse | null>(null);

  const dayGroups = result?.week?.meals.reduce<Record<string, typeof result.week.meals>>((acc, meal) => {
    if (!acc[meal.date]) acc[meal.date] = [];
    acc[meal.date].push(meal);
    return acc;
  }, {}) ?? {};

  const sortedDates = Object.keys(dayGroups).sort();
  const grocery = result?.grocery ?? [];
  const pantryPreview = seedData.household ? seedData : null;
  const hardRules = seedData.preferences.filter((p) => p.kind === "hardRule");
  const otherPrefs = seedData.preferences.filter((p) => p.kind !== "hardRule");

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
            {pantryPreview && pantryPreview.pantryCarryover.length > 0 ? (
              <div className="pantry">
                🥬 PANTRY CARRYOVER: {pantryPreview.pantryCarryover.map((p) => p.name).join(", ")}
              </div>
            ) : null}

            <div className="budget">
              {result?.week?.estimatedCostDKK != null
                ? `EST. SHOP THIS WEEK: ${result.week.estimatedCostDKK} DKK`
                : `TARGET: ~${seedData.household.budgetTargetDKK} DKK · ceiling ${seedData.household.budgetCeilingDKK} DKK`}
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
                      <div className="row meal" key={`${date}-${meal.slot}-${index}`}>
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
              <GenerateButton onGenerated={setResult} />
              <a href="#grocery" className="btn ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                View grocery list →
              </a>
            </div>
            <div className="note">Tap-to-swap and daily logging aren&rsquo;t built yet — see Screen ②.</div>

            {result && !result.ok ? <div className="error">{result.message ?? "Generation failed."}</div> : null}
          </div>
        </div>

        {/* SCREEN 2 — LOG / OVERRIDE (placeholder, not built) */}
        <div className="screen disabled">
          <div className="scr-head">
            <span>② LOG / OVERRIDE</span>
            <span className="scr-tag">phase 2 — not built yet</span>
          </div>
          <div className="scr-body">
            <div className="box">📧 Morning ping: &ldquo;Did you have the planned breakfast?&rdquo;</div>
            <div className="qrow">
              <div className="qbtn">✓ Yes, ate it</div>
              <div className="qbtn">✗ No, something else</div>
            </div>
            <div className="ovr">
              <div className="label" style={{ marginTop: 0, color: "var(--blue)" }}>
                What did you eat instead?
              </div>
              <div className="small">→ will log a substitution and update preference counts</div>
            </div>
            <div className="note">This screen will close the feedback loop. Coming in Phase 2.</div>
          </div>
        </div>

        {/* SCREEN 3 — GROCERY + PREFS */}
        <div className="screen" id="grocery">
          <div className="scr-head">
            <span>③ GROCERY + PREFS</span>
            <span className="scr-tag">code-computed</span>
          </div>
          <div className="scr-body">
            <div className="label">Grocery list (auto, minus pantry)</div>
            {grocery.length === 0 ? (
              <div className="box">Generate a week to see the grocery list here.</div>
            ) : (
              <>
                {grocery.map((item) => (
                  <div
                    className="row"
                    key={item.name}
                    style={item.fromPantry ? { opacity: 0.45, textDecoration: "line-through" } : undefined}
                  >
                    <span>{item.fromPantry ? item.name : `☐ ${item.name} — ${item.quantity}`}</span>
                    <span className="small">{item.fromPantry ? "pantry" : `${item.estPriceDKK} DKK`}</span>
                  </div>
                ))}
                <div className="tot">
                  <span>TOTAL</span>
                  <span>{result?.week?.estimatedCostDKK ?? 0} DKK</span>
                </div>
              </>
            )}

            <div className="label">What I&rsquo;ve learned about you</div>
            <div className="box" style={{ borderColor: "var(--accent)" }}>
              {hardRules.map((pref) => (
                <span className="chip on" key={pref.text}>
                  {pref.text}
                </span>
              ))}
              {otherPrefs.map((pref) => (
                <span className="chip" key={pref.text}>
                  {pref.text}
                </span>
              ))}
            </div>
            <div className="small">
              These come from data/seed-preferences.json for now. An editable list with accept/reject
              tracking arrives in Phase 2.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
