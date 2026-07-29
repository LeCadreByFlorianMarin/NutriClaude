/**
 * Traduction des refus levés par les fonctions d'inscription au foyer.
 *
 * **Pourquoi ce module existe.** Les fonctions plpgsql lèvent en anglais, et
 * l'interface distingue les refus par le *texte* de ces exceptions. C'est un
 * contrat inter-langage, entre un fichier `.sql` et des composants React, que
 * rien ne typait ni ne testait — alors qu'il a **déjà contraint une migration** :
 * `20260727161200_guard_invite_use_count.sql` a dû réordonner ses contrôles pour
 * préserver ces libellés, et son en-tête le dit explicitement.
 *
 * Le test qui accompagne ce fichier épingle les chaînes telles qu'elles
 * apparaissent dans les migrations. **Le test EST le document du contrat** :
 * reformuler un `raise exception` fait désormais échouer la CI au lieu de faire
 * retomber trois refus distincts sur « Ça n'a pas marché ».
 *
 * **Pourquoi la fonction lit `code` *et* `message`.** Il n'existe pas de
 * préproduction, et Vercel et Supabase se déploient séparément : migration et
 * déploiement applicatif ne peuvent donc jamais être atomiques. Il y aura
 * toujours une fenêtre où le JS servi ne correspond pas à la base. Lire d'abord
 * un `errcode` s'il est présent, retomber sur le texte sinon, rend la bascule
 * vers des SQLSTATE stables faisable plus tard sans coordination — et ne coûte
 * rien aujourd'hui.
 */

export type RefusInscription =
  | "code-inconnu"
  | "code-expire"
  | "code-epuise"
  | "deja-membre"
  | "session-perdue"
  | "echec";

/** Forme minimale d'une erreur Supabase, sans dépendre de son typage. */
type ErreurBase = { code?: string | null; message?: string | null };

/**
 * SQLSTATE personnalisés, pour le jour où les fonctions en poseront.
 * Vides aujourd'hui : les migrations lèvent encore sans `errcode`.
 */
const PAR_CODE: Record<string, RefusInscription> = Object.create(null);

/**
 * Libellés tels qu'ils figurent dans les `raise exception` des migrations.
 * Source : `20260502000000_initial_schema.sql` et
 * `20260727161200_guard_invite_use_count.sql`.
 */
const PAR_MESSAGE: ReadonlyArray<[string, RefusInscription]> = [
  ["Invalid invite code", "code-inconnu"],
  ["Invite expired", "code-expire"],
  ["Invite has no uses remaining", "code-epuise"],
  ["Profile already exists", "deja-membre"],
  ["Not authenticated", "session-perdue"],
];

/**
 * Une vraie course entre deux soumissions ne lève **pas** `Profile already
 * exists` : le contrôle `exists (select 1 from profiles …)` s'exécute à l'entrée
 * des deux transactions, les deux le passent, et la seconde échoue sur la clé
 * primaire. Le distinguer compte, parce que l'état visé est alors atteint —
 * c'est un succès, pas un refus.
 */
export function estCourseGagneeAilleurs(erreur: ErreurBase | null): boolean {
  if (!erreur) return false;
  if (erreur.code === "23505") return true;
  return (erreur.message ?? "").includes("profiles_pkey");
}

export function refusInscription(erreur: ErreurBase | null): RefusInscription {
  if (!erreur) return "echec";

  if (erreur.code && Object.hasOwn(PAR_CODE, erreur.code)) {
    return PAR_CODE[erreur.code];
  }

  const message = erreur.message ?? "";
  for (const [extrait, refus] of PAR_MESSAGE) {
    if (message.includes(extrait)) return refus;
  }
  return "echec";
}
