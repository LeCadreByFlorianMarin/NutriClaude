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
 * ⚠ **Une propriété Unicode, pas une énumération — et c'est une leçon payée
 * deux fois.** La première rédaction listait huit points de code, la seconde
 * en listait seize. Les deux se voulaient exhaustives, les deux étaient fausses :
 * la seconde revue du 2026-07-29 a mesuré que U+115F et U+1160 — les frères
 * pleine largeur du U+3164 que la liste citait en exemple — passaient encore.
 * La catégorie `Cf` seule compte plusieurs centaines de points de code, et
 * Unicode en ajoute à chaque version. **Une liste écrite à la main ne peut pas
 * gagner ; un prédicat de catégorie, si.**
 *
 * `Default_Ignorable_Code_Point` est exactement la propriété voulue : Unicode y
 * classe les caractères « qu'un moteur de rendu doit ignorer s'il ne sait pas
 * les traiter » — les remplisseurs Hangul, les sélecteurs de variante, les
 * jointures, les marques et contrôles directionnels, le joncteur de graphème.
 * S'y ajoute U+2800 (braille blanc), qui n'est pas ignorable par défaut mais
 * s'affiche vide.
 *
 * ⚠ **Cette plage contient U+200D (ZWJ)**, qui est *porteur de sens* dans un
 * emoji : 🧑\u200D🍳 s'écrit 🧑 + ZWJ + 🍳. La retirer d'une icône la casserait en
 * deux. Voir `INVISIBLES_HORS_JOINTURE` et `lib/rayons/saisie.ts`.
 *
 * ⚠ **`trim()` ne couvre pas ce que couvre cette plage, et l'inverse est vrai
 * aussi.** `trim()` retire les blancs Unicode — tabulation, U+00A0, U+2000-200A,
 * et aussi U+0085 et U+001C-001F ; aucun d'eux n'est ignorable par défaut. Les
 * deux sont donc appliqués, et dans cet ordre.
 *
 * ⚠ **La contrepartie en base est `aisles_name_non_vide`**
 * (`20260729095923`), qui emploie `[^[:graph:]]` — Postgres n'a pas de
 * propriété Unicode dans ses expressions rationnelles. Les deux populations ne
 * sont pas identiques par construction ; l'accord est **mesuré** par le test
 * « client et base s'accordent » de `saisie.test.ts`, pas affirmé.
 */
export const INVISIBLES =
  /[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cn}\u2800]/gu;

/**
 * Même chose, **sans** les deux jointures U+200C (ZWNJ) et U+200D (ZWJ). À
 * employer partout où la saisie peut contenir un emoji composé : on veut
 * toujours retirer l'espace de largeur nulle collé par un copier-coller, sans
 * démembrer la séquence.
 */
export const INVISIBLES_HORS_JOINTURE =
  /(?!\u200C|\u200D)[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cn}\u2800]/gu;

/**
 * Rend la saisie nettoyée et bornée, ou `null` s'il ne reste rien d'affichable.
 *
 * `null` est délibérément distinct de `""` : l'appelant doit décider quoi en
 * faire plutôt que d'envoyer une chaîne vide à la base.
 *
 * ⚠ **`normalize("NFC")` d'abord, et ce n'est pas décoratif.** « Crémerie »
 * collé depuis une source en NFD s'écrit `e` + U+0301 : une chaîne *différente*
 * de la même en NFC, que `unique (household_id, name)` compare octet à octet et
 * laisse donc coexister. Deux rayons rigoureusement identiques à l'œil, aucun
 * `23505`, et rien pour les distinguer.
 *
 * ⚠ **Le bornage compte des POINTS DE CODE, pas des unités UTF-16.** `slice`
 * coupe au milieu d'une paire de substitution, et la demi-paire qui en sort
 * n'est pas du JSON valide : Postgres rend `22P02`, que `refusRayon` ne traduit
 * pas, donc « Réessaie dans un instant » en boucle. Ce n'est pas théorique — la
 * seconde revue du 2026-07-29 l'a atteint depuis le champ, `maxLength` compris,
 * parce que **NFC peut ALLONGER** : U+1D15E se compose en deux caractères
 * hors-BMP, donc 39 unités saisies en font 77 une fois composées. La première
 * rédaction postulait l'inverse, en toutes lettres.
 *
 * ⚠ **Le `trim()` final n'est pas un doublon du premier.** Le bornage coupe à
 * un nombre de caractères, pas à une frontière de mot : borner « …aaa  b »
 * laisserait une espace en fin de chaîne, et l'unicité de la base en fait un
 * nom distinct.
 */
export function normaliserTexte(saisie: string, maximum: number): string | null {
  const net = saisie.normalize("NFC").replace(INVISIBLES, "").trim();
  if (net === "") return null;

  // `[...net]` itère par points de code : une paire de substitution est un seul
  // élément, donc jamais coupée en deux.
  const borne = [...net].slice(0, maximum).join("").trim();
  return borne === "" ? null : borne;
}
