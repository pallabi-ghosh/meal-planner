import type { BoughtEntry, Meal } from "@/types";
import { CATEGORY_ORDER, classifyCategory } from "./grocery";
import { addDays } from "./plan";

// The grocery engine: what to buy for a range of days. Pure functions, no files.
// Amounts are added up per item and unit (g and kg together, ml and l together). Ingredients
// written without an amount count once per meal. Items in the pantry are left out, and an item
// counts as bought when the bought ledger covers every day that needs it.

export interface RangeItem {
  key: string;
  name: string;
  quantity: string; // "1.2 kg", "6", "2 tsp", or empty for a single plain mention
  category: string;
  bought: boolean;
}

export interface RangeResult {
  items: RangeItem[];
  inPantry: string[];
}

interface Need {
  date: string;
  qty: number;
  unit: string; // "g", "ml", "" (a count), or a kitchen unit like "tsp"
}

const UNIT_ALIASES: Record<string, { unit: string; factor: number }> = {
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  tsp: { unit: "tsp", factor: 1 },
  tbsp: { unit: "tbsp", factor: 1 },
  cup: { unit: "cup", factor: 1 },
  cups: { unit: "cup", factor: 1 },
  clove: { unit: "clove", factor: 1 },
  cloves: { unit: "clove", factor: 1 },
  can: { unit: "can", factor: 1 },
  cans: { unit: "can", factor: 1 },
  pack: { unit: "pack", factor: 1 },
  packs: { unit: "pack", factor: 1 },
  pcs: { unit: "", factor: 1 },
  piece: { unit: "", factor: 1 },
  pieces: { unit: "", factor: 1 },
};

// "800 g chicken" -> 800 g of chicken. "chicken" -> one mention.
export function parseIngredient(text: string): { name: string; qty: number; unit: string } {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|tbsp|tsp|cups?|cloves?|pcs|pieces?|cans?|packs?)?\b\s*(.*)$/i);
  if (!match || !match[3].trim()) return { name: trimmed, qty: 1, unit: "" };

  const amount = Number(match[1].replace(",", "."));
  const alias = match[2] ? UNIT_ALIASES[match[2].toLowerCase()] : undefined;
  return { name: match[3].trim(), qty: amount * (alias?.factor ?? 1), unit: alias?.unit ?? "" };
}

// "Tomatoes" and "tomato" are one item.
export function itemKey(name: string): string {
  const lower = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (lower.length > 3 && lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && lower.endsWith("oes")) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function formatQuantity(totals: Map<string, number>): string {
  const parts: string[] = [];
  for (const [unit, total] of totals) {
    if (unit === "g") parts.push(total >= 1000 ? `${formatNumber(total / 1000)} kg` : `${formatNumber(total)} g`);
    else if (unit === "ml") parts.push(total >= 1000 ? `${formatNumber(total / 1000)} l` : `${formatNumber(total)} ml`);
    else if (unit === "") {
      if (total > 1) parts.push(formatNumber(total));
    } else parts.push(`${formatNumber(total)} ${unit}`);
  }
  return parts.join(" + ");
}

export function rangeDates(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to && dates.length < 62; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function buildRangeList(args: {
  meals: Meal[];
  dates: string[];
  pantryNames: string[];
  bought: BoughtEntry[];
}): RangeResult {
  const days = new Set(args.dates);
  const pantry = new Set(args.pantryNames.map(itemKey));
  const groups = new Map<string, { name: string; needs: Need[] }>();

  for (const meal of args.meals) {
    if (!days.has(meal.date)) continue;
    for (const ingredient of meal.ingredients) {
      const parsed = parseIngredient(ingredient);
      if (!parsed.name) continue;
      const key = itemKey(parsed.name);
      const group = groups.get(key) ?? { name: parsed.name, needs: [] };
      group.needs.push({ date: meal.date, qty: parsed.qty, unit: parsed.unit });
      groups.set(key, group);
    }
  }

  const items: RangeItem[] = [];
  const inPantry: string[] = [];

  for (const [key, group] of groups) {
    if (pantry.has(key)) {
      inPantry.push(group.name);
      continue;
    }
    const totals = new Map<string, number>();
    for (const need of group.needs) totals.set(need.unit, (totals.get(need.unit) ?? 0) + need.qty);

    const covering = args.bought.filter((entry) => itemKey(entry.name) === key);
    const bought = group.needs.every((need) =>
      covering.some((entry) => entry.coversFrom !== undefined && entry.coversTo !== undefined && entry.coversFrom <= need.date && need.date <= entry.coversTo)
    );

    const name = group.name.charAt(0).toUpperCase() + group.name.slice(1);
    items.push({ key, name, quantity: formatQuantity(totals), category: classifyCategory(group.name), bought });
  }

  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  items.sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name));
  return { items, inPantry: inPantry.sort() };
}
