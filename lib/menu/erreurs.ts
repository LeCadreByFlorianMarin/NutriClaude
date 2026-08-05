/**
 * Traduction des refus que la base oppose aux écritures du menu.
 *
 * Même intention que `lib/recettes/erreurs.ts`, `lib/rayons/erreurs.ts` et
 * `lib/foyer/erreurs.ts` — rendre un refus compréhensible plutôt que répondre
 * « Ça n'a pas marché » à quelqu'un qui n'aurait plus qu'à retenter à
 * l'identique.
 *
 * ⚠️ **DEUX DISCRIMINANTS, ET LE CHOIX N'EST PAS UNE PRÉFÉRENCE.** La règle du
 * dépôt est « SQLSTATE d'abord, texte en repli », et elle existe parce que Vercel
 * et Supabase se déploient séparément : il y a toujours une fenêtre où le JS servi
 * ne correspond pas à la base. Elle vise les textes **rédigés** — la phrase
 * française d'un `raise exception` — qu'une reformulation casserait en silence.
 *
 * Un **nom de contrainte** est d'une autre nature : il fait partie du schéma, il
 * ne se reformule pas, et le test qui l'épingle fait échouer bruyamment un
 * renommage. C'est pourquoi :
 *
 *   - `23505` et les deux codes de « la recette a disparu » sont décidés sur le
 *     **SQLSTATE** : ils portent une CATÉGORIE de situation, pas une règle métier
 *     nommée. `meal_plan_entries` n'ayant qu'une seule contrainte d'unicité,
 *     `23505` est sans ambiguïté ;
 *   - `23514` est décidé sur le **nom de contrainte**, parce qu'un `check` nomme
 *     une règle précise et que d'autres tables en portent de très ressemblantes
 *     (`recipes_servings_positif` face à `meal_plan_entries_servings_positif`).
 *
 * Formes mesurées le 2026-08-04 sur le stack local, contraintes en place :
 *   {"code":"23505","message":"duplicate key value violates unique constraint
 *    \"meal_plan_entries_assignation_unique\""}
 *   {"code":"42501","message":"new row violates row-level security policy for
 *    table \"meal_plan_entries\""}
 */

export type RefusAssignation =
  | "deja-au-menu"
  | "personnes-invalides"
  | "menu-change"
  | "echec";

/** Forme minimale d'une erreur Supabase, sans dépendre de son typage. */
type ErreurBase = { code?: string | null; message?: string | null };

/**
 * Les SQLSTATE qui disent « la recette a disparu sous tes pieds », et qui ne
 * peuvent donc PAS se traiter par « Réessaie ».
 *
 * ⚠️ **Le défaut que ça répare a déjà été en production, sur un autre écran.** Si
 * l'autre membre du foyer supprime la recette pendant qu'on remplit le
 * formulaire, l'`insert` rend `23503` — la clé étrangère `..._recipe_id_fkey` n'a
 * plus de cible — ou `42501` si c'est le `with check` de `meal_plan_all` qui
 * parle, la recette n'appartenant plus au foyer. Aucun des deux n'est un nom de
 * contrainte `check` : sans cette table, les deux retomberaient sur « echec »,
 * c'est-à-dire **« Ça n'a pas marché. Réessaie dans un instant. »** — un conseil
 * qui ne peut JAMAIS fonctionner, la famille que `project-context.md` interdit
 * nommément. Revue adversariale du 2026-08-03, chemin d'ajout d'ingrédient.
 *
 * ⚠️ **`42501` recouvre aussi le refus de provenance** posé par
 * `20260804144217` (volet 2) : une case pointant la recette d'un autre foyer. Ce
 * chemin n'est pas atteignable depuis l'écran, dont le sélecteur ne propose que
 * les recettes du foyer — et quand il l'est malgré tout, c'est que la recette a
 * changé de main ou disparu. Le même message convient donc aux deux.
 */
const SQLSTATE_MENU_CHANGE = new Set(["23503", "42501"]);

/**
 * Noms de contraintes tels qu'ils figurent en base, posés par
 * `20260804144217_contraindre_les_assignations_de_menu.sql`.
 *
 * ⚠️ **La comparaison est faite sur le nom COMPLET.** `recipes_servings_positif`
 * n'est pas un suffixe de `meal_plan_entries_servings_positif`, mais les deux se
 * ressemblent assez pour qu'une comparaison relâchée les confonde — et l'écran du
 * menu dirait « il faut au moins une personne » sur un refus qui parle de la
 * recette.
 */
const PAR_CONTRAINTE: ReadonlyArray<[string, RefusAssignation]> = [
  ["meal_plan_entries_servings_positif", "personnes-invalides"],
];

export function refusAssignation(erreur: ErreurBase | null): RefusAssignation {
  if (!erreur) return "echec";

  if (erreur.code && SQLSTATE_MENU_CHANGE.has(erreur.code)) return "menu-change";

  /*
   * ⚠️ **Avant le repli sur le texte, et pas après.** `meal_plan_entries` ne porte
   * qu'une seule contrainte d'unicité — celle d'AD-6 — donc `23505` la désigne
   * sans ambiguïté. Le jour où une seconde apparaîtrait, ce raccourci deviendrait
   * faux : c'est pour ça que le test épingle aussi le message.
   */
  if (erreur.code === "23505") return "deja-au-menu";

  const message = erreur.message ?? "";
  for (const [contrainte, refus] of PAR_CONTRAINTE) {
    if (message.includes(contrainte)) return refus;
  }

  /*
   * Tout le reste reste générique. Un refus qu'on ne sait pas nommer vaut mieux
   * qu'un refus faussement précis : dire « Cette recette est déjà à ce repas » sur
   * un `42P01` enverrait corriger quelque chose qui n'a rien.
   */
  return "echec";
}
