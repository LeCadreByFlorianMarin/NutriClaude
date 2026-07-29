"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appartenance } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import {
  revoquerInvitation,
  revoquerToutesLesInvitations,
} from "@/lib/foyer/invitation";

/**
 * Clés de refus rendues à l'interface. Une union, pas `string` : c'est ce qui
 * permet au compilateur de vérifier que chaque clé produite ici a bien un
 * message en face.
 */
export type RefusInvitation = "session-perdue" | "indisponible" | "echec";

export type ResultatInvitation = { ok: true } | { ok: false; erreur: RefusInvitation };

/**
 * Émet un code d'invitation pour le foyer courant.
 *
 * ⚠️ **Server Action, et pas un appel depuis le navigateur.** Le critère n'est
 * pas « est-ce une émission ? » — `generate_household_invite` est
 * `security definer` et n'exige aucun secret serveur, il pourrait parfaitement
 * partir du client comme le rachat d'invitation. Ce que la Server Action achète
 * réellement, c'est `revalidatePath` : l'écran du foyer est rendu côté serveur,
 * et l'émission doit y être visible immédiatement. C'est la formulation retenue
 * d'AD-13 — cause, et non analogie de vocabulaire.
 *
 * On lit `appartenance()` plutôt que la garde `requireProfile()` : celle-ci
 * lève, ce qui sortirait de la fonction sans jamais rendre le
 * `ResultatInvitation` promis par la signature. Et **tout le corps est enveloppé**,
 * parce que `appartenance()` peut lever elle aussi dès que la lecture du profil
 * échoue — la première version se protégeait d'une levée et atterrissait sur une
 * autre, remplaçant tout l'écran foyer par la frontière d'erreur.
 */
export async function genererInvitation(): Promise<ResultatInvitation> {
  try {
    const etat = await appartenance();
    if (etat.etat === "anonyme") return { ok: false, erreur: "session-perdue" };
    if (etat.etat === "inverifiable") return { ok: false, erreur: "indisponible" };
    if (etat.etat !== "membre") return { ok: false, erreur: "echec" };

    const supabase = await createServerComponentClient();

    /*
     * Émettre remplace : les codes encore valables sont révoqués d'abord.
     *
     * « Créer un autre code » laissait auparavant le précédent vivant sept jours
     * tout en le faisant disparaître de l'écran — seul le plus récent étant
     * affiché. Le code qu'on venait de partager puis de regretter était donc le
     * seul qu'aucun bouton n'atteignait, et l'écran laissait croire le
     * contraire. Un code à la fois, c'est ce que le mot « autre » promet.
     */
    await revoquerToutesLesInvitations(supabase);

    // La fonction ne prend aucun argument et ne rend que le code.
    const { data: code, error } = await supabase.rpc("generate_household_invite");
    if (error || !code) {
      console.error("[foyer/invitation] émission refusée :", error?.message);
      return { ok: false, erreur: "echec" };
    }

    /*
     * Le code EST créé à ce stade — la fonction a committé. Tout ce qui suit
     * est donc une confirmation, jamais un motif d'échec : annoncer « ça n'a
     * pas marché » après un succès poussait le membre à réessayer, et chaque
     * tentative laissait derrière elle un vrai code vivant de plus, invisible
     * puisque l'écran n'affiche que le plus récent.
     *
     * `revalidatePath` est donc inconditionnel, et une relecture qui échoue est
     * journalisée sans changer le verdict.
     */
    const { error: erreurRelecture } = await supabase
      .from("household_invites")
      .select("code")
      .eq("code", code)
      .maybeSingle();

    if (erreurRelecture) {
      console.error(
        "[foyer/invitation] code émis mais relecture impossible :",
        erreurRelecture.message
      );
    }

    revalidatePath("/foyer");
    return { ok: true };
  } catch (cause) {
    console.error("[foyer/invitation] exception :", cause);
    return { ok: false, erreur: "echec" };
  }
}

/**
 * Révoque un code d'invitation.
 *
 * Même critère qu'au-dessus : l'écran du foyer est rendu côté serveur, la
 * disparition du code doit y être visible tout de suite.
 */
export async function annulerInvitation(code: string): Promise<ResultatInvitation> {
  try {
    const etat = await appartenance();
    if (etat.etat === "anonyme") return { ok: false, erreur: "session-perdue" };
    if (etat.etat === "inverifiable") return { ok: false, erreur: "indisponible" };
    if (etat.etat !== "membre") return { ok: false, erreur: "echec" };

    const supabase = await createServerComponentClient();
    await revoquerInvitation(supabase, code);

    revalidatePath("/foyer");
    return { ok: true };
  } catch (cause) {
    console.error("[foyer/invitation] révocation impossible :", cause);
    return { ok: false, erreur: "echec" };
  }
}

/**
 * Ferme la session sur cet appareil.
 *
 * Le produit vit sur des appareils partagés — tablette de cuisine, portable
 * emprunté, téléphone revendu — et le cookie de session Supabase dure 400 jours.
 * Sans ce chemin, un membre connecté ne pouvait plus se déconnecter du tout, et
 * aucune administration ne permettait de le faire à sa place.
 *
 * `scope: "local"` et non `"global"` : on ferme **cet** appareil, pas toutes les
 * sessions du membre. Se déconnecter de la tablette ne doit pas éjecter le même
 * membre de son téléphone.
 *
 * ⚠️ **L'erreur de `signOut` est testée, et c'est essentiel.** `auth-js` sort
 * avant de purger la session en cas d'échec de transport : le cookie survit.
 * Rediriger quand même vers `/login` donnait alors le pire résultat possible —
 * le proxy y voit une session valide, renvoie vers `/`, et la personne qui
 * vient de rendre la tablette croit s'être déconnectée alors qu'elle ne l'est
 * pas. On préfère le dire.
 *
 * `redirect()` lève : il reste le dernier geste, hors de tout `try/catch`.
 */
export async function seDeconnecter(): Promise<never> {
  let echec = false;

  try {
    const supabase = await createServerComponentClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("[foyer/deconnexion] signOut a échoué :", error.message);
      echec = true;
    }
  } catch (cause) {
    console.error("[foyer/deconnexion] exception :", cause);
    echec = true;
  }

  if (echec) redirect("/foyer?deconnexion=echec");

  // La page d'accueil lit le foyer : sans invalidation, le rendu suivant
  // pourrait servir le nom du foyer que l'on vient de quitter.
  revalidatePath("/", "layout");
  redirect("/login");
}
