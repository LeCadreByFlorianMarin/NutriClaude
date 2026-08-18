import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

/**
 * Retirer **un** article de la liste vivante.
 *
 * ⛔ **CE N'EST PAS UN `DELETE`, ET CE N'EST PAS UNE PRÉFÉRENCE DE STYLE.** AD-3
 * impose le tombstone, et la base le rend *obligatoire* d'une façon que rien ne
 * signale à l'appel : le privilège de table `DELETE` **est** accordé à
 * `authenticated`, mais **aucune politique RLS `for delete` n'existe** (volet 6 de
 * `20260805092611`, « la RLS, et le DELETE qui disparaît »).
 *
 * **Mesuré le 2026-08-17**, en rôle `authenticated`, sur sa PROPRE ligne :
 *
 * ```
 * delete from grocery_list_items where name = '…';   →   DELETE 0, aucune erreur
 * ```
 *
 * Postgres ne refuse pas : il ne *voit* aucune ligne. ⛔ **Un `.delete()` de
 * PostgREST rendrait donc `error: null` sans avoir rien supprimé** — l'écran
 * optimiste montrerait l'article disparu, et il reviendrait au chargement suivant,
 * sans qu'aucune porte, aucun journal ni aucun message ne dise pourquoi. C'est la
 * forme de défaut la plus coûteuse de ce dépôt : celle qu'aucune porte ne voit.
 *
 * ⚠️ **`status` n'est pas touché, et c'est FR-6** — « un article peut être supprimé
 * de la liste, **distinctement** du fait de le cocher ». Un article supprimé alors
 * qu'il était à prendre reste `pending` ; un archivé reste `bought`. C'est cette
 * différence qui rend l'archivage traçable (voir {@link archiverLesAchetes}).
 *
 * ⚠️ **Le client est passé EN PARAMÈTRE**, jamais construit ici — motif
 * d'`articlesDuFoyer`, `basculerStatut` et `ajouterArticle`. C'est ce qui rend cette
 * fonction appelable telle quelle par le dashboard (Epic 5) et le serveur MCP
 * (Epic 7), et **exerçable contre une vraie base** dans `isolation.test.ts`.
 *
 * @returns le nombre de lignes réellement retirées — **0 n'est pas une erreur**.
 * Supprimer un article qu'un autre membre vient de supprimer rend 0 : la
 * convergence ne demande aucun arbitrage (NFR-2, `EXPERIENCE.md:122`).
 * @throws si la base refuse l'écriture. ⛔ **Sur un écran client, personne
 * n'attrape ce `throw`** : `app/error.tsx` est une frontière d'erreur de *rendu*,
 * qu'un rejet de promesse dans un callback `async` ne traverse pas. L'appelant doit
 * l'envelopper — voir `ListeCourses`.
 */
export async function supprimerArticle(
  supabase: SupabaseClient<Database>,
  articleId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("supprimer_article", {
    p_id: articleId,
  });

  if (error) {
    throw new Error(`Suppression de l'article impossible : ${error.message}`);
  }

  return compte(data);
}

/**
 * Retirer de la liste vivante **tous les articles achetés** du foyer.
 *
 * C'est « Vider le panier » (`EXPERIENCE.md:134`) : le geste de fin de courses.
 *
 * ⚠️ **L'archivé garde son `status = 'bought'`, et c'est ce qui le rend traçable.**
 * L'AC2 demande qu'ils soient « retirés de la liste active tout en restant
 * traçables ». Un archivé porte donc les DEUX marques — acheté **et** tombstoné —
 * ce qui le distingue d'une suppression pure (`pending` + tombstone).
 *
 * ⛔ **`(status, deleted_at)` n'est volontairement contraint par rien**, et
 * `deferred-work.md` le signalait comme un manque. C'en est un ailleurs ; ici c'est
 * le mécanisme même de l'archivage. Une contrainte d'exclusion casserait l'AC2.
 *
 * ⚠️ **Aucun filtre de foyer n'est écrit, ni ici ni dans la fonction SQL.** La
 * politique `grocery_update` est ancrée sur `current_household_id()`. Mesuré le
 * 2026-08-17 : un archivage en masse sans filtre ne touche que les lignes de
 * l'appelant — 2 lignes du foyer A, foyer B jamais vu. L'écrire laisserait croire
 * que c'est le client qui protège, ce qu'AD-1/AD-2 refusent.
 *
 * @returns le nombre d'articles archivés, que l'écran annonce. Un geste de masse
 * qui ne dit pas ce qu'il a fait laisse le membre vérifier à l'œil sur trente lignes.
 */
export async function archiverLesAchetes(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data, error } = await supabase.rpc("archiver_les_achetes");

  if (error) {
    throw new Error(`Archivage des articles pris impossible : ${error.message}`);
  }

  return compte(data);
}

/**
 * Retirer de la liste vivante **tous les articles** du foyer — pris ou non.
 *
 * ⚠️ **La confirmation exigée par l'AC3 vit à l'écran, pas ici.** Une fonction ne
 * peut rien confirmer, et lui passer un booléen « confirmé » serait une garde que
 * n'importe quel appelant contournerait — exactement le genre de contrôle
 * applicatif qu'AD-2 refuse.
 *
 * ⚠️ **Aucun statut n'est réécrit.** Vider, c'est retirer la liste — pas déclarer
 * tout acheté.
 *
 * @returns le nombre d'articles retirés.
 */
export async function viderLaListe(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data, error } = await supabase.rpc("vider_la_liste");

  if (error) {
    throw new Error(`Vidage de la liste impossible : ${error.message}`);
  }

  return compte(data);
}

/**
 * Le compte rendu par une des trois fonctions, ramené à un entier sûr.
 *
 * ⚠️ **`data` est typé `number` mais arrive de PostgREST**, qui rend `null` sur un
 * corps vide. Le dépôt refuse le `!` d'assertion — « le type décrit le schéma, pas
 * ce que le transport fait » — et un `null` traité comme un compte ferait rendre
 * « null articles rangés » au membre.
 */
function compte(data: number | null): number {
  return typeof data === "number" ? data : 0;
}

/**
 * La phrase qui rend compte d'un geste de masse.
 *
 * ⛔ **ELLE VIT ICI PARCE QU'ELLE EST TESTABLE ICI.** NFR-10 interdit un harnais de
 * composants : une règle laissée dans le JSX n'est exercée par rien. Le dépôt a payé
 * cette leçon deux fois — « 2 pièce » dans la carte-rayon, et `comparerGroupes` dont
 * la mutation survivait faute d'export.
 *
 * ⚠️ **Le zéro a sa propre phrase, et ce n'est pas de la coquetterie.** « 0 article
 * rangé » se lit comme une panne alors que c'est un succès sans objet — le cas d'un
 * membre dont l'autre moitié du foyer vient de faire le geste.
 *
 * ⚠️ **Tutoiement, registre familier** (UX-DR12), et aucun mot banni.
 */
export function compteRenduArchivage(nombre: number): string {
  if (nombre === 0) return "Il n'y avait rien à ranger.";
  return nombre === 1 ? "1 article rangé." : `${nombre} articles rangés.`;
}

/**
 * La phrase qui rend compte d'un vidage.
 *
 * ⚠️ **« retiré » et non « supprimé » ni « effacé »** : le tombstone ne détruit
 * rien, et réajouter l'article le fait revenir. Promettre une destruction que la
 * base ne fait pas serait faux dans les deux sens.
 */
export function compteRenduVidage(nombre: number): string {
  if (nombre === 0) return "Ta liste était déjà vide.";
  return nombre === 1 ? "1 article retiré." : `${nombre} articles retirés.`;
}
