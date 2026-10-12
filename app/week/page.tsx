"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppData } from "@/app/components/AppData";
import GenerateButton from "@/app/components/GenerateButton";
import MealPlanPanel from "@/app/components/MealPlanPanel";
import ProfileSwitch from "@/app/components/ProfileSwitch";
import type { GenerationResponse } from "@/types";

export default function WeekPage() {
  const { week, preferences, household, view, refresh } = useAppData();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleGenerated(data: GenerationResponse) {
    if (data.ok) {
      setErrorMessage(null);
      refresh();
    } else {
      setErrorMessage(data.message ?? "Generation failed.");
    }
  }

  const viewedProfile = view === "family" ? null : household?.profiles.find((p) => p.id === view) ?? null;
  const profileMeals = (week?.meals ?? []).filter(
    (meal) => meal.forWhom === "household" || meal.forWhom === viewedProfile?.id
  );

  return (
    <div className="screen">
      <div className="scr-head">
        <span>WEEK</span>
        <span className="scr-tag">{viewedProfile ? `${viewedProfile.name}'s view` : "family plan"}</span>
      </div>
      <div className="scr-body">
        <ProfileSwitch allowFamily />

        {preferences && preferences.pantryCarryover.length > 0 ? (
          <div className="pantry">
            PANTRY CARRYOVER: {preferences.pantryCarryover.map((p) => p.name).join(", ")}
          </div>
        ) : null}

        <div className="budget">
          {preferences
            ? `TARGET: ~${preferences.household.budgetTargetDKK} DKK · ceiling ${preferences.household.budgetCeilingDKK} DKK`
            : "Loading…"}
        </div>

        {viewedProfile ? (
          // Planning is family-level; a person's view is read-only.
          <>
            <div className="label">{viewedProfile.name}&rsquo;s meals this week</div>
            {profileMeals.length === 0 ? (
              <div className="box">Nothing planned for {viewedProfile.name} yet.</div>
            ) : (
              profileMeals.map((meal) => (
                <div className="row meal" key={meal.id ?? `${meal.date}-${meal.slot}-${meal.dish}`}>
                  <span>{meal.dish}</span>
                  <span className="small">{meal.slot}</span>
                </div>
              ))
            )}
            <div className="note">Planning happens in Family view. Switch back to edit the week.</div>
          </>
        ) : (
          <>
            <MealPlanPanel meals={week?.meals ?? []} startDate={week?.startDate} onChanged={refresh} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <GenerateButton onGenerated={handleGenerated} />
              <Link href="/grocery" className="btn ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                Go to grocery →
              </Link>
            </div>
          </>
        )}

        {errorMessage ? <div className="error">{errorMessage}</div> : null}
      </div>
    </div>
  );
}
