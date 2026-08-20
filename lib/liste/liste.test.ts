import { test } from "node:test";
import assert from "node:assert/strict";
import { versArticle } from "./liste.ts";

/**
 * Le rétrécissement d'une ligne de la vue vers le type de domaine (story 4.2).
 *
 * ⛔ **CE FICHIER EST NÉ D'UN TROU TROUVÉ EN REVUE le 2026-08-07.** Il n'existait
 * pas, et `versArticle` n'était exercée par rien : `groupement.test.ts` construit
 * ses fixtures **à la main**, donc aucune assertion ne reliait la forme rendue par
 * PostgREST au type de domaine. **Intervertir `aisle_sort` et `quantity` dans le
 * mapping laissait la suite entièrement verte** — sur le seul point de contact
 * entre la base et l'écran.
 *
 * ⚠️ **Pourquoi seulement `versArticle`, et pas `articlesDuFoyer`.** Cette
 * dernière prend son client en PARAMÈTRE, et la frontière que
 * `lib/menu/menu.test.ts` a déjà tracée vaut ici : « un faux client prouverait le
 * mapping et jamais l'isolation ». Ce que PostgREST rend vraiment — l'ordre, le
 * `left join`, la RLS — se mesure dans `supabase/tests/isolation.test.ts`, contre
 * une vraie base. Ce qui se teste ici est le pur : le mapping, et la garde de
 * nullité.
 */

/** Une ligne de la vue, toutes colonnes renseignées, à surcharger au cas par cas. */
function ligne(surcharge: Partial<Parameters<typeof versArticle>[0]> = {}) {
  return {
    id: "id-1",
    name: "Lait",
    quantity: 1.5,
    unit: "L",
    status: "pending",
    aisle_id: "rayon-1",
    aisle_name: "Crèmerie",
    aisle_icon: "🧀",
    aisle_sort: 42,
    actor_kind: "profile",
    surface: "web",
    recipe_id: "recette-7",
    ...surcharge,
  };
}

test("chaque colonne atterrit dans le CHAMP qui lui correspond", () => {
  /*
   * ⛔ **Le test qui justifie ce fichier.** DOUZE colonnes, douze champs, et douze
   * valeurs toutes DISTINCTES *(neuf jusqu'à la story 4.6, qui ajoute la provenance)* — c'est ce qui le rend capable de voir une
   * permutation. Avec deux `null` au même endroit ou deux nombres égaux, un
   * mapping croisé passerait.
   *
   * ⚠️ **`deepEqual` sur l'objet ENTIER, jamais champ par champ** : c'est ce qui
   * fait échouer ce test quand un champ NAÎT sans être mappé. La story 4.3 l'a
   * vérifié en ajoutant `statut` — le test est tombé avant que le code ne bouge.
   */
  const [article] = versArticle(ligne());

  assert.deepEqual(article, {
    id: "id-1",
    nom: "Lait",
    quantite: 1.5,
    unite: "L",
    statut: "pending",
    rayonId: "rayon-1",
    rayonNom: "Crèmerie",
    rayonIcone: "🧀",
    rayonOrdre: 42,
    acteurType: "profile",
    surface: "web",
    recetteId: "recette-7",
  });
});

test("`quantity` et `aisle_sort` ne se confondent pas", () => {
  /*
   * ⚠️ Les deux sont les seules colonnes NUMÉRIQUES, donc les seules qu'une
   * permutation rendrait typo-valides — `npm run typecheck` ne verrait rien. Le
   * test précédent le couvre déjà par ses valeurs distinctes ; celui-ci le dit à
   * voix haute, pour qu'une réécriture ne relâche pas les fixtures sans savoir ce
   * qu'elle relâche.
   */
  const [article] = versArticle(ligne({ quantity: 7, aisle_sort: 900 }));

  assert.equal(article.quantite, 7, "la quantité vient de `quantity`");
  assert.equal(article.rayonOrdre, 900, "l'ordre vient de `aisle_sort`");
});

test("un article SANS rayon garde ses quatre champs de rayon nuls", () => {
  /*
   * ⚠️ Mesuré (M7) : le `LEFT JOIN` rend `aisle_name`, `aisle_icon` et
   * `aisle_sort` tous nuls quand l'article n'a pas de rayon. C'est le cas
   * NOMINAL aujourd'hui — 100 % des articles ont `aisle_id` nul, parce que
   * `product_aisle_map` est vide (story 2.3). `rayonId` nul est la clé du groupe
   * « À classer », pas une absence à combler.
   */
  const [article] = versArticle(
    ligne({ aisle_id: null, aisle_name: null, aisle_icon: null, aisle_sort: null })
  );

  assert.equal(article.rayonId, null);
  assert.equal(article.rayonNom, null);
  assert.equal(article.rayonIcone, null);
  assert.equal(article.rayonOrdre, null);
  assert.equal(article.nom, "Lait", "l'article lui-même est intact");
});

test("une quantité ou une unité absente passe telle quelle, sans repli", () => {
  /*
   * ⚠️ **`null` ne devient pas `0` ni `""`.** L'écran conditionne l'affichage de
   * la quantité sur `null` : un repli ici ferait apparaître « 0 » sur un article
   * dont personne n'a jamais dit la quantité. Et AD-7 fait de l'unité un morceau
   * de la clé canonique — la vider changerait l'identité de la ligne.
   */
  const [sansQuantite] = versArticle(ligne({ quantity: null }));
  assert.equal(sansQuantite.quantite, null);
  assert.equal(sansQuantite.unite, "L");

  const [sansUnite] = versArticle(ligne({ unit: null }));
  assert.equal(sansUnite.unite, null);
  assert.equal(sansUnite.quantite, 1.5);
});

test("une quantité de ZÉRO n'est pas confondue avec une absence", () => {
  /*
   * ⛔ **`=== null`, jamais `if (!quantity)`.** C'est le piège que
   * `formaterTemps` documente dans `lib/recettes/lecture.ts`, et il mord ici
   * aussi : `0` est une valeur, `null` veut dire « non renseigné ». Un test de
   * véracité confondrait les deux **en silence**.
   * ⚠️ Mesuré : `quantity` ne reçoit AUCUNE contrainte de positivité (c'est écrit
   * dans l'en-tête de la migration, et reporté à la story 4.4) — zéro est donc
   * atteignable en base.
   */
  const [article] = versArticle(ligne({ quantity: 0 }));
  assert.equal(article.quantite, 0, "zéro survit au mapping");
});

test("une ligne à `id` nul est ÉCARTÉE, pas affirmée par un `!`", () => {
  /*
   * ⛔ **Mesuré (M9) : toutes les colonnes de la vue sont `| null` dans les types
   * générés**, `id` et `name` compris, parce que Postgres ne propage pas le
   * `not null` à travers une vue. Le dépôt refuse le `!` d'assertion — « le type
   * décrit le schéma, pas la RLS » — donc la garde d'exécution reste due, et
   * c'est un `flatMap` qui la rend : zéro ou un élément.
   */
  assert.deepEqual(versArticle(ligne({ id: null })), []);
});

test("une ligne à `name` nul est ÉCARTÉE aussi", () => {
  // Un article sans nom n'a rien à montrer : la ligne serait vide à l'écran.
  assert.deepEqual(versArticle(ligne({ name: null })), []);
});

test("une ligne valide rend EXACTEMENT un élément", () => {
  /*
   * ⚠️ L'invariant du `flatMap` : zéro ou un, jamais deux. Sans cette assertion,
   * une rédaction qui rendrait `[a, a]` dupliquerait silencieusement chaque
   * article de la liste, et le compteur « n à prendre » compterait double.
   */
  assert.equal(versArticle(ligne()).length, 1);
});

/* ── `statut` — story 4.3 ─────────────────────────────────────────────────── */

test("le STATUT remonte au client, sans quoi la coche ne peut rien afficher", () => {
  /*
   * ⛔ **La colonne ne remontait pas AVANT la story 4.3**, et pour deux raisons
   * cumulées : la vue filtrait `status = 'pending'` (donc un article coché
   * n'existait pas côté client), et la chaîne `.select()` d'`articlesDuFoyer`
   * énumère ses colonnes une par une — élargir la vue sans l'y ajouter aurait
   * rendu `statut` silencieusement `undefined`, jamais une erreur.
   */
  assert.equal(versArticle(ligne({ status: "pending" }))[0]?.statut, "pending");
  assert.equal(versArticle(ligne({ status: "bought" }))[0]?.statut, "bought");
});

test("un statut INCONNU écarte la ligne, il ne la déforme pas", () => {
  /*
   * ⚠️ Même garde que `id` et `name` : le type de la vue rend toutes ses colonnes
   * `| null` (M9 de la 4.2), et la contrainte `check (status in ('pending',
   * 'bought'))` vit en base — pas dans les types générés. Une valeur hors
   * vocabulaire signifierait que la base a changé sans que le client le sache :
   * l'écarter est plus honnête que de la traiter comme « à prendre ».
   *
   * ⛔ **Et l'écart LAISSE UNE TRACE** — même raison que la garde `id`/`name` :
   * une ligne qui disparaît en silence fait sous-compter le compteur sans qu'aucun
   * signal n'existe.
   */
  assert.deepEqual(versArticle(ligne({ status: null })), []);
  assert.deepEqual(versArticle(ligne({ status: "archived" })), []);
  assert.deepEqual(versArticle(ligne({ status: "" })), []);
});
