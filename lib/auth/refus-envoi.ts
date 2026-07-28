/**
 * Traduction des refus de `signInWithOtp` en clés internes.
 *
 * Symétrique de `lib/foyer/erreurs.ts`, et pour la même raison : c'est un
 * contrat inter-système — les codes d'erreur de GoTrue — que rien ne typait ni
 * ne testait. Le domaine foyer avait sorti sa taxonomie et l'avait épinglée ;
 * le domaine login gardait la sienne inline dans un `.tsx`, donc hors de portée
 * du harnais. L'asymétrie était le défaut, pas le code.
 */

export type RefusEnvoi =
  | "trop-de-demandes"
  | "adresse-invalide"
  | "adresse-non-autorisee"
  | "envoi-impossible";

/**
 * `email_address_not_authorized` mérite son propre message : sans service
 * d'envoi dédié, seules les adresses rattachées au projet reçoivent quelque
 * chose — c'est le premier écueil d'une nouvelle personne du foyer.
 */
export function versCleMessage(
  code: string | undefined,
  status: number | undefined
): RefusEnvoi {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "trop-de-demandes";
    case "email_address_invalid":
    case "validation_failed":
      return "adresse-invalide";
    case "email_address_not_authorized":
      return "adresse-non-autorisee";
    default:
      // Un 429 sans code connu reste un plafond atteint : le dire vaut mieux
      // que d'inviter à réessayer tout de suite.
      return status === 429 ? "trop-de-demandes" : "envoi-impossible";
  }
}
