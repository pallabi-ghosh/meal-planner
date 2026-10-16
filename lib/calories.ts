import type { ActivityLevel, CalorieThresholds, Meal, Profile, ProfileId } from "@/types";
import { mealFor, PLAN_SLOTS, sharedMeal } from "./plan";

// Daily calorie target for an adult: Mifflin-St Jeor resting rate times an activity factor.
// Pure functions, safe in the browser. The child has no target (the epic says estimate only).

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Weight is optional on the profile. Without it, assume a healthy BMI of 22 for that height.
function assumedWeightKg(heightCm: number): number {
  const metres = heightCm / 100;
  return 22 * metres * metres;
}

// Rounded to the nearest 10 so it reads like a target, not a measurement.
export function dailyTarget(profile: Profile | undefined): number | null {
  if (!profile || profile.kind !== "adult") return null;
  const { sex, ageYears, heightCm, weightKg, activity } = profile;
  if (!sex || !ageYears || !heightCm) return null;

  const weight = weightKg ?? assumedWeightKg(heightCm);
  const resting = 10 * weight + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161);
  return Math.round((resting * ACTIVITY_FACTOR[activity ?? "light"]) / 10) * 10;
}

export function formatKcal(value: number): string {
  return value.toLocaleString("en-US");
}

// What one person eats on a day: their own meals plus shared ones that cover them.
// Meals without a calorie figure are counted in `missing`, not guessed.
export function dayTotal(meals: Meal[], date: string, who: ProfileId): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const slot of PLAN_SLOTS) {
    // Adults eat the family dinner; the child has his own.
    const meal = mealFor(meals, date, slot, who) ?? (slot === "dinner" && who !== "toddler" ? sharedMeal(meals, date, slot) : undefined);
    if (!meal) continue;
    if (typeof meal.kcal === "number") total += meal.kcal;
    else missing += 1;
  }
  return { total, missing };
}

export type Load = "ok" | "amber" | "red";

// How far over target a day is, as a percentage (negative when under).
export function overPct(total: number, target: number): number {
  return Math.round((total / target - 1) * 100);
}

export function loadLevel(total: number, target: number, thresholds: CalorieThresholds): Load {
  const over = overPct(total, target);
  if (over > thresholds.redPct) return "red";
  if (over > thresholds.amberPct) return "amber";
  return "ok";
}
