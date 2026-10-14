import { NextResponse } from "next/server";
import { getCurrentWeek, getMealLogs, startNewWeek } from "@/lib/store";

export async function GET() {
  const stored = await getCurrentWeek();
  const mealLogs = await getMealLogs();

  return NextResponse.json({ ok: true, week: stored.week, grocery: stored.grocery, mealLogs });
}

// Start a new, empty plan beginning on `startDate` (the grocery list is untouched).
export async function POST(request: Request) {
  let startDate: unknown;
  try {
    ({ startDate } = (await request.json()) as { startDate?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }

  const valid =
    typeof startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`));
  if (!valid) {
    return NextResponse.json({ ok: false, message: "startDate must be a date like 2026-10-12." }, { status: 400 });
  }

  const stored = await startNewWeek(startDate as string);
  return NextResponse.json({ ok: true, week: stored.week });
}
