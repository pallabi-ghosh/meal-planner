import { NextResponse } from "next/server";
import { appendMealLog, addLearnedPreference, bumpPreferenceCount, getCurrentWeek } from "@/lib/store";
import type { AteStatus, Scope } from "@/types";

interface LogRequestBody {
  mealId?: string;
  eater: Scope;
  ate?: AteStatus;
  actualDish?: string;
  newPreferenceText?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LogRequestBody>;

  if (!body.eater) {
    return NextResponse.json({ ok: false, message: "eater is required." }, { status: 400 });
  }

  // Mode B: a standalone new preference, not tied to any specific meal ("push your own suggestion").
  if (!body.mealId) {
    if (!body.newPreferenceText || !body.newPreferenceText.trim()) {
      return NextResponse.json(
        { ok: false, message: "newPreferenceText is required when mealId is omitted." },
        { status: 400 }
      );
    }
    const learnedPreference = await addLearnedPreference(body.eater, body.newPreferenceText.trim());
    return NextResponse.json({ ok: true, log: null, matchedPreference: null, learnedPreference });
  }

  if (!body.ate) {
    return NextResponse.json({ ok: false, message: "ate is required when mealId is set." }, { status: 400 });
  }

  if (body.ate === "substituted" && !body.actualDish) {
    return NextResponse.json(
      { ok: false, message: "actualDish is required when ate is 'substituted'." },
      { status: 400 }
    );
  }

  const stored = await getCurrentWeek();
  const meal = stored.week?.meals.find((m) => m.id === body.mealId);

  if (!meal) {
    return NextResponse.json({ ok: false, message: "No matching meal in the current week." }, { status: 404 });
  }

  const log = await appendMealLog({
    mealId: body.mealId,
    eater: body.eater,
    ate: body.ate,
    actualDish: body.actualDish,
  });

  const dishText = body.ate === "yes" ? meal.dish : `${meal.dish} ${body.actualDish ?? ""}`;
  const matchedPreference = await bumpPreferenceCount(
    body.eater,
    dishText,
    body.ate === "yes" ? "accept" : "reject"
  );

  let learnedPreference = null;
  if (body.newPreferenceText && body.newPreferenceText.trim()) {
    learnedPreference = await addLearnedPreference(body.eater, body.newPreferenceText.trim());
  }

  return NextResponse.json({ ok: true, log, matchedPreference, learnedPreference });
}
