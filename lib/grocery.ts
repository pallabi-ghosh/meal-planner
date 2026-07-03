import type { Meal, GroceryItem, PantryItem } from "@/types";

const categoryRules: Array<{ category: string; keywords: string[] }> = [
  { category: "Produce", keywords: ["tomato", "onion", "garlic", "pepper", "spinach", "lettuce", "cucumber", "carrot", "potato", "mushroom", "apple", "banana", "lemon", "lime", "avocado", "cabbage", "broccoli", "zucchini", "eggplant", "parsley", "cilantro", "ginger"] },
  { category: "Dairy", keywords: ["cheese", "yogurt", "butter", "milk", "cream", "egg"] },
  { category: "Meat & Fish", keywords: ["chicken", "salmon", "fish", "beef", "turkey", "pork", "bacon", "sausage", "ham", "shrimp", "tuna"] },
  { category: "Bakery", keywords: ["bread", "toast", "pita", "bun", "wrap", "tortilla", "bagel", "croissant"] },
  { category: "Pantry", keywords: ["rice", "pasta", "lentil", "bean", "peas", "cereal", "oil", "flour", "sugar", "soy", "stock", "broth", "sauce", "coconut", "tahini", "hummus", "nut", "spice", "curry"] },
  { category: "Frozen", keywords: ["frozen"] },
  { category: "Beverages", keywords: ["coffee", "tea", "juice", "water"] },
];

const basePrices: Record<string, number> = {
  Produce: 12,
  Dairy: 10,
  "Meat & Fish": 24,
  Bakery: 8,
  Pantry: 6,
  Frozen: 9,
  Beverages: 5,
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseIngredientQuantity(value: string): { name: string; quantity: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|clove|cloves|pcs|pieces|piece|can|cans|pack|packs)?\s*(.*)$/i);

  if (!match) {
    return { name: trimmed, quantity: "1" };
  }

  const amount = Number(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : "";
  const remainder = match[3].trim();
  const quantity = unit ? `${amount}${unit}` : `${amount}`;
  return {
    name: remainder || trimmed,
    quantity: Number.isFinite(amount) ? quantity : "1",
  };
}

function mergeQuantities(existing: string, incoming: string): string {
  const left = Number(existing);
  const right = Number(incoming);

  if (!Number.isNaN(left) && !Number.isNaN(right)) {
    return `${left + right}`;
  }

  return `${existing} + ${incoming}`;
}

function classifyCategory(name: string): string {
  const normalized = normalizeText(name);
  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return "Uncategorised";
}

export function buildGroceryList(
  meals: Meal[],
  pantry: PantryItem[]
): GroceryItem[] {
  const pantryNames = new Set(pantry.map((item) => normalizeText(item.name)));
  const seen = new Map<string, GroceryItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      const parsed = parseIngredientQuantity(ingredient);
      const key = normalizeText(parsed.name);
      const existing = seen.get(key);

      if (existing) {
        existing.quantity = mergeQuantities(existing.quantity, parsed.quantity);
        existing.estPriceDKK = Math.max(existing.estPriceDKK, basePrices[existing.category] ?? 8);
        continue;
      }

      const category = classifyCategory(parsed.name);
      seen.set(key, {
        name: parsed.name,
        quantity: parsed.quantity,
        category,
        estPriceDKK: basePrices[category] ?? 8,
        fromPantry: Array.from(pantryNames).some((pantryName) => key.includes(pantryName) || pantryName.includes(key)),
      });
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function estimateTotalDKK(items: GroceryItem[]): number {
  return items
    .filter((item) => !item.fromPantry)
    .reduce((sum, item) => sum + item.estPriceDKK, 0);
}