import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import type { StatutArticle } from "./liste.ts";

/**
 * Poser l'état d'un article de la liste — **à prendre** ou **dans le panier**.
 *
 * ⛔ **UNE VALEUR POSÉE, JAMAIS UN BASCULEMENT RELATIF. C'est tout AD-4.** La
 * fonction reçoit le statut VOULU, elle ne lit pas l'état courant pour l'inverser.
 * La différence n'est pas stylistique :
 *
 * - `status = !status` fait que deux surfaces qui cochent en même temps
 *   **s'annulent** — la seconde écriture défait la première ;
 * - `status = 'bought'` fait que deux surfaces qui cochent en même temps
 *   **convergent** — la seconde écriture confirme la première.
 *
 * C'est l'AC2 (idempotence, NFR-2) obtenu par construction plutôt que par une
 * garde. ⚠️ **Et c'est le bug littéral du produit d'origine**, tracé au PRD :
 * « Cocher / décocher : **Cassé** — case codée en dur, un article acheté ne peut
 * pas revenir » (`prd.md:207`).
 *
 * ⛔ **`intent_at` EST ÉCRIT ICI, ET C'EST UNE DÉCISION (D3).** Mesuré le
 * 2026-08-12 : un `UPDATE` de `status` fait bouger `updated_at` (le trigger du
 * volet 5 tire) mais laisse `intent_at` **à sa valeur d'insertion** — un `default`
 * ne s'applique pas à un `UPDATE`. Or `intent_at` est l'ARBITRE du LWW d'AD-3 :
 * sans cette ligne, toute coche posée d'ici la story 4.10 porterait un arbitre
 * périmé, et la convergence entre appareils n'aurait rien pour trancher. Le défaut
 * ne se voit sur aucun écran et n'est vu par aucune porte ; il se paierait deux
 * stories plus loin, sur des données déjà écrites.
 *
 * ⚠️ **C'est l'horloge du CLIENT, et c'est correct au sens d'AD-3** : la colonne
 * porte l'heure de l'INTENTION, pas celle de l'arrivée. Elle deviendra l'horloge
 * du geste quand l'outbox existera (story 4.9), et la forme ne changera pas.
 *
 * ⚠️ **Aucun filtre `household_id` à la main.** La politique `grocery_update` est
 * ancrée sur `current_household_id()`, en `using` ET en `with check` : la RLS
 * refuse déjà d'écrire sur le foyer d'autrui, et refuse aussi de DÉPLACER une
 * ligne vers un autre foyer. L'écrire ici laisserait croire que c'est le client
 * qui protège, ce qu'AD-1/AD-2 refusent.
 *
 * ⚠️ **Le client est passé EN PARAMÈTRE**, jamais construit ici — motif
 * d'`articlesDuFoyer` et de `rayonsDuFoyer`. C'est ce qui rend cette fonction
 * appelable telle quelle par le dashboard (Epic 5) et le serveur MCP (Epic 7),
 * et **exerçable contre une vraie base** dans `supabase/tests/isolation.test.ts`.
 *
 * @throws si la base refuse l'écriture. ⛔ **Sur un écran client, personne
 * n'attrape ce `throw`** : `app/error.tsx` est une frontière d'erreur de *rendu*,
 * qu'un rejet de promesse dans un callback `async` ne traverse pas. L'appelant
 * doit l'envelopper — voir `ListeCourses`.
 */
export async function basculerStatut(
  supabase: SupabaseClient<Database>,
  articleId: string,
  statut: StatutArticle
): Promise<void> {
  const { error } = await supabase
    .from("grocery_list_items")
    .update({ status: statut, intent_at: new Date().toISOString() })
    .eq("id", articleId);

  /*
   * ⚠️ **On lit `error`, et on ne lit PAS le nombre de lignes touchées.** Zéro
   * ligne n'est pas une erreur ici, et surtout ce n'est pas distinguable d'un
   * succès : PostgREST rend `error: null` aussi bien quand la ligne a été mise à
   * jour que quand la RLS l'a rendue invisible. Exiger « exactement une ligne »
   * demanderait un `.select()` de retour, donc une lecture de plus à chaque
   * coche, dans un magasin, sur réseau instable — et cela n'ajouterait aucune
   * garantie de sécurité, la RLS étant déjà seule garante (AD-1/AD-2).
   *
   * ⛔ **Ce que ça implique pour l'appelant** : une coche sur un article qui
   * n'est plus à soi « réussit » silencieusement. C'est le comportement voulu
   * d'un système convergent — la prochaine lecture rétablira la vérité — et non
   * un trou à combler côté client.
   */
  if (error) {
    throw new Error(`Bascule de l'article impossible : ${error.message}`);
  }
}

/**
 * Le statut que vaut un article après le geste, à partir de la case rendue.
 *
 * ⚠️ **Une fonction plutôt qu'un ternaire en ligne, pour UNE raison** : c'est le
 * seul endroit où « la case est cochée » se traduit en « l'article est acheté ».
 * Le laisser dans le JSX le rendait intestable (NFR-10 interdit un harnais de
 * composants), et c'est exactement la leçon que la revue de la 4.2 a payée sur
 * l'accord des unités.
 */
export function statutApresGeste(caseCochee: boolean): StatutArticle {
  return caseCochee ? "bought" : "pending";
}
