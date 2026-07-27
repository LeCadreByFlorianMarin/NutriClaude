import { createClient } from "@/lib/supabase/server";

export type InvitationEnCours = {
  code: string;
  joursRestants: number;
  usagesRestants: number;
};

/**
 * L'invitation « en cours » du foyer : la plus récente encore valable.
 *
 * Rien en base ne fait ce tri — plusieurs codes peuvent coexister, chacun avec
 * sa propre échéance et son propre compteur, puisque générer n'invalide pas
 * les précédents.
 *
 * Vit hors du composant, et non dans son corps : lire l'horloge est une
 * opération impure, interdite pendant le rendu.
 */
export async function invitationEnCours(): Promise<InvitationEnCours | null> {
  const supabase = await createClient();
  const maintenant = new Date();

  /*
   * Pas de filtre sur `household_id` : la RLS s'en charge, et l'ajouter à la
   * main laisserait croire que c'est lui qui protège.
   */
  const { data } = await supabase
    .from("household_invites")
    .select("code, expires_at, uses_remaining")
    .gt("expires_at", maintenant.toISOString())
    .gt("uses_remaining", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const restant = new Date(data.expires_at).getTime() - maintenant.getTime();

  return {
    code: data.code,
    joursRestants: Math.max(0, Math.ceil(restant / 86_400_000)),
    usagesRestants: data.uses_remaining,
  };
}
