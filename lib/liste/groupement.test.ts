import { test } from "node:test";
import assert from "node:assert/strict";
import { comparerGroupes, grouperParRayon, type GroupeDeRayon } from "./groupement.ts";
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

/* ── comparerGroupes, exercée DIRECTEMENT ─────────────────────────────────── */

test("un groupe VIDE se trie sur SON ordre, pas sur celui de son premier article", () => {
  /*
   * ⛔ **CE TEST EXISTE PARCE QUE LE CHAMP `ordre` N'ÉTAIT MESURÉ PAR RIEN.**
   * Il est né de la revue du 2026-08-07 — `comparerGroupes` allait alors chercher
   * sa clé dans `a.articles[0]?.rayonOrdre`, et un groupe vide partait
   * silencieusement en fin de parcours quel que soit son `sort_order`. Le
   * correctif a porté l'ordre sur le groupe, mais **sans test** : `grouperParRayon`
   * ne produit jamais de groupe vide, donc `comparerGroupes` n'était pas
   * atteignable par l'API publique. Vérifié le 2026-08-12 : rétablir
   * `a.articles[0]?.rayonOrdre` laissait les 235 tests verts.
   *
   * ⚠️ **Règle §4** : l'invariant était affirmé par un docblock (« correct par
   * construction »), pas mesuré — et `GroupeDeRayon` est un type **exporté** que
   * la story 4.17 construira précisément avec des groupes vides.
   */
  const videMaisTot: GroupeDeRayon = { rayonId: "v", nom: "Vide", icone: null, ordre: 5, articles: [] };
  const pleinMaisTard: GroupeDeRayon = {
    rayonId: "p",
    nom: "Plein",
    icone: null,
    ordre: 50,
    articles: [article("pomme", { id: "p", nom: "Plein", ordre: 50 })],
  };

  assert.deepEqual(
    [pleinMaisTard, videMaisTot].sort(comparerGroupes).map((g) => g.rayonId),
    ["v", "p"],
    "le groupe vide d'ordre 5 passe AVANT le groupe plein d'ordre 50"
  );
});

test("un groupe vide SANS ordre reste en dernier, comme tout groupe sans ordre", () => {
  const videSansOrdre: GroupeDeRayon = { rayonId: null, nom: null, icone: null, ordre: null, articles: [] };
  const tardif: GroupeDeRayon = { rayonId: "t", nom: "Tardif", icone: null, ordre: 9999, articles: [] };

  assert.deepEqual(
    [videSansOrdre, tardif].sort(comparerGroupes).map((g) => g.rayonId),
    ["t", null],
    "« À classer » reste en fin de parcours même face à un rayon d'ordre 9999"
  );
});

test("deux groupes EX ÆQUO se départagent par le nom du RAYON", () => {
  // Sans ce départage, l'ordre de deux ex æquo est celui que le moteur choisit ce
  // jour-là, et l'écran « bouge tout seul » d'un rechargement à l'autre.
  const zebre: GroupeDeRayon = { rayonId: "z", nom: "Zèbre", icone: null, ordre: 20, articles: [] };
  const abricot: GroupeDeRayon = { rayonId: "a", nom: "Abricot", icone: null, ordre: 20, articles: [] };

  assert.deepEqual(
    [zebre, abricot].sort(comparerGroupes).map((g) => g.rayonId),
    ["a", "z"]
  );
});
