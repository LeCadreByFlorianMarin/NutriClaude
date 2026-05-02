"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";

export async function createAisle(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();

  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const sort_order = Number(formData.get("sort_order") || 100);

  if (!name) return { error: "Nom requis" };

  const { error } = await supabase
    .from("aisles")
    .insert({ household_id: profile.household_id, name, icon, sort_order });

  if (error) return { error: error.message };
  revalidatePath("/aisles");
  return { ok: true };
}

export async function updateAisle(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const sort_order = Number(formData.get("sort_order") || 100);

  const { error } = await supabase
    .from("aisles")
    .update({ name, icon, sort_order })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/aisles");
  return { ok: true };
}

export async function deleteAisle(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("aisles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/aisles");
  return { ok: true };
}

export async function createMapping(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();

  const keyword = String(formData.get("keyword") || "").trim().toLowerCase();
  const aisle_id = String(formData.get("aisle_id"));
  if (!keyword || !aisle_id) return { error: "Mot-clé et rayon requis" };

  const { error } = await supabase.from("product_aisle_map").insert({
    household_id: profile.household_id,
    keyword,
    aisle_id,
  });
  if (error) return { error: error.message };
  revalidatePath("/aisles");
  return { ok: true };
}

export async function deleteMapping(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("product_aisle_map")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/aisles");
  return { ok: true };
}
