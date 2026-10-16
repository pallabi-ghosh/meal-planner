import { NextResponse } from "next/server";
import { getCurrentWeek, setCuisine } from "@/lib/store";
import { weekDates } from "@/lib/plan";

// Save the week's cuisine. Send `{ week: "Bengali", byDate: { "2026-10-15": "Italian" } }`.
// Blank values are dropped, so clearing a box clears the setting.
export async function POST(request: Request) {
  let body: { week?: unknown; byDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }

  const tidy = (value: unknown) => (typeof value === "string" ? value.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "");

  const current = await getCurrentWeek();
  if (!current.week) {
    return NextResponse.json({ ok: false, message: "There is no plan yet." }, { status: 409 });
  }

  const inWeek = new Set(weekDates(current.week.startDate));
  const byDate: Record<string, string> = {};
  if (body.byDate && typeof body.byDate === "object") {
    for (const [date, value] of Object.entries(body.byDate as Record<string, unknown>)) {
      const cuisine = tidy(value);
      if (inWeek.has(date) && cuisine) byDate[date] = cuisine;
    }
  }

  const week = await setCuisine({ week: tidy(body.week) || undefined, byDate });
  return NextResponse.json({ ok: true, week });
}
