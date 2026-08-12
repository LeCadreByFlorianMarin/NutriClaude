import { test } from "node:test";
import assert from "node:assert/strict";
import { grouperParRayon } from "./groupement.ts";
import type { ArticleDeListe } from "./liste.ts";

/**
 * Le pur du regroupement de la liste (story 4.2).
 *
 * **Ce que ce fichier existe pour tenir : l'AC3 au niveau du pur** — « aucune
 * surface ne calculant son propre regroupement ». La vue rend des lignes plates ;
 * le client DOIT matérialiser des cartes, mais il n'a le droit de rien
 * **décider** : l'appartenance vient d'`aisle_id`, l'ordre d'`aisle_sort`.
 *
 * ⛔ **Le test qui justifie ce fichier est celui des rayons EX ÆQUO**, et le
 * défaut qu'il attrape ne se voit jamais en développement : il faut un foyer qui
 * a réordonné ses rayons. Mesuré le 2026-08-05 (M6) : `aisles.sort_order` n'a
 * **aucune contrainte d'unicité** et vaut 100 par défaut, donc deux rayons ex
 * æquo font s'INTERCALER leurs articles dans le flux rendu par la vue. Un
 * regroupement « j'ouvre une carte quand le nom change » rendrait alors deux
 * cartes portant le même rayon, articles répartis au hasard entre les deux.
 */

/**
 * Un article nommé, dans un rayon nommé. Les champs qui ne servent pas au
 * regroupement sont posés une fois pour toutes ici.
 */
function article(
  nom: string,
  rayon: { id: string | null; nom: string | null; ordre: number | null }
): ArticleDeListe {
  return {
    id: `id-${nom}`,
    nom,
    quantite: null,
    unite: null,
    rayonId: rayon.id,
    rayonNom: rayon.nom,
    rayonIcone: null,
    rayonOrdre: rayon.ordre,
  };
}

const ALPHA = { id: "a", nom: "Alpha", ordre: 20 };
const EXAEQUO = { id: "e", nom: "Exaequo", ordre: 20 };
const SANS_RAYON = { id: null, nom: null, ordre: null };

/**
 * L'assertion STRUCTURELLE, appelée sur CHAQUE cas qui a des articles. Elle ne
 * regarde pas l'ordre : seulement qu'aucun article n'a été avalé ni dupliqué par
 * le regroupement. Motif de `memeEnsemble` (`lib/ordre.test.ts`) — sans elle, une
 * `Map` mal alimentée passe tous les tests d'ordre.
 *
 * ⛔ **Elle ne l'était PAS partout, et c'est une correction de revue du
 * 2026-08-07.** Ce docblock disait déjà « à appeler sur CHAQUE cas » ; deux tests
 * ne l'appelaient pas — « un rayon d'ordre 9999 » et « le groupe porte le nom et
 * l'icône ». Le premier n'assertionnait QUE `groupes.map(g => g.rayonId)` : une
 * implémentation qui aurait perdu l'article du groupe « À classer » en gardant sa
 * clé serait restée verte, c'est-à-dire exactement le défaut dont ce docblock
 * explique qu'il faut s'en garder. **Une consigne qu'on n'applique pas est pire
 * qu'une consigne absente** : elle fait croire la couverture acquise.
 * ⚠️ Seule exception, et elle n'en est pas une : « une liste vide » n'a aucun
 * article à comparer.
 */
function memeArticles(
  groupes: ReadonlyArray<{ articles: ReadonlyArray<{ id: string }> }>,
  depart: ReadonlyArray<ArticleDeListe>
) {
  const rendus = groupes.flatMap((g) => g.articles.map((a) => a.id));
  assert.equal(rendus.length, depart.length, "aucun article perdu ni ajouté");
  assert.equal(new Set(rendus).size, rendus.length, "aucun doublon");
  assert.deepEqual(
    [...rendus].sort(),
    depart.map((a) => a.id).sort(),
    "exactement les mêmes articles"
  );
}

test("deux rayons EX ÆQUO ne font pas deux cartes du même rayon", () => {
  /*
   * ⛔ Le test le plus important du lot, et le seul qui distingue un
   * regroupement par CLÉ d'un regroupement par lignes consécutives.
   *
   * Cet ordre d'arrivée est celui **mesuré** sur le stack local le 2026-08-05 :
   * `Alpha` et `Exaequo` tous deux à `sort_order = 20`, et la vue rend
   * aaa(Exaequo), bbb(Alpha), ccc(Exaequo) — les articles s'intercalent.
   */
  const articles = [
    article("aaa", EXAEQUO),
    article("bbb", ALPHA),
    article("ccc", EXAEQUO),
  ];

  const groupes = grouperParRayon(articles);

  assert.equal(groupes.length, 2, "un groupe par rayon, pas par changement");
  assert.deepEqual(
    groupes.map((g) => g.rayonId),
    ["a", "e"],
    "triés par (ordre, nom) : Alpha avant Exaequo à ordre égal"
  );
  assert.deepEqual(
    groupes.map((g) => g.articles.map((a) => a.nom)),
    [["bbb"], ["aaa", "ccc"]],
    "les deux articles d'Exaequo sont réunis dans UNE carte"
  );
  memeArticles(groupes, articles);
});

test("les articles SANS rayon forment un groupe, et il est en DERNIER", () => {
  /*
   * ⚠️ « À classer » : `rayonId` nul est une clé de plein droit, pas une
   * absence. Sa position en fin de parcours reproduit le
   * `coalesce(a.sort_order, 9999)` de la vue (M7) et `EXPERIENCE.md`.
   *
   * ⚠️ Il est posé EN TÊTE du tableau d'entrée exprès : s'il ressortait premier,
   * c'est que l'ordre d'apparition l'aurait emporté sur l'ordre du parcours.
   */
  const articles = [
    article("orphelin", SANS_RAYON),
    article("bbb", ALPHA),
    article("autre orphelin", SANS_RAYON),
  ];

  const groupes = grouperParRayon(articles);

  assert.deepEqual(groupes.map((g) => g.rayonId), ["a", null]);
  assert.deepEqual(groupes.at(-1)?.articles.map((a) => a.nom), [
    "orphelin",
    "autre orphelin",
  ]);
  memeArticles(groupes, articles);
});

test("l'ordre des groupes suit (ordre, nom), pas l'ordre d'apparition", () => {
  // Le rayon d'ordre 10 arrive EN DERNIER dans le flux : s'il ne remonte pas en
  // tête, le tri n'a pas eu lieu.
  const TARD = { id: "t", nom: "Tardif", ordre: 90 };
  const TOT = { id: "p", nom: "Précoce", ordre: 10 };

  const articles = [article("z", TARD), article("a", TOT)];
  const groupes = grouperParRayon(articles);

  assert.deepEqual(groupes.map((g) => g.nom), ["Précoce", "Tardif"]);
  memeArticles(groupes, articles);
});

test("un rayon d'ordre 9999 n'est PAS confondu avec l'absence de rayon", () => {
  /*
   * ⚠️ Le tri est écrit « les nuls en dernier », pas « les nuls valent 9999 ».
   * La nuance mord ici : un rayon légitimement classé très loin reste AVANT
   * « À classer », qui n'a pas d'ordre du tout.
   */
  const LOINTAIN = { id: "l", nom: "Lointain", ordre: 9999 };

  const articles = [article("orphelin", SANS_RAYON), article("loin", LOINTAIN)];
  const groupes = grouperParRayon(articles);

  assert.deepEqual(groupes.map((g) => g.rayonId), ["l", null]);
  memeArticles(groupes, articles);
});

test("l'ordre des articles DANS un groupe est celui reçu, jamais retrié", () => {
  // La requête trie déjà par `name` ; retrier ici serait l'arbitrage que l'AC3
  // interdit — et un tri client divergerait de celui de la base.
  const articles = [
    article("zèbre", ALPHA),
    article("abricot", ALPHA),
    article("melon", ALPHA),
  ];

  const groupes = grouperParRayon(articles);

  assert.deepEqual(groupes[0]?.articles.map((a) => a.nom), [
    "zèbre",
    "abricot",
    "melon",
  ]);
  memeArticles(groupes, articles);
});

test("une liste vide rend zéro groupe, et ce n'est pas une panne", () => {
  assert.deepEqual(grouperParRayon([]), []);
});

test("le groupe porte le nom et l'icône de son rayon", () => {
  // Ce que la carte-rayon consomme : sans ça, l'écran afficherait des cartes
  // muettes, et le défaut ne se verrait qu'à l'œil.
  const articles = [{ ...article("pomme", ALPHA), rayonIcone: "🍎" }];
  const groupes = grouperParRayon(articles);

  assert.equal(groupes[0]?.nom, "Alpha");
  assert.equal(groupes[0]?.icone, "🍎");
  assert.equal(groupes[0]?.ordre, 20, "le groupe porte AUSSI son ordre");
  memeArticles(groupes, articles);
});
