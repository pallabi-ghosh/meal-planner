import { NextResponse } from "next/server";
import { suggestDinners } from "@/lib/suggest";

// Dinner ideas for a cuisine. Send `{ cuisine, count, exclude: [dish names] }`.
export async function POST(request: Request) {
  let body: { cuisine?: unknown; count?: unknown; exclude?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }

  const cuisine = typeof body.cuisine === "string" ? body.cuisine.trim().slice(0, 60) : "";
  const count = typeof body.count === "number" ? Math.min(Math.max(Math.round(body.count), 1), 10) : 3;
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((d): d is string => typeof d === "string").slice(0, 40)
    : [];

  const { dishes, source } = await suggestDinners(cuisine, count, exclude);
  return NextResponse.json({ ok: true, dishes, source });
}
