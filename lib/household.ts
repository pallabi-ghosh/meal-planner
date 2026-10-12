import type { ActivityLevel, ChildRules, Household, Profile, ProfileId, Sex } from "@/types";

// Pure helpers (no Node APIs) — used by the API for validation and by the UI to
// decide whether first-time setup is still needed.

const PROFILE_IDS: ProfileId[] = ["him", "her", "toddler"];
const SEXES: Sex[] = ["female", "male"];
const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];

export function isProfileComplete(profile: Profile): boolean {
  if (!profile.name.trim()) return false;
  if (profile.kind === "child") return Boolean(profile.childRules);
  return Boolean(profile.sex && profile.ageYears && profile.heightCm && profile.activity);
}

export function isHouseholdSetUp(household: Household): boolean {
  return household.profiles.length > 0 && household.profiles.every(isProfileComplete);
}

type Validation = { ok: true; household: Household } | { ok: false; message: string };

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validateChildRules(input: unknown): ChildRules | string {
  if (!input || typeof input !== "object") return "childRules is required for the child profile.";
  const rules = input as Partial<ChildRules>;
  if (typeof rules.noAddedSugar !== "boolean" || typeof rules.noAddedSalt !== "boolean") {
    return "childRules.noAddedSugar and childRules.noAddedSalt must be true or false.";
  }
  if (!Array.isArray(rules.allergens) || rules.allergens.some((a) => typeof a !== "string")) {
    return "childRules.allergens must be a list of text values.";
  }
  const texture = typeof rules.texture === "string" && rules.texture.trim() ? rules.texture.trim() : undefined;
  return {
    noAddedSugar: rules.noAddedSugar,
    noAddedSalt: rules.noAddedSalt,
    texture,
    allergens: rules.allergens.map((a) => a.trim()).filter(Boolean),
  };
}

// Returns a cleaned copy: unknown fields are dropped, and a child never carries
// calorie-target fields (the epic gives the child no calorie target).
export function validateHousehold(input: unknown): Validation {
  if (!input || typeof input !== "object") return { ok: false, message: "Send the household as a JSON object." };
  const raw = input as { profiles?: unknown; calorieThresholds?: unknown };

  if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
    return { ok: false, message: "profiles must be a non-empty list." };
  }

  const seen = new Set<string>();
  const profiles: Profile[] = [];

  for (const entry of raw.profiles as Array<Partial<Profile>>) {
    if (!entry || typeof entry !== "object") return { ok: false, message: "Each profile must be an object." };
    if (!entry.id || !PROFILE_IDS.includes(entry.id)) {
      return { ok: false, message: `Profile id must be one of: ${PROFILE_IDS.join(", ")}.` };
    }
    if (seen.has(entry.id)) return { ok: false, message: `Profile "${entry.id}" appears more than once.` };
    seen.add(entry.id);

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name || name.length > 40) return { ok: false, message: `Profile "${entry.id}" needs a name (max 40 characters).` };

    if (entry.kind === "adult") {
      if (!entry.sex || !SEXES.includes(entry.sex)) return { ok: false, message: `${name}: pick a sex.` };
      if (!inRange(entry.ageYears, 16, 110)) return { ok: false, message: `${name}: age must be between 16 and 110.` };
      if (!inRange(entry.heightCm, 100, 230)) return { ok: false, message: `${name}: height must be between 100 and 230 cm.` };
      if (!entry.activity || !ACTIVITY_LEVELS.includes(entry.activity)) {
        return { ok: false, message: `${name}: pick an activity level.` };
      }
      if (entry.weightKg !== undefined && !inRange(entry.weightKg, 30, 300)) {
        return { ok: false, message: `${name}: weight must be between 30 and 300 kg.` };
      }
      profiles.push({
        id: entry.id,
        kind: "adult",
        name,
        sex: entry.sex,
        ageYears: entry.ageYears,
        heightCm: entry.heightCm,
        weightKg: entry.weightKg,
        activity: entry.activity,
      });
    } else if (entry.kind === "child") {
      const rules = validateChildRules(entry.childRules);
      if (typeof rules === "string") return { ok: false, message: `${name}: ${rules}` };
      if (entry.ageYears !== undefined && !inRange(entry.ageYears, 0, 15)) {
        return { ok: false, message: `${name}: age must be between 0 and 15.` };
      }
      profiles.push({ id: entry.id, kind: "child", name, ageYears: entry.ageYears, childRules: rules });
    } else {
      return { ok: false, message: `Profile "${entry.id}" needs kind "adult" or "child".` };
    }
  }

  const thresholds = (raw.calorieThresholds ?? { amberPct: 10, redPct: 25 }) as Household["calorieThresholds"];
  if (!inRange(thresholds.amberPct, 1, 100) || !inRange(thresholds.redPct, 1, 100) || thresholds.amberPct >= thresholds.redPct) {
    return { ok: false, message: "Calorie thresholds need amberPct below redPct, both between 1 and 100." };
  }

  return {
    ok: true,
    household: { profiles, calorieThresholds: { amberPct: thresholds.amberPct, redPct: thresholds.redPct } },
  };
}
