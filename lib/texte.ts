/**
 * Normalisation des saisies libres, commune à tous les domaines.
 *
 * Extrait de `lib/foyer/saisie.ts` quand les rayons sont devenus le troisième
 * champ libre du produit. La règle du fichier d'origine — « ces fonctions
 * existaient en trois copies inline, rassemblées ici elles sont testables » —
 * vaut d'un domaine à l'autre autant qu'à l'intérieur d'un seul.
 */

/**
 * Caractères invisibles que `String.prototype.trim()` **ne retire pas** :
 * espace de largeur nulle, liant/antiliant, séparateur de mots, et les marques
 * directionnelles. Ils arrivent en collant depuis une application de messagerie
 * et produisent une saisie qui passe tous les contrôles tout en s'affichant
 * vide.
 *
 * ⚠️ **Cette plage contient U+200D (ZWJ)**, qui est *porteur de sens* dans un
 * emoji : 🧑‍🍳 s'écrit 🧑 + ZWJ + 🍳. La retirer d'une icône la casserait en
 * deux. Voir `INVISIBLES_HORS_JOINTURE` et `lib/rayons/saisie.ts`.
 */
export const INVISIBLES = /[\u200B-\u200F\u2060\uFEFF]/g;

/**
 * Même chose, **sans** les deux jointures U+200C (ZWNJ) et U+200D (ZWJ). À
 * employer partout où la saisie peut contenir un emoji composé : on veut
 * toujours retirer l'espace de largeur nulle collé par un copier-coller, sans
 * démembrer la séquence.
 */
export const INVISIBLES_HORS_JOINTURE = /[\u200B\u200E\u200F\u2060\uFEFF]/g;

/**
 * Rend la saisie nettoyée et bornée, ou `null` s'il ne reste rien d'affichable.
 *
 * `null` est délibérément distinct de `""` : l'appelant doit décider quoi en
 * faire plutôt que d'envoyer une chaîne vide à la base.
 */
export function normaliserTexte(saisie: string, maximum: number): string | null {
  const net = saisie.replace(INVISIBLES, "").trim();
  return net === "" ? null : net.slice(0, maximum);
}
