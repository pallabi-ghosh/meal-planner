import type { Meal, ProfileId, Slot } from "@/types";
import type { UsualMeal, UsualMeals } from "@/lib/taste";

// Pure planning helpers for the Week screen (no Node APIs, safe in the browser).
// Dates are ISO "YYYY-MM-DD" strings handled in UTC so a timezone can't shift a day.

export const PROFILE_ORDER: ProfileId[] = ["her", "him", "toddler"];
export const PLAN_SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The Monday of the week containing `iso`.
export function mondayOf(iso: string): string {
  const { y, m, d } = parts(iso);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dayOfWeek + 6) % 7));
}

export function weekDates(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
}

export function dayTypeOf(iso: string): "weekday" | "weekend" {
  const { y, m, d } = parts(iso);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday";
}

// Today in the viewer's own calendar (not UTC).
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Usual meals tagged for this kind of day win; otherwise the "any day" ones.
// With several to choose from, rotate by the day so the week has some variety.
export function pickUsual(options: UsualMeal[], dayType: "weekday" | "weekend", dayIndex: number): UsualMeal | null {
  const tagged = options.filter((option) => option.dayType === dayType);
  const pool = tagged.length > 0 ? tagged : options.filter((option) => option.dayType === "any");
  if (pool.length === 0) return null;
  return pool[dayIndex % pool.length];
}

// A shared (household) meal covers everyone for breakfast, lunch and snack. Dinner
// is the exception: the family dinner says nothing about what the child eats.
function covers(meal: Meal, slot: Slot, who: ProfileId): boolean {
  return meal.forWhom === who || (slot !== "dinner" && meal.forWhom === "household");
}

export function mealFor(meals: Meal[], date: string, slot: Slot, who: ProfileId): Meal | undefined {
  const onDay = meals.filter((meal) => meal.date === date && meal.slot === slot);
  return onDay.find((meal) => meal.forWhom === who) ?? onDay.find((meal) => covers(meal, slot, who));
}

export function sharedMeal(meals: Meal[], date: string, slot: Slot): Meal | undefined {
  return meals.find((meal) => meal.date === date && meal.slot === slot && meal.forWhom === "household");
}

// Meals to add so every empty breakfast / lunch / snack cell gets the person's usual
// meal, and the child gets a dinner from his pool. Never overwrites anything.
// Adult dinners stay empty: dinner is the one decision made each day.
export function fillDefaults(args: {
  dates: string[];
  usual: Partial<Record<ProfileId, UsualMeals>>;
  meals: Meal[];
  makeId: () => string;
}): Meal[] {
  const added: Meal[] = [];

  args.dates.forEach((date, dayIndex) => {
    const dayType = dayTypeOf(date);
    for (const slot of PLAN_SLOTS) {
      for (const who of PROFILE_ORDER) {
        if (slot === "dinner" && who !== "toddler") continue;
        const pick = pickUsual(args.usual[who]?.[slot] ?? [], dayType, dayIndex);
        if (!pick) continue;
        const taken = [...args.meals, ...added].some(
          (meal) => meal.date === date && meal.slot === slot && covers(meal, slot, who)
        );
        if (taken) continue;
        added.push({
          id: args.makeId(),
          date,
          slot,
          forWhom: who,
          dish: pick.dish,
          ingredients: pick.ingredients,
          source: "usual",
        });
      }
    }
  });

  return added;
}

function asUTC(iso: string): Date {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayName(iso: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: style, timeZone: "UTC" }).format(asUTC(iso));
}

export function dayOfMonth(iso: string): number {
  return parts(iso).d;
}

// "14 October"
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(asUTC(iso));
}

// "12 – 18 October" (or "28 Sep – 4 Oct" across months)
export function rangeLabel(startIso: string): string {
  const endIso = addDays(startIso, 6);
  const start = parts(startIso);
  const end = parts(endIso);
  if (start.m === end.m) return `${start.d} – ${longDate(endIso)}`;
  const short = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(asUTC(iso));
  return `${short(startIso)} – ${short(endIso)}`;
}
