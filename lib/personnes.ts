import { normaliserEntier } from "./recettes/saisie.ts";

/**
 * La saisie d'un nombre de personnes : ce qu'elle vaut, ou **pourquoi** elle est
 * refusée.
 *
 * **Pourquoi ce module vit à la racine de `lib/` et non sous `lib/menu/`.** Deux
 * surfaces le consomment, et elles n'appartiennent pas au même domaine : le
 * réglage du foyer (`households.default_servings`, écran `/foyer`) et
 * l'assignation d'un repas (`meal_plan_entries.servings`, écran
 * `/menu/[jour]/[repas]`). Le ranger sous l'un ferait importer l'autre depuis un
 * domaine qui n'est pas le sien. C'est la même raison qui a fait sortir
 * `lib/ordre.ts` de `lib/rayons/`, et l'extraction de `useSoumission` a déjà eu à
 * réparer ce que deux copies deviennent.
 *
 * ⚠️ **Rend la FAUTE, pas seulement `null`.** La première rédaction des quantités
 * d'ingrédients confondait « ce n'est pas un nombre » et « ce nombre est hors
 * bornes », et répondait « Une quantité s'écrit en chiffres. » à quelqu'un qui
 * venait d'écrire « 1000000 » — un conseil qu'il avait déjà suivi. Revue
 * adversariale du 2026-08-03 ; la leçon est appliquée ici avant d'être répétée.
 *
 * ⚠️ **La frontière DURE est en base** (AD-1/AD-2) :
 * `meal_plan_entries_servings_positif` et `households_default_servings_positif`
 * (`20260804144217`). Celle-ci rend un message au lieu d'un `23514`. Que les deux
 * côtés soient d'accord est **mesuré** par `supabase/tests/contraintes.test.ts`,
 * jamais affirmé — c'est la règle §4, et le projet a déjà payé trois fois pour
 * l'avoir affirmée.
 */
export type PersonnesAnalysees =
  | { valeur: number }
  | { faute: "illisible" | "trop-peu" };

export function analyserPersonnes(saisie: string): PersonnesAnalysees {
  /*
   * `normaliserEntier` porte déjà les trois pièges du champ numérique, et son
   * en-tête les explique : `Number("")` vaut 0, `parseInt("")` rend `NaN` que
   * `JSON.stringify` transforme en `null` **en silence** sur une colonne
   * `not null`, et `type="number"` accepte « 2e3 ». Il borne aussi à l'`int`
   * Postgres, ce qui évite un `22003` que rien ne traduirait.
   */
  const valeur = normaliserEntier(saisie);
  if (valeur === null) return { faute: "illisible" };

  /*
   * ⚠️ **Le zéro et le négatif sont RENDUS par `normaliserEntier`, et refusés
   * ici.** Le partage est délibéré et repris de `normaliserQuantite` : « ce n'est
   * pas un entier » est une règle de FORME, « un repas pour zéro personne n'a pas
   * de sens » est une règle MÉTIER. La seconde a sa contrepartie en base ; la
   * première n'en a pas besoin.
   */
  if (valeur <= 0) return { faute: "trop-peu" };

  return { valeur };
}
