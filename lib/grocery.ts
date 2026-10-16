import type { Meal, GroceryItem, PantryItem } from "@/types";

const categoryRules: Array<{ category: string; keywords: string[] }> = [
  { category: "Produce", keywords: ["tomato", "onion", "garlic", "pepper", "spinach", "lettuce", "cucumber", "carrot", "potato", "mushroom", "apple", "banana", "lemon", "lime", "avocado", "cabbage", "broccoli", "zucchini", "eggplant", "parsley", "cilantro", "ginger", "celery", "greens"] },
  { category: "Dairy", keywords: ["cheese", "yogurt", "butter", "milk", "cream", "egg", "ghee", "curd", "paneer"] },
  { category: "Meat & Fish", keywords: ["chicken", "salmon", "fish", "beef", "turkey", "pork", "bacon", "sausage", "ham", "shrimp", "tuna", "burger", "meat"] },
  { category: "Bakery", keywords: ["bread", "toast", "pita", "bun", "wrap", "tortilla", "bagel", "croissant", "roti", "naan"] },
  { category: "Pantry", keywords: ["rice", "pasta", "lentil", "bean", "peas", "cereal", "oil", "flour", "sugar", "soy", "stock", "broth", "sauce", "coconut", "tahini", "hummus", "nut", "spice", "curry", "noodle", "oats", "mayo", "salt", "cumin", "cardamom", "turmeric", "masala", "cinnamon", "mustard", "vinegar", "honey", "jam", "couscous", "chickpea", "dal"] },
  { category: "Frozen", keywords: ["frozen", "frys", "fries"] },
  { category: "Beverages", keywords: ["coffee", "tea", "juice", "water"] },
  { category: "Household", keywords: ["soap", "shampoo", "toothpaste", "toilet paper", "tissue", "detergent", "cleaner", "cleaning", "sponge", "foil", "cling film", "bin bag", "trash bag", "paper towel", "deodorant", "toiletries", "napkin", "dish soap", "washing"] },
];

// Canonical display order for grouping the grocery list by category, in both the
// app and the email — food first (roughly shop-aisle order), household last.
export const CATEGORY_ORDER = [
  "Produce",
  "Dairy",
  "Meat & Fish",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Household",
  "Uncategorised",
];

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

export function classifyCategory(name: string): string {
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
        continue;
      }

      const category = classifyCategory(parsed.name);
      seen.set(key, {
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: parsed.name,
        quantity: parsed.quantity,
        category,
        fromPantry: Array.from(pantryNames).some((pantryName) => key.includes(pantryName) || pantryName.includes(key)),
      });
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.name.localeCompare(right.name));
}