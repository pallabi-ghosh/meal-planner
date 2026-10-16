import { NextResponse } from "next/server";
import { getCurrentWeek, getPantry } from "@/lib/store";
import { buildRangeList, rangeDates } from "@/lib/groceryRange";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// What to buy for a range of days: GET /api/grocery/range?from=2026-10-12&to=2026-10-18
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || to < from) {
    return NextResponse.json({ ok: false, message: "Pick a start date and an end date after it." }, { status: 400 });
  }
  const dates = rangeDates(from, to);
  if (dates[dates.length - 1] !== to) {
    return NextResponse.json({ ok: false, message: "That range is too long. Pick at most two months." }, { status: 400 });
  }

  const [{ week }, pantry] = await Promise.all([getCurrentWeek(), getPantry()]);
  const result = buildRangeList({
    meals: week?.meals ?? [],
    dates,
    pantryNames: pantry.stock.map((item) => item.name),
    bought: pantry.bought,
  });
  return NextResponse.json({ ok: true, ...result, pantry: pantry.stock });
}
