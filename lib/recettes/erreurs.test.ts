import { test } from "node:test";
import assert from "node:assert/strict";
import {
  refusIngredient,
  refusOrdreIngredients,
  refusRecette,
} from "./erreurs.ts";

/**
 * Les deux messages ci-dessous sont **mesurés**, pas inventés : ce sont les
 * réponses réelles de PostgREST du stack local le 2026-08-01, les deux
 * contraintes de `20260801124553` en place.
 */
const TITRE_VIDE = {
  code: "23514",
  message:
    'new row for relation "recipes" violates check constraint "recipes_titre_non_vide"',
};
const PORTIONS = {
  code: "23514",
  message:
    'new row for relation "recipes" violates check constraint "recipes_servings_positif"',
};

test("le même SQLSTATE 23514 rend DEUX refus distincts", () => {
  /*
   * Le cœur de ce fichier. `lib/rayons/erreurs.ts` peut mapper « 23514 →
   * nom-vide » parce qu'`aisles` n'a qu'une seule contrainte `check`. `recipes`
   * en a deux : décider sur le seul code rendrait « Il faut un titre. » à
   * quelqu'un qui a saisi 0 portion.
   */
  assert.equal(refusRecette(TITRE_VIDE), "titre-vide");
  assert.equal(refusRecette(PORTIONS), "portions-invalides");
});

test("un refus inconnu reste générique plutôt que faussement précis", () => {
  assert.equal(refusRecette({ code: "23514", message: "contrainte inconnue" }), "echec");
  assert.equal(refusRecette({ code: "23502", message: "null value in column" }), "echec");
  assert.equal(refusRecette({ code: "42501", message: "permission denied" }), "echec");
  assert.equal(refusRecette({}), "echec");
  assert.equal(refusRecette(null), "echec");
});

test("le nom de contrainte suffit, même si le SQLSTATE manque", () => {
  // Une panne de transport peut rendre un message sans code. Le nom de
  // contrainte est stable ; c'est lui le discriminant.
  assert.equal(refusRecette({ message: TITRE_VIDE.message }), "titre-vide");
  assert.equal(refusRecette({ message: PORTIONS.message }), "portions-invalides");
});

test("un message nul ou absent ne fait pas lever", () => {
  assert.equal(refusRecette({ code: "23514", message: null }), "echec");
  assert.equal(refusRecette({ code: null, message: null }), "echec");
});

test("les deux noms de contrainte sont ceux de la migration, à la lettre", () => {
  /*
   * Ce test existe pour qu'un renommage de contrainte casse ICI, bruyamment,
   * plutôt qu'à l'écran sous la forme d'un « Ça n'a pas marché » générique. Une
   * contrainte renommée sans que ce fichier suive est un défaut silencieux.
   */
  assert.equal(refusRecette({ message: "…constraint \"recipes_titre_non_vide\"" }), "titre-vide");
  assert.equal(
    refusRecette({ message: "…constraint \"recipes_servings_positif\"" }),
    "portions-invalides"
  );
});

/* ── Ingrédients ──────────────────────────────────────────────────────────── */

const msg = (contrainte: string) => ({
  code: "23514",
  message: `new row for relation "recipe_ingredients" violates check constraint "${contrainte}"`,
});

test("les TROIS contraintes d'ingrédient se distinguent, sous le même 23514", () => {
  assert.equal(refusIngredient(msg("recipe_ingredients_nom_non_vide")), "nom-vide");
  assert.equal(refusIngredient(msg("recipe_ingredients_unite_fermee")), "unite-inconnue");
  assert.equal(refusIngredient(msg("recipe_ingredients_quantite_positive")), "quantite-negative");
});

test("un refus d'ingrédient inconnu reste générique", () => {
  assert.equal(refusIngredient(msg("contrainte_inventee")), "echec");
  assert.equal(refusIngredient({ code: "23503", message: "foreign key" }), "echec");
  assert.equal(refusIngredient(null), "echec");
  assert.equal(refusIngredient({ code: null, message: null }), "echec");
});

test("les quatre gardes de reorder_recipe_ingredients disent la même chose", () => {
  // Toutes rendent P0001 : l'utilisateur n'a qu'une action possible, rafraîchir.
  assert.equal(refusOrdreIngredients({ code: "P0001", message: "cardinal" }), "liste-changee");
  assert.equal(refusOrdreIngredients({ code: "P0001", message: "doublon" }), "liste-changee");
  assert.equal(refusOrdreIngredients({ code: "42501", message: "denied" }), "echec");
  assert.equal(refusOrdreIngredients(null), "echec");
});
