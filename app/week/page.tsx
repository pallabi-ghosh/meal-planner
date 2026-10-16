"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/app/components/AppData";
import GenerateButton from "@/app/components/GenerateButton";
import { dailyTarget, dayTotal, loadLevel, overPct } from "@/lib/calories";
import Alternatives, { type Alternative } from "@/app/components/week/Alternatives";
import CuisineCard from "@/app/components/week/CuisineCard";
import DayList from "@/app/components/week/DayList";
import DayPlan, { type MealChange } from "@/app/components/week/DayPlan";
import { toddlerIssues } from "@/lib/toddler";
import type { DinnerIdea } from "@/lib/dishes";
import { PLAN_SLOTS, PROFILE_ORDER, addDays, fillDefaults, longDate, mealFor, mondayOf, rangeLabel, sharedMeal, todayISO, weekDates, weekdayName } from "@/lib/plan";
import type { UsualMeals } from "@/lib/taste";
import type { GenerationResponse, Meal, ProfileId } from "@/types";

type UsualByProfile = Partial<Record<ProfileId, UsualMeals>>;

export default function WeekPage() {
  const { week, household, preferences, loaded, setupComplete, refresh } = useAppData();
  const [usual, setUsual] = useState<UsualByProfile>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [alts, setAlts] = useState<{ date: string; ideas: Alternative[]; loading: boolean; note: string | null } | null>(null);

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

  const targets: Record<ProfileId, number | null> = {
    her: dailyTarget(household?.profiles.find((p) => p.id === "her")),
    him: dailyTarget(household?.profiles.find((p) => p.id === "him")),
    toddler: null,
  };

  const thresholds = household?.calorieThresholds ?? { amberPct: 10, redPct: 25 };

  // Days where an adult is over target (the cheat day is exempt). Shown as a pill in the calendar.
  const flags: Record<string, { pct: number; level: "amber" | "red" }> = {};
  for (const date of dates) {
    if (date === week?.cheatDay) continue;
    for (const who of ["her", "him"] as const) {
      const target = targets[who];
      const { total } = dayTotal(meals, date, who);
      if (!target || total === 0) continue;
      const level = loadLevel(total, target, thresholds);
      if (level === "ok") continue;
      const pct = overPct(total, target);
      if (!flags[date] || pct > flags[date].pct) flags[date] = { pct, level };
    }
  }

  const childRules = household?.profiles.find((p) => p.id === "toddler")?.childRules;
  const cuisineOf = (date: string) => week?.cuisine?.byDate?.[date] ?? week?.cuisine?.week ?? "";
  const cuisines: Record<string, string> = {};
  for (const date of dates) {
    // Only label dinners we know the style of: suggested ones, or a day with its own cuisine.
    const dinner = sharedMeal(meals, date, "dinner");
    if (dinner && cuisineOf(date) && (dinner.source === "generated" || week?.cuisine?.byDate?.[date])) cuisines[date] = cuisineOf(date);
  }
  const openDates = dates.filter((date) => date >= today && !sharedMeal(meals, date, "dinner"));

  // Meals on a day that still have no calorie figure (each meal counted once).
  function missingKcalMeals(date: string): Meal[] {
    const found = new Map<string, Meal>();
    for (const who of PROFILE_ORDER) {
      for (const slot of PLAN_SLOTS) {
        const meal = mealFor(meals, date, slot, who) ?? (slot === "dinner" && who !== "toddler" ? sharedMeal(meals, date, slot) : undefined);
        if (meal?.id && meal.kcal === undefined) found.set(meal.id, meal);
      }
    }
    return [...found.values()];
  }

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
    // Changing only the calories keeps what the meal already knows (its ingredients and "usual" tag).
    const before = index >= 0 && meals[index].dish === dish ? meals[index] : undefined;
    const updated: Meal = {
      id: index >= 0 ? meals[index].id : crypto.randomUUID(),
      date: change.date,
      slot: change.slot,
      forWhom: change.who,
      dish,
      ingredients: change.ingredients ?? before?.ingredients ?? [],
      source: before?.source ?? change.source ?? "manual",
      ...(change.kcal ? { kcal: change.kcal } : {}),
    };
    saveMeals(index >= 0 ? meals.map((m, i) => (i === index ? updated : m)) : [...meals, updated]);
  }

  async function fetchIdeas(count: number, cuisine: string, exclude: string[]): Promise<{ dishes: DinnerIdea[]; source: string } | null> {
    try {
      const res = await fetch("/api/dinners/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine, count, exclude }),
      });
      const data = await res.json();
      return data.ok ? { dishes: data.dishes as DinnerIdea[], source: data.source as string } : null;
    } catch {
      return null;
    }
  }

  const sourceNote = (sources: string[]) =>
    sources.every((src) => src === "builtin")
      ? "from the built-in ideas, because the AI model wasn't available"
      : sources.some((src) => src !== "ai")
        ? "from the AI model, topped up with built-in ideas"
        : "from the AI model";

  async function saveCuisine(weekCuisine: string, dayCuisine: string) {
    const byDate = { ...(week?.cuisine?.byDate ?? {}) };
    if (dayCuisine) byDate[selectedDate] = dayCuisine;
    else delete byDate[selectedDate];
    await send("/api/week/cuisine", { week: weekCuisine, byDate });
  }

  // Fills every open dinner, one request per cuisine so a Thursday exception gets its own style.
  async function suggestOpen() {
    setNotice(null);
    setMessage(null);
    if (openDates.some((date) => !cuisineOf(date))) {
      setMessage("Pick a cuisine for the week first (or one for each open day).");
      return;
    }
    setSuggesting(true);
    const exclude = meals.filter((m) => m.slot === "dinner" && m.forWhom === "household").map((m) => m.dish);
    const added: Meal[] = [];
    const sources: string[] = [];
    try {
      for (const cuisine of [...new Set(openDates.map(cuisineOf))]) {
        const forCuisine = openDates.filter((date) => cuisineOf(date) === cuisine);
        const result = await fetchIdeas(forCuisine.length, cuisine, exclude);
        if (!result) {
          setMessage("Couldn't get suggestions. Check the Mac is on and try again.");
          return;
        }
        sources.push(result.source);
        forCuisine.forEach((date, i) => {
          const idea = result.dishes[i];
          if (!idea) return;
          exclude.push(idea.dish);
          added.push({
            id: crypto.randomUUID(),
            date,
            slot: "dinner",
            forWhom: "household",
            dish: idea.dish,
            ingredients: idea.ingredients,
            source: "generated",
            ...(idea.kcal ? { kcal: idea.kcal } : {}),
          });
        });
      }
      if (added.length > 0 && (await saveMeals([...meals, ...added]))) {
        setNotice(`Suggested ${added.length} ${added.length === 1 ? "dinner" : "dinners"} ${sourceNote(sources)}. Swap any you don't like.`);
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function loadAlternatives(date: string, avoid: string[] = []) {
    setAlts((current) => ({ date, ideas: current?.date === date ? current.ideas : [], loading: true, note: null }));
    const exclude = [...meals.filter((m) => m.slot === "dinner" && m.forWhom === "household").map((m) => m.dish), ...avoid];
    const result = await fetchIdeas(3, cuisineOf(date), exclude);
    setAlts({
      date,
      loading: false,
      ideas: (result?.dishes ?? []).map((idea) => ({ ...idea, issues: toddlerIssues(idea.dish, idea.ingredients, childRules) })),
      note: !result
        ? "Couldn't get ideas. Check the Mac is on and try again."
        : !cuisineOf(date)
          ? "No cuisine is set for this day, so these are mixed ideas."
          : `Ideas ${sourceNote([result.source])}.`,
    });
  }

  function useAlternative(idea: Alternative) {
    if (!alts) return;
    changeMeal({ date: alts.date, slot: "dinner", who: "household", dish: idea.dish, ingredients: idea.ingredients, kcal: idea.kcal, source: "generated" });
    setAlts(null);
  }

  async function estimateMissing(date: string) {
    const targets = missingKcalMeals(date);
    if (targets.length === 0) return;
    setNotice(null);
    setMessage(null);
    setEstimating(true);
    try {
      const res = await fetch("/api/estimate-kcal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: targets.map((m) => ({ id: m.id, dish: m.dish, forChild: m.forWhom === "toddler", slot: m.slot })) }),
      });
      const estimates = ((await res.json()).estimates ?? {}) as Record<string, { kcal: number }>;
      const found = targets.filter((m) => m.id && estimates[m.id]).length;
      if (found === 0) {
        setMessage("Couldn't estimate this time. Is Ollama running? You can type the calories in.");
        return;
      }
      const next = meals.map((m) => (m.id && estimates[m.id] ? { ...m, kcal: estimates[m.id].kcal } : m));
      if (await saveMeals(next)) setNotice(`Estimated ${found} of ${targets.length}. They are estimates, so edit any that look off.`);
    } catch {
      setMessage("Couldn't reach the planner. Check the Mac is on and try again.");
    } finally {
      setEstimating(false);
    }
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
            <aside className="week-side">
              <DayList
                label={rangeLabel(week.startDate)}
                dates={dates}
                meals={meals}
                finalised={finalised}
                cheatDay={week.cheatDay}
                cuisines={cuisines}
                flags={flags}
                selected={selectedDate}
                today={today}
                onSelect={setSelected}
              />
              <CuisineCard
                weekCuisine={week.cuisine?.week ?? ""}
                dayCuisine={week.cuisine?.byDate?.[selectedDate] ?? ""}
                dayLabel={weekdayName(selectedDate, "long")}
                openCount={openDates.length}
                busy={busy}
                suggesting={suggesting}
                onSave={saveCuisine}
                onSuggest={suggestOpen}
              />
            </aside>

            <section>
              <div className="day-head day-head-row">
                <div>
                  <h2>
                    {weekdayName(selectedDate, "long")} {longDate(selectedDate)}
                  </h2>
                  <p>Dinner is the only decision. The rest fills in from everyone&rsquo;s usual meals.</p>
                </div>
                <label className="cheat-toggle">
                  <input
                    type="checkbox"
                    checked={week.cheatDay === selectedDate}
                    disabled={busy}
                    onChange={(e) => send("/api/week/cheat-day", { date: e.target.checked ? selectedDate : null })}
                  />
                  Make this the cheat day
                </label>
              </div>
              <DayPlan
                date={selectedDate}
                meals={meals}
                names={names}
                targets={targets}
                thresholds={thresholds}
                cheat={week.cheatDay === selectedDate}
                childRules={childRules}
                childDinners={usual.toddler?.dinner ?? []}
                busy={busy}
                missingCount={missingKcalMeals(selectedDate).length}
                estimating={estimating}
                onSwap={() => loadAlternatives(selectedDate)}
                onEstimateMissing={() => estimateMissing(selectedDate)}
                onChange={changeMeal}
              />

              {alts && alts.date === selectedDate ? (
                <Alternatives
                  title={`3 alternatives for ${weekdayName(selectedDate, "long")}'s dinner`}
                  ideas={alts.ideas}
                  loading={alts.loading}
                  note={alts.note}
                  busy={busy}
                  onUse={useAlternative}
                  onMore={() => loadAlternatives(selectedDate, alts.ideas.map((i) => i.dish))}
                  onClose={() => setAlts(null)}
                />
              ) : null}

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

      {notice ? <div className="note" style={{ marginTop: 12 }}>{notice}</div> : null}
      {message ? <div className="error">{message}</div> : null}

      <details className="box" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>Generate a whole week with AI instead</summary>
        <div className="small" style={{ margin: "8px 0" }}>
          Replaces the current plan with a generated one and emails it. For one dinner at a time, use Suggest or Swap
          above.
        </div>
        <GenerateButton
          onGenerated={handleGenerated}
          confirmMessage={meals.length > 0 ? "This replaces the current plan with a generated week. Continue?" : undefined}
        />
      </details>
    </div>
  );
}
