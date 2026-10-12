"use client";

import { useAppData } from "./AppData";

// Family view vs. one person's view. The Log tab always needs a person (logs are
// per profile), so it hides the Family option.
export default function ProfileSwitch({ allowFamily }: { allowFamily: boolean }) {
  const { household, view, setView } = useAppData();
  const profiles = household?.profiles ?? [];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {allowFamily ? (
        <button className={`chip${view === "family" ? " on" : ""}`} onClick={() => setView("family")}>
          Family
        </button>
      ) : null}
      {profiles.map((profile) => (
        <button
          key={profile.id}
          className={`chip${view === profile.id ? " on" : ""}`}
          onClick={() => setView(profile.id)}
        >
          {profile.name}
        </button>
      ))}
    </div>
  );
}
