export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

export type Confidence = "low" | "medium" | "high";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  id: string;
  name: string;
  portion: string;
}

export interface Entry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  /** Epoch ms of when the meal was eaten. */
  eatenAt: number;
  mealType: MealType;
  name: string;
  items: FoodItem[];
  /** Multiplier applied to every item (e.g. 0.5 for half the plate). */
  servings: number;
  /** Small JPEG data URL of the photo, if logged from an image. */
  image?: string;
  /** What the user typed, if logged from a description. */
  description?: string;
  confidence?: Confidence;
  notes?: string;
}

export interface Goals extends Macros {
  /** When true, macro goals are derived from the calorie goal. */
  autoMacros: boolean;
}

/** Shape returned by POST /api/analyze. */
export interface Analysis {
  name: string;
  items: Omit<FoodItem, "id">[];
  confidence: Confidence;
  notes: string;
}

export interface AnalyzeRequest {
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
  };
  description?: string;
  correction?: string;
  previous?: Analysis;
}

export type AnalyzeErrorCode =
  | "not_food"
  | "bad_request"
  | "not_configured"
  | "rate_limited"
  | "refused"
  | "upstream";

export interface AnalyzeError {
  error: { code: AnalyzeErrorCode; message: string };
}

export type Sex = "female" | "male";
export type GoalKind = "lose" | "maintain" | "gain";
export type Activity =
  "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Units = "metric" | "imperial";

export interface Profile {
  name: string;
  goal: GoalKind;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  units: Units;
  /** Epoch ms when onboarding was completed. */
  onboardedAt: number;
}
