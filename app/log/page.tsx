"use client";

import { useAppData } from "@/app/components/AppData";
import LogPanel from "@/app/components/LogPanel";
import ProfileSwitch from "@/app/components/ProfileSwitch";
import { possessive } from "@/lib/household";
import type { SeedData } from "@/types";

function prefLabel(pref: SeedData["preferences"][number]): string {
  if (!pref.acceptCount && !pref.rejectCount) return pref.text;
  return `${pref.text} (✓${pref.acceptCount ?? 0}/✗${pref.rejectCount ?? 0})`;
}

export default function LogPage() {
  const { week, mealLogs, household, preferences, view, refresh } = useAppData();

  // Logs exist per profile only, so the Family view isn't an option here.
  const profiles = household?.profiles ?? [];
  const active = profiles.find((p) => p.id === view) ?? profiles[0];
  const meals = (week?.meals ?? []).filter(
    (meal) => meal.forWhom === "household" || meal.forWhom === active?.id
  );

  const hardRules = preferences?.preferences.filter((p) => p.kind === "hardRule") ?? [];
  const otherPrefs = preferences?.preferences.filter((p) => p.kind !== "hardRule") ?? [];

  return (
    <div className="screen">
      <div className="scr-head">
        <span>LOG</span>
        <span className="scr-tag">{active ? `${possessive(active.name)} log` : "per profile"}</span>
      </div>
      <div className="scr-body">
        <ProfileSwitch allowFamily={false} />

        {active ? (
          <LogPanel meals={meals} mealLogs={mealLogs} profile={active.id} onLogged={refresh} />
        ) : (
          <div className="box">Loading profiles…</div>
        )}

        <div className="label">What I&rsquo;ve learned about you</div>
        <div className="box" style={{ borderColor: "var(--accent)" }}>
          {hardRules.map((pref) => (
            <span className="chip on" key={pref.text}>
              {prefLabel(pref)}
            </span>
          ))}
          {otherPrefs.map((pref) => (
            <span className="chip" key={pref.text}>
              {prefLabel(pref)}
            </span>
          ))}
        </div>
        <div className="small">
          Accept/reject counts update as you log meals. Add your own with &ldquo;Push your own suggestion&rdquo; above.
        </div>
      </div>
    </div>
  );
}
