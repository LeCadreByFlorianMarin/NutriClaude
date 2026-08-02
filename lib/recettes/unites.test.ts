import { test } from "node:test";
import assert from "node:assert/strict";
import { UNITES, estUniteConnue } from "./unites.ts";

/**
 * Le vocabulaire d'unités est un **contrat avec l'Epic 4**, pas une liste
 * d'affichage.
 *
 * `generate_grocery_list_from_menu` groupe par `ri.unit` **brut** et le recopie
 * dans `grocery_list_items.unit`, dont AD-3 fait un morceau de la clé canonique
 * `(household_id, nom normalisé, unité)`. La chaîne que le produit écrit ici est
 * donc la clé d'agrégation de toute la liste de courses.
 */

test("les huit jetons d'AD-7, dans l'ordre, à la lettre", () => {
  assert.deepEqual(UNITES, ["g", "kg", "ml", "L", "pièce", "cs", "cc", "pincée"]);
});

test("le commentaire du squelette n'est PAS la référence", () => {
  /*
   * `initial_schema.sql:162` annonce `-- 'g', 'ml', 'piece', 'cs', 'cc'` : cinq
   * jetons, et `piece` sans accent. AD-7 en nomme huit, accentués. Ce test fige
   * lequel des deux fait foi, pour qu'un développeur qui lit le schéma et croit
   * bien faire casse ici plutôt qu'en production.
   */
  assert.equal(UNITES.length, 8);
  assert.ok(UNITES.includes("kg"), "kg manque au commentaire du squelette");
  assert.ok(UNITES.includes("L"), "L manque au commentaire du squelette");
  assert.ok(UNITES.includes("pincée"), "pincée manque au commentaire du squelette");
  assert.ok(!(UNITES as readonly string[]).includes("piece"), "« piece » sans accent n'est pas un jeton");
});

test("tous les jetons sont en NFC", () => {
  /*
   * Mesuré : « pièce » composé (5 points de code) et décomposé (6) sont deux
   * chaînes que Postgres juge inégales. Deux « pièce » de formes différentes
   * seraient deux lignes de courses qui ne fusionneraient jamais.
   */
  for (const u of UNITES) {
    assert.equal(u, u.normalize("NFC"), `${u} n'est pas en NFC`);
  }
});

test("estUniteConnue accepte les huit et rien d'autre", () => {
  for (const u of UNITES) assert.equal(estUniteConnue(u), true, u);

  for (const faux of ["", " ", "piece", "l", "G", "KG", "litre", "cuillère", "oz", "lb"]) {
    assert.equal(estUniteConnue(faux), false, `« ${faux} » ne doit pas passer`);
  }
});

test("une forme décomposée est REFUSÉE, pas silencieusement recomposée", () => {
  /*
   * Recomposer en douce ferait de `estUniteConnue` un normalisateur déguisé, et
   * masquerait le seul cas qui compte : une valeur qui n'est pas venue du
   * `<select>`. On veut qu'elle échoue bruyamment.
   */
  const decomposee = "pièce".normalize("NFD");
  assert.notEqual(decomposee, "pièce");
  assert.equal(estUniteConnue(decomposee), false);
});

test("la casse et les espaces ne sont pas tolérés", () => {
  // Le `<select>` n'émet jamais rien d'autre que les jetons exacts. Tolérer des
  // variantes ouvrirait un chemin que la contrainte en base refuserait ensuite.
  assert.equal(estUniteConnue(" g"), false);
  assert.equal(estUniteConnue("g "), false);
  assert.equal(estUniteConnue("Pièce"), false);
});
