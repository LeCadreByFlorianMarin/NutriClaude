import { test } from "node:test";
import assert from "node:assert/strict";
import { refusOrdre, refusRayon } from "./erreurs.ts";

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

// ── refusOrdre — les refus de `reorder_aisles` ──────────────────────────────

test("les quatre gardes de reorder_aisles disent toutes la même chose", () => {
  /*
   * `raise exception` sans `errcode` rend P0001 — mesuré. Les quatre gardes le
   * rendent, et du point de vue de l'utilisateur elles disent une seule chose :
   * la liste envoyée ne correspond plus à la base. La distinction entre elles
   * n'intéresse que le développeur, et elle part dans `console.error`.
   */
  for (const message of [
    "Aucun rayon à ordonner",
    "Un rayon est cité deux fois",
    "La liste des rayons a changé (5 cités, 11 en base)",
    "La liste des rayons a changé (0 déplacés sur 11)",
  ]) {
    assert.equal(refusOrdre({ code: "P0001", message }), "liste-changee");
  }
});

test("tout autre refus d'ordre reste générique", () => {
  assert.equal(refusOrdre({ code: "42501", message: "permission denied" }), "echec");
  assert.equal(refusOrdre({ code: null, message: "" }), "echec");
  assert.equal(refusOrdre(null), "echec");
});

test("refusOrdre ne lit jamais le texte du message", () => {
  /*
   * Le message de la fonction n'est pas destiné à l'écran (NFR-8) et n'est pas
   * un contrat : le reformuler en base ne doit rien casser côté client. Sans
   * code, on retombe donc sur "echec" même si le texte est parlant.
   */
  assert.equal(refusOrdre({ code: null, message: "La liste des rayons a changé" }), "echec");
});
