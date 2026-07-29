import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOM_RAYON,
  iconeTropLongue,
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

test("le nom de rayon est composé en NFC", () => {
  /*
   * « Crémerie » collé depuis une source en NFD s'écrit `e` + U+0301. Sans
   * composition, `unique (household_id, name)` compare octet à octet et laisse
   * coexister deux rayons identiques à l'œil, sans jamais rendre 23505.
   */
  const nfd = "Cre\u0301merie";
  const nfc = "Crémerie";
  assert.notEqual(nfd, nfc);
  assert.equal(normaliserNomRayon(nfd), nfc);
  assert.equal(normaliserNomRayon(nfc), nfc);
});

test("les invisibles qui ne sont pas des blancs sont retirés du nom", () => {
  /*
   * `trim()` couvre les blancs Unicode, `btrim` en base ne couvre que l'espace
   * ASCII — ni l'un ni l'autre ne voit ceux-ci. Sans eux dans la plage, un
   * rayon au nom entièrement invisible était créable (revue du 2026-07-29).
   */
  assert.equal(normaliserNomRayon("\u00AD"), null); // trait d'union conditionnel
  assert.equal(normaliserNomRayon("\u3164"), null); // remplisseur Hangul
  assert.equal(normaliserNomRayon("\u2800"), null); // braille blanc
  assert.equal(normaliserNomRayon("\u180E"), null); // séparateur mongol
  assert.equal(normaliserNomRayon("\u202E"), null); // forçage droite-à-gauche
  assert.equal(normaliserNomRayon("\u2800\u3164 \u00AD"), null);
});

test("un nom borné ne garde pas d'espace en fin de chaîne", () => {
  /*
   * `slice` coupe à un nombre d'unités, pas à une frontière de mot. Sans le
   * second `trim`, « Boucherie » et « Boucherie⎵ » sont deux noms distincts
   * pour l'unicité de la base, et aucun 23505 ne prévient.
   */
  const borne = normaliserNomRayon("a".repeat(MAX_NOM_RAYON - 1) + "  b");
  assert.equal(borne, "a".repeat(MAX_NOM_RAYON - 1));
  assert.equal(borne?.endsWith(" "), false);
});

test("une icône à plus d'un grapheme est signalée plutôt que tronquée", () => {
  assert.equal(iconeTropLongue("Fromages"), true);
  assert.equal(iconeTropLongue("🥬🥩"), true);
  assert.equal(iconeTropLongue("🥬 du texte"), true);
});

test("une icône d'un seul grapheme, ou vide, n'est pas trop longue", () => {
  assert.equal(iconeTropLongue("🥬"), false);
  assert.equal(iconeTropLongue("🇫🇷"), false);
  assert.equal(iconeTropLongue("🧑\u200D🍳"), false);
  assert.equal(iconeTropLongue("  \u200B🥬 "), false);
  // Vide : ce n'est pas un refus, l'icône est facultative.
  assert.equal(iconeTropLongue(""), false);
  assert.equal(iconeTropLongue("   "), false);
});

test("les deux fonctions d'icône s'accordent sur la même saisie nettoyée", () => {
  // Une saisie que `iconeTropLongue` accepte doit être exactement celle que
  // `normaliserIcone` rend sans rien perdre.
  for (const saisie of ["🥬", "🇫🇷", "🧑\u200D🍳", "\uFEFF🥬 ", "e\u0301"]) {
    assert.equal(iconeTropLongue(saisie), false);
    assert.equal(normaliserIcone(saisie), saisie.normalize("NFC").replace(/[\uFEFF]/g, "").trim());
  }
});
