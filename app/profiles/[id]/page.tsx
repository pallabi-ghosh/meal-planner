"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppData } from "@/app/components/AppData";
import NumberField from "@/app/components/NumberField";
import { missingAdultField } from "@/lib/household";
import UsualMealsEditor from "@/app/components/UsualMealsEditor";
import type { ActivityLevel, ChildRules, Household, Profile, Sex } from "@/types";

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Sedentary — little or no exercise" },
  { value: "light", label: "Light — exercise 1–3 days a week" },
  { value: "moderate", label: "Moderate — exercise 3–5 days a week" },
  { value: "active", label: "Active — exercise 6–7 days a week" },
  { value: "very_active", label: "Very active — hard exercise or a physical job" },
];

const TEXTURES = ["Mashed", "Soft pieces", "Finger food"];

export default function EditProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { household, refresh, loaded } = useAppData();

  const source = household?.profiles.find((p) => p.id === params.id);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [allergenText, setAllergenText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (source && !draft) setDraft(structuredClone(source));
  }, [source, draft]);

  if (loaded && !source) {
    return (
      <div className="screen">
        <div className="scr-body">
          <div className="box">That profile doesn&rsquo;t exist.</div>
          <Link href="/profiles" className="btn ghost">
            Back to profiles
          </Link>
        </div>
      </div>
    );
  }
  if (!draft || !household) {
    return (
      <div className="screen">
        <div className="scr-body">Loading…</div>
      </div>
    );
  }

  const profile: Profile = draft;
  const rules: ChildRules = profile.childRules ?? { noAddedSugar: true, noAddedSalt: true, allergens: [] };

  function update(patch: Partial<Profile>) {
    setDraft({ ...profile, ...patch });
  }

  function updateRules(patch: Partial<ChildRules>) {
    update({ childRules: { ...rules, ...patch } });
  }

  function addAllergen() {
    const value = allergenText.trim();
    if (!value || rules.allergens.some((a) => a.toLowerCase() === value.toLowerCase())) return;
    updateRules({ allergens: [...rules.allergens, value] });
    setAllergenText("");
  }

  async function save() {
    setMessage(null);
    const missing = profile.kind === "adult" ? missingAdultField(profile) : null;
    if (missing) {
      setMessage(missing);
      return;
    }
    setSaving(true);
    const next: Household = {
      ...household!,
      profiles: household!.profiles.map((p) => (p.id === profile.id ? profile : p)),
    };
    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message ?? "Couldn't save this profile.");
        return;
      }
      await refresh();
      router.push("/profiles");
    } catch {
      setMessage("Couldn't reach the planner. Check the Mac is on and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="screen">
      <div className="scr-head">
        <span>{profile.name || "Profile"}</span>
        <Link href="/profiles" className="scr-tag">
          Profiles
        </Link>
      </div>
      <div className="scr-body">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            className="text-input"
            value={profile.name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={40}
          />
        </div>

        {profile.kind === "adult" ? (
          <>
            <div className="field">
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Sex (used for the calorie target)</span>
              <div className="seg" role="group" aria-label="Sex">
                {(["female", "male"] as Sex[]).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    className={profile.sex === sex ? "on" : ""}
                    aria-pressed={profile.sex === sex}
                    onClick={() => update({ sex })}
                  >
                    {sex === "female" ? "Female" : "Male"}
                  </button>
                ))}
              </div>
            </div>
            <NumberField id="age" label="Age" unit="years" required value={profile.ageYears} onChange={(v) => update({ ageYears: v })} />
            <NumberField id="height" label="Height" unit="cm" required value={profile.heightCm} onChange={(v) => update({ heightCm: v })} />
            <NumberField id="weight" label="Weight" unit="kg" value={profile.weightKg} onChange={(v) => update({ weightKg: v })} />
            <div className="field">
              <label htmlFor="activity">Activity level</label>
              <select
                id="activity"
                className="text-input"
                value={profile.activity ?? ""}
                onChange={(e) => update({ activity: (e.target.value || undefined) as ActivityLevel | undefined })}
              >
                <option value="">Choose…</option>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <NumberField id="age-months" label="Age" unit="months" value={profile.ageMonths} onChange={(v) => update({ ageMonths: v })} />
            <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              No calorie target is set for a child. Calories are shown as estimates only.
            </div>

            <div className="label">Food rules</div>
            <label className="toggle-row">
              <span>No added sugar</span>
              <input type="checkbox" checked={rules.noAddedSugar} onChange={(e) => updateRules({ noAddedSugar: e.target.checked })} />
            </label>
            <label className="toggle-row">
              <span>No added salt</span>
              <input type="checkbox" checked={rules.noAddedSalt} onChange={(e) => updateRules({ noAddedSalt: e.target.checked })} />
            </label>

            <div className="field" style={{ marginTop: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Texture</span>
              <div className="seg" role="group" aria-label="Texture">
                {TEXTURES.map((texture) => (
                  <button
                    key={texture}
                    type="button"
                    className={rules.texture === texture ? "on" : ""}
                    aria-pressed={rules.texture === texture}
                    onClick={() => updateRules({ texture })}
                  >
                    {texture}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="allergen">Allergens</label>
              <div>
                {rules.allergens.length === 0 ? <span className="small">None listed</span> : null}
                {rules.allergens.map((allergen) => (
                  <button
                    key={allergen}
                    type="button"
                    className="chip on"
                    aria-label={`Remove ${allergen}`}
                    onClick={() => updateRules({ allergens: rules.allergens.filter((a) => a !== allergen) })}
                  >
                    {allergen} &times;
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="allergen"
                  className="text-input"
                  style={{ flex: 1 }}
                  value={allergenText}
                  placeholder="e.g. sesame"
                  onChange={(e) => setAllergenText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addAllergen();
                  }}
                />
                <button type="button" className="btn ghost" onClick={addAllergen} disabled={!allergenText.trim()}>
                  Add
                </button>
              </div>
            </div>
          </>
        )}

        {message ? <div className="error">{message}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Link href="/profiles" className="btn ghost" style={{ flex: 1 }}>
            Cancel
          </Link>
          <button className="btn" style={{ flex: 2 }} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>

    <div className="screen" style={{ marginTop: 16 }}>
      <div className="scr-head">
        <span>Usual meals</span>
        <span className="scr-tag">saved as you go</span>
      </div>
      <div className="scr-body">
        <UsualMealsEditor
          profileId={profile.id}
          kind={profile.kind}
          avoid={[
            ...(rules.noAddedSalt && profile.kind === "child" ? ["salt"] : []),
            ...(rules.noAddedSugar && profile.kind === "child" ? ["sugar"] : []),
          ]}
        />
      </div>
    </div>
    </>
  );
}
