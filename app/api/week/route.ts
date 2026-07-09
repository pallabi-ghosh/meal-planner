import { NextResponse } from "next/server";
import { getCurrentWeek, getMealLogs } from "@/lib/store";

export async function GET() {
  const stored = await getCurrentWeek();
  const mealLogs = await getMealLogs();

  return NextResponse.json({ ok: true, week: stored.week, grocery: stored.grocery, mealLogs });
}
