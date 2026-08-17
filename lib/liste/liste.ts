import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

/**
 * Un article de la liste, tel que l'écran l'affiche.
 *
 * ⚠️ **`unite` n'est PAS décoratif.** AD-7 fait de l'unité un morceau de la clé
 * canonique : « lait / L » et « lait / pièce » sont **deux lignes distinctes du
 * même rayon**, et deux unités ne sont jamais additionnées ni converties. Les
 * omettre rendrait deux « Lait » identiques que rien n'expliquerait, et le
 * membre en conclurait que l'agrégation est cassée.
 */
/**
 * Les deux états d'un article, tels que la base les contraint.
 *
 * ⚠️ **Le vocabulaire est CLOS en base** — `check (status in ('pending','bought'))`,
 * posé par `initial_schema:204`. Ce n'est donc pas une énumération qui court après
 * une catégorie (règle §3) : c'est la reprise d'un ensemble contrôlé.
 *
 * ⛔ **`bought` n'est PAS « supprimé ».** AD-3 distingue le tombstone (`deleted_at`,
 * story 4.5) de l'état d'achat. Un article acheté reste dans la liste vivante, il
 * est seulement repoussé « dans le panier » — c'est FR-3, et c'est tout l'objet de
 * la story 4.3.
 */
export type StatutArticle = "pending" | "bought";

/** Vrai si la chaîne est **exactement** l'un des deux états connus. */
export function estStatutConnu(valeur: string | null): valeur is StatutArticle {
  return valeur === "pending" || valeur === "bought";
}

export type ArticleDeListe = {
  id: string;
  /** `name`, tel que le membre l'a tapé. Jusqu'à 200 caractères (mesuré). */
  nom: string;
  quantite: number | null;
  unite: string | null;
  /**
   * `status` — **à prendre** ou **dans le panier** (story 4.3, FR-3).
   *
   * ⚠️ **Il commande trois choses à l'écran**, et les confondre est le piège n°10
   * de la story : le compteur « n à prendre » (qui compte les `pending`, PAS la
   * longueur du tableau), le ratio `pris/total` de la carte-rayon, et la position
   * de la ligne dans son rayon (les achetés sont repoussés sous le séparateur).
   */
  statut: StatutArticle;
  /** `aisle_id` — **la CLÉ de groupement**, `null` étant une clé de plein droit. */
  rayonId: string | null;
  rayonNom: string | null;
  rayonIcone: string | null;
  /** `aisle_sort` — l'ordre du parcours magasin. `null` passe en dernier. */
  rayonOrdre: number | null;
};

/**
 * Les articles vivants de la liste du foyer courant.
 *
 * **La PREMIÈRE lecture client-direct du produit** (AC1, AD-13). Mesuré le
 * 2026-08-05, **chiffre corrigé le 2026-08-12** : les 20 appels de
 * `createNavigateurClient()` du dépôt étaient tous des écritures ou de l'auth, et
 * aucun des **10** `useEffect` ne faisait d'`await` de données. Il n'y avait donc
 * aucun motif à copier. *(La revue avait écrit « 8 » ; `git grep -c "useEffect("
 * 69a34fa -- app` en rend 10, et le nombre n'a pas bougé sur les trois commits
 * qui encadrent cette date. La conclusion tenait, le dénombrement non.)*
 *
 * Le client est **passé en paramètre**, jamais construit ici — motif de
 * `rayonsDuFoyer`. C'est ce qui rend cette fonction appelable telle quelle par le
 * dashboard (Epic 5) et le serveur MCP (Epic 7) : `createNavigateurClient()` et
 * `createServerComponentClient()` rendent le même `SupabaseClient<Database>`.
 *
 * ⚠️ **Aucun filtre `household_id` à la main.** La vue est en
 * `security_invoker = true` et les politiques de `grocery_list_items` sont
 * ancrées sur `current_household_id()` : la RLS s'en charge. L'écrire laisserait
 * croire que c'est lui qui protège, ce qu'AD-1/AD-2 refusent.
 *
 * ⚠️ **Le tri est explicite alors que la vue en porte déjà un.** Mesuré (M5) :
 * l'`ORDER BY` de la vue survit à PostgREST aujourd'hui, par deux sondes
 * convergentes. Mais Postgres ne le **garantit** pas pour une sous-requête, et
 * l'écrire coûte zéro. ⛔ **Ce n'est de toute façon pas lui qui rend le
 * regroupement correct** — voir `grouperParRayon`, qui regroupe par clé.
 *
 * ⚠️ **Aucune borne de volume.** Mesuré : aucune décision d'architecture ne
 * traite la pagination ni la volumétrie. C'est un silence assumé, pas un oubli —
 * ne pose pas de `.limit()` sans décision.
 */
export async function articlesDuFoyer(
  supabase: SupabaseClient<Database>
): Promise<ArticleDeListe[]> {
  const { data, error } = await supabase
    .from("grocery_list_by_aisle")
    /*
     * ⛔ **`status` A DÛ ÊTRE AJOUTÉ ICI, ET ÉLARGIR LA VUE NE SUFFISAIT PAS.**
     * Cette chaîne énumère ses colonnes une par une : la migration du 2026-08-13
     * a rendu les articles achetés visibles, mais sans cette ligne `statut`
     * serait arrivé `undefined` au client — **silencieusement, jamais en
     * erreur**. C'est la forme de défaut que la story 4.3 nomme en Task 1.
     */
    .select("id, name, quantity, unit, status, aisle_id, aisle_name, aisle_icon, aisle_sort")
    .order("aisle_sort")
    .order("name");

  /*
   * Lève si la lecture échoue, rend `[]` sur zéro ligne : **une liste vide est
   * l'état nominal, pas une panne** — c'est même l'état d'un foyer neuf, que
   * l'écran doit savoir montrer (`EXPERIENCE.md` : « Ta liste est vide. »).
   *
   * ⛔ **Sur un écran CLIENT, personne n'attrape ce `throw`.** `app/error.tsx`
   * est une frontière d'erreur de *rendu* : un rejet de promesse dans un
   * callback `async` de `useEffect` ne la traverse pas — il devient un
   * `unhandledrejection`, et l'écran resterait sur son squelette indéfiniment,
   * sans rien dire. C'est le motif de `rayonsDuFoyer` qui NE se transpose pas :
   * lui est appelé depuis un composant serveur. L'appelant client doit donc
   * envelopper cet appel dans un `try/catch` — voir `ListeCourses`.
   */
  if (error) {
    throw new Error(`Lecture de la liste impossible : ${error.message}`);
  }

  return (data ?? []).flatMap(versArticle);
}

/**
 * Rétrécit une ligne de la vue vers le type de domaine, ou l'écarte.
 *
 * ⚠️ **Rend un TABLEAU de zéro ou un article**, pour être consommé par
 * `flatMap` — motif exact de `versCaseDeMenu` (`lib/menu/menu.ts`).
 *
 * ⛔ **Mesuré (M9) : TOUTES les colonnes de la vue sont `| null` dans les types
 * générés**, `id` et `name` compris, alors qu'elles sont `not null` en base.
 * Postgres ne propage pas la non-nullité à travers une vue, et le générateur ne
 * peut pas l'inventer. ⚠️ **Ne pas affirmer la non-nullité par un `!`** : le
 * dépôt le refuse explicitement — « le type décrit le schéma, pas la RLS », donc
 * la garde d'exécution reste due.
 *
 * ⚠️ **EXPORTÉE POUR ÊTRE TESTÉE, et c'est une correction de revue du
 * 2026-08-07.** Elle ne l'était pas, et rien ne l'exerçait : `groupement.test.ts`
 * construit ses fixtures à la main, donc **aucune assertion ne reliait la forme
 * rendue par PostgREST au type de domaine**. Intervertir `aisle_sort` et
 * `quantity` ici laissait la suite entièrement verte — sur le seul point de
 * contact entre la base et l'écran. Voir `liste.test.ts`.
 */
export function versArticle(ligne: {
  id: string | null;
  name: string | null;
  quantity: number | null;
  unit: string | null;
  status: string | null;
  aisle_id: string | null;
  aisle_name: string | null;
  aisle_icon: string | null;
  aisle_sort: number | null;
}): ArticleDeListe[] {
  /*
   * ⚠️ **Le statut se garde comme `id` et `name`, et pour la même raison.** La
   * contrainte `check (status in ('pending','bought'))` vit en BASE ; les types
   * générés, eux, rendent la colonne `string | null` (M9 : Postgres ne propage
   * pas la non-nullité à travers une vue). Une valeur hors vocabulaire voudrait
   * dire que la base a changé sans que le client le sache — la traiter comme
   * « à prendre » inventerait un état, et la traiter comme « acheté » en
   * cacherait un.
   */
  if (!estStatutConnu(ligne.status)) {
    console.warn(
      "[courses] Ligne de liste écartée : statut inconnu.",
      ligne.status,
      ligne
    );
    return [];
  }

  if (ligne.id === null || ligne.name === null) {
    /*
     * ⛔ **UN ÉCART SILENCIEUX EST UN SOUS-COMPTAGE INVISIBLE, et c'est une
     * correction de revue du 2026-08-12.** La ligne sort de la liste ET du
     * compteur « n à prendre » : sans trace, un membre verrait un total faux
     * sans qu'aucun signal n'existe nulle part. Le `catch` voisin de
     * `ListeCourses` s'est vu ajouter son journal le 2026-08-07 sur l'argument
     * exact « le membre voit une phrase ; le développeur doit voir la cause » —
     * ce chemin-ci ne l'avait pas reçu.
     *
     * ⚠️ **`warn` et non `error`** : ce n'est pas un échec de lecture, et rien
     * n'est cassé pour le membre. C'est une ligne que la base n'aurait pas dû
     * rendre — `id` et `name` sont `not null`, le `| null` des types n'étant
     * qu'un artefact de vue (M9).
     */
    console.warn("[courses] Ligne de liste écartée : id ou name nul.", ligne);
    return [];
  }

  return [
    {
      id: ligne.id,
      nom: ligne.name,
      quantite: ligne.quantity,
      unite: ligne.unit,
      statut: ligne.status,
      rayonId: ligne.aisle_id,
      rayonNom: ligne.aisle_name,
      rayonIcone: ligne.aisle_icon,
      rayonOrdre: ligne.aisle_sort,
    },
  ];
}
