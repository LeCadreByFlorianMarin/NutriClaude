// Hand-rolled types — replace later with `supabase gen types typescript`.
// Keep aligned with /supabase/migrations/*.

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type Timestamp = string;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type GroceryStatus = "pending" | "bought";

export interface Household {
  id: UUID;
  name: string;
  created_at: Timestamp;
}

export interface Profile {
  id: UUID;
  household_id: UUID;
  display_name: string;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  daily_fiber_g: number | null;
  restrictions: string[];
  preferences: Record<string, unknown>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Aisle {
  id: UUID;
  household_id: UUID;
  name: string;
  sort_order: number;
  icon: string | null;
  created_at: Timestamp;
}

export interface ProductAisleMap {
  id: UUID;
  household_id: UUID;
  product_id: UUID | null;
  keyword: string | null;
  aisle_id: UUID;
  created_at: Timestamp;
}

export interface Recipe {
  id: UUID;
  household_id: UUID;
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  tags: string[];
  total_kcal: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  source: string;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RecipeIngredient {
  id: UUID;
  recipe_id: UUID;
  product_id: UUID | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle_keyword: string | null;
  optional: boolean;
  sort_order: number;
  created_at: Timestamp;
}

export interface MealPlanEntry {
  id: UUID;
  household_id: UUID;
  recipe_id: UUID;
  meal_date: ISODate;
  meal_type: MealType;
  servings: number;
  notes: string | null;
  created_by: UUID | null;
  created_at: Timestamp;
}

export interface GroceryListItem {
  id: UUID;
  household_id: UUID;
  name: string;
  quantity: number | null;
  unit: string | null;
  product_id: UUID | null;
  aisle_id: UUID | null;
  recipe_id: UUID | null;
  added_by: UUID | null;
  status: GroceryStatus;
  created_at: Timestamp;
}

export interface GroceryListByAisleRow extends GroceryListItem {
  aisle_name: string | null;
  aisle_icon: string | null;
  aisle_sort: number | null;
}
