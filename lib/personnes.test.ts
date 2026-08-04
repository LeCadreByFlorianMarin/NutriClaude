import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserPersonnes } from "./personnes.ts";

/**
 * La saisie d'un nombre de personnes, et **pourquoi** elle est refusée.
 *
 * Le contrat que ce fichier épingle est celui de deux contraintes en base —
 * `meal_plan_entries_servings_positif` et `households_default_servings_positif`
 * (`20260804144217`). Que les deux côtés soient d'accord ne s'affirme pas : c'est
 * `supabase/tests/contraintes.test.ts` qui le mesure (règle §4).
 */

test("un nombre de personnes normal est accepté", () => {
  for (const saisie of ["1", "2", "4", "12", " 6 "]) {
    const analyse = analyserPersonnes(saisie);
    assert.ok("valeur" in analyse, `« ${saisie} » doit être accepté`);
  }
  assert.deepEqual(analyserPersonnes("4"), { valeur: 4 });
});

test("zéro et le négatif sont refusés — mais PAS comme « illisible »", () => {
  /*
   * ⚠️ **Deux fautes distinctes, et c'est tout le point.** « 0 » est parfaitement
   * lisible : répondre « ça s'écrit en chiffres » à quelqu'un qui vient d'écrire
   * un chiffre est un conseil qu'il a déjà suivi, et un conseil qui ne peut pas
   * fonctionner enferme l'utilisateur dans une boucle. C'est le défaut corrigé le
   * 2026-08-03 sur les quantités d'ingrédients, transposé ici avant de le
   * commettre.
   */
  assert.deepEqual(analyserPersonnes("0"), { faute: "trop-peu" });
  assert.deepEqual(analyserPersonnes("-1"), { faute: "trop-peu" });
  assert.deepEqual(analyserPersonnes("-12"), { faute: "trop-peu" });
});

test("le champ vidé est refusé, et jamais lu comme zéro", () => {
  /*
   * ⚠️ **`Number("")` vaut 0**, et c'est le piège de tout champ numérique : sans
   * garde, vider le champ enregistrerait « 0 personne » — que la base refuserait
   * ensuite par un `23514` que rien ne traduit, sur un champ que l'utilisateur
   * voit vide.
   */
  assert.deepEqual(analyserPersonnes(""), { faute: "illisible" });
  assert.deepEqual(analyserPersonnes("   "), { faute: "illisible" });
});

test("ce qui n'est pas un entier est illisible", () => {
  /*
   * ⚠️ **`type="number"` accepte plus que des chiffres** : « e », « + », « - » et
   * le séparateur décimal local. « 2e3 » est une saisie valide pour le navigateur.
   *
   * ⚠️ **Une demi-personne n'existe pas** — contrairement à une quantité
   * d'ingrédient, où « 0,5 » est légitime. `servings` est un `int` en base.
   */
  for (const saisie of ["deux", "2e3", "2,5", "2.5", "٤", "1 2", "NaN", "Infinity"]) {
    assert.deepEqual(
      analyserPersonnes(saisie),
      { faute: "illisible" },
      `« ${saisie} » n'est pas un nombre de personnes`
    );
  }
});

test("au-delà de ce qu'un int Postgres retient, on refuse plutôt que de laisser passer", () => {
  /*
   * ⚠️ **Sinon la base rend `22003`**, un code que rien ne traduit — donc
   * « Réessaie » en boucle sur une saisie que retenter à l'identique ne corrigera
   * jamais. Même parade que `normaliserQuantite` face à `numeric(8,2)`.
   */
  assert.deepEqual(analyserPersonnes("2147483648"), { faute: "illisible" });
  assert.deepEqual(analyserPersonnes("99999999999999999999"), { faute: "illisible" });
  // La borne exacte, elle, passe.
  assert.deepEqual(analyserPersonnes("2147483647"), { valeur: 2147483647 });
});
