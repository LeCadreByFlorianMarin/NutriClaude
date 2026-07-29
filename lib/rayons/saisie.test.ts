import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOM_RAYON,
  normaliserIcone,
  normaliserNomRayon,
  prochainOrdre,
} from "./saisie.ts";

test("le nom de rayon perd ses espaces de bord", () => {
  assert.equal(normaliserNomRayon("  Boucherie  "), "Boucherie");
  assert.equal(normaliserNomRayon("Boucherie"), "Boucherie");
});

test("un nom de rayon sans rien d'affichable rend null", () => {
  assert.equal(normaliserNomRayon(""), null);
  assert.equal(normaliserNomRayon("   "), null);
  assert.equal(normaliserNomRayon("\t\n"), null);
  // `btrim` en base ne les voit pas : c'est la raison d'être de ce filtre.
  assert.equal(normaliserNomRayon("\u200B"), null);
  assert.equal(normaliserNomRayon(" \u200B \uFEFF "), null);
});

test("les invisibles au milieu d'un nom légitime disparaissent sans l'abîmer", () => {
  assert.equal(normaliserNomRayon("Bou\u200Bcherie"), "Boucherie");
  assert.equal(normaliserNomRayon("Fruits & Légumes"), "Fruits & Légumes");
  assert.equal(normaliserNomRayon("Épicerie sèche"), "Épicerie sèche");
});

test("le nom de rayon est borné", () => {
  assert.equal(normaliserNomRayon("a".repeat(500))?.length, MAX_NOM_RAYON);
});

test("l'icône garde un emoji entier, quel que soit son nombre d'unités UTF-16", () => {
  // 🥬 = 2 unités UTF-16. `slice(0, 1)` en rendrait la moitié.
  assert.equal(normaliserIcone("🥬"), "🥬");
  // Drapeau = deux indicateurs régionaux, 4 unités UTF-16.
  assert.equal(normaliserIcone("🇫🇷"), "🇫🇷");
});

test("l'icône garde une séquence à jointure de largeur nulle entière", () => {
  /*
   * Le piège de ce fichier. U+200D (ZWJ) tombe dans la plage d'invisibles que
   * `lib/texte.ts` retire — appliquer la même normalisation qu'à un nom
   * couperait 🧑\u200D🍳 en 🧑 + 🍳, et le premier grapheme deviendrait 🧑.
   */
  assert.equal(normaliserIcone("🧑\u200D🍳"), "🧑\u200D🍳");
  assert.equal(normaliserIcone("👨\u200D👩\u200D👧"), "👨\u200D👩\u200D👧");
});

test("l'icône ne garde que le premier grapheme", () => {
  assert.equal(normaliserIcone("🥬🥩"), "🥬");
  assert.equal(normaliserIcone("🥬 du texte"), "🥬");
  assert.equal(normaliserIcone("ab"), "a");
});

test("une icône vide, ou faite d'invisibles seuls, rend null", () => {
  assert.equal(normaliserIcone(""), null);
  assert.equal(normaliserIcone("   "), null);
  assert.equal(normaliserIcone("\u200B"), null);
  assert.equal(normaliserIcone("\uFEFF \u200E"), null);
});

test("un invisible collé devant l'emoji ne le fait pas perdre", () => {
  // Un collage depuis une messagerie transporte volontiers un U+200B en tête.
  assert.equal(normaliserIcone("\u200B🥬"), "🥬");
  assert.equal(normaliserIcone("\uFEFF🧑\u200D🍳"), "🧑\u200D🍳");
});

test("le prochain ordre place le rayon en fin de parcours", () => {
  assert.equal(prochainOrdre([]), 10);
  assert.equal(prochainOrdre([{ ordre: 10 }, { ordre: 20 }]), 30);
  // Le jeu par défaut monte à 999 (« Autre »).
  assert.equal(prochainOrdre([{ ordre: 10 }, { ordre: 999 }, { ordre: 100 }]), 1009);
});

test("le prochain ordre ne dépend pas de l'ordre de la liste reçue", () => {
  assert.equal(prochainOrdre([{ ordre: 999 }, { ordre: 10 }]), 1009);
  assert.equal(prochainOrdre([{ ordre: 10 }, { ordre: 999 }]), 1009);
});

test("le prochain ordre survit à des positions négatives", () => {
  // `sort_order` est un `int` signé : rien en base n'interdit le négatif, et
  // `Math.max()` sur une liste vide rend -Infinity.
  assert.equal(prochainOrdre([{ ordre: -50 }]), -40);
});
