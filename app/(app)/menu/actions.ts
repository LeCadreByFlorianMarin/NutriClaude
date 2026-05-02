"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type { MealType } from "@/lib/supabase/types";

export async function assignRecipe(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();

  const recipe_id = String(formData.get("recipe_id"));
  const meal_date = String(formData.get("meal_date"));
  const meal_type = String(formData.get("meal_type")) as MealType;
  const servings = Number(formData.get("servings") || 2);

  const { error } = await supabase.from("meal_plan_entries").insert({
    household_id: profile.household_id,
    recipe_id,
    meal_date,
    meal_type,
    servings,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/menu");
  return { ok: true };
}

export async function unassignRecipe(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/menu");
  return { ok: true };
}
