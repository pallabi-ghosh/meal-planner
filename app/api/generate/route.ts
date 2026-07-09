import { NextResponse } from "next/server";
import { buildGenerationPrompt } from "@/lib/prompt";
import { buildGroceryList, estimateTotalDKK } from "@/lib/grocery";
import { sendWeekEmail } from "@/lib/email";
import { getPreferencesData, saveCurrentWeek } from "@/lib/store";
import type { Scope, Slot, Week } from "@/types";

const VALID_SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];
const VALID_SCOPES: Scope[] = ["him", "her", "toddler", "household"];

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

interface OllamaResponse {
  response?: string;
  done?: boolean;
  error?: string;
}

function parseWeekPayload(payload: unknown): Week {
  if (!payload || typeof payload !== "object") {
    throw new Error("The model response was not a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const candidate = record.week ?? record;

  if (!candidate || typeof candidate !== "object") {
    throw new Error("The model response did not contain a week object.");
  }

  const week = candidate as Partial<Week>;
  if (typeof week.startDate !== "string" || !Array.isArray(week.meals)) {
    throw new Error("The generated week object is missing startDate or meals.");
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

async function generateWeekFromOllama(prompt: string): Promise<Week> {
  let response: Response;

  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. Start it with "ollama serve" and make sure the model "${OLLAMA_MODEL}" is available. Details: ${detail}`
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OllamaResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.response) {
    throw new Error("Ollama did not return a model response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data.response);
  } catch {
    throw new Error("Ollama returned malformed JSON.");
  }

  const week = parseWeekPayload(parsed);
  validateWeek(week);
  return week;
}

export async function POST() {
  const seedData = await getPreferencesData();
  const weekStart = new Date().toISOString().slice(0, 10);
  const prompt = buildGenerationPrompt(seedData, weekStart);

  let lastError: unknown;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const week = await generateWeekFromOllama(prompt);
      const grocery = buildGroceryList(week.meals, seedData.pantryCarryover);
      week.estimatedCostDKK = estimateTotalDKK(grocery);

      const stored = await saveCurrentWeek(week, grocery);

      try {
        await sendWeekEmail(stored.week, stored.grocery);
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
      promptPreview: prompt.slice(0, 400) + "…",
    },
    { status: 500 }
  );
}