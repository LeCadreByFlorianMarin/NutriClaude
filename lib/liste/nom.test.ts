import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserNomArticle, MAX_NOM_ARTICLE } from "./nom.ts";

/**
 * Le pur du nom d'article (story 4.4).
 *
 * ⛔ **Ce que ce fichier NE teste PAS, et c'est délibéré : la clé canonique.** Elle
 * vit dans l'expression de l'index, côté serveur. Un test applicatif qui la
 * reproduirait créerait la seconde source de vérité qu'AD-1/AD-6 refusent — et
 * mesurerait sa propre copie. Son comportement réel se mesure dans
 * `supabase/tests/isolation.test.ts`, contre une vraie base.
 */

test("le nom garde sa casse, ses accents et sa mise en forme", () => {
  /*
   * ⛔ **LE TEST QUI DIT LA DIFFÉRENCE ENTRE LES DEUX NORMALISATIONS.** Le serveur
   * plie « Crème fraîche » en `cremefraiche` pour DÉCIDER de l'égalité ; ce que le
   * membre a tapé n'est jamais réécrit. Confondre les deux effacerait les accents
   * dans la donnée, et l'écran afficherait « Creme fraiche ».
   */
  assert.equal(normaliserNomArticle("Crème fraîche"), "Crème fraîche");
  assert.equal(normaliserNomArticle("LAIT Entier"), "LAIT Entier");
});

test("les bords sont rognés, l'intérieur ne l'est pas", () => {
  assert.equal(normaliserNomArticle("  Pommes  "), "Pommes");
  assert.equal(normaliserNomArticle("Huile d'olive"), "Huile d'olive");
});

test("une saisie sans rien d'affichable rend null, jamais la chaîne vide", () => {
  /*
   * `null` est distinct de `""` : l'écran doit pouvoir refuser l'ajout plutôt que
   * d'envoyer un nom vide que `grocery_list_items_nom_non_vide` rejetterait avec un
   * code que rien ne traduit.
   */
  assert.equal(normaliserNomArticle(""), null);
  assert.equal(normaliserNomArticle("   "), null);
  assert.equal(normaliserNomArticle("​­"), null);
});

test("le bornage compte des POINTS DE CODE, pas des unités UTF-16", () => {
  /*
   * ⚠️ Un emoji occupe 2 unités UTF-16. Borner avec `slice` couperait une paire de
   * substitution en deux et stockerait un demi-caractère, affiché en carré blanc.
   */
  const long = "🥬".repeat(MAX_NOM_ARTICLE + 10);
  const rendu = normaliserNomArticle(long);
  assert.equal([...rendu!].length, MAX_NOM_ARTICLE);
  assert.ok(!rendu!.endsWith("\uD83E"), "une demi-paire de substitution a été laissée");
});

test("la borne est celle de la CONTRAINTE, et elle est plus large que celle d'un rayon", () => {
  /*
   * ⚠️ **Mesure d'un invariant entre deux fichiers** (règle §4) :
   * `grocery_list_items_nom_borne` vaut 200 en base. Un nom de rayon vaut 40, parce
   * qu'il s'affiche en eyebrow capitales ; un article s'affiche sur une ligne qui
   * sait s'enrouler.
   */
  assert.equal(MAX_NOM_ARTICLE, 200);
  const pile = normaliserNomArticle("a".repeat(200));
  assert.equal(pile?.length, 200, "un nom de 200 caractères doit passer entier");
});
