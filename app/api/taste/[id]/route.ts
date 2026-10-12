import { NextResponse } from "next/server";
import { getHousehold, getTasteFile, saveUsualMeals } from "@/lib/store";
import { sanitiseUsualMeals } from "@/lib/taste";
import type { ProfileId } from "@/types";

const PROFILE_IDS: ProfileId[] = ["him", "her", "toddler"];

// The id becomes part of a file path, so only the three known profile ids are accepted.
async function resolve(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!PROFILE_IDS.includes(id as ProfileId)) return null;
  const household = await getHousehold();
  const name = household.profiles.find((p) => p.id === id)?.name ?? id;
  return { id: id as ProfileId, title: `Taste profile: ${name}` };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const target = await resolve(params);
  if (!target) return NextResponse.json({ ok: false, message: "Unknown profile." }, { status: 404 });

  const file = await getTasteFile(target.id, target.title);
  return NextResponse.json({ ok: true, usualMeals: file.usualMeals });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const target = await resolve(params);
  if (!target) return NextResponse.json({ ok: false, message: "Unknown profile." }, { status: 404 });

  let body: { usualMeals?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body.usualMeals || typeof body.usualMeals !== "object") {
    return NextResponse.json({ ok: false, message: "usualMeals is required." }, { status: 400 });
  }

  const saved = await saveUsualMeals(target.id, target.title, sanitiseUsualMeals(body.usualMeals));
  return NextResponse.json({ ok: true, usualMeals: saved.usualMeals });
}
