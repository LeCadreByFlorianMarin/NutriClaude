import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

/** Ce que le foyer porte et que les écrans lisent. */
export type Foyer = {
  nom: string;
  /**
   * Le nombre de personnes proposé quand on met une recette au menu.
   *
   * ⚠️ **Une valeur PROPOSÉE, jamais une valeur qui décide.** Elle est lue à
   * l'ouverture d'un formulaire d'assignation et nulle part ailleurs : une case
   * déjà posée garde son propre nombre (`meal_plan_entries.servings`), et changer
   * ce réglage ne réécrit rien rétroactivement. Décision de Florian du
   * 2026-08-04.
   *
   * ⚠️ **C'est un réglage de FOYER, pas de membre** — AD-16, le foyer est
   * symétrique et `profiles` n'a aucune colonne de rôle. Le changer change ce que
   * voit l'autre membre.
   */
  personnesParDefaut: number;
};

/**
 * Le foyer courant : son nom, et ce qu'il règle.
 *
 * La requête était écrite deux fois à l'identique, dans `app/page.tsx` et
 * `app/foyer/page.tsx` — les deux seules lectures que ces pages faisaient à la
 * main, alors qu'elles déléguaient tout le reste à des fonctions nommées.
 *
 * ⚠️ **Une seule lecture pour les deux champs, et c'est le point.** Ils vivent sur
 * la même ligne : en faire deux fonctions ferait deux allers-retours pour la même
 * ligne sur `/foyer`, qui a besoin des deux.
 *
 * Lève si la lecture échoue. `null` est réservé au cas où la ligne n'existe pas,
 * ce qui ne devrait pas arriver : `household_id` est `not null` et
 * `households_select` rend la ligne visible à tout membre. Les rendre tous deux
 * comme « pas de nom » faisait afficher « Chez toi » à la place de « Chez les
 * Marin » — donnant à croire que le foyer avait été renommé.
 */
export async function foyerCourant(
  supabase: SupabaseClient<Database>,
  householdId: string
): Promise<Foyer | null> {
  const { data, error } = await supabase
    .from("households")
    .select("name, default_servings")
    .eq("id", householdId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lecture du foyer impossible : ${error.message}`);
  }

  return data
    ? { nom: data.name, personnesParDefaut: data.default_servings }
    : null;
}
