import { NextResponse } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

// Suggests ingredient names for a dish so nobody has to type them. The person
// always confirms or edits the result; failure just means "type them yourself".
export async function POST(request: Request) {
  let dish = "";
  try {
    const body = (await request.json()) as { dish?: unknown };
    dish = typeof body.dish === "string" ? body.dish.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  } catch {
    // fall through to the validation below
  }
  if (!dish) return NextResponse.json({ ok: false, ingredients: [], message: "Give the dish a name first." }, { status: 400 });

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        messages: [
          {
            role: "user",
            content: `List the main ingredients for this dish as plain names without quantities: "${dish}". Use at most 10 short names. Answer only with JSON like {"ingredients": ["name", "name"]}.`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Ollama answered ${response.status}`);

    const data = (await response.json()) as { message?: { content?: string } };
    const parsed = JSON.parse(data.message?.content ?? "{}") as { ingredients?: unknown };
    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients
          .filter((i): i is string => typeof i === "string")
          .map((i) => i.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40))
          .filter(Boolean)
          .slice(0, 10)
      : [];

    if (ingredients.length === 0) {
      return NextResponse.json({ ok: false, ingredients: [], message: "No suggestion this time. Type the ingredients in." });
    }
    return NextResponse.json({ ok: true, ingredients });
  } catch {
    return NextResponse.json(
      { ok: false, ingredients: [], message: "Couldn't get a suggestion. Is Ollama running? You can type the ingredients in." },
      { status: 503 }
    );
  }
}
