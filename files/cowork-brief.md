# Meal Planner App — Cowork Starting Brief

A personal tool for a family of three (two adults + 16-month toddler) in Denmark.
Generates a weekly meal plan + grocery list, emails it daily, learns from what was actually eaten.

**Primary goal:** a tool the family actually uses. Not a recruiter demo.
**Implication:** optimise for reliability and low-friction logging, not polish. The #1 risk is abandonment, not bad architecture.

---

## Decisions already locked

- **No RAG in v1.** This is constrained *generation* over structured preference data, not retrieval. (RAG is a possible v2: retrieve from a personal saved-recipe library.)
- **Per-person preferences** (him / her / toddler / household), via a `scope` field — NOT a full Person/Users table.
- **Seed from the two known weeks**, confirmed-stable items only. One-offs (e.g. coffee restock) are NOT preferences.
- **Email notifications first.** Push notifications deferred — they're a real complexity jump (service workers, permissions, push service) and email covers the need.
- **Grocery math is CODE, not LLM.** The LLM picks dishes; code merges quantities, subtracts pantry, sums DKK. Never let the LLM do arithmetic.
- **DB is low-stakes.** The model maps cleanly to JSON files OR SQLite OR Postgres with almost no change. Start with whatever is easiest (even JSON files). Don't let this block you.

---

## Seed preference data (from 2 real weeks)

These are confirmed by repetition — safe to hardcode as starting `Preference` rows.

**Breakfast (per-person, per-day-type):**
- him → oats daily (`scope: him, kind: hardRule`)
- her → wholegrain toast + avocado + poached egg, weekdays (`scope: her`)
- both → pancakes, weekend mornings (`scope: household`)
- REMOVED: poha, upma — do not reflect real habits. Do not seed.

**Hard rules (household):**
- no quinoa (tried, disliked)
- no rice at lunch → leftovers re-served as salads / bowls / wraps
- rice & roti fine at dinner
- leftover-into-lunch structure kept (cost + waste mechanism)

**Ratios / targets:**
- ~60/40 non-veg to veg, where fish & eggs count as non-veg
- ~4 legume meals/week (lentils, chickpeas)
- chicken thighs, not breast
- mushrooms featured; mushroom risotto as a dinner

**Frictions (soft — the LLM should weigh, not obey):**
- cold leftover salad bowls lose appeal by midweek → wraps as fallback
- avocado is perishable & price-variable in DK supermarkets
- watch cholesterol when risotto + a roast land in the same week

**Budget reality:** target was 1,000–1,500 DKK; real spend runs ~700–800 because leftovers carry days. Model the *pantry carryover* or the app will over-suggest shopping.

---

## Domain model

`Week` is the aggregate root — always enter through it.

| Entity | Key fields | Belongs to |
|---|---|---|
| **Week** | startDate, status, estimatedCost, budgetTarget | — (root) |
| **Meal** | weekId, date, slot, forWhom, dish, ingredients, source | Week (composition) |
| **MealLog** | mealId, eater, ate(yes/substituted), actualDish, loggedAt | Meal (0..*) |
| **GroceryItem** | weekId, name, quantity, category, estPrice, fromPantry | Week (composition) |
| **Preference** | scope, kind(hardRule/ratio/learned/friction), text, acceptCount, rejectCount | independent |
| **PantryItem** | name, quantity, carriesOverDays | independent |

- Diamond (composition): delete the Week, its Meals & GroceryItems go too.
- `Preference` & `PantryItem` live OUTSIDE any week — they outlive weeks. (Beginner trap: don't cram them into Week.)
- `MealLog → Preference` (update counts) and `MealLog → PantryItem` (update stock) = the feedback loop.
- **Possible v1 cut:** skip `PantryItem` on day one; add it once over-shopping annoys you.

---

## The runtime loop

1. **Sunday:** gather Preferences + Pantry + budget → one LLM call → structured JSON week of meals.
2. **Code** derives the grocery list from meals minus pantry, grouped, with DKK totals.
3. **Each morning:** a scheduled job (Vercel Cron or equivalent) emails today's plan.
4. **During the day:** log what was actually eaten (per person). Substitutions update preference counts + pantry.
5. **Next Sunday:** generation reads the updated state. Loop closes.

---

## Three screens (v1)

1. **Week view** — pantry carryover banner, est. spend, meals per day with per-person + toddler variants, regenerate button, link to grocery list.
2. **Log / override** — "did you eat the planned X?" → yes / substituted → what instead. One tap = common case. *Friction here kills the loop — obsess over this.*
3. **Grocery + prefs** — auto grocery list (pantry items struck through), editable "what I've learned about you" preference list. You own the list, not the LLM.

UI stays ugly until everything works.

---

## Phased build (evenings)

- **Phase 1 — Spine (~3–4):** scaffold + seed preferences + LLM call returning structured JSON week + render week + render grocery list (code-computed). The gate: does it reliably respect hard rules (no rice at lunch, no quinoa) run after run? Don't proceed until yes.
- **Phase 2 — Logging loop (~2–3):** per-person logging, the substitution input, MealLog updates preference counts.
- **Phase 3 — Email (~2–3):** daily email via a HOSTED scheduler. Decide where it runs *before* building. Hardest infra piece.
- **Phase 4 — Visible adaptation (~2):** next week shifts based on logs; editable "learned about you" view.

~2–2.5 weeks of evenings total. Phase 1 is the real gate.

---

## Hardest bits to learn (flagged honestly)

1. **Structured LLM output** — reliable conforming JSON (schema validation + retry on malformed). The core skill; likely your biggest unknown.
2. **Constraint adherence** — LLMs drift on "never do X." May need validate-and-retry, not just trusting the prompt. Your no-rice-at-lunch rule is the test case.
3. **Scheduled jobs serverless** — the email piece; can't run on a closed laptop.
4. **Grocery quantity math** — merging "200g paneer ×3 meals" minus pantry. Pure code, fiddly, not an LLM job.

---

## Things to deliberately NOT build in v1

- No Users/Person table (use `scope` enum).
- No push notifications (email only).
- No RAG / vector store.
- No auth (single-family, can stay local/unlisted).
- Maybe no Pantry table at first.

Adding these early is procrastination disguised as architecture.
