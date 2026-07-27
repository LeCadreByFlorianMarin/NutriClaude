import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { Database } from "./types";

/**
 * Sous-ensemble du profil dont les surfaces ont besoin aujourd'hui, **dérivé du
 * schéma** plutôt que réécrit : une colonne renommée en base casse le typage
 * ici, au lieu de diverger en silence.
 */
export type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "household_id" | "display_name"
>;

/**
 * État d'appartenance du visiteur courant. Les trois cas sont distincts et
 * doivent le rester : « pas connecté » et « connecté sans foyer » n'appellent
 * pas le même aiguillage.
 *
 * « Authentifié sans foyer » est un état **légitime** : la connexion (Story 1.2)
 * crée un compte, mais aucun trigger ne crée de `profiles` — c'est l'inscription
 * au foyer qui s'en charge. Un `profile` à `null` n'est donc pas une anomalie.
 */
export async function getMembership(): Promise<{
  signedIn: boolean;
  profile: Profile | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, profile: null };

  // `maybeSingle()` : zéro ligne est un cas nominal, pas une erreur.
  const { data } = await supabase
    .from("profiles")
    .select("id, household_id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return { signedIn: true, profile: data ?? null };
}

/**
 * Garde des pages qui lisent des données de foyer : renvoie le profil, ou
 * redirige vers l'écran qui manque.
 *
 * ⚠️ **Ce n'est pas un contrôle de sécurité.** La sécurité est assurée par la
 * RLS, et par elle seule : sans profil, `current_household_id()` vaut `NULL` et
 * toutes les politiques refusent — il n'y a rien à lire, même en contournant
 * cette fonction. Ce qu'elle apporte, c'est l'*expérience* : ne pas afficher une
 * page vide à qui n'a pas encore de foyer.
 *
 * Ne la déplace pas dans le proxy : elle interroge la base, ce qu'un contrôle
 * exécuté à chaque requête ne peut pas se permettre — et qui entrerait en
 * conflit avec sa bascule hors-ligne.
 *
 * `redirect()` lève une exception que Next intercepte : **ne l'enveloppe jamais
 * dans un `try/catch`**, il avalerait la redirection.
 */
export async function requireProfile(): Promise<Profile> {
  const { signedIn, profile } = await getMembership();
  if (!signedIn) redirect("/login");
  if (!profile) redirect("/onboarding");
  return profile;
}
