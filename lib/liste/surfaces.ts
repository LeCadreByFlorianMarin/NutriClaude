/**
 * Les surfaces par lesquelles un article peut entrer dans la liste (FR-7).
 *
 * ⛔ **VOCABULAIRE PUR — aucune chaîne d'affichage ici, et c'est la raison d'être du fichier.**
 * Correctif de la revue du 2026-08-20 (décision D-2 de Florian). Ce vocabulaire vivait dans
 * `provenance.ts`, avec la table d'emoji et la microcopie — si bien que `lib/liste/liste.ts`,
 * l'adaptateur de persistance, devait **importer la présentation** pour atteindre un simple
 * prédicat de schéma. La dépendance pointait donc du module le plus stable vers le plus volatil :
 * `provenance.ts` change à chaque surface ajoutée (Epic 5 le dashboard, Epic 6 le pont, Epic 7
 * MCP), et toute la lecture en dépendait.
 *
 * ⚠️ **Le dépôt avait déjà le motif** : `lib/recettes/unites.ts` est exactement ça — `UNITES`,
 * `Unite`, `estUniteConnue`, et pas une seule chaîne rendue ; c'est `lib/quantite.ts` qui
 * présente. On s'y aligne.
 *
 * ⚠️ **Ce n'est pas une énumération qui court après une catégorie** (règle §3). Cette règle
 * interdit d'énumérer un ensemble qu'on ne contrôle pas — points de code Unicode, codes SQLSTATE.
 * Les surfaces sont l'inverse : **nous** les écrivons, une par une. C'est le raisonnement du
 * vocabulaire d'unités (AD-7).
 *
 * ⚠️ **Contrepartie applicative de `grocery_list_items_surface_fermee`.** L'accord entre les deux
 * est **mesuré**, pas affirmé — `supabase/tests/contraintes.test.ts`, comme pour `UNITES`
 * (règle §4).
 */
export const SURFACES = [
  "web",
  "dashboard",
  "voix",
  "dictee",
  "pont",
  "mcp",
] as const;

export type Surface = (typeof SURFACES)[number];

/**
 * Vrai si la chaîne est **exactement** l'une des surfaces connues.
 *
 * ⚠️ **C'est le TABLEAU qu'on élargit, jamais la valeur qu'on transtype** — correctif de la revue.
 * `SURFACES.includes(valeur as Surface)` affirmait au compilateur exactement ce que la fonction
 * est censée vérifier : le jour où un appelant passe un `unknown`, le transtypage le laisse
 * entrer en silence. Élargir le tableau ne ment sur rien. Motif d'`unites.ts:47`.
 */
export function estSurfaceConnue(valeur: string | null): valeur is Surface {
  return (SURFACES as readonly (string | null)[]).includes(valeur);
}
