import { askJson } from "./ollama";
import { bankDishes, bankKcal, normaliseDish, type DinnerIdea } from "./dishes";

export interface Suggestions {
  dishes: DinnerIdea[];
  source: "ai" | "builtin" | "mixed";
}

function clean(text: unknown, max: number): string {
  return typeof text === "string" ? text.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Turns whatever the model sent back into valid ideas, dropping anything doubtful.
function readIdeas(raw: unknown, cuisine: string): DinnerIdea[] {
  const list = (raw as { dishes?: unknown } | null)?.dishes;
  if (!Array.isArray(list)) return [];
  const ideas: DinnerIdea[] = [];
  for (const item of list) {
    const entry = item as { dish?: unknown; ingredients?: unknown; kcal?: unknown };
    const dish = clean(entry.dish, 80);
    const ingredients = Array.isArray(entry.ingredients)
      ? entry.ingredients.map((i) => clean(i, 40).toLowerCase()).filter(Boolean).slice(0, 12)
      : [];
    if (!dish || ingredients.length < 2) continue;
    const kcal = typeof entry.kcal === "number" && entry.kcal >= 150 && entry.kcal <= 1500 ? Math.round(entry.kcal / 10) * 10 : undefined;
    ideas.push({ dish, cuisine, ingredients, kcal });
  }
  return ideas;
}

// `count` dinners for a cuisine, never repeating anything in `exclude`. The model goes first;
// the built-in list tops it up so there are always enough.
export async function suggestDinners(cuisine: string, count: number, exclude: string[]): Promise<Suggestions> {
  const seen = new Set(exclude.map(normaliseDish));
  const wantedCuisine = cuisine.trim() || "family-friendly";

  const ai = readIdeas(
    await askJson(
      `Suggest ${count} different family dinners in the ${wantedCuisine} style, easy to cook on a weekday. ` +
        `Do not suggest: ${exclude.slice(0, 15).join(", ") || "nothing in particular"}. ` +
        `For each give the dish name, 4 to 10 plain ingredient names without quantities, and calories per adult serving. ` +
        `Answer only with JSON like {"dishes":[{"dish":"name","ingredients":["a","b"],"kcal":600}]}.`
    ),
    cuisine.trim() || "Family"
  );

  const picked: DinnerIdea[] = [];
  let fromAi = 0;
  for (const idea of ai) {
    const key = normaliseDish(idea.dish);
    if (seen.has(key) || picked.length >= count) continue;
    seen.add(key);
    picked.push(idea);
    fromAi += 1;
  }

  // Built-in dishes in a shuffled order so repeated requests don't give the same list.
  const bank = [...bankDishes(cuisine)].sort(() => Math.random() - 0.5);
  let fromBank = 0;
  for (const idea of bank) {
    if (picked.length >= count) break;
    const key = normaliseDish(idea.dish);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(idea);
    fromBank += 1;
  }

  return { dishes: picked, source: fromAi > 0 && fromBank > 0 ? "mixed" : fromAi > 0 ? "ai" : "builtin" };
}

export interface EstimateItem {
  id: string;
  dish: string;
  forChild: boolean;
  slot?: string;
}

// Believable calories for one adult serving of a meal type. Anything outside is thrown away.
const ADULT_RANGE: Record<string, [number, number]> = {
  breakfast: [100, 900],
  lunch: [150, 1200],
  snack: [30, 500],
  dinner: [150, 1200],
};

function plausible(item: EstimateItem, kcal: number): boolean {
  const [low, high] = item.forChild ? [30, 600] : (ADULT_RANGE[item.slot ?? ""] ?? [50, 1200]);
  return kcal >= low && kcal <= high;
}

// Calories for a list of dishes. Dishes in the built-in list use its figure; the rest go to the
// model in one request. A child's figure is for a toddler portion, not an adult one.
export async function estimateKcal(items: EstimateItem[]): Promise<Record<string, { kcal: number; source: "builtin" | "ai" }>> {
  const result: Record<string, { kcal: number; source: "builtin" | "ai" }> = {};
  const unknown: EstimateItem[] = [];

  for (const item of items) {
    const known = bankKcal(item.dish);
    if (known && !item.forChild) result[item.id] = { kcal: known, source: "builtin" };
    else unknown.push(item);
  }
  if (unknown.length === 0) return result;

  // The small local model sometimes answers with nothing usable, so ask again once for what's missing.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pending = unknown.filter((item) => !result[item.id]);
    if (pending.length === 0) break;

    const lines = pending
      .map((item, index) => `${index + 1}. ${item.dish} (${item.slot ? `${item.slot}, ` : ""}${item.forChild ? "one toddler portion, under 2 years" : "one adult serving"})`)
      .join("\n");
    const answer = await askJson<{ estimates?: { number?: unknown; kcal?: unknown }[] }>(
      `Estimate the calories (kcal) for each portion below. Be realistic, not exact.\n${lines}\n` +
        `Answer only with JSON like {"estimates":[{"number":1,"kcal":450}]} using the numbers above.`
    );

    for (const entry of answer?.estimates ?? []) {
      const item = typeof entry.number === "number" ? pending[entry.number - 1] : undefined;
      const kcal = typeof entry.kcal === "number" ? Math.round(entry.kcal / 10) * 10 : 0;
      if (item && plausible(item, kcal)) result[item.id] = { kcal, source: "ai" };
    }
  }
  return result;
}
