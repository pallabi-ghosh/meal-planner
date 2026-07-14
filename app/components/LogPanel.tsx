"use client";

import { useState } from "react";
import type { AteStatus, Meal, MealLog, Scope } from "@/types";

interface LogPanelProps {
  meals: Meal[];
  mealLogs: MealLog[];
  onLogged: () => void;
}

const SCOPES: Scope[] = ["him", "her", "toddler", "household"];

function SubstitutionForm({ onSubmit }: { onSubmit: (actualDish: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="ovr">
      <div className="label" style={{ marginTop: 0, color: "var(--blue)" }}>
        What did you eat instead?
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="text-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. chai + biscuit"
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          disabled={!value.trim()}
          onClick={() => onSubmit(value.trim())}
        >
          Save log
        </button>
      </div>
      <div className="small">→ logs the substitution and nudges the matching preference's counts</div>
    </div>
  );
}

function MealLogRow({ meal, log, onLogged }: { meal: Meal; log?: MealLog; onLogged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitLog(ate: AteStatus, actualDish?: string) {
    if (!meal.id) return;
    setBusy(true);
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id, eater: meal.forWhom, ate, actualDish }),
      });
      setShowForm(false);
      onLogged();
    } finally {
      setBusy(false);
    }
  }

  if (log) {
    return (
      <div className="box">
        <strong>{meal.dish}</strong> ({meal.slot}) —{" "}
        {log.ate === "yes" ? "✓ ate it as planned" : `✗ had ${log.actualDish} instead`}
      </div>
    );
  }

  return (
    <div className="box" style={{ borderStyle: "solid" }}>
      <div>
        📧 <strong>{meal.dish}</strong> — {meal.slot} ({meal.forWhom})
      </div>
      <div className="qrow">
        <button className="qbtn" disabled={busy} onClick={() => submitLog("yes")}>
          ✓ Yes, ate it
        </button>
        <button className="qbtn" disabled={busy} onClick={() => setShowForm((s) => !s)}>
          ✗ No, something else
        </button>
      </div>
      {showForm ? <SubstitutionForm onSubmit={(dish) => submitLog("substituted", dish)} /> : null}
    </div>
  );
}

export default function LogPanel({ meals, mealLogs, onLogged }: LogPanelProps) {
  const [suggestionScope, setSuggestionScope] = useState<Scope>("household");
  const [suggestionText, setSuggestionText] = useState("");
  const [savingSuggestion, setSavingSuggestion] = useState(false);

  async function saveSuggestion() {
    if (!suggestionText.trim()) return;
    setSavingSuggestion(true);
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eater: suggestionScope, newPreferenceText: suggestionText.trim() }),
      });
      setSuggestionText("");
      onLogged();
    } finally {
      setSavingSuggestion(false);
    }
  }

  const logByMealId = new Map(mealLogs.map((l) => [l.mealId, l]));

  return (
    <>
      {meals.length === 0 ? (
        <div className="box">Generate a week first, then log what was actually eaten here.</div>
      ) : (
        meals.map((meal) => (
          <MealLogRow
            key={meal.id ?? `${meal.date}-${meal.slot}-${meal.forWhom}`}
            meal={meal}
            log={meal.id ? logByMealId.get(meal.id) : undefined}
            onLogged={onLogged}
          />
        ))
      )}

      <div className="label">Push your own suggestion</div>
      <div className="box">
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <select
            className="text-input"
            value={suggestionScope}
            onChange={(e) => setSuggestionScope(e.target.value as Scope)}
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="text-input"
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            placeholder="For breakfast I usually like…"
            style={{ flex: 1 }}
          />
        </div>
        <button className="btn" disabled={savingSuggestion || !suggestionText.trim()} onClick={saveSuggestion}>
          Add as a preference
        </button>
      </div>
      <div className="note">Becomes a Preference the AI respects next time it generates a week.</div>
    </>
  );
}
