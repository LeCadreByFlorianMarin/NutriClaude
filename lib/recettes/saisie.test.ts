import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DESCRIPTION,
  MAX_INSTRUCTIONS,
  MAX_TITRE,
  estUuid,
  normaliserDescription,
  normaliserEntier,
  normaliserInstructions,
  normaliserQuantite,
  normaliserTitre,
} from "./saisie.ts";

test("le titre perd ses bords et ses invisibles", () => {
  assert.equal(normaliserTitre("  Curry de pois chiches  "), "Curry de pois chiches");
  assert.equal(normaliserTitre("Cur​ry"), "Curry");
  assert.equal(normaliserTitre("Œufs à la coque"), "Œufs à la coque");
  assert.equal(normaliserTitre("🍛 Curry"), "🍛 Curry");
});

test("un titre sans rien d'affichable rend null", () => {
  assert.equal(normaliserTitre(""), null);
  assert.equal(normaliserTitre("   "), null);
  assert.equal(normaliserTitre("\t\n"), null);
  assert.equal(normaliserTitre("​"), null);
  // U+3164 (remplisseur Hangul) : la base le refuse aussi, et
  // `supabase/tests/contraintes.test.ts` mesure que les deux s'accordent.
  assert.equal(normaliserTitre("ㅤ"), null);
});

test("un titre sur plusieurs lignes est APLATI, et c'est voulu", () => {
  // Un titre tient sur une ligne : il s'affiche en `<h1>` et en ligne de
  // répertoire. Un saut de ligne collé y est une saisie cassée, pas une mise en
  // forme — contrairement aux instructions.
  assert.equal(normaliserTitre("Curry\nde pois chiches"), "Curryde pois chiches");
});

test("les trois champs sont bornés, chacun à sa longueur", () => {
  assert.equal([...(normaliserTitre("a".repeat(500)) ?? "")].length, MAX_TITRE);
  assert.equal([...(normaliserDescription("a".repeat(900)) ?? "")].length, MAX_DESCRIPTION);
  assert.equal([...(normaliserInstructions("a".repeat(9000)) ?? "")].length, MAX_INSTRUCTIONS);
});

test("les instructions gardent leur mise en forme — c'est l'AC de la story 3.3", () => {
  const recette = "Faire revenir l'oignon.\n\n1. Ajouter les épices\n2. Mouiller";
  assert.equal(normaliserInstructions(recette), recette);
});

test("la description est une phrase, donc elle est aplatie comme le titre", () => {
  assert.equal(normaliserDescription("Rapide\net végé"), "Rapideet végé");
});

test("un champ multiligne vide rend null, jamais la chaîne vide", () => {
  assert.equal(normaliserInstructions(""), null);
  assert.equal(normaliserInstructions("\n\n  \n"), null);
  assert.equal(normaliserDescription("   "), null);
});

/* ── normaliserEntier ─────────────────────────────────────────────────────── */

test("un champ numérique vidé rend null, jamais 0", () => {
  // LE piège : `Number("")` vaut 0. Un champ « cuisson » vidé enregistrerait
  // « 0 minute » au lieu de « pas renseigné », et pour `servings`, 0 est
  // précisément la valeur que la base refuse — l'utilisateur verrait une erreur
  // pour avoir EFFACÉ un champ.
  assert.equal(normaliserEntier(""), null);
  assert.equal(normaliserEntier("   "), null);
});

test("un entier écrit normalement est rendu tel quel", () => {
  assert.equal(normaliserEntier("4"), 4);
  assert.equal(normaliserEntier(" 4 "), 4);
  assert.equal(normaliserEntier("0"), 0);
  assert.equal(normaliserEntier("-3"), -3);
  assert.equal(normaliserEntier("120"), 120);
});

test("0 est RENDU, pas refusé — c'est à l'appelant de décider", () => {
  // Refuser 0 ici mêlerait deux règles : « ce n'est pas un entier » et « une
  // recette pour 0 personne n'a pas de sens ». La seconde appartient à la
  // contrainte `recipes_servings_positif` et à l'écran, pas au normalisateur —
  // et `cook_time_min` à 0 est parfaitement légitime.
  assert.equal(normaliserEntier("0"), 0);
});

test("tout ce qui n'est pas un entier décimal rend null", () => {
  // `<input type="number">` accepte « e », « + », « - » et le séparateur
  // décimal local : « 2e3 » est une saisie valide POUR LE NAVIGATEUR.
  assert.equal(normaliserEntier("2e3"), null);
  assert.equal(normaliserEntier("2,5"), null);
  assert.equal(normaliserEntier("2.5"), null);
  assert.equal(normaliserEntier("+4"), null);
  assert.equal(normaliserEntier("4 personnes"), null);
  assert.equal(normaliserEntier("abc"), null);
  assert.equal(normaliserEntier("Infinity"), null);
  assert.equal(normaliserEntier("0x10"), null);
});

test("les chiffres non ASCII rendent null plutôt qu'un nombre surprise", () => {
  // `Number("٤")` vaut 4 (chiffre arabe-indien) : accepter en silence une forme
  // qu'aucun `<input type="number">` n'émet ouvrirait un chemin non éprouvé.
  assert.equal(normaliserEntier("٤"), null);
  assert.equal(normaliserEntier("４"), null);
});

test("un entier hors des bornes d'un int Postgres rend null", () => {
  // `servings` et les deux temps sont des `int` : au-delà, Postgres rend 22003,
  // que rien ne traduit — donc « Réessaie » en boucle sur une saisie fautive.
  assert.equal(normaliserEntier("2147483648"), null);
  assert.equal(normaliserEntier("-2147483649"), null);
  assert.equal(normaliserEntier("2147483647"), 2147483647);
  assert.equal(normaliserEntier("-2147483648"), -2147483648);
});

/* ── estUuid ──────────────────────────────────────────────────────────────── */

test("un uuid canonique est reconnu, quelle que soit sa casse", () => {
  assert.equal(estUuid("11111111-1111-1111-1111-111111111111"), true);
  assert.equal(estUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(estUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), true);
});

test("ce qui n'est pas un uuid est refusé AVANT d'atteindre la base", () => {
  /*
   * `/recettes/pizza/modifier` enverrait « pizza » à PostgREST, qui rend 22P02 —
   * un code que rien ne traduit, donc « Réessaie dans un instant » sur une URL
   * qui sera toujours aussi fausse au deuxième essai.
   */
  assert.equal(estUuid("pizza"), false);
  assert.equal(estUuid(""), false);
  assert.equal(estUuid("11111111111111111111111111111111"), false);
  assert.equal(estUuid("{11111111-1111-1111-1111-111111111111}"), false);
  assert.equal(estUuid("11111111-1111-1111-1111-111111111111 "), false);
  assert.equal(estUuid("gggggggg-1111-1111-1111-111111111111"), false);
  // Une injection tentée par l'URL n'atteint pas la requête.
  assert.equal(estUuid("1' or '1'='1"), false);
});

/* ── normaliserQuantite ───────────────────────────────────────────────────── */

test("une quantité vide rend null — « du sel » est un ingrédient légitime", () => {
  assert.equal(normaliserQuantite(""), null);
  assert.equal(normaliserQuantite("   "), null);
});

test("les quantités décimales passent, virgule française comprise", () => {
  // Un clavier français produit une virgule, et `Number("0,5")` vaut NaN.
  assert.equal(normaliserQuantite("0,5"), 0.5);
  assert.equal(normaliserQuantite("1.5"), 1.5);
  assert.equal(normaliserQuantite("2"), 2);
  assert.equal(normaliserQuantite(" 250 "), 250);
  assert.equal(normaliserQuantite("0"), 0);
  assert.equal(normaliserQuantite(",5"), 0.5);
});

test("le négatif est RENDU, pas refusé — c'est à la base de trancher", () => {
  /*
   * Même partage qu'avec `normaliserEntier` : « ce n'est pas un nombre » est une
   * règle de forme, « une quantité négative n'a pas de sens » est une règle
   * métier, et elle vit dans `recipe_ingredients_quantite_positive`.
   */
  assert.equal(normaliserQuantite("-3"), -3);
});

test("la quantité N'EST PAS arrondie ici — un seul arrondisseur, la colonne", () => {
  /*
   * Écrit d'abord à l'envers. La première rédaction arrondissait « pour que le
   * client et la base s'accordent » ; mesuré, elle les faisait DIVERGER sur un
   * demi exact — Postgres arrondit au plus loin de zéro (`1.005::numeric(8,2)`
   * → 1.01), `toFixed` rend 1.00 parce que le flottant vaut 1.00499….
   *
   * Répliquer l'arithmétique décimale de Postgres en flottant reviendrait à
   * AFFIRMER un invariant entre deux endroits. On le supprime en n'ayant qu'un
   * seul arrondisseur : la colonne. La réduction reste visible au rechargement.
   */
  assert.equal(normaliserQuantite("0,333"), 0.333);
  assert.equal(normaliserQuantite("1,005"), 1.005);
  assert.equal(normaliserQuantite("2,675"), 2.675);
});

test("au-delà de ce que numeric(8,2) accepte, on refuse", () => {
  // Postgres rendrait `22003`, que rien ne traduit — donc « Réessaie » en boucle.
  assert.equal(normaliserQuantite("999999.99"), 999999.99);
  assert.equal(normaliserQuantite("1000000"), null);
  assert.equal(normaliserQuantite("-1000000"), null);
});

test("tout ce qui n'est pas un nombre décimal rend null", () => {
  assert.equal(normaliserQuantite("2e3"), null);
  assert.equal(normaliserQuantite("+2"), null);
  assert.equal(normaliserQuantite("2 g"), null);
  assert.equal(normaliserQuantite("une pincée"), null);
  assert.equal(normaliserQuantite("1,2,3"), null);
  assert.equal(normaliserQuantite("."), null);
  assert.equal(normaliserQuantite(","), null);
  assert.equal(normaliserQuantite("Infinity"), null);
  assert.equal(normaliserQuantite("٤"), null);
});
