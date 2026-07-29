/**
 * Traduction des refus que la base oppose aux écritures de rayons.
 *
 * Même forme que `lib/foyer/erreurs.ts`, et pour la même raison : **le SQLSTATE
 * d'abord, le texte en repli.** Vercel et Supabase se déploient séparément, donc
 * migration et déploiement applicatif ne peuvent jamais être atomiques — il y
 * aura toujours une fenêtre où le JS servi ne correspond pas à la base.
 *
 * Ce que ce module empêche concrètement : un nom de rayon en doublon est un cas
 * parfaitement compréhensible, et sans traduction l'écran répondrait « Ça n'a
 * pas marché » à quelqu'un qui n'aurait plus qu'à retenter à l'identique.
 */

export type RefusRayon = "nom-pris" | "nom-vide" | "echec";

/** Forme minimale d'une erreur Supabase, sans dépendre de son typage. */
type ErreurBase = { code?: string | null; message?: string | null };

/**
 * SQLSTATE standard. `23505` = violation d'unicité —
 * `aisles.unique (household_id, name)`. `23514` = violation de contrainte
 * `check` — `aisles_name_non_vide`.
 */
const PAR_CODE: Record<string, RefusRayon> = {
  "23505": "nom-pris",
  "23514": "nom-vide",
};

/**
 * Noms de contraintes tels qu'ils figurent en base. Repli employé seulement si
 * le SQLSTATE manque.
 *
 * `aisles_household_id_name_key` est le nom que Postgres donne d'office au
 * `unique (household_id, name)` de `20260502000000_initial_schema.sql:81` ;
 * `aisles_name_non_vide` est nommée explicitement par
 * `20260729095923_require_non_blank_aisle_name.sql`.
 */
const PAR_MESSAGE: ReadonlyArray<[string, RefusRayon]> = [
  ["aisles_household_id_name_key", "nom-pris"],
  ["aisles_name_non_vide", "nom-vide"],
];

export function refusRayon(erreur: ErreurBase | null): RefusRayon {
  if (!erreur) return "echec";

  // `Object.hasOwn` et pas `PAR_CODE[code]` : le code vient d'une réponse
  // serveur, et indexer directement rend une fonction pour `"constructor"`.
  if (erreur.code && Object.hasOwn(PAR_CODE, erreur.code)) {
    return PAR_CODE[erreur.code];
  }

  const message = erreur.message ?? "";
  for (const [extrait, refus] of PAR_MESSAGE) {
    if (message.includes(extrait)) return refus;
  }
  return "echec";
}
