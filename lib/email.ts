import type { Week, GroceryItem } from "../types";

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

  const groceryRows = grocery
    .filter((g) => !g.fromPantry)
    .map((g) => `<li>${g.name} — ${g.quantity}</li>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Meal plan — week of ${week.startDate}</h2>
    ${dayBlocks}
    <h3 style="margin-top:20px">Grocery list</h3>
    <ul>${groceryRows}</ul>
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
    from: "Meal Planner <pallabighoshdas@gmail.com>",
    to,
    subject: `Meal plan — week of ${week.startDate}`,
    html: renderHtml(week, grocery),
  });
}