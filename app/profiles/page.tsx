"use client";

import Link from "next/link";
import { useAppData } from "@/app/components/AppData";
import { isProfileComplete } from "@/lib/household";
import type { Profile } from "@/types";

function summary(profile: Profile): string {
  if (profile.kind === "child") {
    const age = profile.ageMonths !== undefined ? `${profile.ageMonths} months` : "age not set";
    const rules = [
      profile.childRules?.noAddedSugar ? "no added sugar" : null,
      profile.childRules?.noAddedSalt ? "no added salt" : null,
    ].filter(Boolean);
    return ["Child", age, ...rules].join(" · ");
  }
  const parts = ["Adult"];
  if (profile.ageYears) parts.push(`${profile.ageYears} years`);
  if (profile.heightCm) parts.push(`${profile.heightCm} cm`);
  return parts.join(" · ");
}

export default function ProfilesPage() {
  const { household, setupComplete, loaded } = useAppData();
  const profiles = household?.profiles ?? [];

  return (
    <div className="screen">
      <div className="scr-head">
        <span>Profiles and food rules</span>
        <Link href="/week" className="scr-tag">
          Back to week
        </Link>
      </div>
      <div className="scr-body">
        {loaded && !setupComplete ? (
          <div className="budget">
            Fill in each profile once. Calorie targets and the week plan use these details.
          </div>
        ) : null}

        {profiles.map((profile) => {
          const complete = isProfileComplete(profile);
          return (
            <Link key={profile.id} href={`/profiles/${profile.id}`} className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <span>
                <strong>{profile.name}</strong>
                <span className="kid" style={{ color: "var(--muted)" }}>
                  {summary(profile)}
                </span>
              </span>
              <span className={`chip${complete ? " on" : ""}`} style={{ margin: 0 }}>
                {complete ? "Done" : "Needs details"}
              </span>
            </Link>
          );
        })}

        <div className="note">
          Planning and groceries are for the whole family. Logging and calories are per person.
        </div>
      </div>
    </div>
  );
}
