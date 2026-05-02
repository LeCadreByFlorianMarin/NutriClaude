"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";

export async function createRecipe(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();

  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Titre requis" };

  const servings = Number(formData.get("servings") || 2);
  const prep = formData.get("prep_time_min");
  const cook = formData.get("cook_time_min");

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      household_id: profile.household_id,
      title,
      description: String(formData.get("description") || "") || null,
      instructions: String(formData.get("instructions") || "") || null,
      servings,
      prep_time_min: prep ? Number(prep) : null,
      cook_time_min: cook ? Number(cook) : null,
      created_by: profile.id,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/recipes");
  redirect(`/recipes/${data.id}`);
}

export async function updateRecipe(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const prep = formData.get("prep_time_min");
  const cook = formData.get("cook_time_min");

  const { error } = await supabase
    .from("recipes")
    .update({
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "") || null,
      instructions: String(formData.get("instructions") || "") || null,
      servings: Number(formData.get("servings") || 2),
      prep_time_min: prep ? Number(prep) : null,
      cook_time_min: cook ? Number(cook) : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
  return { ok: true };
}

export async function deleteRecipe(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function addIngredient(formData: FormData) {
  await requireProfile();
  const supabase = createClient();

  const recipe_id = String(formData.get("recipe_id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Nom requis" };

  const qty = formData.get("quantity");
  const sort = formData.get("sort_order");

  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id,
    name,
    quantity: qty ? Number(qty) : null,
    unit: String(formData.get("unit") || "") || null,
    aisle_keyword:
      String(formData.get("aisle_keyword") || "").trim().toLowerCase() || null,
    optional: formData.get("optional") === "on",
    sort_order: sort ? Number(sort) : 0,
  });
  if (error) return { error: error.message };
  revalidatePath(`/recipes/${recipe_id}`);
  return { ok: true };
}

export async function deleteIngredient(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const recipe_id = String(formData.get("recipe_id"));
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/recipes/${recipe_id}`);
  return { ok: true };
}
