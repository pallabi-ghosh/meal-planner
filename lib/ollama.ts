const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

// Ask the local model for a JSON answer. Any failure (Ollama off, slow, rambling) is just
// `null`, so every caller has to have a sensible fallback. Server-side only.
export async function askJson<T>(prompt: string, timeoutMs = 45_000): Promise<T | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: { content?: string } };
    return JSON.parse(data.message?.content ?? "") as T;
  } catch {
    return null;
  }
}
