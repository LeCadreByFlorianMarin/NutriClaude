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

/**
 * Même plage, **sans le saut de ligne**. À employer sur tout champ dont les
 * retours à la ligne sont porteurs de sens.
 *
 * ⚠ **Écrite par EXCLUSION, jamais en listant ce qu'on garde.** Même forme et
 * même raison qu'`INVISIBLES_HORS_JOINTURE` : la plage de départ est une
 * catégorie Unicode qui s'enrichit à chaque version, et une énumération écrite à
 * la main ne peut pas gagner contre elle.
 *
 * ⚠ **Pas le drapeau `v`** (soustraction d'ensembles) : la cible TypeScript de
 * ce projet ne l'accepte pas. L'anticipation négative fait le même travail.
 */
const INVISIBLES_HORS_SAUT_DE_LIGNE =
  /(?!\n)[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cn}⠀]/gu;

/**
 * Comme `normaliserTexte`, **mais les retours à la ligne survivent**.
 *
 * ⚠ **LA RAISON D'ÊTRE DE CETTE FONCTION, ET IL FAUT LA LIRE AVANT DE CHOISIR
 * ENTRE LES DEUX.** `normaliserTexte` **détruit tous les sauts de ligne** : sa
 * plage `INVISIBLES` contient `\p{Cc}`, la catégorie « contrôle », qui comprend
 * U+000A. Mesuré :
 *
 *     normaliserTexte("Étape 1\nÉtape 2\n\nÉtape 3", 4000)
 *     // → "Étape 1Étape 2Étape 3"
 *
 * Sur un champ d'une ligne — prénom, nom de foyer, nom de rayon — c'est
 * exactement ce qu'on veut : un saut de ligne collé y est une saisie cassée.
 * Sur `recipes.instructions`, c'est une **perte de données silencieuse**. Le
 * texte s'enregistre, il s'affiche, il est simplement aplati, et rien ne le
 * signale — ni typage, ni lint, ni test, ni contrainte. C'est pour ça que les
 * deux fonctions vivent côte à côte : les séparer ferait resurgir le piège.
 *
 * Ce qu'elle fait de plus que sa voisine : les fins de ligne Windows (`\r\n`) et
 * Mac historiques (`\r` seul) sont ramenées à `\n`. Un copier-coller depuis un
 * traitement de texte ou un PDF en transporte, et rien d'autre ne les
 * retirerait — `\r` est lui aussi dans `\p{Cc}`, donc il partirait sans laisser
 * de saut de ligne à sa place, collant deux lignes l'une à l'autre.
 *
 * ⚠ **Seuls les BORDS sont rognés.** « Étape 1\n\nÉtape 2 » porte une ligne
 * vide intérieure qui est une mise en forme voulue, pas une saisie sale.
 */
export function normaliserMultiligne(
  saisie: string,
  maximum: number
): string | null {
  const net = saisie
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLES_HORS_SAUT_DE_LIGNE, "")
    .trim();
  if (net === "") return null;

  const borne = [...net].slice(0, maximum).join("").trim();
  return borne === "" ? null : borne;
}
