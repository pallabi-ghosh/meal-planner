"use client";

import { useAppData } from "@/app/components/AppData";
import GroceryPanel from "@/app/components/GroceryPanel";
import GroceryRange from "@/app/components/GroceryRange";
import { addDays, weekDates } from "@/lib/plan";

export default function GroceryPage() {
  const { week, grocery, loaded, refresh } = useAppData();
  if (!loaded) return <div className="card" style={{ padding: 16 }}>Loading…</div>;

  // Default range: the finalised days; with none, the whole week.
  const finalised = [...(week?.finalisedDates ?? [])].sort();
  const dates = week ? weekDates(week.startDate) : [];
  const defaultFrom = finalised[0] ?? dates[0] ?? new Date().toISOString().slice(0, 10);
  const defaultTo = finalised[finalised.length - 1] ?? dates[6] ?? addDays(defaultFrom, 6);

  return (
    <div className="grocery-page">
      <h2 className="g-title">Grocery</h2>
      {/* keyed so the dates reset when the finalised days change */}
      <GroceryRange key={`${defaultFrom}-${defaultTo}`} defaultFrom={defaultFrom} defaultTo={defaultTo} hasFinalised={finalised.length > 0} />

      <details className="card g-extras">
        <summary>Extras you added by hand ({grocery.length})</summary>
        <div className="g-extras-body">
          <GroceryPanel grocery={grocery} onChanged={refresh} />
        </div>
      </details>
    </div>
  );
}
