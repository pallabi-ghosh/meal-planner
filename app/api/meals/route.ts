import { NextResponse } from "next/server";
import { updateMeals } from "@/lib/store";
import type { Meal } from "@/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { meals?: Meal[] };

  if (!Array.isArray(body.meals)) {
    return NextResponse.json({ ok: false, message: "meals must be an array." }, { status: 400 });
  }

  const stored = await updateMeals(body.meals);
  return NextResponse.json({ ok: true, week: stored.week });
}
