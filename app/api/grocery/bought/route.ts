import { NextResponse } from "next/server";
import { setBought } from "@/lib/store";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Tick or untick an item: `{ name, bought, from, to }`.
export async function POST(request: Request) {
  let body: { name?: unknown; bought?: unknown; from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  const { name, bought, from, to } = body;
  if (typeof name !== "string" || !name.trim() || typeof bought !== "boolean" || typeof from !== "string" || typeof to !== "string" || !ISO.test(from) || !ISO.test(to) || to < from) {
    return NextResponse.json({ ok: false, message: "Send a name, bought true/false, and a from/to date range." }, { status: 400 });
  }
  await setBought(name.trim().slice(0, 80), bought, from, to);
  return NextResponse.json({ ok: true });
}
