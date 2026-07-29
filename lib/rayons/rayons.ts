import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

export type Rayon = {
  id: string;
  nom: string;
  icone: string | null;
  ordre: number;
};

/**
 * Les rayons du foyer courant, dans l'ordre du parcours magasin.
 *
 * Le client est **passé en paramètre**, jamais construit ici : cette fonction
 * n'a rien de spécifique à une route web, et l'y attacher la rendrait
 * inutilisable hors d'un rendu Next — donc inutilisable par le dashboard de
 * l'Epic 5 et le serveur MCP de l'Epic 7. Même raison pour son emplacement dans
 * `lib/` : le glob du lanceur de tests s'arrête à `lib/`.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge (`aisles_all`, `using`
 * **et** `with check`), et l'ajouter à la main laisserait croire que c'est lui
 * qui protège.
 *
 * ⚠️ **Le tri secondaire par nom n'est pas décoratif.** `sort_order` n'est pas
 * unique en base et vaut `100` par défaut — deux rayons peuvent légalement
 * partager une position. Sans second critère, l'ordre d'affichage de deux ex
 * æquo est celui que Postgres choisit ce jour-là, et l'écran « bouge tout seul »
 * d'un rechargement à l'autre.
 */
export async function rayonsDuFoyer(
  supabase: SupabaseClient<Database>
): Promise<Rayon[]> {
  const { data, error } = await supabase
    .from("aisles")
    .select("id, name, icon, sort_order")
    .order("sort_order")
    .order("name");

  /*
   * Lève si la lecture échoue — mais rend `[]` sans lever quand il n'y a
   * simplement aucune ligne.
   *
   * C'est la différence avec `membresDuFoyer`, et elle est délibérée : là-bas,
   * zéro ligne est un pur signal d'échec (l'appelant vient de prouver qu'il a un
   * profil, et la politique porte `or id = auth.uid()`). Ici, un foyer sans
   * rayon est l'**état nominal de l'AC4** — celui qu'on atteint en les
   * supprimant tous, et que l'écran doit savoir montrer.
   */
  if (error) {
    throw new Error(`Lecture des rayons impossible : ${error.message}`);
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    nom: a.name,
    icone: a.icon,
    ordre: a.sort_order,
  }));
}
