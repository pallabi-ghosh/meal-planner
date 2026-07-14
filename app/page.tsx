"use client";

import { useEffect, useState } from "react";
import GenerateButton from "./components/GenerateButton";
import LogPanel from "./components/LogPanel";
import GroceryPanel from "./components/GroceryPanel";
import MealPlanPanel from "./components/MealPlanPanel";
import type { GenerationResponse, GroceryItem, MealLog, SeedData, Week } from "@/types";

export default function Home() {
  const [weekData, setWeekData] = useState<Week | null>(null);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
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
              {preferencesData
                ? `TARGET: ~${preferencesData.household.budgetTargetDKK} DKK · ceiling ${preferencesData.household.budgetCeilingDKK} DKK`
                : "Loading…"}
            </div>

            <MealPlanPanel meals={weekData?.meals ?? []} startDate={weekData?.startDate} onChanged={refreshAll} />

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <GenerateButton onGenerated={handleGenerated} />
              <a href="#grocery" className="btn ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                View grocery list →
              </a>
            </div>
            <div className="note">Tap-to-swap isn&rsquo;t built yet — log substitutions in Screen ③ instead.</div>

            {errorMessage ? <div className="error">{errorMessage}</div> : null}
          </div>
        </div>

        {/* SCREEN 2 — GROCERY + PREFS */}
        <div className="screen" id="grocery">
          <div className="scr-head">
            <span>② GROCERY + PREFS</span>
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
              Editable via Screen ③&rsquo;s &ldquo;push your own suggestion&rdquo; box. Accept/reject
              counts update as you log meals.
            </div>
          </div>
        </div>

        {/* SCREEN 3 — LOG / OVERRIDE */}
        <div className="screen">
          <div className="scr-head">
            <span>③ LOG / OVERRIDE</span>
            <span className="scr-tag">the feedback loop</span>
          </div>
          <div className="scr-body">
            <LogPanel meals={weekData?.meals ?? []} mealLogs={mealLogs} onLogged={refreshAll} />
          </div>
        </div>
      </div>
    </main>
  );
}
