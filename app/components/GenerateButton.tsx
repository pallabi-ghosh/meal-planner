"use client";

import { useState } from "react";
import type { GenerationResponse } from "@/types";

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
    <button onClick={handleClick} disabled={loading} className="btn">
      {loading ? "Generating…" : "↻ Generate week & email it"}
    </button>
  );
}