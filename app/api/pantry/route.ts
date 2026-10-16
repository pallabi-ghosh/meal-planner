import { NextResponse } from "next/server";
import { addPantryItem, getPantry, removePantryItem } from "@/lib/store";

export async function GET() {
  const pantry = await getPantry();
  return NextResponse.json({ ok: true, stock: pantry.stock });
}

// Add an item (`{ name }`) or remove one (`{ remove: id }`).
export async function POST(request: Request) {
  let body: { name?: unknown; remove?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.remove === "string") {
    const pantry = await removePantryItem(body.remove);
    return NextResponse.json({ ok: true, stock: pantry.stock });
  }
  if (typeof body.name === "string" && body.name.trim()) {
    const pantry = await addPantryItem(body.name.replace(/[\r\n]+/g, " ").trim().slice(0, 60));
    return NextResponse.json({ ok: true, stock: pantry.stock });
  }
  return NextResponse.json({ ok: false, message: "Send a name to add, or an id to remove." }, { status: 400 });
}
