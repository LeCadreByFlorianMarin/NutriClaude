/**
 * Le pur de l'affichage d'une recette : mettre en français ce que la base rend
 * en nombres.
 *
 * **Pourquoi un module, et pas trois expressions dans le JSX.** Les trois
 * fonctions ci-dessous portent chacune une règle qu'un test peut tenir, là où le
 * JSX n'est couvert par rien (NFR-10 interdit le harnais de composants). C'est le
 * même partage que `lib/recettes/saisie.ts` : le pur descend dans `lib/`, le
 * reste s'éprouve à l'œil.
 *
 * ⚠️ **Toutes rendent `null` — jamais `""` — quand il n'y a rien à dire.** C'est
 * ce qui permet à l'écran de ne rendre AUCUN nœud, plutôt qu'un `<span>` vide qui
 * laisserait une espace ou une marge. AC3 est un critère d'absence.
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

/**
 * Le temps de la recette, ou `null` quand il n'y a rien à dire.
 *
 * ⚠️ **`=== null` et jamais `if (!temps)`.** C'est LE piège de cette fonction.
 * `0` est une valeur **saisie** — « pas de cuisson » — et `null` veut dire « non
 * renseigné ». Un test de véracité attrape les deux et confond « je n'ai pas
 * répondu » avec « il n'y en a pas », **en silence** : les quatre cas deviennent
 * trois sans que rien ne le signale. Décision de Florian du 2026-08-02.
 *
 * ⚠️ **Les deux temps ne s'additionnent JAMAIS.** La story 3.1 a gardé deux
 * champs parce qu'un livre de cuisine sépare le temps actif du temps passif ; les
 * fusionner à l'affichage défairait la décision, et annoncerait « 45 min » pour
 * une recette qui ne demande que 15 min de présence.
 */
export function formaterTemps(
  preparationMin: number | null,
  cuissonMin: number | null
): string | null {
  const morceaux: string[] = [];
  if (preparationMin !== null) morceaux.push(`${preparationMin} min de préparation`);
  if (cuissonMin !== null) morceaux.push(`${cuissonMin} min de cuisson`);

  return morceaux.length === 0 ? null : morceaux.join(", ");
}

/**
 * Le nombre de personnes, accordé.
 *
 * Jamais `null` : `recipes_servings_positif` (story 3.1) garantit `servings > 0`
 * en base, et `servings` est `not null`. Il y a donc toujours quelque chose à
 * dire, et traiter l'absence ici serait du code mort qui suggère une possibilité
 * qui n'existe pas.
 */
export function formaterPortions(portions: number): string {
  return `Pour ${portions} personne${portions > 1 ? "s" : ""}`;
}
