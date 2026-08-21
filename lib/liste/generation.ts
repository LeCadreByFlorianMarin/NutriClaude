import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

/**
 * Générer la liste de courses depuis le menu de la semaine (AC1, AC2, FR-16).
 *
 * ⛔ **UN SEUL APPEL, ET TOUT SE DÉCIDE EN BASE.** AD-6 : agrégation, mise à
 * l'échelle et résolution de rayon sont autoritaires côté serveur. Cette fonction
 * n'est qu'une porte — elle ne lit rien, n'agrège rien, n'arbitre rien.
 *
 * ⛔ **NE PAS ÊTRE TENTÉ DE BOUCLER ICI.** Faire lire les ingrédients au client
 * puis appeler `ajouterArticle` article par article coûterait N allers-retours et,
 * surtout, ferait perdre l'arbitrage de l'AC3 : l'intention de génération est prise
 * **une fois**, en base, avant la boucle. Prise côté client, deux articles supprimés
 * à la même seconde seraient arbitrés différemment.
 *
 * ⚠️ **Le client est passé EN PARAMÈTRE**, jamais construit ici — motif de toutes
 * les portes de `lib/liste/`. C'est ce qui la rend exerçable contre une vraie base
 * dans `supabase/tests/isolation.test.ts`, et appelable par le serveur MCP (Epic 7).
 *
 * ⚠️ **Les bornes sont des dates, pas des instants.** `p_start_date` et `p_end_date`
 * sont inclusives (`between`), et la base compare à `meal_plan_entries.meal_date`.
 *
 * @returns Le nombre d'articles **effectivement** ajoutés ou incrémentés — jamais le
 *   nombre d'ingrédients du menu. Les deux diffèrent : un article dont la suppression
 *   est plus récente que la génération n'est pas ressuscité (AC3), et deux
 *   ingrédients qui partagent la clé canonique ne comptent que pour un.
 *
 * @throws si la base refuse. ⛔ **Sur un écran client, personne n'attrape ce
 * `throw`** : `app/error.tsx` est une frontière d'erreur de *rendu*, qu'un rejet de
 * promesse dans un callback `async` ne traverse pas. L'appelant doit l'envelopper.
 */
export async function genererLaListe(
  supabase: SupabaseClient<Database>,
  debut: string,
  fin: string
): Promise<number> {
  const { data, error } = await supabase.rpc("generate_grocery_list_from_menu", {
    p_start_date: debut,
    p_end_date: fin,
  });

  if (error) {
    throw new Error(`Génération de la liste impossible : ${error.message}`);
  }

  /*
   * ⚠️ **`?? 0` PLUTÔT QU'UN `!`.** La signature générée rend le compte nullable ;
   * un menu vide rend `0` et non `null`, mais l'affirmer par `!` ferait dépendre le
   * compte rendu d'une promesse non tenue par le type. Zéro est une réponse valide,
   * et elle a sa propre phrase.
   */
  return data ?? 0;
}

/**
 * Ce que la génération annonce au membre (AC2, FR-17).
 *
 * ⛔ **LA PHRASE VIT ICI, PAS DANS LE JSX**, et le dépôt a payé cette leçon deux
 * fois : « 2 pièce » dans la carte-rayon (story 4.2), et `comparerGroupes` dont la
 * mutation survivait. NFR-10 interdit un harnais de composants — une règle laissée
 * dans un composant n'est exercée par rien.
 *
 * ⚠️ **Le zéro a sa propre phrase.** « 0 article ajouté. » se lit comme une panne
 * alors que c'est un succès sans objet : le menu est vide, ou tout y était déjà. La
 * leçon écrite en revue de la 4.2 était « un état vide se mérite ».
 */
export function compteRenduGeneration(ajoutes: number): string {
  if (ajoutes === 0) return "Ta liste avait déjà tout ce qu'il faut.";
  if (ajoutes === 1) return "1 article ajouté à ta liste.";
  return `${ajoutes} articles ajoutés à ta liste.`;
}
