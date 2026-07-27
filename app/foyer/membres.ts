import { createClient } from "@/lib/supabase/server";

export type Membre = {
  id: string;
  prenom: string;
};

/**
 * Les membres du foyer courant, dans l'ordre où ils sont arrivés.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge, et l'ajouter à la
 * main laisserait croire que c'est lui qui protège.
 *
 * La requête ramène aussi l'appelant — la politique est
 * `household_id = current_household_id() or id = auth.uid()`. C'est voulu :
 * afficher les deux membres et marquer le sien se lit mieux qu'une liste
 * « des autres » vide quand on est seul chez soi.
 */
export async function membresDuFoyer(): Promise<Membre[]> {
  const supabase = await createClient();

  // `created_at` plutôt que le prénom : un ordre stable, qui ne danse pas
  // quand quelqu'un se renomme.
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("created_at");

  return (data ?? []).map((p) => ({ id: p.id, prenom: p.display_name }));
}
