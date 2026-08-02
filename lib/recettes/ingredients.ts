import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { estUuid } from "./saisie.ts";

export type Ingredient = {
  id: string;
  nom: string;
  quantite: number | null;
  unite: string | null;
  motCleRayon: string | null;
  optionnel: boolean;
  ordre: number;
};

/** Les colonnes lues, en un seul endroit. */
const COLONNES = "id, name, quantity, unit, aisle_keyword, optional, sort_order";

type LigneIngredient = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle_keyword: string | null;
  optional: boolean;
  sort_order: number;
};

function versIngredient(ligne: LigneIngredient): Ingredient {
  return {
    id: ligne.id,
    nom: ligne.name,
    quantite: ligne.quantity,
    unite: ligne.unit,
    motCleRayon: ligne.aisle_keyword,
    optionnel: ligne.optional,
    ordre: ligne.sort_order,
  };
}

/**
 * Les ingrédients d'une recette, dans l'ordre voulu par le foyer.
 *
 * Le client est **passé en paramètre**, jamais construit ici : motif de
 * `rayonsDuFoyer` et de `recettesDuFoyer`, et pour la même raison — le dashboard
 * de l'Epic 5 et le serveur MCP de l'Epic 7 n'ont pas de rendu Next.
 *
 * ⚠️ **Aucun filtre `household_id`, et c'est délibéré même si le nom de la table
 * n'en porte pas.** `recipe_ingredients_all` ancre l'isolation par un `exists`
 * sur `recipes` (`initial_schema.sql:299-313`), donc la RLS filtre déjà. Ajouter
 * un filtre à la main laisserait croire que c'est lui qui protège.
 *
 * Le filtre `recipe_id`, lui, n'est **pas** une garde de sécurité : deux recettes
 * du même foyer sont mutuellement visibles sous RLS. C'est un filtre métier, et
 * c'est exactement pour ça que `reorder_recipe_ingredients` doit le refaire
 * elle-même dans son `update` — voir l'en-tête de sa migration.
 *
 * ⚠️ **Le tri secondaire par `created_at` n'est pas décoratif, et il l'est encore
 * moins ici que sur les rayons.** `recipe_ingredients.sort_order` vaut **0 par
 * défaut pour tous** : une recette dont les ingrédients n'ont jamais été
 * réordonnés a dix lignes à la position 0, et leur ordre d'affichage serait celui
 * que Postgres choisit ce jour-là. `created_at` plutôt que `name` : l'ordre
 * d'ajout est ce qu'un cuisinier attend d'une liste qu'il n'a pas encore rangée,
 * là où l'alphabet n'aurait aucun sens.
 */
export async function ingredientsDeRecette(
  supabase: SupabaseClient<Database>,
  recetteId: string
): Promise<Ingredient[]> {
  if (!estUuid(recetteId)) return [];

  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select(COLONNES)
    .eq("recipe_id", recetteId)
    .order("sort_order")
    .order("created_at");

  /*
   * Lève si la lecture échoue, rend `[]` sans lever sur zéro ligne : une recette
   * sans ingrédient est l'état **nominal** au sortir de la story 3.1, qui crée
   * les recettes sans en poser aucun.
   */
  if (error) {
    throw new Error(`Lecture des ingrédients impossible : ${error.message}`);
  }

  return (data ?? []).map(versIngredient);
}

/**
 * La position d'un ingrédient nouvellement ajouté : après tous les autres.
 *
 * ⚠️ **Ne laisse jamais le défaut de la colonne faire ce travail.**
 * `sort_order` vaut `0`, donc tout ingrédient ajouté sans calcul rejoindrait le
 * peloton des ex æquo — et sur cette table, contrairement aux rayons, ce peloton
 * est l'état de départ de toute recette.
 *
 * Le pas de 10 est celui qu'emploie `reorder_recipe_ingredients` au
 * renumérotage ; il laisse de la place pour insérer entre deux.
 */
export function prochainOrdreIngredient(
  ingredients: ReadonlyArray<{ ordre: number }>
): number {
  // `Math.max()` sur une liste vide rend -Infinity, pas 0.
  if (ingredients.length === 0) return 10;
  return Math.max(...ingredients.map((i) => i.ordre)) + 10;
}
