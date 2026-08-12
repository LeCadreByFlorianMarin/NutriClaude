/**
 * Le pur de l'affichage d'une recette : mettre en français ce que la base rend
 * en nombres.
 *
 * ⚠️ **`formaterQuantite` n'habite plus ici** — c'est une règle de quantité, et
 * elle a un appelant hors des recettes depuis la story 4.2. Elle vit dans
 * `lib/quantite.ts` et n'est ré-exportée ici que pour les appelants existants.
 *
 * **Pourquoi un module, et pas trois expressions dans le JSX.** Les
 * fonctions ci-dessous portent chacune une règle qu'un test peut tenir, là où le
 * JSX n'est couvert par rien (NFR-10 interdit le harnais de composants). C'est le
 * même partage que `lib/recettes/saisie.ts` : le pur descend dans `lib/`, le
 * reste s'éprouve à l'œil.
 *
 * ⚠️ **Toutes rendent `null` — jamais `""` — quand il n'y a rien à dire.** C'est
 * ce qui permet à l'écran de ne rendre AUCUN nœud, plutôt qu'un `<span>` vide qui
 * laisserait une espace ou une marge. AC3 est un critère d'absence.
 */

/*
 * ⚠️ **`formaterQuantite` A DÉMÉNAGÉ dans `lib/quantite.ts` le 2026-08-07** —
 * décision D-5 de la revue de la story 4.2. C'est une règle de QUANTITÉ, pas de
 * recette, et elle a désormais un appelant qui n'est pas une recette
 * (`app/courses/ListeCourses.tsx`). Ré-exportée ici pour ne casser aucun
 * appelant existant ; les nouveaux l'importent depuis `@/lib/quantite`.
 */
export { formaterQuantite } from "../quantite.ts";

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
