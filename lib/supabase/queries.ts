import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  AUTH_TIMEOUT_MS,
  TIMEOUT,
  estPanneDeTransport,
  withTimeout,
} from "../auth/panne.ts";

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
 * État d'appartenance du visiteur courant.
 *
 * Union discriminée plutôt qu'une paire `{ signedIn, profile }` : cette dernière
 * rendait représentable `{ signedIn: false, profile: <un profil> }`, si bien que
 * la distinction des cas ne tenait qu'à un commentaire. Ici, c'est le
 * compilateur qui l'impose, et l'aiguillage devient exhaustif.
 *
 * - `anonyme` — pas de session. Refus franc de Supabase.
 * - `inverifiable` — Supabase injoignable ou trop lent. **Ce n'est pas une
 *   absence de session** : le lire comme tel déconnecterait tout le foyer à
 *   chaque incident, ce qui contredirait NFR-1 et annulerait la bascule
 *   hors-ligne du proxy un hop plus loin.
 * - `sans-foyer` — authentifié, mais aucune ligne `profiles`. État **légitime** :
 *   la connexion crée un compte, aucun trigger ne crée de profil, c'est
 *   l'inscription au foyer qui s'en charge.
 * - `membre` — authentifié et rattaché.
 */
export type Appartenance =
  | { etat: "anonyme" }
  | { etat: "inverifiable" }
  | { etat: "sans-foyer" }
  | { etat: "membre"; profile: Profile };

/**
 * Lit l'appartenance du visiteur.
 *
 * Le client est **passé en paramètre**, jamais construit ici : c'est ce qui rend
 * cette fonction utilisable ailleurs que dans un Server Component — Edge
 * Function, serveur MCP de l'Epic 7 — et testable avec un faux client, sans
 * Next ni réseau. L'aiguillage web (`redirect`) vit chez l'appelant, dans
 * `app/_lib/garde.ts`.
 */
export async function getMembership(
  supabase: SupabaseClient<Database>
): Promise<Appartenance> {
  // Même garde que le proxy : sans délai ni test d'erreur, une panne Supabase
  // se présente ici comme « pas de session ». Les trois formes de panne sont
  // le délai dépassé, l'erreur de transport rendue, et l'appel qui lève.
  let verification: Awaited<ReturnType<typeof supabase.auth.getUser>> | typeof TIMEOUT;
  try {
    verification = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
  } catch {
    return { etat: "inverifiable" };
  }

  if (verification === TIMEOUT) return { etat: "inverifiable" };
  if (estPanneDeTransport(verification.error)) return { etat: "inverifiable" };
  if (!verification.data.user) return { etat: "anonyme" };
  const utilisateur = verification.data.user;

  // `maybeSingle()` : zéro ligne est un cas nominal, pas une erreur.
  const { data: profile, error: erreurProfil } = await supabase
    .from("profiles")
    .select("id, household_id, display_name")
    .eq("id", utilisateur.id)
    .maybeSingle();

  // Zéro ligne et « la lecture a échoué » ne se confondent pas. Les rendre tous
  // deux comme « sans foyer » enverrait un membre parfaitement rattaché en créer
  // un second — où la fonction lèverait `Profile already exists`, que
  // l'onboarding traite comme un succès et renvoie vers `/`, qui échoue à
  // nouveau : la boucle de redirections est complète.
  if (erreurProfil) {
    throw new Error(`Lecture du profil impossible : ${erreurProfil.message}`);
  }

  return profile ? { etat: "membre", profile } : { etat: "sans-foyer" };
}
