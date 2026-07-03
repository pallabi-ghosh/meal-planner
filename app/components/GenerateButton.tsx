"use client";

import { useState } from "react";

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

interface GenerateButtonProps {
  onGenerated: (result: GenerationResponse) => void;
}

export default function GenerateButton({ onGenerated }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = (await res.json()) as GenerationResponse;
      onGenerated(data);
    } catch (e) {
      onGenerated({ ok: false, message: "Request failed: " + (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{ padding: "10px 16px", fontSize: 14, cursor: "pointer" }}
    >
      {loading ? "Generating…" : "Generate week & email it"}
    </button>
  );
}