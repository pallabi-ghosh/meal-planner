import type { PantryItem, Preference, SeedData } from "@/types";

export function buildGenerationPrompt(seedData: SeedData, weekStart: string): string {
  const preferences = seedData.preferences
    .map((preference: Preference) => `- [${preference.kind}] ${preference.scope}: ${preference.text}`)
    .join("\n");

  const pantry = seedData.pantryCarryover
    .map(
      (item: PantryItem) =>
        `- ${item.name}${item.quantity ? ` (${item.quantity})` : ""} carries over ${item.carriesOverDays} days`
    )
    .join("\n");

  return `You are generating a meal plan for ${seedData.household.location}.
Household members: ${seedData.household.members.join(", ")}
Budget target: ${seedData.household.budgetTargetDKK} DKK
Budget ceiling: ${seedData.household.budgetCeilingDKK} DKK
Week start: ${weekStart}
Household notes: ${seedData.household.notes}

Preferences:
${preferences || "(none)"}

Pantry carryover:
${pantry || "(none)"}

Return ONLY valid JSON with a top-level object containing a "week" property.
The week object must match this shape (this example row is illustrative only — write
your own real dish for every meal):
{
  "startDate": "${weekStart}",
  "meals": [
    { "date": "YYYY-MM-DD", "slot": "breakfast", "forWhom": "him", "dish": "short dish name", "ingredients": ["ingredient 1", "ingredient 2"] }
  ],
  "budgetTargetDKK": ${seedData.household.budgetTargetDKK}
}
Field rules:
- "slot" must be exactly one of these four words, never combined: breakfast, lunch, snack, dinner.
- "forWhom" must be exactly one of these four words, never combined: him, her, toddler, household.
- Never write a value like "breakfast|lunch|snack|dinner" — pick exactly one word per meal.
Rules:
- Create 7 days of meals with breakfast, lunch, snack, and dinner each day (28 meals total).
- Keep lunch meals free of rice.
- Do not include quinoa in any dish or ingredient.
- Keep the plan realistic for the household and budget.
- Use pantry items where appropriate.
- Return compact valid JSON with double quotes and no markdown.`;
}
