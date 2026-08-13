import type { ArticleDeListe } from "./liste.ts";

/**
 * Un rayon et ses articles — ce qu'une carte-rayon reçoit.
 *
 * ⚠️ **`rayonId` à `null` est une CLÉ DE PLEIN DROIT**, pas une absence : c'est
 * le groupe « À classer », celui des articles dont le rayon n'a pas été résolu.
 * Mesuré le 2026-08-05 : `product_aisle_map` est vide (les règles mot-clé →
 * rayon sont la story 2.3), donc `resolve_aisle_id` rend `null` pour tous les
 * articles et **c'est aujourd'hui le seul groupe qu'un foyer réel affiche**.
 *
 * ⚠️ **Le groupe « À classer » lui-même appartient à la story 4.17** — sa
 * position en fin de parcours, son non-repli, son effacement quand il est vide.
 * Cette story ne fait que le faire apparaître sans le casser.
 */
export type GroupeDeRayon = {
  rayonId: string | null;
  nom: string | null;
  icone: string | null;
  /**
   * `aisle_sort` — la position du rayon dans le parcours, `null` en dernier.
   *
   * ⛔ **CE CHAMP EST NÉ D'UN DÉFAUT TROUVÉ EN REVUE le 2026-08-07.** Il n'y
   * était pas, et `comparerGroupes` allait chercher sa clé de tri dans
   * `a.articles[0]?.rayonOrdre` — la propriété du PREMIER ENFANT, pas du groupe.
   * L'optionnel `?.` masquait le cas dégénéré : un groupe à `articles: []`
   * voyait son ordre valoir `null` et partait **silencieusement en fin de
   * parcours**, quel que soit son `sort_order` réel.
   *
   * ⚠️ **Et le groupe vide est un cas NOMINAL, écrit dans deux documents** :
   * `ProprietesCarteRayon.children` est optionnel parce qu'« un rayon sans
   * article reste une carte », et la story 4.17 possède ce comportement.
   * `grouperParRayon` n'en produit pas aujourd'hui, mais ce type est **exporté**
   * et la 4.17 en construira. Porter l'ordre sur le groupe rend le cas correct
   * par construction, plutôt que correct par accident.
   */
  ordre: number | null;
  articles: ArticleDeListe[];
};

/**
 * Matérialise les cartes-rayon à partir des lignes plates de la vue.
 *
 * ⚠️ **L'AC3 dit « aucune surface ne calculant son propre regroupement », et ça
 * ne veut PAS dire « ne regroupe pas ».** La vue rend des lignes, pas des
 * groupes : le client DOIT matérialiser des cartes. Ce que l'AC3 interdit, c'est
 * de **décider** l'appartenance ou l'ordre — les deux viennent de la base
 * (`aisle_id`, `aisle_sort`). Le client matérialise, il n'arbitre pas.
 *
 * ⛔ **REGROUPE PAR CLÉ, JAMAIS PAR LIGNES CONSÉCUTIVES.** `aisles.sort_order`
 * n'a aucune contrainte d'unicité et vaut 100 par défaut (M11), donc deux rayons
 * ex æquo font s'INTERCALER leurs articles dans le flux rendu (M6, mesuré :
 * aaa/Exaequo, bbb/Alpha, ccc/Exaequo). Ouvrir une carte « quand le nom change »
 * rendrait **deux cartes portant le même rayon**, articles répartis au hasard
 * entre les deux — et le défaut ne se verrait que sur un foyer ayant réordonné
 * ses rayons, donc jamais en développement.
 *
 * ⚠️ **Reprend la BOUCLE de `grouperParCase` (`lib/menu/menu.ts`), pas son type
 * de retour.** Celui-là rend une `Map`, dont l'itération suit l'ordre
 * d'INSERTION — exactement l'« ordre d'apparition » que l'AC2 proscrit ici. La
 * `Map` ne sert qu'à agréger ; le tri est refait explicitement ensuite.
 */
export function grouperParRayon(
  articles: ReadonlyArray<ArticleDeListe>
): GroupeDeRayon[] {
  const par = new Map<string | null, GroupeDeRayon>();

  for (const a of articles) {
    const deja = par.get(a.rayonId);
    if (deja) {
      deja.articles.push(a);
    } else {
      par.set(a.rayonId, {
        rayonId: a.rayonId,
        nom: a.rayonNom,
        icone: a.rayonIcone,
        ordre: a.rayonOrdre,
        articles: [a],
      });
    }
  }

  /*
   * ⚠️ **L'ordre des ARTICLES dans un groupe reste celui reçu** (par `name`,
   * posé par la requête) : `push` préserve l'ordre d'arrivée, et retrier ici
   * serait précisément l'arbitrage que l'AC3 interdit.
   */
  return [...par.values()].sort(comparerGroupes);
}

/**
 * L'ordre du parcours magasin : `(aisle_sort, aisle_name)`, les rayons sans
 * ordre en DERNIER.
 *
 * ⚠️ **Le tri secondaire par nom n'est pas décoratif** — même raison que
 * `rayonsDuFoyer` : sans lui, l'ordre de deux ex æquo est celui que Postgres
 * choisit ce jour-là, et l'écran « bouge tout seul » d'un rechargement à l'autre.
 *
 * ⚠️ **Les nuls en dernier obtiennent le MÊME RÉSULTAT que le
 * `coalesce(a.sort_order, 9999)` de la vue sans en être une reproduction**, et
 * la nuance a été rectifiée en revue le 2026-08-07 : ce commentaire disait
 * « reproduisent », puis se contredisait deux lignes plus bas. Les deux règles
 * ne coïncident pas partout —
 *
 * - la vue met un rayon légitimement classé à **9999 à ÉGALITÉ** avec l'absence
 *   de rayon, puis les départage par nom d'**article** ;
 * - ici, l'absence de rayon passe **strictement en dernier**, toujours.
 *
 * ⛔ **L'écart est délibéré, et c'est `groupement.test.ts` qui le fixe** (« un
 * rayon d'ordre 9999 n'est PAS confondu avec l'absence de rayon ») : « À
 * classer » est un groupe de plein droit dont la place est la fin du parcours
 * (M7, `EXPERIENCE.md`), pas un rang numérique qu'un rayon pourrait disputer.
 * Écrire `9999` en dur ici rendrait ce rayon indiscernable de lui.
 *
 * ⚠️ **Le départage par nom de RAYON, lui, n'est pas dans la vue du tout** (son
 * `g.name` est le nom de l'ARTICLE). Il est prescrit par la story, pour la même
 * raison que `rayonsDuFoyer` : sans lui, l'ordre de deux ex æquo est celui que
 * Postgres choisit ce jour-là, et l'écran « bouge tout seul » d'un rechargement
 * à l'autre. ⚠️ `rayonsDuFoyer` le fait par `.order("name")`, donc par la
 * collation Postgres, là où l'on emploie ici `localeCompare(…, "fr")` : sur deux
 * rayons ex æquo aux noms accentués, `/rayons` et `/courses` peuvent diverger.
 * Personne ne l'a mesuré, et l'application ne produit pas d'ex æquo elle-même
 * (`prochainOrdre` rend `max+10`, `reorder_aisles` renumérote au pas de 10).
 *
 * ⛔ **EXPORTÉE POUR ÊTRE TESTÉE, et c'est une correction de revue du
 * 2026-08-12.** Elle ne l'était pas, et `grouperParRayon` ne produit **jamais** de
 * groupe vide : le champ `ordre` — né de la revue du 2026-08-07 précisément pour
 * que le cas vide soit correct — n'était donc mesuré par rien. **Vérifié** :
 * rétablir `a.articles[0]?.rayonOrdre` à la place de `a.ordre` laissait les 235
 * tests verts. L'invariant était affirmé par un docblock (« correct par
 * construction »), pas mesuré — règle §4, sur un type **exporté** que la story
 * 4.17 construira avec des groupes vides. Voir `groupement.test.ts`.
 */
export function comparerGroupes(a: GroupeDeRayon, b: GroupeDeRayon): number {
  const ordreA = a.ordre;
  const ordreB = b.ordre;

  if (ordreA !== ordreB) {
    if (ordreA === null) return 1;
    if (ordreB === null) return -1;
    return ordreA - ordreB;
  }

  return (a.nom ?? "").localeCompare(b.nom ?? "", "fr");
}
