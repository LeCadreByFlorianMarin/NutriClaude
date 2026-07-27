"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export type ResultatInvitation = { ok: true } | { ok: false; erreur: string };

/**
 * Émet un code d'invitation pour le foyer courant.
 *
 * ⚠️ **Server Action, et pas un appel depuis le navigateur.** L'émission d'une
 * invitation fait partie de l'irréductible serveur nommé par AD-13, au même
 * titre que le retour de connexion — contrairement à la création de foyer
 * (Story 1.3) qui, elle, part bien du client. Ne pas uniformiser les deux.
 *
 * `requireProfile()` d'abord : sans profil, il n'y a pas de foyer, et c'est ce
 * qui matérialise côté application le refus attendu d'un appelant non-membre.
 * La garde réelle reste en base — `generate_household_invite` lève si
 * `current_household_id()` est nul.
 */
export async function genererInvitation(): Promise<ResultatInvitation> {
  await requireProfile();

  const supabase = await createClient();

  // La fonction ne prend aucun argument et ne rend que le code.
  const { data: code, error } = await supabase.rpc("generate_household_invite");
  if (error || !code) return { ok: false, erreur: "echec" };

  /*
   * Relecture de la ligne créée, par son code exact. Deux raisons :
   * la durée et le nombre d'usages ne viennent pas de la fonction mais des
   * valeurs par défaut de la table, et cette lecture confirme que la ligne est
   * bien visible sous la RLS du foyer — si elle ne l'était pas, l'écran
   * afficherait un code que personne ne peut relire.
   */
  const { data: invitation } = await supabase
    .from("household_invites")
    .select("code")
    .eq("code", code)
    .maybeSingle();

  if (!invitation) return { ok: false, erreur: "echec" };

  revalidatePath("/foyer");
  return { ok: true };
}
