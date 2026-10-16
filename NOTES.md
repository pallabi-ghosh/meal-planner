# Meal Planner — Personal Notes (project log + interview prep)

This file is just for you. It's not used by the app itself — a running, one-line-per-idea
record of what's been built and what we've talked about, so you can review it anytime or
add your own notes. Add freely below any section.

## Project setup
- Built with Next.js (App Router) + TypeScript — one framework that handles both the web
  page and the backend API in the same project.
- Domain model: `Week` is the "aggregate root" (it owns Meals + GroceryItems); `Preference`
  and `PantryItem` live independently and outlive any single week.
- Data is stored as plain JSON files for now (no real database) — fine for a single-family
  app; the design can move to a real database later without changing the model.

## Phase 2 — logging loop (built 2026-07-08)
- Added `MealLog` (which meal, who ate it, yes/substituted, what instead) and wired it end
  to end: generated weeks now persist to `data/current-week.json` so a page refresh
  doesn't lose the plan, and each meal gets a stable id.
- Screen ② (Log/Override) is now real: tap "yes" or log a substitution per meal, plus a
  standing "push your own suggestion" box that adds a brand-new preference directly.
- Substitutions do a best-effort keyword match back to an existing hard-rule/learned
  preference and bump its accept/reject count — same pragmatic keyword style already used
  in `lib/grocery.ts`, not a strict database relationship.
- Found and fixed the real cause of "the meals aren't right": the AI prompt showed a
  placeholder like `"breakfast|lunch|snack|dinner"` meaning "pick one," and the small local
  model sometimes echoed it back literally instead of choosing a value. Fixed the prompt
  wording and added validation so this class of bad output now triggers a retry.
- Getting a full, reliable 28-meal week every time is still open (small local model
  under-produces sometimes) — this is the cloud-AI-swap conversation from before, still
  deferred by choice for now.

## Editable grocery list (built 2026-07-08)
- Screen ③'s grocery list is no longer read-only — it's a real weekly checklist you edit
  directly: add your own items, check off anything you already have at home (strikethrough,
  stays visible, same style as pantry items), remove items, all saved immediately.
- Decoupled from meal generation on purpose: the grocery list now lives independently in
  storage, so editing it never depends on — or gets overwritten by — regenerating a week.
- Added a "Send list by email" button so the current list goes out on demand, instead of
  only ever being emailed automatically when a week is generated.

## GitHub
- Installed and logged into the GitHub CLI (`gh`) to create/push repos from the terminal.
- Repo is private (github.com/pallabi-ghosh/meal-planner) because it contains real
  household details (budget, food habits).
- `.gitignore` keeps secrets (`.env.local`) and build folders (`node_modules`, `.next`) out
  of git — always worth a check before pushing.

## AI generation (Ollama)
- Ollama = a program that runs an AI language model locally on your own Mac, for free, no
  per-call cost.
- The app talks to Ollama at `http://127.0.0.1:11434` — "127.0.0.1" always means "this same
  computer," which is why it only works while Ollama is running locally.
- Ollama isn't a background service — it has to be started manually (`ollama serve` or the
  app) before generating; if it's off, generation fails instantly.
- Known gap: the small local model (llama3.2) doesn't yet reliably generate the full 7-day/
  28-meal week — sometimes returns a partial result. This is the "Phase 1 gate" to close
  before moving on to logging (Phase 2).

## Deploying beyond localhost
- Ollama can't be reached from a deployed app (e.g. on Netlify) — "127.0.0.1" on a cloud
  server means that server, not your Mac.
- To use this app from a phone after deploying, the AI call needs to move to a cloud AI API
  (OpenAI/Anthropic) instead of Ollama — small cost per call, but reliable from anywhere.
  Ollama can stay for local development either way.

## Wireframe / UI
- Applied the hand-drawn wireframe's visual design (monospace font, bordered "screen"
  cards, color-coded chips/banners) into the real app's CSS.
- App currently shows 2 of the 3 planned screens live (Week View, Grocery+Prefs); Screen ②
  (Log/Override) is a visual placeholder only — not functional yet, that's Phase 2.

## Email (Resend)
- Resend = a "transactional email" service — a company that specializes in reliably
  delivering emails on your app's behalf, so you don't have to run your own mail server.
- Your app calls Resend's API with the email content; Resend actually delivers it and logs
  every send (visible in their dashboard under "Emails"/"Logs").
- Fixed the sender address to `onboarding@resend.dev` (Resend's built-in test sender) — the
  original `@gmail.com` sender wouldn't have worked without verifying a domain.
- `.env.local` holds the Resend API key + recipient emails — never committed to git.

## System design concepts discussed (interview-ready vocabulary)
- SMTP = the actual internet protocol all email runs on (like HTTP for websites); every
  provider (Gmail, Resend, Azure) speaks it under the hood, often via a nicer API on top.
- Companies rarely run their own mail server — earning deliverability/reputation with Gmail
  etc. from scratch is hard; they use transactional email services instead (SendGrid,
  Resend, Azure Communication Services).
- Big companies log every email sent (recipient, template, delivery status) for customer
  support, compliance/audit, and analytics — this is standard practice, not unusual.
- Enterprise pattern: split one big app into many small independent services, connected by
  a message queue (e.g. Azure Service Bus) instead of calling each other directly — so a
  slow/broken piece (like email) never blocks the rest (like checkout).
- Centralized logging (e.g. Azure Application Insights) lets support trace one customer's
  request across every service it touched.
- Planned hands-on exercise: apply this "decouple email via a queue" pattern to the Meal
  Planner itself, at small scale, once we're back to building.

---
<!-- Add your own notes below this line anytime. -->

## v2 — Sprint 1 progress
- **MP2-2 done:** v2 data model added on top of v1 (profiles, structured recipes, pantry/bought ledger,
  proposals — all optional, so v1 data still loads). Storage stays JSON files, now with atomic writes and a
  per-file write queue so two phones can't corrupt a file. New `/api/household` with validation.
- **MP2-3 done:** the single page became three tabs (Week / Log / Grocery) as routes, reusing the v1 panels.
  Tab bar sits at the bottom on phones. Log is per profile (no Family option); Week has a read-only
  per-person view. Planning and groceries stay family-level.
- Ollama is back on `127.0.0.1` (the Tailscale-bound setup was only for the dropped Fly.io plan).
- **MP2-3b done:** new calm design system (tokens in `globals.css`, Figtree, 44px touch targets) and a
  responsive shell: tabs in the header on wide screens, bottom bar on phones.
- **MP2-4 done:** `/profiles` list and per-profile forms. Adults: sex, age, height, weight (optional), activity.
  Child: age in months, no added sugar/salt, texture, allergens. Each profile saves on its own.
- **MP2-5 done:** usual meals per person in `data/taste/<id>.md` (hand-editable; other sections preserved).
  Child dinner is a pool. Ingredient suggestion via Ollama, filtered by the child's rules.
- Found while testing: saving one profile used to fail because all three were validated together. Fixed.
- **MP2-6 done:** the Week screen. Calendar on the left (a day strip on phones), the day on the right with a
  column per person. "Fill the week from usual meals" prefills breakfast/lunch/snack (weekday vs weekend aware,
  rotating when there are several options) and the child's dinner from his pool. Adult dinners stay empty on
  purpose: dinner is the decision. Anything can be edited in place; nothing already planned is overwritten.
- Old plans are detected: a "Start this week's plan" action begins a fresh Monday-start week and keeps groceries.
- Planning logic lives in `lib/plan.ts` as pure functions (22 checks passed in a throwaway script).

- **MP2-6 restyle + MP2-8 (first part) done:** the Week screen now follows the approved wireframe: a calendar
  card (a day strip on phones), the day's heading, a card with a column per person, and a dinner row where the
  family dinner and the child's own dinner sit side by side. A "Finalise week" bar marks days that have a family
  dinner as finalised (shows "Finalised" in the calendar); "Reopen week" undoes it. Stored as `finalisedDates`
  on the week via `/api/week/finalise`.
- Finalising does not yet change the grocery list; that comes with the grocery-by-date-range story (MP2-9/10).
- Still to build on this screen: calories per meal and day totals, "Swap" with three alternatives, cuisine card
  with dinner suggestions, cheat day, toddler-safe badge, previous/next week.
- **Week screen, desktop polish (16 Oct):** column heads show each adult's daily calorie target (worked out from
  sex, age, height, weight and activity; no weight means a healthy-BMI assumption). Every meal can carry an
  optional calorie number, shown under the dish. A Day total row shows each person's total against target with a
  bar (amber over 10%, red over 25%, set in the household thresholds). The calendar shows a +% pill on days where
  an adult is over. The child has no target, only an estimate.
- **Cheat day:** one tick-box per week; the day goes green in the calendar and is exempt from warnings.
- Family dinner counts toward both adults' totals; the child's own dinner counts toward his.
- Calories are typed in by hand for now. AI estimates (MP2-14/16) come later.
- Week arrows (previous/next week) are not built: the app keeps one current week, so that needs week history.
- **MP2-7 (first version), MP2-17, MP2-21 (badge), calorie estimates done (16 Oct):**
  - *Cuisine card:* a cuisine for the week, plus an optional different one for the selected day. "Suggest the N open
    dinners" fills every empty dinner from today onwards, one request per cuisine. The calendar labels suggested
    dinners with their cuisine.
  - *Ideas come from two places:* the local AI model first; if it gives too little (or is off) a built-in list of
    about 40 dinners across 7 cuisines tops it up. The screen says which one was used.
  - *Swap:* three alternatives for the day's dinner, "Use this" in one tap, "Show others" for more.
  - *Not toddler-safe badge:* worked out by fixed rules (chilli, salty things, sugar, whole nuts, allergens from the
    child's profile), never by the AI, because it's a safety flag. Tested with 10 checks.
  - *Calorie estimates:* "Estimate calories" in the edit box, and "Estimate the N missing figures" for a day. The
    built-in list is used where it knows the dish; otherwise the AI, with believable limits per meal type. They are
    estimates; the 3B model is shaky, so it asks twice and reports "Estimated X of Y".
- Lesson: the small local model got a kebab box wrong (1,500 kcal) until I added sanity limits. Anything the model
  produces needs checks around it.
- Cuisine card sits under the calendar on wide screens; on a phone it will need a better place (mobile pass later).
- **MP2-9 and MP2-10 done (16 Oct): the Grocery tab.** Pick From and To dates (it starts with the finalised days,
  or the whole week if none). The engine adds up amounts per item (g with kg, ml with l, counts, tsp and so on),
  folds plurals (tomato/tomatoes), leaves out pantry items and sorts by shop aisle. Tick an item and it is written
  to a "bought" ledger (`data/pantry.json`) for that range, so it stays ticked and disappears from later ranges
  that it covers. "In the pantry" is a short list you manage by hand. 15 checks passed on the engine.
- Ingredients with no amount ("onion") count once per meal, so the list says "3" not "1.5 kg". Real quantities
  need structured recipes, which the AI suggestions don't produce yet.
- Hand-added items and the email moved under "Extras". Making the email follow the date range is MP2-25.
- **Grocery on a desktop screen (16 Oct):** it was a narrow column on the left with the rest empty. Now it is two
  columns on wide screens: the date range, progress and pantry on the left, the aisles as cards on the right
  (3 across on very wide screens, 1 on a phone).
- **MP2-11 (first part) done:** the app can be added to a phone's home screen: manifest, a green plate icon,
  `apple-touch-icon`, full-screen mode and theme colour. On iPhone: Safari, Share, Add to Home Screen.
- Lesson: an `app/manifest.ts` file made every page fail in this dev setup ("require is not defined"). A plain
  `public/manifest.webmanifest` file works, so that is what's used.
- Not done for MP2-11: HTTPS. iPhone only gives a true full-screen install over HTTPS, and plain http over the
  Tailscale IP can add a bookmark-style shortcut. The Tailscale HTTPS option (`tailscale serve`) is the next try.
