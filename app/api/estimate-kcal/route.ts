import { NextResponse } from "next/server";
import { estimateKcal, type EstimateItem } from "@/lib/suggest";

// Calorie estimates. Send `{ items: [{ id, dish, forChild, slot? }] }`; get back `estimates` keyed by id.
// Dishes it can't estimate are simply left out.
export async function POST(request: Request) {
  let items: unknown;
  try {
    ({ items } = (await request.json()) as { items?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return NextResponse.json({ ok: false, message: "Send between 1 and 20 dishes." }, { status: 400 });
  }

  const clean: EstimateItem[] = [];
  for (const raw of items) {
    const item = raw as { id?: unknown; dish?: unknown; forChild?: unknown; slot?: unknown };
    if (typeof item.id !== "string" || typeof item.dish !== "string" || !item.dish.trim()) continue;
    const slot = typeof item.slot === "string" && ["breakfast", "lunch", "snack", "dinner"].includes(item.slot) ? item.slot : undefined;
    clean.push({ id: item.id, dish: item.dish.replace(/\s+/g, " ").trim().slice(0, 80), forChild: item.forChild === true, slot });
  }

  const estimates = await estimateKcal(clean);
  return NextResponse.json({ ok: true, estimates, asked: clean.length });
}
