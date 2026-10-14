"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/app/components/AppData";
import GenerateButton from "@/app/components/GenerateButton";
import DayList from "@/app/components/week/DayList";
import DayPlan, { type MealChange } from "@/app/components/week/DayPlan";
import { PROFILE_ORDER, addDays, fillDefaults, longDate, mondayOf, rangeLabel, sharedMeal, todayISO, weekDates, weekdayName } from "@/lib/plan";
import type { UsualMeals } from "@/lib/taste";
import type { GenerationResponse, Meal, ProfileId } from "@/types";

type UsualByProfile = Partial<Record<ProfileId, UsualMeals>>;

export default function WeekPage() {
  const { week, household, preferences, loaded, setupComplete, refresh } = useAppData();
  const [usual, setUsual] = useState<UsualByProfile>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Everyone's usual meals feed the prefilled breakfast, lunch, snack and child dinner.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PROFILE_ORDER.map((id) =>
        fetch(`/api/taste/${id}`)
          .then((res) => res.json())
          .then((data) => [id, data.usualMeals as UsualMeals] as const)
          .catch(() => [id, undefined] as const)
      )
    ).then((entries) => {
      if (cancelled) return;
      const next: UsualByProfile = {};
      for (const [id, meals] of entries) if (meals) next[id] = meals;
      setUsual(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return <div className="card" style={{ padding: 16 }}>Loading…</div>;

  const today = todayISO();
  const meals: Meal[] = week?.meals ?? [];
  const dates = week ? weekDates(week.startDate) : [];
  const stale = week ? addDays(week.startDate, 6) < today : false;
  const selectedDate = selected && dates.includes(selected) ? selected : dates.includes(today) ? today : dates[0];

  const names = {
    her: household?.profiles.find((p) => p.id === "her")?.name ?? "Her",
    him: household?.profiles.find((p) => p.id === "him")?.name ?? "Him",
    toddler: household?.profiles.find((p) => p.id === "toddler")?.name ?? "Child",
  };

  const gapCount = week ? fillDefaults({ dates, usual, meals, makeId: () => "" }).length : 0;
  const hasAnyUsual = PROFILE_ORDER.some((id) => {
    const u = usual[id];
    return u && Object.values(u).some((list) => list.length > 0);
  });

  // Finalising: days with a family dinner chosen can be locked in for grocery generation.
  const withDinner = dates.filter((date) => sharedMeal(meals, date, "dinner"));
  const finalised = (week?.finalisedDates ?? []).filter((date) => withDinner.includes(date));
  const toFinalise = withDinner.filter((date) => !finalised.includes(date));

  async function send(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message ?? "That didn't save.");
        return false;
      }
      await refresh();
      return true;
    } catch {
      setMessage("Couldn't reach the planner. Check the Mac is on and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveMeals = (next: Meal[]) => send("/api/meals", { meals: next });
  const setFinalised = (next: string[]) => send("/api/week/finalise", { dates: next });

  async function startWeek() {
    if (week && week.meals.length > 0 && !window.confirm("Start a new week? This clears the current plan. The grocery list is kept.")) {
      return;
    }
    if (await send("/api/week", { startDate: mondayOf(today) })) setSelected(null);
  }

  function fillWeek() {
    const added = fillDefaults({ dates, usual, meals, makeId: () => crypto.randomUUID() });
    if (added.length > 0) saveMeals([...meals, ...added]);
  }

  function changeMeal(change: MealChange) {
    const index = meals.findIndex((m) => m.date === change.date && m.slot === change.slot && m.forWhom === change.who);
    const dish = change.dish.trim();

    if (!dish) {
      if (index >= 0) saveMeals(meals.filter((_, i) => i !== index));
      return;
    }
    const updated: Meal = {
      id: index >= 0 ? meals[index].id : crypto.randomUUID(),
      date: change.date,
      slot: change.slot,
      forWhom: change.who,
      dish,
      ingredients: change.ingredients ?? [],
      source: change.source ?? "manual",
    };
    saveMeals(index >= 0 ? meals.map((m, i) => (i === index ? updated : m)) : [...meals, updated]);
  }

  function handleGenerated(data: GenerationResponse) {
    if (data.ok) {
      setMessage(null);
      refresh();
    } else {
      setMessage(data.message ?? "Generation failed.");
    }
  }

  return (
    <div className="week-page">
      {!setupComplete ? (
        <div className="budget">
          Finish setting up your profiles so calorie targets and food rules apply.{" "}
          <Link href="/profiles">Set up profiles</Link>
        </div>
      ) : null}

      {preferences && preferences.pantryCarryover.length > 0 ? (
        <div className="pantry">Pantry carry-over: {preferences.pantryCarryover.map((p) => p.name).join(", ")}</div>
      ) : null}

      {!week ? (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <strong>No plan yet.</strong>
          <div className="small" style={{ margin: "4px 0 10px" }}>
            Start this week&rsquo;s plan, then fill it in from everyone&rsquo;s usual meals.
          </div>
          <button className="btn" disabled={busy} onClick={startWeek}>
            Start this week&rsquo;s plan
          </button>
        </div>
      ) : null}

      {week && stale ? (
        <div className="pantry">
          This plan is for {rangeLabel(week.startDate)}.{" "}
          <button className="link-btn" disabled={busy} onClick={startWeek}>
            Start this week&rsquo;s plan
          </button>
        </div>
      ) : null}

      {week && gapCount > 0 ? (
        <div className="ovr" style={{ marginTop: 0, marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{gapCount} meals can be filled from usual meals</div>
          <div className="small" style={{ margin: "2px 0 8px" }}>
            Breakfast, lunch, snacks and {names.toddler}&rsquo;s dinner. Nothing you&rsquo;ve already planned is changed.
          </div>
          <button className="btn" disabled={busy} onClick={fillWeek}>
            Fill the week from usual meals
          </button>
        </div>
      ) : null}

      {week && gapCount === 0 && !hasAnyUsual && meals.length === 0 ? (
        <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
          Add usual meals in <Link href="/profiles">Profiles</Link> and breakfast, lunch and snacks fill in by themselves.
        </div>
      ) : null}

      {week && selectedDate ? (
        <>
          <div className="week-layout">
            <DayList
              label={rangeLabel(week.startDate)}
              dates={dates}
              meals={meals}
              finalised={finalised}
              selected={selectedDate}
              today={today}
              onSelect={setSelected}
            />

            <section>
              <div className="day-head">
                <h2>
                  {weekdayName(selectedDate, "long")} {longDate(selectedDate)}
                </h2>
                <p>Dinner is the only decision. The rest fills in from everyone&rsquo;s usual meals.</p>
              </div>
              <DayPlan
                date={selectedDate}
                meals={meals}
                names={names}
                childDinners={usual.toddler?.dinner ?? []}
                busy={busy}
                onChange={changeMeal}
              />

              <div className="card finalise">
                <div>
                  <div style={{ fontWeight: 600 }}>{withDinner.length} of 7 dinners decided</div>
                  <div className="small">
                    {finalised.length > 0 && toFinalise.length === 0
                      ? `All ${finalised.length} planned days are finalised. `
                      : "Finalising locks the plan in for the grocery list. "}
                    <Link href="/grocery">Go to grocery</Link>
                  </div>
                </div>
                {toFinalise.length > 0 ? (
                  <button className="btn" disabled={busy} onClick={() => setFinalised([...finalised, ...toFinalise])}>
                    Finalise week
                  </button>
                ) : finalised.length > 0 ? (
                  <button className="btn ghost" disabled={busy} onClick={() => setFinalised([])}>
                    Reopen week
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {message ? <div className="error">{message}</div> : null}

      <details className="box" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>Generate a whole week with AI instead</summary>
        <div className="small" style={{ margin: "8px 0" }}>
          Replaces the current plan with a generated one and emails it. Dinner suggestions that respect the usual
          meals are coming next.
        </div>
        <GenerateButton
          onGenerated={handleGenerated}
          confirmMessage={meals.length > 0 ? "This replaces the current plan with a generated week. Continue?" : undefined}
        />
      </details>
    </div>
  );
}
