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

// What the LLM must return, per meal slot, per day.
export interface Meal {
  id?: string;          // assigned when a generated week is persisted; absent on raw LLM output
  date: string;        // ISO date, e.g. "2026-06-29"
  slot: Slot;
  forWhom: Scope;      // him | her | toddler | shared(household)
  dish: string;
  ingredients: string[];
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