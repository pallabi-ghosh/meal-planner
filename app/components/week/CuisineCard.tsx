"use client";

import { useEffect, useState } from "react";
import { KNOWN_CUISINES } from "@/lib/dishes";

// The week's cuisine, an optional different one for the selected day, and the button that
// fills the open dinners.
export default function CuisineCard({
  weekCuisine,
  dayCuisine,
  dayLabel,
  openCount,
  busy,
  suggesting,
  onSave,
  onSuggest,
}: {
  weekCuisine: string;
  dayCuisine: string;
  dayLabel: string;
  openCount: number;
  busy: boolean;
  suggesting: boolean;
  onSave: (week: string, day: string) => void;
  onSuggest: () => void;
}) {
  const [week, setWeek] = useState(weekCuisine);
  const [day, setDay] = useState(dayCuisine);

  // Follow the saved values when another day is selected or the plan reloads.
  useEffect(() => setWeek(weekCuisine), [weekCuisine]);
  useEffect(() => setDay(dayCuisine), [dayCuisine, dayLabel]);

  const commit = () => {
    if (week.trim() !== weekCuisine || day.trim() !== dayCuisine) onSave(week.trim(), day.trim());
  };
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="card cuisine-card">
      <label htmlFor="cuisine-week" style={{ fontWeight: 600 }}>
        Cuisine for the week
      </label>
      <input
        id="cuisine-week"
        className="text-input"
        list="cuisine-options"
        value={week}
        placeholder="e.g. Bengali"
        maxLength={60}
        onChange={(e) => setWeek(e.target.value)}
        onBlur={commit}
        onKeyDown={onEnter}
      />
      <label htmlFor="cuisine-day" className="small">
        Something different on {dayLabel}? (optional)
      </label>
      <input
        id="cuisine-day"
        className="text-input"
        list="cuisine-options"
        value={day}
        placeholder="e.g. Italian"
        maxLength={60}
        onChange={(e) => setDay(e.target.value)}
        onBlur={commit}
        onKeyDown={onEnter}
      />
      <datalist id="cuisine-options">
        {KNOWN_CUISINES.map((cuisine) => (
          <option key={cuisine} value={cuisine} />
        ))}
      </datalist>
      <button className="btn" disabled={busy || suggesting || openCount === 0} onClick={onSuggest}>
        {suggesting ? "Suggesting…" : openCount === 0 ? "All dinners are chosen" : `Suggest the ${openCount} open ${openCount === 1 ? "dinner" : "dinners"}`}
      </button>
    </div>
  );
}
