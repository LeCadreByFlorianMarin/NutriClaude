import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

/**
 * Le nom du foyer courant.
 *
 * La requête était écrite deux fois à l'identique, dans `app/page.tsx` et
 * `app/foyer/page.tsx` — les deux seules lectures que ces pages faisaient à la
 * main, alors qu'elles déléguaient tout le reste à des fonctions nommées.
 *
 * Lève si la lecture échoue. `null` est réservé au cas où la ligne n'existe pas,
 * ce qui ne devrait pas arriver : `household_id` est `not null` et
 * `households_select` rend la ligne visible à tout membre. Les rendre tous deux
 * comme « pas de nom » faisait afficher « Chez toi » à la place de « Chez les
 * Marin » — donnant à croire que le foyer avait été renommé.
 */
export async function nomDuFoyer(
  supabase: SupabaseClient<Database>,
  householdId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lecture du foyer impossible : ${error.message}`);
  }

  return data?.name ?? null;
}
