import type { SeedData, Week } from "@/types";

// A genuine tool-calling agent, not a one-shot prompt: the model decides when to
// call get_preferences / get_pantry for context, then must submit its final answer
// through submit_week_plan, whose parameters are an enforced JSON schema (enum
// constraints on slot/forWhom) rather than prose instructions the model can drift on.

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const MAX_AGENT_STEPS = 6;

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaChatResponse {
  message?: OllamaMessage;
  done?: boolean;
  error?: string;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_preferences",
      description:
        "Look up this household's real food preferences: hard rules, ratios, and known frictions. Call this before deciding any meals.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pantry",
      description:
        "Look up ingredients already at home that carry over between weeks and should be used rather than re-bought.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_week_plan",
      description: "Call this exactly once, when the full week is decided, to submit your final answer.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "ISO date, e.g. 2026-07-13" },
          meals: {
            type: "array",
            description: "Exactly 28 meals: 7 days x (breakfast, lunch, snack, dinner).",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "ISO date YYYY-MM-DD" },
                slot: { type: "string", enum: ["breakfast", "lunch", "snack", "dinner"] },
                forWhom: { type: "string", enum: ["him", "her", "toddler", "household"] },
                dish: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
              },
              required: ["date", "slot", "forWhom", "dish", "ingredients"],
            },
          },
        },
        required: ["startDate", "meals"],
      },
    },
  },
];

function executeTool(name: string, seedData: SeedData): unknown {
  if (name === "get_preferences") return seedData.preferences;
  if (name === "get_pantry") return seedData.pantryCarryover;
  return { error: `Unknown tool: ${name}` };
}

function parseArguments(raw: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

export async function runOllamaAgent(seedData: SeedData, weekStart: string): Promise<Week> {
  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: `You are a meal-planning agent for a household in ${seedData.household.location}. Members: ${seedData.household.members.join(", ")}. Budget target ${seedData.household.budgetTargetDKK} DKK, ceiling ${seedData.household.budgetCeilingDKK} DKK.
Before deciding any meals, call get_preferences and get_pantry to learn this household's real rules and what's already at home — do not guess at them.
Hard constraints you must always respect: never put rice at lunch; never include quinoa in any dish.
Once your plan is complete, call submit_week_plan exactly once with the full week. Do not write the plan as chat text — it must be submitted through that tool.`,
    },
    {
      role: "user",
      content: `Plan the week starting ${weekStart}. Use your tools for context first, then submit the plan.`,
    },
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools: TOOLS, stream: false }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not reach Ollama at ${OLLAMA_BASE_URL}. Details: ${detail}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama chat request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) throw new Error(data.error);

    const message = data.message;
    if (!message) throw new Error("Ollama returned no message.");

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // Self-correction nudge rather than an immediate hard failure — a real agent
      // loop gives the model a chance to get back on protocol before giving up.
      messages.push({ role: "assistant", content: message.content ?? "" });
      messages.push({
        role: "user",
        content:
          "You responded with chat text instead of calling a tool. Call submit_week_plan now with your complete plan as structured arguments — do not write it as text.",
      });
      continue;
    }

    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });

    const submission = toolCalls.find((call) => call.function.name === "submit_week_plan");
    if (submission) {
      return parseArguments(submission.function.arguments) as unknown as Week;
    }

    for (const call of toolCalls) {
      const result = executeTool(call.function.name, seedData);
      messages.push({ role: "tool", content: JSON.stringify(result) });
    }
  }

  throw new Error(`Agent did not submit a plan within ${MAX_AGENT_STEPS} steps.`);
}
