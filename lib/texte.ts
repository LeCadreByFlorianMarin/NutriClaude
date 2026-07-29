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
 * espace de largeur nulle, liant/antiliant, séparateur de mots, marques et
 * contrôles directionnels, et les quelques « faux blancs » qu'Unicode ne classe
 * pas comme espace. Ils arrivent en collant depuis une application de
 * messagerie et produisent une saisie qui passe tous les contrôles tout en
 * s'affichant vide.
 *
 * ⚠️ **Écrits en échappements `\uXXXX`, jamais en clair.** Un caractère
 * invisible copié tel quel dans cette source serait invisible ici aussi : on ne
 * pourrait ni le relire, ni le différ, ni savoir lequel c'est.
 *
 * ⚠️ **Cette plage contient U+200D (ZWJ)**, qui est *porteur de sens* dans un
 * emoji : 🧑‍🍳 s'écrit 🧑 + ZWJ + 🍳. La retirer d'une icône la casserait en
 * deux. Voir `INVISIBLES_HORS_JOINTURE` et `lib/rayons/saisie.ts`.
 *
 * ⚠️ **La couverture de `trim()` n'est pas celle qu'on croit.** Il retire bien
 * tous les blancs Unicode — tabulation, saut de ligne, U+00A0, U+2000-200A —
 * mais **pas** les invisibles qui n'en sont pas : U+00AD (trait d'union
 * conditionnel), U+3164 (remplisseur Hangul), U+2800 (braille blanc), U+180E.
 * Sans eux dans cette plage, un nom de rayon entièrement invisible passait le
 * contrôle client *et* la contrainte `check` de la base — mesuré à la revue du
 * 2026-07-29. Les contrôles directionnels U+202A-202E et U+2066-2069 sont là
 * pour une raison voisine : ils ne s'affichent pas, mais retournent le sens de
 * lecture du reste de la ligne.
 */
export const INVISIBLES =
  /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]/g;

/**
 * Même chose, **sans** les deux jointures U+200C (ZWNJ) et U+200D (ZWJ). À
 * employer partout où la saisie peut contenir un emoji composé : on veut
 * toujours retirer l'espace de largeur nulle collé par un copier-coller, sans
 * démembrer la séquence.
 */
export const INVISIBLES_HORS_JOINTURE =
  /[\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]/g;

/**
 * Rend la saisie nettoyée et bornée, ou `null` s'il ne reste rien d'affichable.
 *
 * `null` est délibérément distinct de `""` : l'appelant doit décider quoi en
 * faire plutôt que d'envoyer une chaîne vide à la base.
 *
 * ⚠️ **`normalize("NFC")` d'abord, et ce n'est pas décoratif.** « Crémerie »
 * collé depuis une source en NFD s'écrit `e` + U+0301 : une chaîne *différente*
 * de la même en NFC, que `unique (household_id, name)` compare octet à octet et
 * laisse donc coexister. Deux rayons rigoureusement identiques à l'œil, aucun
 * `23505`, et rien pour les distinguer. La composition vient avant le bornage,
 * sans quoi `slice` compterait chaque diacritique séparément.
 *
 * ⚠️ **Le `trim()` final n'est pas un doublon du premier.** `slice` coupe à un
 * nombre d'unités, pas à une frontière de mot : borner « …aaa  b » laisse une
 * espace en fin de chaîne, et l'unicité de la base en fait un nom distinct.
 */
export function normaliserTexte(saisie: string, maximum: number): string | null {
  const net = saisie.normalize("NFC").replace(INVISIBLES, "").trim();
  if (net === "") return null;

  const borne = net.slice(0, maximum).trim();
  return borne === "" ? null : borne;
}
