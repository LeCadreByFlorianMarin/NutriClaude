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

import { estUniteConnue, type Unite } from "./recettes/unites.ts";

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
 *
 * ⛔ **ÉCARTE AUSSI LES VALEURS NON FINIES, et c'est une correction de revue du
 * 2026-08-12.** Seul `=== null` était testé. Mesuré alors : `formaterQuantite(NaN)`
 * rendait `"NaN"`, `Infinity` rendait `"∞"`, `-Infinity` `"-∞"` — et
 * `ListeCourses` les affichait tels quels, « **NaN kg** » à droite de la ligne.
 * ⚠️ **Ce n'est pas théorique** : `quantity` est un `numeric(8,2)` **sans aucune
 * contrainte** (la positivité est reportée à la 4.4, écrit dans l'en-tête de
 * `20260805092611`), `numeric` accepte le littéral `'NaN'`, et l'écriture est
 * client-direct. Le présentateur frère a déjà payé exactement ça —
 * `lib/rayons/carte.ts` a reçu son `Number.isInteger` le 2026-08-07 parce qu'un
 * « NaN sur 4 pris » atteignait un lecteur d'écran.
 */
export function formaterQuantite(quantite: number | null): string | null {
  if (quantite === null || !Number.isFinite(quantite)) return null;
  return rendreNombre(quantite);
}

/** Le rendu du nombre seul, une fois la finitude acquise. */
function rendreNombre(quantite: number): string {
  return quantite.toLocaleString(LOCALE, {
    useGrouping: false,
    maximumFractionDigits: 2,
  });
}

/**
 * Les unités qui s'accordent en nombre — **exhaustif PAR LE TYPE, pas par une
 * liste**.
 *
 * ⚠️ **C'est la règle §3 respectée, pas contournée.** « Une énumération ne peut
 * pas gagner contre une catégorie » vise les ensembles qu'on ne contrôle pas.
 * Celui-ci est **clos et contraint en base** (`grocery_list_items_unite_fermee`),
 * sa source unique est `lib/recettes/unites.ts`, et l'accord entre cette source
 * et la contrainte est déjà **mesuré** par `supabase/tests/contraintes.test.ts`.
 *
 * ⛔ **Le `Record<Unite, …>` est la garde** : ajouter un neuvième jeton à `UNITES`
 * **casse la compilation ici** tant que personne n'a dit s'il s'accorde. Une
 * `Set` de deux valeurs aurait laissé le neuvième passer en silence.
 *
 * Six des huit sont des symboles (`g`, `kg`, `ml`, `L`, `cs`, `cc`) : un symbole
 * d'unité ne prend pas la marque du pluriel en français. Deux sont des noms
 * communs, et ils la prennent.
 */
const ACCORDE_EN_NOMBRE: Record<Unite, boolean> = {
  g: false,
  kg: false,
  ml: false,
  L: false,
  cs: false,
  cc: false,
  pièce: true,
  pincée: true,
};

/**
 * Une quantité SUIVIE DE SON UNITÉ, accordée en nombre, ou `null`.
 *
 * ⛔ **NÉ D'UN DÉFAUT DE REVUE (2026-08-12) : l'écran affichait « 2 pièce ».**
 * L'appariement vivait dans le JSX de `ListeCourses`, donc **aucun test ne
 * pouvait l'atteindre** — NFR-10 interdit un harnais de composants. Le descendre
 * ici est ce qui rend le cas couvrable ; c'est la raison du déplacement, pas un
 * rangement.
 *
 * ⚠️ **La règle française est « pluriel à partir de 2 »**, donc 1,5 reste au
 * singulier — « 1,5 pièce ». C'est bien 1,5 et non 2 la frontière.
 *
 * ⚠️ **C'est la QUANTITÉ qui commande.** Une unité qualifie un nombre : sans
 * nombre elle ne veut rien dire, alors qu'un nombre nu (« 3 ») en dit déjà
 * quelque chose. Le couple `(null, 'kg')` rend donc `null` — il est possible,
 * mesuré : rien ne couple les deux colonnes en base.
 *
 * ⚠️ **Une unité hors vocabulaire est rendue TELLE QUELLE, sans accord.** Elle ne
 * peut pas venir de l'application (contrainte en base + `<select>`), donc si elle
 * arrive, c'est un appel forgé ou un défaut : la déformer masquerait le signal.
 */
export function formaterQuantiteEtUnite(
  quantite: number | null,
  unite: string | null
): string | null {
  if (quantite === null || !Number.isFinite(quantite)) return null;

  const rendu = rendreNombre(quantite);
  if (unite === null) return `${rendu}`;

  const accorde = estUniteConnue(unite) && ACCORDE_EN_NOMBRE[unite] && quantite >= 2;
  return `${rendu} ${accorde ? `${unite}s` : unite}`;
}
