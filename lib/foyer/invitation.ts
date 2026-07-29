import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

export type InvitationEnCours = {
  code: string;
  /** Instant brut. Le libellé est une décision de vue — voir `libelles-invitation.ts`. */
  expiresAt: string;
  usagesRestants: number;
};

/**
 * L'invitation « en cours » du foyer : la plus récente encore valable.
 *
 * La **validité** est définie une seule fois, par la vue — donc avec l'horloge
 * Postgres, la même que `redeem_household_invite`. Ce module ne réimplémente
 * plus le prédicat : il ne garde que « laquelle montrer ? », qui est une règle
 * de présentation et lui appartient réellement. Plusieurs codes peuvent
 * coexister, chacun avec son échéance et son compteur, puisque générer
 * n'invalide pas les précédents — c'est une décision produit assumée.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge (la vue est en
 * `security_invoker`, elle n'ouvre donc aucune brèche), et l'ajouter à la main
 * laisserait croire que c'est lui qui protège.
 */
export async function invitationEnCours(
  supabase: SupabaseClient<Database>
): Promise<InvitationEnCours | null> {
  const { data, error } = await supabase
    .from("household_invites_valides")
    .select("code, expires_at, uses_remaining")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Zéro ligne est nominal — personne n'est invité. Un échec de lecture ne
  // l'est pas : le rendre comme « aucune invitation » invitait le membre à en
  // créer une de plus, alors qu'une vivait déjà.
  if (error) {
    throw new Error(`Lecture de l'invitation impossible : ${error.message}`);
  }

  if (!data) return null;

  /*
   * Les trois colonnes sont `not null` dans `household_invites`, mais Postgres
   * **perd cette information à travers une vue** : les types générés les
   * déclarent donc nullables, et ce n'est pas une erreur de génération.
   *
   * On teste plutôt que d'affirmer. Une ligne incomplète ne devrait pas exister ;
   * si elle existe, la traiter comme « pas d'invitation » vaut mieux que de
   * rendre `null` au milieu d'un code affiché à l'écran ou lu au téléphone.
   */
  if (
    data.code === null ||
    data.expires_at === null ||
    data.uses_remaining === null
  ) {
    return null;
  }

  return {
    code: data.code,
    expiresAt: data.expires_at,
    usagesRestants: data.uses_remaining,
  };
}

/**
 * Révoque un code d'invitation.
 *
 * La politique `invites_delete_own` existe dans le schéma initial mais n'était
 * exposée nulle part : une fois un code partagé, rien ne permettait de revenir
 * dessus.
 */
export async function revoquerInvitation(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<void> {
  const { error } = await supabase
    .from("household_invites")
    .delete()
    .eq("code", code);

  if (error) {
    throw new Error(`Révocation impossible : ${error.message}`);
  }
}

/**
 * Révoque **tous** les codes encore valables du foyer.
 *
 * Appelé avant d'en émettre un nouveau, pour que « Créer un autre code » veuille
 * dire ce que le mot « autre » laisse attendre.
 *
 * Avant cela, créer laissait le précédent vivant sept jours **et invisible** —
 * seul le plus récent étant affiché — si bien que le seul code qu'on pouvait
 * vouloir révoquer, celui qu'on venait de partager puis de regretter, était
 * précisément celui qu'aucun bouton n'atteignait.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge, et `invites_delete_own`
 * est ancrée sur `current_household_id()`.
 */
export async function revoquerToutesLesInvitations(
  supabase: SupabaseClient<Database>
): Promise<void> {
  const { data, error: erreurLecture } = await supabase
    .from("household_invites_valides")
    .select("code");

  if (erreurLecture) {
    throw new Error(`Lecture des invitations impossible : ${erreurLecture.message}`);
  }

  const codes = (data ?? [])
    .map((l) => l.code)
    .filter((c): c is string => c !== null);
  if (codes.length === 0) return;

  const { error } = await supabase
    .from("household_invites")
    .delete()
    .in("code", codes);

  if (error) {
    throw new Error(`Révocation impossible : ${error.message}`);
  }
}
