import { type Unite } from "../recettes/unites.ts";

/**
 * Arrondir une quantité mise à l'échelle à une valeur **achetable** (D7, FR-52).
 *
 * ⛔ **CETTE FONCTION NE S'EXÉCUTE PAS EN PRODUCTION, ET IL FAUT LE SAVOIR EN LA LISANT.**
 * Mesuré en revue le 2026-08-21 : elle n'est importée que par ses propres tests et par
 * l'invariant. **La règle qui tourne est la SQL** — `public.arrondir_pour_achat`, appelée
 * par la génération, parce que D1(a) met la boucle dans la base et que c'est donc la base
 * qui écrit la quantité.
 *
 * ⛔ **Conséquence à ne pas se cacher** : le banc de mutations de ce module mesure les dents
 * des tests de CETTE copie, pas celles de la règle qui s'exécute. La story 4.7 revendiquait
 * « 8 mutations sur 8 tuées » sans le dire — c'est corrigé partout, et un banc distinct porte
 * désormais sur le SQL.
 *
 * ⚠️ **Elle reste, et elle sert à deux choses réelles** : elle énonce la règle en français
 * lisible, et elle est l'**oracle indépendant** de l'invariant — sans elle, le test comparerait
 * le SQL à lui-même, ce qui ne prouverait rien.
 *
 * ⛔ **CETTE RÈGLE EXISTE DONC EN DEUX EXEMPLAIRES, ET C'EST DÉLIBÉRÉ.** La contrepartie
 * est `public.arrondir_pour_achat(numeric, text)`, posée par la migration
 * `20260821110000`. Deux défauts prescrits de la story 4.7 se contredisaient :
 * D7 disait « jamais dans le SQL », D1(a) mettait la boucle de génération DANS la
 * base — donc c'est la base qui écrit la quantité, donc c'est elle qui l'arrondit.
 * Un arrondi qui ne vivrait qu'ici n'arrondirait rien de ce qui est stocké.
 *
 * ⚠️ **Le dépôt a déjà tranché ce genre de tension deux fois** : `UNITES` et
 * `SURFACES` vivent en TypeScript, leur contrepartie vit en base, et l'accord entre
 * les deux est **mesuré** — jamais affirmé. C'est la règle §4. L'invariant est figé
 * par `supabase/tests/contraintes.test.ts`, qui fait tourner les deux implémentations
 * sur les mêmes entrées.
 *
 * ⛔ **Ne PAS « améliorer » l'une sans l'autre.** Le test échouera, et c'est son
 * travail.
 */

/**
 * Les unités qu'on achète à l'unité entière.
 *
 * ⚠️ **`pièce` est seule ici, et c'est mesuré, pas supposé** : le vocabulaire clos
 * d'AD-7 est `g, kg, ml, L, pièce, cs, cc, pincée`. Les quatre premières sont des
 * mesures continues, les trois dernières des gestes de cuisine.
 */
const DENOMBRABLES: readonly string[] = ["pièce"];

/**
 * Les gestes de cuisine, qu'on arrondit au demi.
 *
 * ⚠️ Personne ne dose 1,67 cuillère. Afficher une telle précision prétendrait que le
 * geste en a une.
 */
const GESTES_DE_CUISINE: readonly string[] = ["cs", "cc", "pincée"];

/**
 * @param quantite La quantité mise à l'échelle, éventuellement fractionnaire.
 *   `null` quand la recette n'en donne pas — on n'en invente pas une.
 * @param unite L'unité, ou `null` si l'ingrédient n'en porte pas.
 */
export function arrondirPourAchat(
  quantite: number | null,
  unite: Unite | string | null
): number | null {
  if (quantite === null) return null;

  /*
   * ⛔ **VERS LE HAUT, JAMAIS AU PLUS PROCHE.** « Jamais 1,67 oignon » est la
   * formulation de l'epic, mais arrondir 1,2 à 1 ferait *manquer* un oignon à la
   * recette. Une liste de courses se trompe du bon côté.
   */
  if (unite !== null && DENOMBRABLES.includes(unite)) return Math.ceil(quantite);

  if (unite !== null && GESTES_DE_CUISINE.includes(unite)) {
    /*
     * ⛔ **LE PLANCHER À UN DEMI N'EST PAS UN ORNEMENT — IL EMPÊCHE UN INGRÉDIENT DE
     * DISPARAÎTRE.** L'arrondi au demi tout nu rend `0` pour toute quantité sous 0,25 :
     * `Math.round(0.1 * 2) / 2 === 0`. Une pincée de safran sortirait de la liste sans
     * un mot, et le membre s'en apercevrait devant ses fourneaux.
     *
     * ⚠️ **Trouvé par le test, pas par la relecture** — la première rédaction de cette
     * fonction avait le défaut, et l'assertion « un demi n'est jamais écrasé à zéro »
     * l'a fait tomber. La contrepartie SQL portait la même faute, corrigée en même temps.
     *
     * ⚠️ **`> 0` et non `>= 0`** : une quantité de zéro reste zéro. Le plancher relève
     * une quantité trop petite, il n'en invente pas là où il n'y en a pas.
     */
    /*
     * ⚠️ **PAS DE BRANCHE « SINON ARRONDIR QUAND MÊME ».** Un banc de mutations a montré
     * qu'elle était morte : à zéro, `round(0 * 2) / 2` et `round(0)` valent tous deux
     * zéro, donc aucun test ne pouvait distinguer une version fautive d'une version
     * juste. Une branche qu'aucun test ne peut atteindre n'est pas couverte, elle est
     * seulement invisible. Zéro sort donc tel quel, et il n'y a plus rien à muter.
     */
    return quantite > 0 ? Math.max(0.5, Math.round(quantite * 2) / 2) : quantite;
  }

  /*
   * ⛔ **LES UNITÉS CONTINUES RESTENT INTACTES**, et c'est le contre-exemple qui a
   * écarté l'option (b) de D7 : arrondir 1,2 kg de farine au supérieur donnerait
   * 2 kg — une erreur d'un facteur proche de 2.
   *
   * ⚠️ **Une unité INCONNUE tombe ici aussi, et c'est voulu** : ne rien faire est le
   * seul comportement qui ne peut pas fausser une quantité. Le vocabulaire est
   * verrouillé par une contrainte en base ; si une valeur hors vocabulaire arrive
   * jusqu'ici, c'est un défaut ailleurs, et l'arrondi n'est pas l'endroit où le
   * rattraper en silence.
   */
  return quantite;
}
