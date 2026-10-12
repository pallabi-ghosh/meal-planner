import type { Slot } from "@/types";

// A taste file is plain Markdown, one per profile (data/taste/<id>.md), so it can be
// curated by hand or through the app. Only the "Usual meals" section is structured;
// every other section is kept exactly as written.
//
//   # Taste profile: Child
//
//   ## Usual meals
//   ### Breakfast
//   - Smoothie | any | banana, milk, oats
//   ### Dinner
//   - Meatball fry | weekday | minced meat, onion, egg, oil
//
//   ## Anything else you like to write
//   Free text is preserved.

export type DayType = "any" | "weekday" | "weekend";

export interface UsualMeal {
  dish: string;
  dayType: DayType;
  ingredients: string[];
}

export type UsualMeals = Record<Slot, UsualMeal[]>;

export interface TasteFile {
  title: string;
  usualMeals: UsualMeals;
  otherSections: string; // everything outside "Usual meals", verbatim
}

export const SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];
export const DAY_TYPES: DayType[] = ["any", "weekday", "weekend"];

const MAX_DISH = 80;
const MAX_INGREDIENT = 40;
const MAX_INGREDIENTS = 20;
const MAX_MEALS_PER_SLOT = 30;

export function emptyUsualMeals(): UsualMeals {
  return { breakfast: [], lunch: [], snack: [], dinner: [] };
}

// "|" and newlines are the file format's delimiters, so they can't live in a value.
function clean(text: string, max: number): string {
  return text.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMeal(raw: { dish?: unknown; dayType?: unknown; ingredients?: unknown }): UsualMeal | null {
  const dish = typeof raw.dish === "string" ? clean(raw.dish, MAX_DISH) : "";
  if (!dish) return null;
  const dayType = DAY_TYPES.includes(raw.dayType as DayType) ? (raw.dayType as DayType) : "any";
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .filter((i): i is string => typeof i === "string")
        .map((i) => clean(i, MAX_INGREDIENT))
        .filter(Boolean)
        .slice(0, MAX_INGREDIENTS)
    : [];
  return { dish, dayType, ingredients };
}

// Accepts untrusted input (an API body) and returns a clean, complete UsualMeals.
export function sanitiseUsualMeals(input: unknown): UsualMeals {
  const result = emptyUsualMeals();
  if (!input || typeof input !== "object") return result;
  const source = input as Record<string, unknown>;

  for (const slot of SLOTS) {
    const list = source[slot];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const meal = cleanMeal(entry as Record<string, unknown>);
      if (!meal) continue;
      const key = meal.dish.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result[slot].push(meal);
      if (result[slot].length >= MAX_MEALS_PER_SLOT) break;
    }
  }
  return result;
}

export function parseTasteFile(text: string): TasteFile {
  const meals = emptyUsualMeals();
  const other: string[] = [];
  let title = "Taste profile";
  let section: "none" | "usual" | "other" = "none";
  let slot: Slot | null = null;

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const h1 = /^# (.+)$/.exec(line);
    const h2 = /^## (.+)$/.exec(line);
    const h3 = /^### (.+)$/.exec(line);

    if (h1) {
      title = h1[1].trim();
      continue;
    }
    if (h2) {
      if (/^usual meals$/i.test(h2[1].trim())) {
        section = "usual";
        slot = null;
      } else {
        section = "other";
        other.push(line);
      }
      continue;
    }

    if (section === "usual") {
      if (h3) {
        const heading = h3[1].trim().toLowerCase();
        slot = SLOTS.find((s) => heading.startsWith(s)) ?? null;
      } else if (slot && line.startsWith("- ")) {
        const [dish = "", day = "", ingredients = ""] = line.slice(2).split("|").map((part) => part.trim());
        const meal = cleanMeal({
          dish,
          dayType: day.toLowerCase(),
          ingredients: ingredients ? ingredients.split(",") : [],
        });
        if (meal) meals[slot].push(meal);
      }
      continue;
    }

    // Preamble or a section we don't structure: keep it verbatim.
    if (section === "other" || line.trim() !== "") other.push(line);
  }

  return { title, usualMeals: meals, otherSections: other.join("\n").trim() };
}

function heading(slot: Slot): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function serialiseTasteFile(file: TasteFile): string {
  const lines: string[] = [`# ${file.title}`, "", "## Usual meals"];
  for (const slot of SLOTS) {
    lines.push(`### ${heading(slot)}`);
    for (const meal of file.usualMeals[slot]) {
      lines.push(`- ${[meal.dish, meal.dayType, meal.ingredients.join(", ")].join(" | ")}`);
    }
    lines.push("");
  }
  if (file.otherSections) lines.push(file.otherSections, "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
