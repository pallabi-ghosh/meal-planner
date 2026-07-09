import { NextResponse } from "next/server";
import { getPreferencesData } from "@/lib/store";

export async function GET() {
  const data = await getPreferencesData();
  return NextResponse.json(data);
}
