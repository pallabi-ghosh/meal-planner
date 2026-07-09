import { NextResponse } from "next/server";
import { getCurrentWeek } from "@/lib/store";
import { sendWeekEmail } from "@/lib/email";
import type { Week } from "@/types";

export async function POST() {
  const stored = await getCurrentWeek();

  if (stored.grocery.length === 0) {
    return NextResponse.json({ ok: false, message: "The grocery list is empty — add something first." }, { status: 400 });
  }

  const week: Week =
    stored.week ?? {
      startDate: new Date().toISOString().slice(0, 10),
      meals: [],
      budgetTargetDKK: 0,
    };

  try {
    const result = await sendWeekEmail(week, stored.grocery);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ ok: false, message: String(result.error) }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to send the list." },
      { status: 500 }
    );
  }
}
