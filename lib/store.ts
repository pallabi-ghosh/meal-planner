import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BoughtEntry, GroceryItem, Household, Meal, MealLog, PantryData, Preference, ProfileId, Scope, SeedData, Week } from "@/types";
import { itemKey } from "@/lib/groceryRange";
import { parseTasteFile, serialiseTasteFile, type TasteFile, type UsualMeals } from "@/lib/taste";

// Personal, single-family app — plain JSON files are the storage layer.
// See NOTES.md: "DB is low-stakes... start with whatever is easiest."

const DATA_DIR = path.join(process.cwd(), "data");
const CURRENT_WEEK_PATH = path.join(DATA_DIR, "current-week.json");
const MEAL_LOGS_PATH = path.join(DATA_DIR, "meal-logs.json");
const PREFERENCES_PATH = path.join(DATA_DIR, "seed-preferences.json");
const HOUSEHOLD_PATH = path.join(DATA_DIR, "household.json");
const TASTE_DIR = path.join(DATA_DIR, "taste");
const PANTRY_PATH = path.join(DATA_DIR, "pantry.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Atomic: write a temp file, then rename over the target, so a reader (or a crash)
// never sees a half-written file.
async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  await rename(tmpPath, filePath);
}

// Two phones can write the same file at once (e.g. ticking grocery items). Every
// read-modify-write on a file runs through this per-file queue so they apply one
// after another. Held on globalThis because Next may bundle each route separately.
type WriteQueues = Map<string, Promise<unknown>>;
const globalWithQueues = globalThis as typeof globalThis & { __mealPlannerWriteQueues?: WriteQueues };
const writeQueues: WriteQueues = (globalWithQueues.__mealPlannerWriteQueues ??= new Map());

function serialised<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const run = previous.then(task);
  writeQueues.set(filePath, run.catch(() => undefined));
  return run;
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

export function saveCurrentWeek(week: Week, grocery: GroceryItem[]): Promise<StoredWeek> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const stored: StoredWeek = { week: assignMealIds(week), grocery: assignGroceryIds(grocery) };
    await writeJson(CURRENT_WEEK_PATH, stored);
    return stored;
  });
}

// Lets the grocery list be hand-edited independently of AI generation — the week
// (if any) stays untouched.
export function updateGroceryList(grocery: GroceryItem[]): Promise<StoredWeek> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    const stored: StoredWeek = { week: current.week, grocery: assignGroceryIds(grocery) };
    await writeJson(CURRENT_WEEK_PATH, stored);
    return stored;
  });
}

// Lets the meal list be hand-edited (Screen 1: add/remove a dish) independently of
// grocery edits. If no week exists yet, starts a fresh one so manual planning works
// even before the first AI generation.
export function updateMeals(meals: Meal[]): Promise<StoredWeek> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    const week: Week = current.week
      ? { ...current.week, meals }
      : { startDate: new Date().toISOString().slice(0, 10), meals, budgetTargetDKK: 0 };
    const stored: StoredWeek = { week, grocery: current.grocery };
    await writeJson(CURRENT_WEEK_PATH, stored);
    return stored;
  });
}

// Begins a fresh, empty plan for the week starting on `startDate`. The grocery list
// is a separate thing and is left exactly as it is.
export function startNewWeek(startDate: string): Promise<StoredWeek> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    const week: Week = {
      startDate,
      meals: [],
      budgetTargetDKK: current.week?.budgetTargetDKK ?? 0,
    };
    const stored: StoredWeek = { week, grocery: current.grocery };
    await writeJson(CURRENT_WEEK_PATH, stored);
    return stored;
  });
}

// Marks which days of the plan are finalised (locked in for grocery generation).
// Returns null when there is no plan to finalise.
export function setFinalisedDates(dates: string[]): Promise<Week | null> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    if (!current.week) return null;
    const week: Week = { ...current.week, finalisedDates: dates };
    await writeJson(CURRENT_WEEK_PATH, { week, grocery: current.grocery } satisfies StoredWeek);
    return week;
  });
}

// One cheat day per week at most; `null` clears it.
export function setCheatDay(date: string | null): Promise<Week | null> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    if (!current.week) return null;
    const { cheatDay: _old, ...rest } = current.week;
    const week: Week = date ? { ...rest, cheatDay: date } : rest;
    await writeJson(CURRENT_WEEK_PATH, { week, grocery: current.grocery } satisfies StoredWeek);
    return week;
  });
}

// The week's cuisine, and optional per-day exceptions ("Italian on Thursday").
export function setCuisine(cuisine: { week?: string; byDate?: Record<string, string> }): Promise<Week | null> {
  return serialised(CURRENT_WEEK_PATH, async () => {
    const current = await getCurrentWeek();
    if (!current.week) return null;
    const week: Week = { ...current.week, cuisine };
    await writeJson(CURRENT_WEEK_PATH, { week, grocery: current.grocery } satisfies StoredWeek);
    return week;
  });
}

export async function getMealLogs(): Promise<MealLog[]> {
  return readJson<MealLog[]>(MEAL_LOGS_PATH, []);
}

export function appendMealLog(entry: Omit<MealLog, "id" | "loggedAt">): Promise<MealLog> {
  return serialised(MEAL_LOGS_PATH, async () => {
    const logs = await getMealLogs();
    const log: MealLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      loggedAt: new Date().toISOString(),
    };
    logs.push(log);
    await writeJson(MEAL_LOGS_PATH, logs);
    return log;
  });
}

export async function getPreferencesData(): Promise<SeedData> {
  // Re-read from disk (not the static import) so runtime updates are visible.
  return readJson<SeedData>(PREFERENCES_PATH, {
    household: { members: [], location: "", budgetTargetDKK: 0, budgetCeilingDKK: 0, notes: "" },
    preferences: [],
    pantryCarryover: [],
  });
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
export function bumpPreferenceCount(
  scope: Scope,
  dishText: string,
  direction: "accept" | "reject"
): Promise<Preference | null> {
  return serialised(PREFERENCES_PATH, async () => {
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

    await writeJson(PREFERENCES_PATH, data);
    return candidate;
  });
}

export function addLearnedPreference(scope: Scope, text: string): Promise<Preference> {
  return serialised(PREFERENCES_PATH, async () => {
    const data = await getPreferencesData();
    const preference: Preference = { scope, kind: "learned", text, acceptCount: 1, rejectCount: 0 };
    data.preferences.push(preference);
    await writeJson(PREFERENCES_PATH, data);
    return preference;
  });
}

// ---- v2: household & profiles ----------------------------------------------

// Skeleton shown before first-time setup: the three v1 identities, adults still
// missing their body details. Not "complete" until the setup form is saved.
const DEFAULT_HOUSEHOLD: Household = {
  profiles: [
    { id: "her", kind: "adult", name: "Her" },
    { id: "him", kind: "adult", name: "Him" },
    {
      id: "toddler",
      kind: "child",
      name: "Child",
      childRules: { noAddedSugar: true, noAddedSalt: true, allergens: [] },
    },
  ],
  calorieThresholds: { amberPct: 10, redPct: 25 },
};

export async function getHousehold(): Promise<Household> {
  return readJson<Household>(HOUSEHOLD_PATH, DEFAULT_HOUSEHOLD);
}

export function saveHousehold(household: Household): Promise<Household> {
  return serialised(HOUSEHOLD_PATH, async () => {
    await writeJson(HOUSEHOLD_PATH, household);
    return household;
  });
}

// ---- v2: taste files (one Markdown file per profile) --------------------------

function tastePath(profileId: ProfileId): string {
  return path.join(TASTE_DIR, `${profileId}.md`);
}

export async function getTasteFile(profileId: ProfileId, defaultTitle: string): Promise<TasteFile> {
  try {
    return parseTasteFile(await readFile(tastePath(profileId), "utf-8"));
  } catch {
    return parseTasteFile(`# ${defaultTitle}\n`);
  }
}

// Replaces only the structured "Usual meals" section; anything else the person
// wrote in the file is preserved.
export function saveUsualMeals(profileId: ProfileId, defaultTitle: string, usualMeals: UsualMeals): Promise<TasteFile> {
  const filePath = tastePath(profileId);
  return serialised(filePath, async () => {
    const current = await getTasteFile(profileId, defaultTitle);
    const next: TasteFile = { ...current, usualMeals };
    await mkdir(TASTE_DIR, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, serialiseTasteFile(next), "utf-8");
    await rename(tmpPath, filePath);
    return next;
  });
}

// ---- Pantry and the bought ledger -------------------------------------------
// The pantry only tracks "we have this" (quantity 1). The ledger records what was ticked off
// as bought, and which days that purchase covers.

export async function getPantry(): Promise<PantryData> {
  return readJson<PantryData>(PANTRY_PATH, { stock: [], bought: [] });
}

export function addPantryItem(name: string): Promise<PantryData> {
  return serialised(PANTRY_PATH, async () => {
    const pantry = await getPantry();
    if (!pantry.stock.some((item) => itemKey(item.name) === itemKey(name))) {
      pantry.stock.push({ id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, quantity: 1, unit: "pcs", updatedAt: new Date().toISOString() });
      await writeJson(PANTRY_PATH, pantry);
    }
    return pantry;
  });
}

export function removePantryItem(id: string): Promise<PantryData> {
  return serialised(PANTRY_PATH, async () => {
    const pantry = await getPantry();
    pantry.stock = pantry.stock.filter((item) => item.id !== id);
    await writeJson(PANTRY_PATH, pantry);
    return pantry;
  });
}

// Tick (bought) or untick an item for a range of days. Unticking removes any purchase of that
// item that overlaps the range.
export function setBought(name: string, bought: boolean, from: string, to: string): Promise<PantryData> {
  return serialised(PANTRY_PATH, async () => {
    const pantry = await getPantry();
    const key = itemKey(name);
    const overlaps = (entry: BoughtEntry) =>
      itemKey(entry.name) === key && entry.coversFrom !== undefined && entry.coversTo !== undefined && entry.coversFrom <= to && entry.coversTo >= from;
    pantry.bought = pantry.bought.filter((entry) => !overlaps(entry));
    if (bought) {
      pantry.bought.push({
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        quantity: 1,
        unit: "pcs",
        boughtAt: new Date().toISOString(),
        coversFrom: from,
        coversTo: to,
      });
    }
    await writeJson(PANTRY_PATH, pantry);
    return pantry;
  });
}
