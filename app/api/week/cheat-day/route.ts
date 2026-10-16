import { NextResponse } from "next/server";
import { getCurrentWeek, setCheatDay } from "@/lib/store";
import { weekDates } from "@/lib/plan";

// Set or clear this week's cheat day. Send `{ date: "YYYY-MM-DD" }`, or `{ date: null }` to clear.
export async function POST(request: Request) {
  let date: unknown;
  try {
    ({ date } = (await request.json()) as { date?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  if (date !== null && typeof date !== "string") {
    return NextResponse.json({ ok: false, message: "date must be a date or null." }, { status: 400 });
  }

  const current = await getCurrentWeek();
  if (!current.week) {
    return NextResponse.json({ ok: false, message: "There is no plan yet." }, { status: 409 });
  }
  if (date !== null && !weekDates(current.week.startDate).includes(date)) {
    return NextResponse.json({ ok: false, message: `${date} is not part of this week.` }, { status: 400 });
  }

  const week = await setCheatDay(date);
  return NextResponse.json({ ok: true, week });
}
