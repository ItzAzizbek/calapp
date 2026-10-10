import type { Activity, GoalKind, Profile, Sex } from "./types";

export const ACTIVITIES: {
  id: Activity;
  label: string;
  hint: string;
  factor: number;
}[] = [
  {
    id: "sedentary",
    label: "Mostly sitting",
    hint: "Desk job, little exercise",
    factor: 1.2,
  },
  {
    id: "light",
    label: "Lightly active",
    hint: "Walks, exercise 1–3 days a week",
    factor: 1.375,
  },
  {
    id: "moderate",
    label: "Active",
    hint: "Exercise 3–5 days a week",
    factor: 1.55,
  },
  {
    id: "active",
    label: "Very active",
    hint: "Hard training 6–7 days a week",
    factor: 1.725,
  },
  {
    id: "athlete",
    label: "Athlete",
    hint: "Physical job or twice-a-day training",
    factor: 1.9,
  },
];

export const GOALS: {
  id: GoalKind;
  label: string;
  hint: string;
  delta: number;
}[] = [
  {
    id: "lose",
    label: "Lose weight",
    hint: "About 0.5 kg (1 lb) a week",
    delta: -500,
  },
  {
    id: "maintain",
    label: "Maintain",
    hint: "Stay where you are, eat mindfully",
    delta: 0,
  },
  {
    id: "gain",
    label: "Build muscle",
    hint: "A lean surplus to support growth",
    delta: 300,
  },
];

export const MIN_CALORIES = 1200;
export const MAX_CALORIES = 6000;

export type BodyStats = Pick<
  Profile,
  "sex" | "age" | "heightCm" | "weightKg" | "activity" | "goal"
>;

/** Resting energy via Mifflin–St Jeor. */
export function bmr({ sex, age, heightCm, weightKg }: BodyStats): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === "male" ? 5 : -161);
}

export function maintenance(stats: BodyStats): number {
  const factor = ACTIVITIES.find((a) => a.id === stats.activity)?.factor ?? 1.2;
  return bmr(stats) * factor;
}

export function calorieTarget(stats: BodyStats): number {
  const delta = GOALS.find((g) => g.id === stats.goal)?.delta ?? 0;
  const raw = maintenance(stats) + delta;
  return clampCalories(Math.round(raw / 10) * 10);
}

export function clampCalories(kcal: number): number {
  return Math.min(MAX_CALORIES, Math.max(MIN_CALORIES, kcal));
}

export const DEFAULT_STATS: Omit<BodyStats, "goal" | "activity"> & {
  sex: Sex;
} = { sex: "female", age: 30, heightCm: 168, weightKg: 68 };

/* ---------- Units ---------- */

export const cmToFtIn = (cm: number) => {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
};
export const ftInToCm = (ft: number, inches: number) =>
  Math.round((ft * 12 + inches) * 2.54);
export const kgToLb = (kg: number) => Math.round(kg * 2.20462);
export const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;
