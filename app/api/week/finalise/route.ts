import { NextResponse } from "next/server";
import { getCurrentWeek, setFinalisedDates } from "@/lib/store";
import { weekDates } from "@/lib/plan";

// Finalise (or reopen) days of the current plan. Send `{ dates: [...] }` — the full
// list of finalised days; an empty list reopens the whole week.
export async function POST(request: Request) {
  let dates: unknown;
  try {
    ({ dates } = (await request.json()) as { dates?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(dates) || dates.some((d) => typeof d !== "string")) {
    return NextResponse.json({ ok: false, message: "dates must be a list of dates." }, { status: 400 });
  }

  const current = await getCurrentWeek();
  if (!current.week) {
    return NextResponse.json({ ok: false, message: "There is no plan to finalise yet." }, { status: 409 });
  }

  // Only days inside this plan's week can be finalised.
  const inWeek = new Set(weekDates(current.week.startDate));
  const unique = [...new Set(dates as string[])];
  const outside = unique.find((d) => !inWeek.has(d));
  if (outside) {
    return NextResponse.json({ ok: false, message: `${outside} is not part of this week.` }, { status: 400 });
  }

  const week = await setFinalisedDates(unique.sort());
  return NextResponse.json({ ok: true, week });
}
