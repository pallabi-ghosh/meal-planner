"use client";

import { useState } from "react";

// A number input that keeps what the person typed ("62." while they type "62.5")
// and only reports a number once the text is a valid one.
export default function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  required,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit ? ` (${unit})` : ""}
        {required ? "" : " — optional"}
      </label>
      <input
        id={id}
        className="text-input"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const parsed = Number(next.replace(",", "."));
          if (next.trim() === "") onChange(undefined);
          else if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}
