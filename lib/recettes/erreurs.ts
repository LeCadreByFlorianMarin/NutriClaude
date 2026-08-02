/**
 * Traduction des refus que la base oppose aux écritures de recettes.
 *
 * Même intention que `lib/foyer/erreurs.ts` et `lib/rayons/erreurs.ts` — traduire
 * un refus compréhensible plutôt que répondre « Ça n'a pas marché » à quelqu'un
 * qui n'aurait plus qu'à retenter à l'identique.
 *
 * ⚠️ **MAIS le discriminant n'est PAS le même, et ce n'est pas une régression.**
 * `lib/rayons/erreurs.ts` mappe `23514 → "nom-vide"` directement, ce qu'il peut
 * se permettre parce qu'`aisles` ne porte **qu'une seule** contrainte `check`.
 * `recipes` en porte **deux** depuis `20260801124553` :
 *
 *   - `recipes_titre_non_vide`
 *   - `recipes_servings_positif`
 *
 * Décider sur le seul SQLSTATE rendrait donc « Il faut un titre. » à quelqu'un
 * qui a saisi 0 portion. Le code identifie la **famille** du refus ; c'est le
 * **nom de contrainte** qui dit laquelle.
 *
 * ⚠️ **Pourquoi s'appuyer sur le texte ici est légitime, alors que `refusOrdre`
 * s'y refuse.** La règle « SQLSTATE d'abord, texte en repli » existe parce que
 * Vercel et Supabase se déploient séparément : il y a toujours une fenêtre où le
 * JS servi ne correspond pas à la base. Elle vise les textes **rédigés**, comme
 * la phrase française d'un `raise exception`, qu'une reformulation casserait en
 * silence. Un **nom de contrainte** est d'une autre nature : il fait partie du
 * schéma, il ne se reformule pas, et `PAR_MESSAGE` de `lib/rayons/erreurs.ts`
 * s'appuie déjà sur lui. Le test « les deux noms sont ceux de la migration »
 * fait échouer bruyamment un renommage.
 *
 * Forme mesurée le 2026-08-01 sur le stack local, contraintes en place :
 *   {"code":"23514","message":"new row for relation \"recipes\" violates
 *    check constraint \"recipes_titre_non_vide\""}
 *
 * **Aucun cas `23505`** : `recipes` n'a aucune contrainte d'unicité, et on n'en
 * ajoute pas — deux « Curry » différents sont légitimes.
 */

export type RefusRecette = "titre-vide" | "portions-invalides" | "echec";

/** Forme minimale d'une erreur Supabase, sans dépendre de son typage. */
type ErreurBase = { code?: string | null; message?: string | null };

/**
 * Noms de contraintes tels qu'ils figurent en base, posés par
 * `20260801124553_require_valid_recipe_fields.sql`.
 */
const PAR_CONTRAINTE: ReadonlyArray<[string, RefusRecette]> = [
  ["recipes_titre_non_vide", "titre-vide"],
  ["recipes_servings_positif", "portions-invalides"],
];

export function refusRecette(erreur: ErreurBase | null): RefusRecette {
  if (!erreur) return "echec";

  const message = erreur.message ?? "";
  for (const [contrainte, refus] of PAR_CONTRAINTE) {
    if (message.includes(contrainte)) return refus;
  }

  /*
   * Tout le reste reste générique. Un refus qu'on ne sait pas nommer vaut mieux
   * qu'un refus faussement précis : dire « Il faut un titre. » sur un `42501`
   * enverrait l'utilisateur corriger un champ qui n'a rien.
   */
  return "echec";
}

/**
 * Les refus propres aux ingrédients. Trois contraintes `check` sur la même
 * table — donc, comme pour `recipes`, c'est le **nom de contrainte** qui
 * discrimine, jamais le seul SQLSTATE `23514`.
 */
export type RefusIngredient =
  | "nom-vide"
  | "unite-inconnue"
  | "quantite-negative"
  | "echec";

const PAR_CONTRAINTE_INGREDIENT: ReadonlyArray<[string, RefusIngredient]> = [
  ["recipe_ingredients_nom_non_vide", "nom-vide"],
  ["recipe_ingredients_unite_fermee", "unite-inconnue"],
  ["recipe_ingredients_quantite_positive", "quantite-negative"],
];

export function refusIngredient(erreur: ErreurBase | null): RefusIngredient {
  if (!erreur) return "echec";

  const message = erreur.message ?? "";
  for (const [contrainte, refus] of PAR_CONTRAINTE_INGREDIENT) {
    if (message.includes(contrainte)) return refus;
  }
  return "echec";
}

/**
 * Les refus de `reorder_recipe_ingredients`, d'une autre nature que ceux d'un
 * `insert` ou d'un `update`.
 *
 * ⚠️ **`raise exception` sans `errcode` rend `P0001`** — les quatre gardes de la
 * fonction le rendent toutes, et c'est voulu : du point de vue de l'utilisateur
 * elles disent une seule et même chose, *la liste que tu m'as envoyée ne
 * correspond plus à celle qui est en base*. Laquelle a parlé n'intéresse que le
 * développeur, et part dans `console.error`.
 *
 * ⚠️ **Aucun repli sur le texte**, contrairement à `refusIngredient` : il
 * faudrait s'appuyer sur une phrase française écrite dans le corps de la
 * fonction, et la reformuler casserait l'écran en silence. Un nom de contrainte
 * fait partie du schéma ; un message n'est pas un contrat. Même raisonnement que
 * `refusOrdre` pour les rayons.
 */
export type RefusOrdreIngredients = "liste-changee" | "echec";

export function refusOrdreIngredients(
  erreur: ErreurBase | null
): RefusOrdreIngredients {
  if (!erreur) return "echec";
  return erreur.code === "P0001" ? "liste-changee" : "echec";
}
