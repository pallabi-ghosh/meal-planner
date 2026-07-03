"use client";

import { useState } from "react";
import GenerateButton from "./components/GenerateButton";

interface GenerationResponse {
  ok: boolean;
  week?: {
    startDate: string;
    meals: Array<{
      date: string;
      slot: string;
      forWhom: string;
      dish: string;
      ingredients: string[];
    }>;
    budgetTargetDKK?: number;
    estimatedCostDKK?: number;
  };
  grocery?: Array<{
    name: string;
    quantity: string;
    category: string;
    estPriceDKK: number;
    fromPantry: boolean;
  }>;
  message?: string;
}

export default function Home() {
  const [result, setResult] = useState<GenerationResponse | null>(null);

  const dayGroups = result?.week?.meals.reduce<Record<string, typeof result.week.meals>>((acc, meal) => {
    if (!acc[meal.date]) {
      acc[meal.date] = [];
    }
    acc[meal.date].push(meal);
    return acc;
  }, {}) ?? {};

  return (
    <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 760, margin: "40px auto", padding: 16 }}>
      <h1>Meal Planner</h1>
      <p style={{ color: "#666" }}>
        Generate a week from seeded preferences and email it. v1: ugly on purpose.
      </p>

      <GenerateButton onGenerated={setResult} />

      {result?.ok && result.week ? (
        <section style={{ marginTop: 24 }}>
          <h2>Generated week</h2>
          <p>
            <strong>Start:</strong> {result.week.startDate}
            {result.week.estimatedCostDKK != null ? ` • Estimated cost: ${result.week.estimatedCostDKK} DKK` : ""}
          </p>

          {Object.entries(dayGroups).map(([date, meals]) => (
            <div key={date} style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>{date}</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {meals.map((meal, index) => (
                  <li key={`${date}-${meal.slot}-${meal.dish}-${index}`}>
                    <strong>{meal.slot}</strong> ({meal.forWhom}): {meal.dish}
                    <div style={{ color: "#666", fontSize: 13 }}>
                      {meal.ingredients.join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h2 style={{ marginTop: 24 }}>Grocery list</h2>
          {result.grocery && result.grocery.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.grocery.map((item, index) => (
                <li key={item.name}>
                  {item.name} — {item.quantity} ({item.category})
                  {item.fromPantry ? " • pantry" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No grocery items were returned.</p>
          )}
        </section>
      ) : null}

      {result && !result.ok ? (
        <p style={{ marginTop: 16, color: "#b91c1c" }}>{result.message ?? "Generation failed."}</p>
      ) : null}
    </main>
  );
}