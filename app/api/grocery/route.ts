import { NextResponse } from "next/server";
import { updateGroceryList } from "@/lib/store";
import type { GroceryItem } from "@/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { grocery?: GroceryItem[] };

  if (!Array.isArray(body.grocery)) {
    return NextResponse.json({ ok: false, message: "grocery must be an array." }, { status: 400 });
  }

  const stored = await updateGroceryList(body.grocery);
  return NextResponse.json({ ok: true, grocery: stored.grocery });
}
