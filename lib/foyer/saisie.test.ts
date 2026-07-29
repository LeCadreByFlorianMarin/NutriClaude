import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PRENOM,
  normaliserCode,
  normaliserNomFoyer,
  normaliserPrenom,
} from "./saisie.ts";

test("le prénom perd ses espaces de bord", () => {
  assert.equal(normaliserPrenom("  Flo  "), "Flo");
  assert.equal(normaliserPrenom("Flo"), "Flo");
});

test("un prénom sans rien d'affichable rend null", () => {
  assert.equal(normaliserPrenom(""), null);
  assert.equal(normaliserPrenom("   "), null);
  assert.equal(normaliserPrenom("\t\n"), null);
  // Ceux-ci passaient `trim()` et produisaient « Salut . » sur l'accueil.
  assert.equal(normaliserPrenom("\u200B"), null);
  assert.equal(normaliserPrenom(" \u200B \uFEFF "), null);
  assert.equal(normaliserPrenom("\u200E\u200F"), null);
});

test("les invisibles au milieu d'un prénom légitime disparaissent sans l'abîmer", () => {
  assert.equal(normaliserPrenom("Fl\u200Bo"), "Flo");
  assert.equal(normaliserPrenom("Zoé"), "Zoé");
  assert.equal(normaliserPrenom("Jean-Marc"), "Jean-Marc");
});

test("le prénom est borné", () => {
  const long = "a".repeat(500);
  assert.equal(normaliserPrenom(long)?.length, MAX_PRENOM);
});

test("le nom de foyer suit la même règle, avec sa propre borne", () => {
  assert.equal(normaliserNomFoyer("  Chez les Marin "), "Chez les Marin");
  assert.equal(normaliserNomFoyer(" \u200B "), null);
  assert.equal(normaliserNomFoyer("x".repeat(500))?.length, 60);
});

test("le code perd espaces, séparateurs et casse", () => {
  assert.equal(normaliserCode("388b 626a"), "388B626A");
  assert.equal(normaliserCode("388B-626A"), "388B626A");
  assert.equal(normaliserCode("388B.626A"), "388B626A");
  assert.equal(normaliserCode(" 388b626a\n"), "388B626A");
});

test("les confusions de lecture sans perte possible sont corrigées", () => {
  // Les codes sont hexadécimaux : O, I et L n'y apparaissent jamais.
  assert.equal(normaliserCode("3O8B626A"), "308B626A");
  assert.equal(normaliserCode("3I8B626A"), "318B626A");
  assert.equal(normaliserCode("3l8b626a"), "318B626A");
});

test("un code déjà propre traverse sans changer", () => {
  assert.equal(normaliserCode("388B626A"), "388B626A");
  assert.equal(normaliserCode(""), "");
});
