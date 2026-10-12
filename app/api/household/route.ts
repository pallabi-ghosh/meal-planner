import { NextResponse } from "next/server";
import { getHousehold, saveHousehold } from "@/lib/store";
import { isHouseholdSetUp, validateHousehold } from "@/lib/household";

export async function GET() {
  const household = await getHousehold();
  return NextResponse.json({ ok: true, household, setupComplete: isHouseholdSetUp(household) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = validateHousehold(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  const household = await saveHousehold(result.household);
  return NextResponse.json({ ok: true, household, setupComplete: isHouseholdSetUp(household) });
}
