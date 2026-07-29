import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

export type Membre = {
  id: string;
  prenom: string;
};

/**
 * Les membres du foyer courant, dans l'ordre où ils sont arrivés.
 *
 * Le client est **passé en paramètre**, jamais construit ici : cette fonction
 * n'a rien de spécifique à une route web, et l'y attacher la rendait
 * inutilisable hors d'un rendu Next — donc inutilisable par le dashboard de
 * l'Epic 5 et le serveur MCP de l'Epic 7. Même raison pour son emplacement dans
 * `lib/` : le glob du lanceur de tests s'arrête à `lib/`, si bien que la laisser
 * sous `app/` l'excluait du harnais sans que personne ne l'ait décidé.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge, et l'ajouter à la
 * main laisserait croire que c'est lui qui protège.
 *
 * La requête ramène aussi l'appelant — la politique est
 * `household_id = current_household_id() or id = auth.uid()`. C'est voulu :
 * afficher les deux membres et marquer le sien se lit mieux qu'une liste
 * « des autres » vide quand on est seul chez soi.
 */
export async function membresDuFoyer(
  supabase: SupabaseClient<Database>
): Promise<Membre[]> {
  // `created_at` plutôt que le prénom : un ordre stable, qui ne danse pas
  // quand quelqu'un se renomme.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("created_at");

  /*
   * Lever plutôt que rendre `[]`. Une liste vide n'est **jamais** un résultat
   * légitime ici : la politique porte `or id = auth.uid()`, et l'appelant vient
   * de prouver qu'il a un profil. Zéro ligne est donc un pur signal d'échec —
   * et l'écran l'affichait comme une affirmation de fait, « Tu es seul ici pour
   * l'instant », à un membre d'un foyer qui n'a rien perdu.
   */
  if (error) {
    throw new Error(`Lecture des membres impossible : ${error.message}`);
  }

  return (data ?? []).map((p) => ({ id: p.id, prenom: p.display_name }));
}
