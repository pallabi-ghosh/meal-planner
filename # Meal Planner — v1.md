# Meal Planner — v1 scaffold

A personal Next.js (App Router + TypeScript) tool: generate a week of meals from
seeded family preferences, build a grocery list, and email it to both of you.

This is **Phase 1, the thin slice**: seed preferences → LLM → structured week → email.
No database, no logging, no notifications scheduler yet — those are later phases.

## What's done for you (boilerplate / non-gap plumbing)
- Project + TypeScript config, path aliases (`@/`)
- `types/index.ts` — the domain model as types (Week is the aggregate root)
- `data/seed-preferences.json` — your two real weeks, as structured data
- `lib/prompt.ts` — turns preferences into a grounded prompt (hard rules vs ratios vs frictions)
- `lib/grocery.ts` — grocery list in CODE (naive v1; TODOs mark where to improve)
- `lib/email.ts` — Resend email sending, fully wired
- `app/page.tsx` + `app/components/GenerateButton.tsx` — Server/Client Component split

## What's left for YOU (deliberately — this is your React/Next learning)
1. **`app/api/generate/route.ts`** — the OpenAI call + JSON parsing + retry on malformed JSON.
2. Same file — **hard-rule validation** (no rice at lunch, no quinoa) before trusting output.
3. **`app/page.tsx`** — render the returned week + grocery list (instead of dumping JSON).

These three are the App Router route-handler and Server/Client boundary skills you
said you wanted to close. The plumbing around them is done so you're not stuck on setup.
(If you'd rather I fill these in too, just ask — they were left open on purpose.)

## Run it
```bash
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev
```
Open http://localhost:3000 and click "Generate week & email it".
Until you implement the TODOs, the route returns a 501 stub showing the prompt preview.

## Key safety note
`.env.local` holds your OpenAI + Resend keys and is gitignored. Never commit it —
you publish repos publicly, so double-check before pushing.

## Next phases (not built yet)
- Phase 2: per-person logging + substitution input → updates preference counts
- Phase 3: daily email via a hosted scheduler (Vercel Cron)
- Phase 4: visible adaptation + editable "what I've learned about you"