"use client";

import type { Meal } from "@/types";
import { dayOfMonth, sharedMeal, weekdayName } from "@/lib/plan";

// The week's calendar: a card on wide screens, a strip of days on a phone.
export default function DayList({
  label,
  dates,
  meals,
  finalised,
  selected,
  today,
  onSelect,
}: {
  label: string;
  dates: string[];
  meals: Meal[];
  finalised: string[];
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
          return (
            <button
              key={date}
              type="button"
              className={`day-item${isSelected ? " selected" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${weekdayName(date, "long")} ${dayOfMonth(date)}${dinner ? `, dinner ${dinner.dish}` : ", dinner not chosen"}${isFinalised ? ", finalised" : ""}`}
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
                {isFinalised ? <span className="day-sub">Finalised</span> : null}
              </span>
              <span className={`day-dot${dinner ? " on" : ""}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
