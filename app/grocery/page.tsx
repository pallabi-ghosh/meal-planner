"use client";

import { useAppData } from "@/app/components/AppData";
import GroceryPanel from "@/app/components/GroceryPanel";

export default function GroceryPage() {
  const { grocery, refresh } = useAppData();

  return (
    <div className="screen">
      <div className="scr-head">
        <span>GROCERY</span>
        <span className="scr-tag">family list</span>
      </div>
      <div className="scr-body">
        <GroceryPanel grocery={grocery} onChanged={refresh} />
      </div>
    </div>
  );
}
