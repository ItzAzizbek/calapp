import type { Entry, FoodItem, Goals, Macros, MealType } from "./types";

export function uid(): string {
  // crypto.randomUUID is unavailable on insecure origins (e.g. a phone hitting
  // the dev server over LAN), so fall back to getRandomValues.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Dates ---------- */

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

/** Monday-start week containing `key`. */
export function weekOf(key: string): string[] {
  const date = parseDayKey(key);
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayTitle(key: string, today = dayKey()): string {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: "long" });
}

export function daySubtitle(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year:
      parseDayKey(key).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A timestamp on `day` at the current wall-clock time. */
export function timestampOn(day: string): number {
  const now = new Date();
  const date = parseDayKey(day);
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return date.getTime();
}

export function mealTypeForTime(date: Date = new Date()): MealType {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

/* ---------- Nutrition ---------- */

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumItems(items: FoodItem[], servings = 1): Macros {
  const total = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { ...ZERO },
  );
  return {
    calories: Math.round(total.calories * servings),
    protein: Math.round(total.protein * servings),
    carbs: Math.round(total.carbs * servings),
    fat: Math.round(total.fat * servings),
  };
}

export function entryTotals(entry: Entry): Macros {
  return sumItems(entry.items, entry.servings);
}

export function sumEntries(entries: Entry[]): Macros {
  return entries.reduce(
    (acc, entry) => {
      const t = entryTotals(entry);
      return {
        calories: acc.calories + t.calories,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
      };
    },
    { ...ZERO },
  );
}

/** Balanced split: 30% protein, 40% carbs, 30% fat. */
export function autoMacros(calories: number): Omit<Macros, "calories"> {
  return {
    protein: Math.round((calories * 0.3) / 4),
    carbs: Math.round((calories * 0.4) / 4),
    fat: Math.round((calories * 0.3) / 9),
  };
}

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  ...autoMacros(2000),
  autoMacros: true,
};

const numberFormat = new Intl.NumberFormat();
export function fmt(n: number): string {
  return numberFormat.format(Math.round(n));
}
