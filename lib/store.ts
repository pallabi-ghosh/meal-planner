import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GroceryItem, Meal, MealLog, Preference, Scope, SeedData, Week } from "@/types";

// Personal, single-family app — plain JSON files are the storage layer.
// See NOTES.md: "DB is low-stakes... start with whatever is easiest."

const DATA_DIR = path.join(process.cwd(), "data");
const CURRENT_WEEK_PATH = path.join(DATA_DIR, "current-week.json");
const MEAL_LOGS_PATH = path.join(DATA_DIR, "meal-logs.json");
const PREFERENCES_PATH = path.join(DATA_DIR, "seed-preferences.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export interface StoredWeek {
  week: Week | null;
  grocery: GroceryItem[];
}

const EMPTY_STORED_WEEK: StoredWeek = { week: null, grocery: [] };

export async function getCurrentWeek(): Promise<StoredWeek> {
  return readJson<StoredWeek>(CURRENT_WEEK_PATH, EMPTY_STORED_WEEK);
}

export function assignMealIds(week: Week): Week {
  return {
    ...week,
    meals: week.meals.map((meal, index) => ({
      ...meal,
      id: meal.id ?? `${meal.date}_${meal.slot}_${meal.forWhom}_${index}`,
    })),
  };
}

// Guarantees every item has a stable id, regardless of source (AI generation,
// manual add, or older data saved before ids existed) — so two items that happen
// to share a name (e.g. two "egg" entries) never collide as React keys or in
// toggle/remove lookups by id.
function assignGroceryIds(grocery: GroceryItem[]): GroceryItem[] {
  return grocery.map((item, index) => ({
    ...item,
    id: item.id ?? `g_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
  }));
}

export async function saveCurrentWeek(week: Week, grocery: GroceryItem[]): Promise<StoredWeek> {
  const stored: StoredWeek = { week: assignMealIds(week), grocery: assignGroceryIds(grocery) };
  await writeJson(CURRENT_WEEK_PATH, stored);
  return stored;
}

// Lets the grocery list be hand-edited independently of AI generation — the week
// (if any) stays untouched.
export async function updateGroceryList(grocery: GroceryItem[]): Promise<StoredWeek> {
  const current = await getCurrentWeek();
  const stored: StoredWeek = { week: current.week, grocery: assignGroceryIds(grocery) };
  await writeJson(CURRENT_WEEK_PATH, stored);
  return stored;
}

// Lets the meal list be hand-edited (Screen 1: add/remove a dish) independently of
// grocery edits. If no week exists yet, starts a fresh one so manual planning works
// even before the first AI generation.
export async function updateMeals(meals: Meal[]): Promise<StoredWeek> {
  const current = await getCurrentWeek();
  const week: Week = current.week
    ? { ...current.week, meals }
    : { startDate: new Date().toISOString().slice(0, 10), meals, budgetTargetDKK: 0 };
  const stored: StoredWeek = { week, grocery: current.grocery };
  await writeJson(CURRENT_WEEK_PATH, stored);
  return stored;
}

export async function getMealLogs(): Promise<MealLog[]> {
  return readJson<MealLog[]>(MEAL_LOGS_PATH, []);
}

export async function appendMealLog(entry: Omit<MealLog, "id" | "loggedAt">): Promise<MealLog> {
  const logs = await getMealLogs();
  const log: MealLog = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    loggedAt: new Date().toISOString(),
  };
  logs.push(log);
  await writeJson(MEAL_LOGS_PATH, logs);
  return log;
}

export async function getPreferencesData(): Promise<SeedData> {
  // Re-read from disk (not the static import) so runtime updates are visible.
  return readJson<SeedData>(PREFERENCES_PATH, {
    household: { members: [], location: "", budgetTargetDKK: 0, budgetCeilingDKK: 0, notes: "" },
    preferences: [],
    pantryCarryover: [],
  });
}

async function savePreferencesData(data: SeedData): Promise<void> {
  await writeJson(PREFERENCES_PATH, data);
}

const STOPWORDS = new Set(["with", "and", "the", "for", "have", "your", "this", "that", "from"]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

/**
 * Best-effort match: a logged meal's dish text against existing hardRule/learned
 * preferences sharing the meal's scope (or household). No direct FK exists between
 * a generated Meal and a Preference, so this is a keyword-overlap heuristic, same
 * style as the category matching in lib/grocery.ts. Returns null if nothing matches
 * closely enough — the MealLog itself is still saved regardless.
 */
export async function bumpPreferenceCount(
  scope: Scope,
  dishText: string,
  direction: "accept" | "reject"
): Promise<Preference | null> {
  const data = await getPreferencesData();
  const dishWords = new Set(significantWords(dishText));
  if (dishWords.size === 0) return null;

  const candidate = data.preferences.find((pref) => {
    if (pref.kind !== "hardRule" && pref.kind !== "learned") return false;
    if (pref.scope !== scope && pref.scope !== "household") return false;
    const prefWords = significantWords(pref.text);
    return prefWords.some((word) => dishWords.has(word));
  });

  if (!candidate) return null;

  if (direction === "accept") {
    candidate.acceptCount = (candidate.acceptCount ?? 0) + 1;
  } else {
    candidate.rejectCount = (candidate.rejectCount ?? 0) + 1;
  }

  await savePreferencesData(data);
  return candidate;
}

export async function addLearnedPreference(scope: Scope, text: string): Promise<Preference> {
  const data = await getPreferencesData();
  const preference: Preference = { scope, kind: "learned", text, acceptCount: 1, rejectCount: 0 };
  data.preferences.push(preference);
  await savePreferencesData(data);
  return preference;
}
