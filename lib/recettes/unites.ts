/**
 * Le vocabulaire d'unités fermé — **la source unique** du `<select>` de l'écran,
 * du test d'accord avec la base, et de tout ce qui viendra ensuite.
 *
 * ⚠️ **Ce n'est pas une liste d'affichage, c'est un contrat avec l'Epic 4.**
 * `generate_grocery_list_from_menu` groupe par `ri.name, ri.unit` **brut** et
 * recopie `ri.unit` dans `grocery_list_items.unit`
 * (`20260502000000_initial_schema.sql:554, 562`). Or AD-3 fait de
 * `(household_id, nom normalisé, unité)` la **clé canonique** de toute la liste de
 * courses. La chaîne écrite ici est donc la clé d'agrégation de l'Epic 4.
 *
 * ⚠️ **Le commentaire du squelette dit autre chose, et il a tort.**
 * `initial_schema.sql:162` annonce `-- 'g', 'ml', 'piece', 'cs', 'cc'` : cinq
 * jetons, et `piece` **sans accent**. AD-7 en nomme **huit**, accentués. C'est
 * AD-7 qui fait foi. Un test fige lequel des deux gagne, pour qu'un développeur
 * qui lit le schéma et croit bien faire casse en local plutôt qu'en production.
 *
 * ⚠️ **Tous les jetons sont en NFC, et ça se mesure.** « pièce » composé occupe
 * 5 points de code, décomposé 6 — et Postgres, qui compare octet à octet, les
 * juge **inégaux**. Deux « pièce » de formes Unicode différentes seraient deux
 * lignes de courses qui ne fusionneraient jamais, sans que rien ne dise pourquoi.
 * C'est pour ça que l'écran offre un `<select>` : l'utilisateur ne tape rien,
 * donc aucune forme décomposée ne peut naître.
 *
 * ⚠️ **Aucune conversion, jamais.** AD-7 : « deux unités différentes ne sont
 * jamais additionnées ni converties ». `kg` et `g` sont deux unités, pas deux
 * échelles d'une même unité.
 *
 * La contrepartie en base est `recipe_ingredients_unite_fermee`
 * (`20260802112511`), et l'accord entre les deux est **mesuré** par
 * `supabase/tests/contraintes.test.ts`, jamais affirmé.
 */
export const UNITES = ["g", "kg", "ml", "L", "pièce", "cs", "cc", "pincée"] as const;

export type Unite = (typeof UNITES)[number];

/**
 * Vrai si la chaîne est **exactement** l'un des huit jetons.
 *
 * ⚠️ **Ne normalise rien, et ne tolère rien** — ni la casse, ni les espaces de
 * bord, ni une forme décomposée. Recomposer en douce ferait de cette fonction un
 * normalisateur déguisé et masquerait le seul cas qui compte : une valeur qui
 * n'est pas venue du `<select>`, donc d'un appel forgé ou d'un défaut. On veut
 * qu'elle échoue bruyamment, et que la contrainte en base la refuse ensuite.
 */
export function estUniteConnue(valeur: string): valeur is Unite {
  return (UNITES as readonly string[]).includes(valeur);
}
