import { test } from "node:test";
import assert from "node:assert/strict";
import { refusRayon } from "./erreurs.ts";

test("un nom déjà pris est reconnu par son SQLSTATE", () => {
  assert.equal(refusRayon({ code: "23505", message: "duplicate key value" }), "nom-pris");
});

test("un nom déjà pris est reconnu par le nom de la contrainte, sans code", () => {
  /*
   * Migration et déploiement applicatif ne sont jamais atomiques (Vercel et
   * Supabase se déploient séparément) : il y aura toujours une fenêtre où le JS
   * servi ne correspond pas à la base. Le repli sur le texte la couvre.
   */
  assert.equal(
    refusRayon({
      code: null,
      message: 'duplicate key value violates unique constraint "aisles_household_id_name_key"',
    }),
    "nom-pris",
  );
});

test("un nom vide refusé par la base est reconnu", () => {
  // La contrainte `aisles_name_non_vide` (23514). Le client normalise en amont,
  // mais un invisible non couvert passerait `btrim` côté base uniquement.
  assert.equal(refusRayon({ code: "23514", message: "violates check constraint" }), "nom-vide");
  assert.equal(
    refusRayon({ code: null, message: 'violates check constraint "aisles_name_non_vide"' }),
    "nom-vide",
  );
});

test("tout le reste retombe sur un refus générique", () => {
  assert.equal(refusRayon({ code: "42501", message: "permission denied" }), "echec");
  assert.equal(refusRayon({ code: null, message: "" }), "echec");
  assert.equal(refusRayon(null), "echec");
});

test("le code prime sur le texte", () => {
  // Un message trompeur ne doit pas l'emporter sur un SQLSTATE explicite.
  assert.equal(
    refusRayon({ code: "23514", message: 'unique constraint "aisles_household_id_name_key"' }),
    "nom-vide",
  );
});
