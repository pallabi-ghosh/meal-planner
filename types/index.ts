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
  date: string;        // ISO date, e.g. "2026-06-29"
  slot: Slot;
  forWhom: Scope;      // him | her | toddler | shared(household)
  dish: string;
  ingredients: string[];
}

export interface GroceryItem {
  name: string;
  quantity: string;
  category: string;    // e.g. "Produce", "Dairy", "Meat & Fish"
  estPriceDKK: number;
  fromPantry: boolean; // true => already have it, struck through, not bought
}

// The aggregate root.
export interface Week {
  startDate: string;
  meals: Meal[];
  estimatedCostDKK?: number;
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