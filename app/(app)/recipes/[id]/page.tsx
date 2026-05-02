import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type { Recipe, RecipeIngredient } from "@/lib/supabase/types";
import EditRecipeForm from "./EditRecipeForm";
import IngredientsList from "./IngredientsList";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireProfile();
  const supabase = createClient();

  const [{ data: recipe }, { data: ingredients }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", params.id)
      .order("sort_order"),
  ]);

  if (!recipe) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/recipes"
        className="text-sm text-muted hover:text-text inline-flex items-center gap-1"
      >
        ← Recettes
      </Link>

      <section className="card">
        <h2 className="font-semibold mb-4">Détails</h2>
        <EditRecipeForm recipe={recipe as Recipe} />
      </section>

      <section className="card">
        <h2 className="font-semibold mb-1">Ingrédients</h2>
        <p className="text-sm text-muted mb-4">
          Le <em>mot-clé rayon</em> permet de classer l'ingrédient même si tu
          n'as pas encore créé l'association sur la page Rayons.
        </p>
        <IngredientsList
          recipeId={recipe.id}
          ingredients={(ingredients ?? []) as RecipeIngredient[]}
        />
      </section>
    </div>
  );
}
