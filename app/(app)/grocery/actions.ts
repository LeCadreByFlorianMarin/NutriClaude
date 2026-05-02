"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";

export async function generateFromMenu(formData: FormData) {
  await requireProfile();
  const supabase = createClient();

  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date"));

  const { data, error } = await supabase.rpc("generate_grocery_list_from_menu", {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true, count: data as number };
}

export async function toggleItemStatus(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const next = String(formData.get("status"));
  const { error } = await supabase
    .from("grocery_list_items")
    .update({ status: next })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true };
}

export async function deleteItem(formData: FormData) {
  await requireProfile();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("grocery_list_items")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true };
}

export async function addAdHocItem(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Nom requis" };
  const aisle_id = String(formData.get("aisle_id") || "") || null;
  const quantity = formData.get("quantity");
  const unit = String(formData.get("unit") || "") || null;

  const { error } = await supabase.from("grocery_list_items").insert({
    household_id: profile.household_id,
    name,
    quantity: quantity ? Number(quantity) : null,
    unit,
    aisle_id,
    added_by: profile.id,
    status: "pending",
  });
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true };
}

export async function clearBought() {
  await requireProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("grocery_list_items")
    .delete()
    .eq("status", "bought");
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true };
}

export async function clearAll() {
  await requireProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("grocery_list_items")
    .delete()
    .not("id", "is", null);
  if (error) return { error: error.message };
  revalidatePath("/grocery");
  return { ok: true };
}
