import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { estUniteConnue, type Unite } from "../recettes/unites.ts";

/**
 * Ajouter un article à la liste du foyer — ou **incrémenter** sa quantité.
 *
 * ⛔ **UN SEUL APPEL, ET C'EST LE SERVEUR QUI DÉCIDE.** AD-6 : « résolution de
 * rayon, agrégation et mise à l'échelle sont autoritaires côté serveur (fonctions
 * SQL). Agrégation = UPSERT-incrémente sur la clé canonique : "ajouter" n'est
 * **jamais** un INSERT nu (FR-5). » Cette fonction n'est donc qu'une porte : elle
 * ne lit rien, ne compare rien, ne décide rien.
 *
 * ⛔ **NE PAS ÊTRE TENTÉ DE LIRE AVANT D'ÉCRIRE.** Deux raisons, et la seconde est
 * fatale :
 *
 * 1. **La ligne qui occupe la clé peut être invisible.** L'index unique est TOTAL :
 *    ni les tombstones ni les articles achetés n'en sont exclus, et
 *    `grocery_list_by_aisle` ne montre ni les uns ni les autres. Mesuré : un
 *    `INSERT` sur une clé tenue par un article acheté rend `23505`, en désignant un
 *    article que la lecture affirme absent.
 * 2. **Un lire-puis-écrire perd une addition.** Deux surfaces qui ajoutent le même
 *    article en même temps liraient la même quantité et écriraient la même somme.
 *    C'est exactement ce que NFR-2 interdit.
 *
 * ⚠️ **Le client est passé EN PARAMÈTRE**, jamais construit ici — motif
 * d'`articlesDuFoyer` et de `basculerStatut`. C'est ce qui rend cette fonction
 * appelable telle quelle par le serveur MCP (Epic 7, qui ajoutera des articles) et
 * **exerçable contre une vraie base** dans `supabase/tests/isolation.test.ts`.
 *
 * ⚠️ **Aucun `household_id` en paramètre.** La fonction SQL le prend de
 * `current_household_id()` ; le laisser passer par l'appelant rendrait la porte
 * capable de désigner un autre foyer — la RLS le refuserait, mais l'erreur serait
 * alors un `42501` illisible plutôt qu'un refus net.
 *
 * @throws si la base refuse l'écriture. ⛔ **Sur un écran client, personne
 * n'attrape ce `throw`** : `app/error.tsx` est une frontière d'erreur de *rendu*,
 * qu'un rejet de promesse dans un callback `async` ne traverse pas. L'appelant doit
 * l'envelopper — voir `ListeCourses`.
 */
export async function ajouterArticle(
  supabase: SupabaseClient<Database>,
  nom: string,
  quantite?: number,
  unite?: Unite
): Promise<void> {
  const { error } = await supabase.rpc("ajouter_article", {
    p_nom: nom,
    /*
     * ⚠️ **On OMET plutôt que de passer `null`.** Les deux paramètres portent un
     * défaut SQL : les omettre laisse Postgres l'appliquer, ce qui est l'intention.
     * Passer `null` dirait la même chose à la base mais ferait mentir la signature
     * générée, qui les rend optionnels.
     */
    ...(quantite === undefined ? {} : { p_quantite: quantite }),
    ...(unite === undefined ? {} : { p_unite: unite }),
  });

  if (error) {
    throw new Error(`Ajout de l'article impossible : ${error.message}`);
  }
}

/**
 * Ce qu'une saisie d'unité vaut, ou `undefined` si le membre n'en a pas choisi.
 *
 * ⚠️ **Le vocabulaire est CLOS et sa source est unique** — `lib/recettes/unites.ts`,
 * dont le docblock dit lui-même : « ce n'est pas une liste d'affichage, c'est un
 * contrat avec l'Epic 4 ». En réécrire une seconde ici la ferait diverger de la
 * contrainte `grocery_list_items_unite_fermee` sans que rien ne le signale.
 *
 * ⛔ **Une valeur hors vocabulaire rend `undefined`, elle n'est pas transmise.**
 * Elle ne peut pas venir du `<select>` de l'écran : si elle arrive, c'est un appel
 * forgé ou un défaut. La laisser passer ferait rendre `23514` par la base — un code
 * que rien ne traduit pour le membre.
 */
export function uniteChoisie(valeur: string): Unite | undefined {
  return estUniteConnue(valeur) ? valeur : undefined;
}
