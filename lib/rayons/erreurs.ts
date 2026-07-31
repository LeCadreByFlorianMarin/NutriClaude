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

/**
 * Les refus de `reorder_aisles`, qui sont d'une autre nature que ceux d'un
 * `insert` ou d'un `update` de rayon — d'où une fonction distincte plutôt qu'une
 * branche de plus dans `refusRayon`.
 */
export type RefusOrdre = "liste-changee" | "echec";

/**
 * ⚠️ **`raise exception` sans `errcode` rend `P0001`** — mesuré sur le stack
 * local. Les quatre gardes de `reorder_aisles` le rendent toutes, et c'est
 * voulu : du point de vue de l'utilisateur, elles disent une seule et même
 * chose — *la liste que tu m'as envoyée ne correspond plus à celle qui est en
 * base*. Laquelle des quatre a parlé n'intéresse que le développeur, et part
 * dans `console.error`.
 *
 * ⚠️ **Aucun repli sur le texte, contrairement à `refusRayon`.** Là-bas, le
 * repli couvre la fenêtre où le JS servi ne correspond pas encore à la base, et
 * il s'appuie sur des **noms de contraintes**, qui sont stables. Ici il faudrait
 * s'appuyer sur une phrase française rédigée dans le corps de la fonction : la
 * reformuler casserait l'écran en silence. Le message n'est pas un contrat.
 */
export function refusOrdre(erreur: ErreurBase | null): RefusOrdre {
  if (!erreur) return "echec";
  return erreur.code === "P0001" ? "liste-changee" : "echec";
}

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
