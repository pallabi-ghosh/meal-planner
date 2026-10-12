"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { GroceryItem, Household, MealLog, ProfileId, SeedData, Week } from "@/types";

// One shared copy of the app's data for all three tabs, so switching tabs doesn't
// refetch and every tab sees the same state after an edit.

export type ProfileView = "family" | ProfileId;

interface AppData {
  week: Week | null;
  grocery: GroceryItem[];
  mealLogs: MealLog[];
  preferences: SeedData | null;
  household: Household | null;
  setupComplete: boolean;
  loaded: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  view: ProfileView;
  setView: (view: ProfileView) => void;
}

const AppDataContext = createContext<AppData | null>(null);
const VIEW_STORAGE_KEY = "mealPlanner.view";

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [week, setWeek] = useState<Week | null>(null);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [preferences, setPreferences] = useState<SeedData | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setViewState] = useState<ProfileView>("family");

  const refresh = useCallback(async () => {
    try {
      const [weekRes, prefRes, houseRes] = await Promise.all([
        fetch("/api/week"),
        fetch("/api/preferences"),
        fetch("/api/household"),
      ]);
      const weekJson = await weekRes.json();
      const houseJson = await houseRes.json();
      setWeek(weekJson.week);
      setGrocery(weekJson.grocery ?? []);
      setMealLogs(weekJson.mealLogs ?? []);
      setPreferences((await prefRes.json()) as SeedData);
      setHousehold(houseJson.household);
      setSetupComplete(Boolean(houseJson.setupComplete));
      setLoadError(null);
    } catch {
      setLoadError("Couldn't reach the planner. Check the Mac is on and try again.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Remember which profile this device was last looking at.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "family" || saved === "her" || saved === "him" || saved === "toddler") {
        setViewState(saved);
      }
    } catch {
      // Storage can be unavailable (private mode); the default view is fine.
    }
  }, []);

  const setView = useCallback((next: ProfileView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Not persisting is acceptable.
    }
  }, []);

  return (
    <AppDataContext.Provider
      value={{ week, grocery, mealLogs, preferences, household, setupComplete, loaded, loadError, refresh, view, setView }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
