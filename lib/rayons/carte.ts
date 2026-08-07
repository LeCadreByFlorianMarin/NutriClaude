import { normaliserIcone, normaliserNomRayon } from "./saisie.ts";

/**
 * Le pur de la carte-rayon (story 2.4).
 *
 * ⚠ **PRÉSENTATEUR, PAS DOMAINE.** Ce fichier convertit un compte en chaînes
 * rendues (la forme visible et son annonce) et pose les replis d'affichage.
 * **Aucune règle de rayon ici** — celles-là vivent en Postgres, et AD-1/AD-2
 * l'exigent : « la règle métier vit en Postgres, jamais dans la vigilance
 * d'une surface ».
 *
 * ⚠ **Sa place dans `lib/` est un choix de commodité, pas une contrainte.**
 * `package.json` fait foi ; état au 2026-08-07 : le script `test` ne globe que
 * `lib/`, donc un test posé ici s'exécute sans rien changer à l'outillage.
 * ⛔ **Ce n'est PAS le seul emplacement testable, contrairement à ce que les
 * trois copies de ce commentaire affirmaient jusqu'au 2026-08-07.** Mesuré à la
 * seconde passe de revue : `node --test` lancé sur un glob visant `app/` exécute
 * très bien un `.test.ts` posé là. La contrainte réelle est que **`node --test`
 * refuse un `.tsx`** (`ERR_UNKNOWN_FILE_EXTENSION`), ce qui ferme les tests de
 * composant — pas les tests de présentateur. Déplacer ce fichier vers
 * `app/_lib/` reste donc possible ; ça exigerait d'étendre le glob **et** la
 * garde de comptage de la CI, et Florian a tranché pour ne pas le faire.
 *
 * ⚠ **Le client est absent, et c'est voulu** : ces fonctions ne lisent rien.
 * L'AC3 de la story 2.4 l'exige — le composant « est éprouvé sans liste ni
 * base », et c'est ce qui le rend démontrable dans l'Epic 2, là où les critères
 * qui exigeaient une liste ont été déplacés en Epic 4.
 */

/**
 * Le ratio d'un rayon, sous ses **deux** formes — celle qu'on voit et celle
 * qu'on entend.
 *
 * ⚠ **L'annonce est DÉRIVÉE du visible, elle n'est pas construite en parallèle.**
 * `review-accessibility.md` classe en défaut le ratio « `3/4` » rendu sans
 * label : un lecteur d'écran annonce « trois barre oblique quatre », ou rien.
 * Deux chaînes bâties côte à côte se périmeraient en silence — on corrigerait
 * l'une, jamais l'autre.
 *
 * ⚠ **C'est une CONVENTION qui rend la divergence improbable, pas une
 * construction qui l'empêche — et la nuance a coûté une passe de revue.** La
 * rédaction du 2026-08-07 écrivait « seule la dérivation rend la divergence
 * inexprimable ». ⛔ **Mesuré à la seconde passe, par deux couches
 * indépendamment : c'est faux.** Remplacer cette dérivation par une construction
 * parallèle — `` `${borne} sur ${total} pris` `` — laisse la suite entière verte
 * (216/216) et franchit les cinq portes. Ce qui est vrai, et qui suffit : aucune
 * assertion ne peut distinguer deux implémentations aujourd'hui équivalentes,
 * donc **rien d'automatique ne défendra cet invariant** ; il tient parce qu'il
 * est écrit ici, et il tombera le jour où quelqu'un réécrira ces deux lignes
 * sans lire ce paragraphe.
 */
export type RatioDeRayon = {
  /** Ce qui s'affiche : `"3/4"`. À rendre en `tabular-nums` (UX-DR12). */
  visible: string;
  /** Ce qui s'annonce : `"3 sur 4 pris"`. Dérivé de `visible`, jamais rebâti. */
  pourLecteur: string;
};

/**
 * Rend le ratio d'un rayon, ou `null` quand il n'y a rien à dire.
 *
 * ⚠ **Les paramètres sont NOMMÉS et non positionnels.** Deux nombres de même
 * type côte à côte rendent l'inversion indétectable : `libelleRatio(4, 3)`
 * rendait `"3/3"` — le bornage transformait l'erreur d'appel en résultat
 * crédible, exactement le défaut qu'il devait prévenir. D2 annonce trois
 * appelants (4.2, 4.17, dashboard) ; l'inversion cesse d'être exprimable.
 *
 * `null` couvre trois familles de cas, et toutes sont nominales :
 *
 * - **`total` n'est pas un entier strictement positif** — un rayon vide.
 *   « 0/0 » n'apprend rien et encombre l'annonce ; le rayon reste rendu, sans
 *   ratio (AC2 : un rayon sans article est un rayon de première classe).
 * - **`pris` est absent ou nul** — l'appelant n'a pas de compte à donner.
 *   L'AC1 conditionne le ratio à « recevoir un rayon **et un compte
 *   d'articles** » : une surface de configuration peut monter la carte sans
 *   inventer un chiffre. ⚠ **`null` compte comme absent** : une colonne de
 *   comptage vide ne veut pas dire « zéro pris ».
 * - **un chiffre qui n'est pas un entier fini** — voir plus bas.
 *
 * ⚠ **`pris = 0` avec `total > 0` rend bien `0/4`**, et ce n'est pas un défaut :
 * c'est l'état nominal de toute la liste jusqu'à la story 4.3. La vue
 * `grocery_list_by_aisle` filtre `status = 'pending'`, donc aucun article n'est
 * « pris » tant que rien ne coche.
 *
 * ⚠ **Les chiffres sont bornés plutôt que crus — mais le bornage ne sait pas
 * tout faire.** La carte les reçoit en propriétés : elle ne contrôle pas qui
 * les calcule. Rendre « 5/4 » serait un défaut visible que le membre ne
 * pourrait pas s'expliquer, et l'annoncer serait pire ; on borne, et le défaut
 * reste chez celui qui a mal compté. ⛔ **`Math.min`/`Math.max` PROPAGENT
 * `NaN`** : un `reduce` sur un champ nul suffisait à rendre « NaN sur 4 pris »
 * à un lecteur d'écran (mesuré à la revue du 2026-08-07). Un chiffre non entier
 * ou non fini ne se borne pas — il ne s'affiche pas.
 */
export function libelleRatio({
  pris,
  total,
}: {
  pris?: number | null;
  total: number;
}): RatioDeRayon | null {
  // ⚠ **Cette branche est REDONDANTE, et elle est gardée pour l'intention.**
  // Mesuré à la seconde passe du 2026-08-07 : la réduire à `=== undefined`
  // laisse la suite verte, parce que `Number.isInteger(null)` vaut `false` et
  // que le garde suivant rattrape donc `null`. Elle reste écrite parce que
  // « absent » et « pas un entier » sont deux raisons DIFFÉRENTES de ne rien
  // afficher, et que la seconde est un accident de typage plutôt qu'une règle.
  if (pris === undefined || pris === null) return null;
  if (!Number.isInteger(pris) || !Number.isInteger(total)) return null;
  if (total <= 0) return null;

  const borne = Math.min(Math.max(pris, 0), total);

  // ⚠ `pourLecteur` se DÉRIVE de `visible`. Voir `RatioDeRayon` : c'est une
  // convention, pas une garantie — rien d'automatique ne la défend.
  const visible = `${borne}/${total}`;
  return {
    visible,
    pourLecteur: `${visible.replace("/", " sur ")} pris`,
  };
}

/**
 * Le libellé de repli d'un rayon sans nom.
 *
 * ⚠ **C'est un repli TECHNIQUE, pas une décision de microcopy.** La vue
 * `grocery_list_by_aisle` fait un `left join` sur `aisles` : un article dont le
 * rayon n'a pas été résolu rend `aisle_name = null`. La story 4.2 type donc son
 * groupe `nom: string | null`, et sans ce repli elle se retrouverait avec `null`
 * face à une propriété `string` — sans qu'aucune story ne possède le libellé.
 *
 * ⚠ **La story 4.17 garde le dernier mot.** C'est elle qui possède le groupe
 * « À classer » : sa position en fin de parcours, son non-repli, son effacement
 * quand il est vide. Le jour où elle changera ce libellé, elle le changera
 * **ici**, à un seul endroit — c'est la raison d'être de cette fonction.
 *
 * ⚠ **ENVELOPPE de `normaliserNomRayon`, et c'est la décision D2 de la seconde
 * passe de revue (2026-08-07).** La première rédaction refaisait la moitié du
 * nettoyage de `saisie.ts` — invisibles et `trim()` — en **omettant** la
 * composition NFC et le bornage, tout en écrivant « même choix que
 * `lib/rayons/saisie.ts` ». Deux nettoyages qui se disent identiques et ne le
 * sont pas, c'est exactement l'invariant que la règle §4 veut mesuré plutôt
 * qu'affirmé. Déléguer supprime la question : **la carte affiche ce que la
 * saisie enregistre, par construction.**
 *
 * ⚠ **Conséquence à connaître : le nom est borné à `MAX_NOM_RAYON` ici aussi.**
 * Rien ne le borne en base (`aisles` ne porte qu'`aisles_name_non_vide`, pas de
 * contrainte de longueur — mesuré), et la carte reçoit son nom d'une vue : sans
 * ce bornage, un nom écrit par une autre surface s'étirerait sans fin dans le
 * `<h2>`.
 */
export function nomDeRayon(nom: string | null): string {
  return (nom === null ? null : normaliserNomRayon(nom)) ?? "À classer";
}

/**
 * L'icône d'un rayon, ou `null` s'il n'y a rien à montrer.
 *
 * ⚠ **Sa raison d'être : la pastille porte un aplat abricot.** Une icône faite
 * d'espaces ou d'invisibles est *vraie* au sens de JavaScript, et affichait donc
 * un carré abricot **vide** — or UX-DR2 réserve l'abricot à l'action courses et
 * interdit l'abricot décoratif, a fortiori vide. Le garde ne peut pas être une
 * vérité nue.
 *
 * ⚠ **ENVELOPPE de `normaliserIcone` (décision D2, 2026-08-07).** Elle apporte
 * trois choses que la rédaction précédente n'avait pas, et dont deux étaient des
 * défauts mesurés à la seconde passe de revue :
 *
 * - **les jointures ORPHELINES sont retirées.** `iconeDeRayon("‍")` rendait
 *   une chaîne *vraie* mais invisible, donc précisément le carré abricot vide
 *   que cette fonction existe pour empêcher — vu sur le HTML prérendu.
 *   `saisie.ts` avait déjà écrit et payé le remède (`JOINTURES_AU_BORD`) ;
 * - **la réduction au premier grapheme.** La propriété est typée `string`, pas
 *   « un point de code » : une icône de plusieurs glyphes débordait la pastille
 *   de 24 px par-dessus le `<h2>` ;
 * - **la composition NFC**, qui manquait.
 *
 * ⛔ **CE QUE CETTE FONCTION NE RÉPARE PAS, ET QUI EST REPORTÉ.**
 * `INVISIBLES_HORS_JOINTURE` exclut ZWJ et ZWNJ, **mais pas U+FE0F** (le
 * sélecteur de variante), qui est `Cf` et `Default_Ignorable`. Mesuré :
 * ❤️ → ❤ (glyphe texte noir), 🏳️‍🌈 et 1️⃣ démembrés, 🏴 d'Écosse réduit à 🏴.
 * ⚠ **La racine est à la SAISIE** — `normaliserIcone` applique la même plage,
 * donc un membre qui choisit ❤️ enregistre déjà ❤ : ce n'est pas l'affichage qui
 * casse l'emoji. Reporté par décision de Florian du 2026-08-07 à une story
 * dédiée, avec ses mesures, dans `deferred-work.md`.
 */
export function iconeDeRayon(icone: string | null): string | null {
  return icone === null ? null : normaliserIcone(icone);
}
