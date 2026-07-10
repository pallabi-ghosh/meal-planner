import { NextResponse } from "next/server";
import { runOllamaAgent } from "@/lib/agent";
import { buildGroceryList, estimateTotalDKK } from "@/lib/grocery";
import { sendWeekEmail } from "@/lib/email";
import { getPreferencesData, saveCurrentWeek } from "@/lib/store";
import type { Scope, Slot, Week } from "@/types";

const VALID_SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];
const VALID_SCOPES: Scope[] = ["him", "her", "toddler", "household"];

function parseWeekPayload(payload: unknown): Week {
  if (!payload || typeof payload !== "object") {
    throw new Error("The agent's submission was not an object.");
  }

  const week = payload as Partial<Week>;
  if (typeof week.startDate !== "string" || !Array.isArray(week.meals)) {
    throw new Error("The submitted week is missing startDate or meals.");
  }

  return week as Week;
}

function validateWeek(week: Week): void {
  const violations: string[] = [];

  if (!week.startDate) {
    violations.push("Missing startDate.");
  }

  if (!week.meals.length) {
    violations.push("No meals were generated.");
  }

  for (const meal of week.meals) {
    if (!VALID_SLOTS.includes(meal.slot)) {
      violations.push(`Meal "${meal.dish}" has an invalid slot value: "${meal.slot}".`);
    }

    if (!VALID_SCOPES.includes(meal.forWhom)) {
      violations.push(`Meal "${meal.dish}" has an invalid forWhom value: "${meal.forWhom}".`);
    }

    const dishText = `${meal.dish} ${meal.ingredients.join(" ")}`.toLowerCase();

    if (meal.slot === "lunch" && /\brice\b/.test(dishText)) {
      violations.push(`Lunch meal "${meal.dish}" contains rice.`);
    }

    if (/\bquinoa\b/.test(dishText)) {
      violations.push(`Meal "${meal.dish}" contains quinoa.`);
    }
  }

  if (violations.length) {
    throw new Error(`Generated meal plan failed validation: ${violations.join(" ")}`);
  }
}

export async function POST() {
  const seedData = await getPreferencesData();
  const weekStart = new Date().toISOString().slice(0, 10);

  let lastError: unknown;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const submitted = await runOllamaAgent(seedData, weekStart);
      const week = parseWeekPayload(submitted);
      validateWeek(week);

      const grocery = buildGroceryList(week.meals, seedData.pantryCarryover);
      week.estimatedCostDKK = estimateTotalDKK(grocery);

      const stored = await saveCurrentWeek(week, grocery);

      try {
        await sendWeekEmail(stored.week!, stored.grocery);
      } catch (emailError) {
        console.error("Email delivery failed", emailError);
      }

      return NextResponse.json({ ok: true, week: stored.week, grocery: stored.grocery });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) {
        break;
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      message: lastError instanceof Error ? lastError.message : "Failed to generate a meal plan.",
    },
    { status: 500 }
  );
}