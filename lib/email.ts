import type { Week, GroceryItem } from "../types";
import { CATEGORY_ORDER } from "./grocery";

declare const process: {
  env: {
    RESEND_API_KEY?: string;
    TO_EMAILS?: string;
  };
};

// Email plumbing — intentionally complete (not your React/Next gap).
// Uses Resend. Set RESEND_API_KEY and TO_EMAILS in .env.local.
// Install: npm install resend

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function renderHtml(week: Week, grocery: GroceryItem[]): string {
  const days = [...new Set(week.meals.map((m) => m.date))].sort();
  const dayBlocks = days
    .map((date) => {
      const rows = week.meals
        .filter((m) => m.date === date)
        .map(
          (m) =>
            `<tr><td style="padding:4px 8px;color:#888">${m.slot} (${m.forWhom})</td><td style="padding:4px 8px">${m.dish}</td></tr>`
        )
        .join("");
      return `<h3 style="margin:14px 0 4px">${date}</h3><table>${rows}</table>`;
    })
    .join("");

  const toBuy = grocery.filter((g) => !g.fromPantry);
  const groceryGroups = CATEGORY_ORDER.map((category) => ({
    category,
    items: toBuy.filter((g) => (g.category || "Uncategorised") === category),
  })).filter((group) => group.items.length > 0);

  const groceryHtml = groceryGroups
    .map(({ category, items }) => {
      const rows = items
        .map(
          (g) =>
            `<tr><td style="padding:5px 0;border-bottom:1px solid #eee">${g.name}${g.quantity ? ` — ${g.quantity}` : ""}</td></tr>`
        )
        .join("");
      return `<div style="margin:0 0 16px">
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#2f6f4f;border-bottom:2px solid #2f6f4f;padding-bottom:4px;margin-bottom:2px">${category}</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      </div>`;
    })
    .join("");

  return `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Meal plan — week of ${week.startDate}</h2>
    ${dayBlocks}
    <h3 style="margin-top:20px">Grocery list</h3>
    ${groceryHtml || "<p>Nothing to buy — everything's covered from the pantry.</p>"}
  </div>`;
}

export async function sendWeekEmail(week: Week, grocery: GroceryItem[]) {
  if (!resend) {
    return { id: null, error: "Email skipped because RESEND_API_KEY is not configured." };
  }

  const to = (process.env.TO_EMAILS ?? "").split(",").map((s) => s.trim());
  if (to.length === 0 || !to[0]) {
    throw new Error("Set TO_EMAILS in .env.local (comma-separated).");
  }

  return resend.emails.send({
    from: "Meal Planner <onboarding@resend.dev>",
    to,
    subject: `Meal plan — week of ${week.startDate}`,
    html: renderHtml(week, grocery),
  });
}