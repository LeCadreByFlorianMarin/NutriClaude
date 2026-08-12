/**
 * Le formatage d'une QUANTITÉ, en français.
 *
 * ⚠️ **Pourquoi ce module vit à la racine de `lib/` et pas dans `lib/recettes/`.**
 * Il y a vécu jusqu'au 2026-08-07 — c'est la story 3.3 qui l'y avait écrit,
 * légitimement : les recettes étaient alors son seul appelant. La story 4.2 lui
 * en a donné un second, `app/courses/ListeCourses.tsx`, et l'import
 * `@/lib/recettes/lecture` depuis un écran de courses rendait deux choses
 * fausses d'un coup : l'en-tête du module (« le pur de l'affichage d'une
 * RECETTE »), et la promesse du docblock d'`articlesDuFoyer`, qui annonce le
 * dashboard (Epic 5) et le serveur MCP (Epic 7) comme consommateurs de la liste.
 * Les deux seraient allés chercher une règle de quantité dans un module de
 * recettes, ou l'auraient réinventée.
 *
 * ⚠️ **`lib/recettes/lecture.ts` la RÉ-EXPORTE**, donc aucun appelant n'a été
 * cassé par le déplacement. Décision D-5 de la revue de la story 4.2 (Florian,
 * 2026-08-07).
 *
 * ⚠️ **Rend `null` — jamais `""` — quand il n'y a rien à dire.** C'est ce qui
 * permet à l'écran de ne rendre AUCUN nœud, plutôt qu'un `<span>` vide qui
 * laisserait une espace ou une marge.
 */

/**
 * La locale, écrite en dur et pas déduite.
 *
 * ⚠️ **`toLocaleString()` sans argument suit la locale du NAVIGATEUR** : un
 * membre dont le système est en anglais verrait « 0.5 » là où il a tapé « 0,5 ».
 * Le produit est en français par NFR-8, pas par coïncidence de configuration.
 */
const LOCALE = "fr-FR";

/**
 * Une quantité, en français, ou `null` s'il n'y en a pas.
 *
 * ⚠️ **Le vrai défaut que cette fonction répare.** `normaliserQuantite` accepte
 * explicitement la virgule française à la saisie — « un clavier français produit
 * une virgule, et `Number("0,5")` vaut NaN ». Mais PostgREST rend `quantity` en
 * **nombre JSON** (mesuré : `0.50` sur le fil, `0.5` après `JSON.parse`), et un
 * nombre rendu tel quel en JSX s'affiche « 0.5 ». Le membre tape donc « 0,5 » et
 * le produit lui répond « 0.5 ».
 *
 * ⚠️ **`useGrouping: false`, et ce n'est pas cosmétique.**
 * `(1500).toLocaleString("fr-FR")` rend « 1 500 » avec une **espace insécable
 * étroite (U+202F)** — mesuré. C'est exactement la famille de caractères
 * invisibles que `lib/texte.ts` passe son temps à retirer des saisies, et
 * l'introduire nous-mêmes dans un texte qu'on relit serait absurde. Sur une
 * quantité de cuisine, le groupement n'apporte de toute façon rien.
 *
 * `maximumFractionDigits: 2` suit la colonne, qui est un `numeric(8,2)` : la base
 * n'en rendra jamais davantage, et le fixer ici évite qu'un flottant de passage
 * fasse apparaître une troisième décimale.
 */
export function formaterQuantite(quantite: number | null): string | null {
  if (quantite === null) return null;
  return quantite.toLocaleString(LOCALE, {
    useGrouping: false,
    maximumFractionDigits: 2,
  });
}
