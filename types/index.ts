// Domain types — mirror the domain model (Week is the aggregate root).
// Kept deliberately small for v1. No User/Person table: identity lives in `scope`.

export type Scope = "him" | "her" | "toddler" | "household";
export type Slot = "breakfast" | "lunch" | "snack" | "dinner";
export type PrefKind = "hardRule" | "ratio" | "learned" | "friction";

export interface Preference {
  scope: Scope;
  kind: PrefKind;
  text: string;
  acceptCount?: number;
  rejectCount?: number;
}

export interface PantryItem {
  name: string;
  quantity?: string;
  carriesOverDays: number;
}

// ---- v2: household & profiles ---------------------------------------------
// Profile ids reuse the Scope values (him / her / toddler), so v1 logs and
// preferences stay valid without migration.
export type ProfileId = Exclude<Scope, "household">;
export type ProfileKind = "adult" | "child";
export type Sex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface ChildRules {
  noAddedSugar: boolean;
  noAddedSalt: boolean;
  texture?: string;      // e.g. "soft, finger foods"
  allergens: string[];
}

export interface Profile {
  id: ProfileId;
  kind: ProfileKind;
  name: string;
  // Adults only — drives the daily calorie target. The child has no calorie target.
  sex?: Sex;
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;     // optional
  activity?: ActivityLevel;
  // Child only.
  ageMonths?: number;
  childRules?: ChildRules;
}

export interface CalorieThresholds {
  amberPct: number;      // roughly >10% over target => amber
  redPct: number;        // roughly >25% over target => red
}

export interface Household {
  profiles: Profile[];
  calorieThresholds: CalorieThresholds;
}

// ---- v2: structured recipes ------------------------------------------------
export type Unit = "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "pcs";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  servings: number;
  ingredients: Ingredient[];
}

// What the LLM must return, per meal slot, per day.
export interface Meal {
  id?: string;          // assigned when a generated week is persisted; absent on raw LLM output
  date: string;        // ISO date, e.g. "2026-06-29"
  slot: Slot;
  forWhom: Scope;      // him | her | toddler | shared(household)
  dish: string;
  ingredients: string[];
  // v2 (all optional so v1 meals keep loading):
  recipe?: Recipe;                                  // structured; drives grocery quantities + calories
  portionShare?: Partial<Record<ProfileId, number>>; // e.g. { him: 1, her: 1, toddler: 0.3 }
  toddlerSafe?: boolean;
  setAsideBeforeSeasoning?: boolean;
}

export type AteStatus = "yes" | "substituted";

// Logged after the fact — the feedback loop. Not produced by the LLM.
export interface MealLog {
  id: string;
  mealId: string;
  eater: Scope;
  ate: AteStatus;
  actualDish?: string;   // set when ate === "substituted"
  loggedAt: string;      // ISO timestamp
}

export interface GroceryItem {
  id?: string;          // assigned when persisted; lets two items share a name safely
  name: string;
  quantity: string;
  category: string;    // e.g. "Produce", "Dairy", "Meat & Fish"
  fromPantry: boolean; // true => already have it, struck through, not bought
}

// The aggregate root.
export interface Week {
  startDate: string;
  meals: Meal[];
  budgetTargetDKK: number;
  // v2 (optional):
  cuisine?: { week?: string; byDate?: Record<string, string> };
  cheatDay?: string;          // ISO date; at most one per week
  finalisedDates?: string[];  // ISO dates locked for grocery generation
}

// ---- v2: pantry, bought ledger, taste-file proposals ------------------------
export interface PantryStock {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  updatedAt: string;
}

export interface BoughtEntry {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  boughtAt: string;
  coversFrom?: string;       // the grocery date range this purchase covered
  coversTo?: string;
}

export interface PantryData {
  stock: PantryStock[];
  bought: BoughtEntry[];
}

export type ProposalStatus = "pending" | "approved" | "rejected";

// A suggested taste-file change. Nothing is applied until the user approves; the
// `key` identifies the suggestion so a decided proposal is never raised twice.
export interface Proposal {
  id: string;
  scope: Scope;
  key: string;
  text: string;
  reason: string;
  status: ProposalStatus;
  createdAt: string;
  decidedAt?: string;
}

// Shape of the seed JSON in /data/seed-preferences.json
export interface SeedData {
  household: {
    members: string[];
    location: string;
    budgetTargetDKK: number;
    budgetCeilingDKK: number;
    notes: string;
  };
  preferences: Preference[];
  pantryCarryover: PantryItem[];
}

// The shape returned by POST /api/generate — shared by GenerateButton and page.tsx
// instead of each re-declaring it.
export interface GenerationResponse {
  ok: boolean;
  week?: Week;
  grocery?: GroceryItem[];
  message?: string;
}