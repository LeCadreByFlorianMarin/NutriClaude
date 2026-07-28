import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";
import {
  getMembership,
  type Appartenance,
  type Profile,
} from "@/lib/supabase/queries";

/** Appartenance du visiteur courant, dans le contexte d'une requête Next. */
export async function appartenance(): Promise<Appartenance> {
  return getMembership(await createServerComponentClient());
}

/**
 * Garde des pages qui lisent des données de foyer : renvoie le profil, ou
 * aiguille vers l'écran qui manque.
 *
 * ⚠️ **Ce n'est pas un contrôle de sécurité.** La sécurité est assurée par la
 * RLS, et par elle seule : sans profil, `current_household_id()` vaut `NULL` et
 * toutes les politiques refusent — il n'y a rien à lire, même en contournant
 * cette fonction. Ce qu'elle apporte, c'est l'*expérience* : ne pas afficher une
 * page vide à qui n'a pas encore de foyer.
 *
 * Elle vit dans `app/` et non dans `lib/` : c'est de la politique de routage
 * web, et l'y laisser rendait la couche données inutilisable hors d'un rendu
 * Next — donc inutilisable par le serveur MCP de l'Epic 7.
 *
 * `redirect()` lève une exception que Next intercepte : **ne l'enveloppe jamais
 * dans un `try/catch`**, il avalerait la redirection.
 */
export async function requireProfile(): Promise<Profile> {
  const etat = await appartenance();

  switch (etat.etat) {
    case "membre":
      return etat.profile;
    case "anonyme":
      redirect("/login");
    case "sans-foyer":
      redirect("/onboarding");
    case "inverifiable":
      /*
       * Surtout pas `/login` : le membre a une session, c'est le service qui ne
       * répond pas. L'y envoyer le déconnecterait à chaque incident (NFR-1), et
       * annulerait la bascule hors-ligne que le proxy vient d'appliquer.
       * `app/error.tsx` propose un « Réessayer » qui refait la requête — la
       * bonne réponse tant que l'Epic 4 n'a pas apporté le vrai hors-ligne.
       */
      throw new Error("Service d'authentification injoignable");
  }
}
