import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserMultiligne, normaliserTexte } from "./texte.ts";

/**
 * Le piège que ce fichier existe pour tenir.
 *
 * `normaliserTexte` **détruit tous les retours à la ligne** — sa plage
 * `INVISIBLES` contient `\p{Cc}`, qui comprend U+000A. C'est voulu sur un champ
 * d'une ligne, où un saut de ligne collé est une saisie cassée. Ça devient une
 * perte de données sur `recipes.instructions`, le premier champ multiligne du
 * produit : le texte s'enregistre, il s'affiche, il est simplement aplati — sans
 * qu'aucun typage, lint, test ou contrainte ne le signale.
 *
 * Le premier test épingle donc le comportement de `normaliserTexte` LUI-MÊME.
 * Ce n'est pas un test de régression sur du code stable : c'est ce qui rend
 * visible, à la lecture, pourquoi il existe deux fonctions et non une.
 */

test("normaliserTexte APLATIT les retours à la ligne — c'est la raison d'être de normaliserMultiligne", () => {
  assert.equal(
    normaliserTexte("Étape 1\nÉtape 2\n\nÉtape 3", 4000),
    "Étape 1Étape 2Étape 3"
  );
});

test("normaliserMultiligne garde les retours à la ligne, y compris les lignes vides", () => {
  assert.equal(
    normaliserMultiligne("Étape 1\nÉtape 2\n\nÉtape 3", 4000),
    "Étape 1\nÉtape 2\n\nÉtape 3"
  );
});

test("les fins de ligne Windows et Mac historiques deviennent des \\n", () => {
  assert.equal(normaliserMultiligne("a\r\nb", 100), "a\nb");
  assert.equal(normaliserMultiligne("a\rb", 100), "a\nb");
  assert.equal(normaliserMultiligne("a\r\n\r\nb", 100), "a\n\nb");
});

test("les autres caractères de contrôle partent, le saut de ligne reste", () => {
  // Tabulation, retour arrière, échappement : \p{Cc} comme \n, mais sans sens ici.
  assert.equal(normaliserMultiligne("a\tb\nc", 100), "ab\nc");
  assert.equal(normaliserMultiligne("ab", 100), "ab");
  // U+200B (espace de largeur nulle), transporté par un copier-coller.
  assert.equal(normaliserMultiligne("a​b\nc", 100), "ab\nc");
  // U+2800 (braille blanc) : graphique pour Postgres, vide à l'œil.
  assert.equal(normaliserMultiligne("a⠀b", 100), "ab");
});

test("seuls les BORDS sont rognés — jamais les lignes vides intérieures", () => {
  assert.equal(normaliserMultiligne("\n\n  Étape 1\n\nÉtape 2  \n\n", 100), "Étape 1\n\nÉtape 2");
});

test("une saisie sans rien d'affichable rend null, jamais la chaîne vide", () => {
  // `null` distinct de `""` : sinon « vide » et « absent » coexistent dans la
  // colonne, deux états que l'écran de lecture devrait ensuite distinguer.
  assert.equal(normaliserMultiligne("", 100), null);
  assert.equal(normaliserMultiligne("   \n\n  \n", 100), null);
  assert.equal(normaliserMultiligne("​⠀", 100), null);
  assert.equal(normaliserMultiligne("\t\r\n", 100), null);
});

test("la composition NFC est appliquée, comme sur un champ d'une ligne", () => {
  // « é » en NFD (e + U+0301) est une chaîne DIFFÉRENTE de la même en NFC.
  const nfd = "Crémerie\nsuite";
  const rendu = normaliserMultiligne(nfd, 100);
  assert.equal(rendu, "Crémerie\nsuite");
  assert.equal(rendu, rendu?.normalize("NFC"));
});

test("le bornage compte des POINTS DE CODE, pas des unités UTF-16", () => {
  // 🍛 (U+1F35B) occupe 2 unités UTF-16 et 1 point de code, et n'a aucune
  // décomposition canonique. Un `slice` sur la chaîne couperait une paire de
  // substitution en deux : la demi-paire qui en sort n'est pas du JSON valide,
  // Postgres rend 22P02, non traduit — donc « Réessaie » en boucle.
  const dix = "🍛".repeat(10);
  const borne = normaliserMultiligne(dix, 4);
  assert.equal([...(borne ?? "")].length, 4);
  assert.equal(borne, "🍛".repeat(4));
});

test("NFC peut ALLONGER, et le bornage s'applique APRÈS", () => {
  /*
   * Le cas qui a fait échouer la première rédaction de ce fichier, et qui vaut
   * d'être figé : U+1D160 (croche) est en **exclusion de composition**. NFC le
   * décompose donc en TROIS points de code — tête, hampe, crochet — et ne le
   * recompose jamais. Une saisie de 10 symboles en fait 30 après composition.
   *
   * C'est ce que l'en-tête de `normaliserTexte` avertit en toutes lettres, et
   * c'est pourquoi `maxLength` sur l'élément ne peut pas tenir lieu de bornage :
   * il compte avant la composition, et il compte des unités UTF-16.
   */
  assert.equal([..."\u{1D160}"].length, 1);
  assert.equal([..."\u{1D160}".normalize("NFC")].length, 3);

  const borne = normaliserMultiligne("\u{1D160}".repeat(10), 4);
  assert.equal([...(borne ?? "")].length, 4);
});

test("le bornage ne laisse ni espace ni saut de ligne en fin de chaîne", () => {
  // Couper à un nombre de caractères ne tombe pas sur une frontière de mot.
  assert.equal(normaliserMultiligne("abc   def", 5), "abc");
  assert.equal(normaliserMultiligne("abc\n\ndef", 5), "abc");
});

test("le bornage ne peut PAS vider un texte déjà rogné", () => {
  /*
   * Écrit d'abord à l'envers — le test attendait `null` sur « ␣␣␣a » borné à 2,
   * et il avait tort. Le `trim()` qui précède le bornage garantit que le premier
   * caractère n'est pas un blanc ; la tranche le contient donc toujours, et le
   * second `trim()` ne peut pas la vider. Le repli `borne === "" ? null` de
   * `normaliserTexte` comme de `normaliserMultiligne` n'est atteignable qu'à
   * `maximum === 0`. Il reste, il est inoffensif — mais il ne fait pas ce qu'un
   * lecteur pressé lui prête, d'où ce test qui fige la vraie règle.
   */
  assert.equal(normaliserMultiligne("a" + " ".repeat(50), 1), "a");
  assert.equal(normaliserMultiligne(" ".repeat(3) + "a", 2), "a");
  assert.equal(normaliserMultiligne("abc", 0), null);
});
