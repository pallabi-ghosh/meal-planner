import type { ChildRules } from "@/types";

// Fixed rules for "can the child eat this?", worked out from the dish name and its ingredients.
// The AI never decides this: it's a safety flag, so it has to be predictable.

const SPICY = ["chilli", "chili", "spicy", "jalapeno", "cayenne", "hot sauce", "sriracha", "curry paste", "wasabi"];
const SALTY = ["soy sauce", "stock cube", "bouillon", "bacon", "ham", "salami", "chorizo", "olives", "anchov"];
const SUGARY = ["sugar", "honey", "syrup", "jam", "sweetened"];
const NUTS = ["peanuts", "almonds", "cashews", "walnuts", "hazelnuts", "nuts"];

function has(text: string, words: string[]): string | undefined {
  return words.find((word) => text.includes(word));
}

// Returns short reasons, e.g. ["chilli"]. Empty means nothing to flag.
export function toddlerIssues(dish: string, ingredients: string[], rules?: ChildRules): string[] {
  const text = [dish, ...ingredients].join(" , ").toLowerCase();
  const issues: string[] = [];

  const spicy = has(text, SPICY);
  if (spicy) issues.push(spicy === "chili" ? "chilli" : spicy);

  if (rules?.noAddedSalt) {
    const salty = has(text, SALTY);
    if (salty) issues.push(salty === "anchov" ? "anchovies" : salty);
  }
  if (rules?.noAddedSugar) {
    const sugary = has(text, SUGARY);
    if (sugary) issues.push(sugary);
  }

  // Whole nuts are a choking risk for under-fives; nut butter is fine.
  const nut = has(text, NUTS);
  if (nut && !text.includes(`${nut} butter`) && !text.includes("peanut butter")) issues.push("whole nuts");

  for (const allergen of rules?.allergens ?? []) {
    const word = allergen.trim().toLowerCase();
    if (word && text.includes(word)) issues.push(`allergen: ${word}`);
  }
  return [...new Set(issues)];
}

export function toddlerBadge(issues: string[]): string {
  return `Not toddler-safe: ${issues.slice(0, 2).join(", ")}`;
}
