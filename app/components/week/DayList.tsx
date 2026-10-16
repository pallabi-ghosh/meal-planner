"use client";

import type { Meal } from "@/types";
import { dayOfMonth, sharedMeal, weekdayName } from "@/lib/plan";

// The week's calendar: a card on wide screens, a strip of days on a phone.
export default function DayList({
  label,
  dates,
  meals,
  finalised,
  cheatDay,
  cuisines,
  flags,
  selected,
  today,
  onSelect,
}: {
  label: string;
  dates: string[];
  meals: Meal[];
  finalised: string[];
  cheatDay?: string;
  cuisines?: Record<string, string>;
  flags?: Record<string, { pct: number; level: "amber" | "red" }>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="cal">
      <div className="cal-head">{label}</div>
      <div className="daylist">
        {dates.map((date) => {
          const dinner = sharedMeal(meals, date, "dinner");
          const isSelected = date === selected;
          const isFinalised = Boolean(dinner) && finalised.includes(date);
          const isCheat = date === cheatDay;
          const sub = [cuisines?.[date] ?? null, isCheat ? "Cheat day" : null, isFinalised ? "Finalised" : null].filter(Boolean).join(" · ");
          return (
            <button
              key={date}
              type="button"
              className={`day-item${isSelected ? " selected" : ""}${isCheat ? " cheat" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${weekdayName(date, "long")} ${dayOfMonth(date)}${dinner ? `, dinner ${dinner.dish}` : ", dinner not chosen"}${isCheat ? ", cheat day" : ""}${isFinalised ? ", finalised" : ""}`}
              onClick={() => onSelect(date)}
            >
              <span className="day-when">
                <span className="day-name">{date === today ? "Today" : weekdayName(date)}</span>
                <span className="day-num">{dayOfMonth(date)}</span>
              </span>
              <span className="day-text">
                <span className="day-dish" style={dinner ? undefined : { color: "var(--muted)" }}>
                  {dinner ? dinner.dish : "Dinner not chosen"}
                </span>
                {sub ? <span className="day-sub">{sub}</span> : null}
              </span>
              {flags?.[date] ? (
                <span className={`day-pill ${flags[date].level}`}>+{flags[date].pct}%</span>
              ) : (
                <span className={`day-dot${dinner ? " on" : ""}`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
