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

test("au-delà de ce qu'un int Postgres retient, la faute est HORS-BORNES, pas « illisible »", () => {
  /*
   * ⚠️ **CE TEST ÉPINGLAIT LE DÉFAUT COMME S'IL ÉTAIT LE CONTRAT.** Il exigeait
   * `{ faute: "illisible" }` pour `2147483648` — c'est-à-dire la même faute que pour
   * « abc », donc le message « Un nombre de personnes s'écrit en chiffres. » rendu à
   * quelqu'un qui vient de taper **uniquement des chiffres**. Un conseil qu'il a déjà
   * suivi, et dont il ne peut pas sortir sans deviner qu'un plafond existe.
   *
   * C'est exactement le défaut que l'en-tête du module se vantait d'avoir évité, et
   * que la revue adversariale du 2026-08-04 a trouvé — dans le module ET dans son
   * test. Un test peut figer un défaut aussi solidement qu'il protège une règle.
   *
   * Sans borne, la base rendrait `22003`, un code que rien ne traduit. Même partage
   * que `normaliserQuantite` face à `numeric(8,2)`, qui distingue déjà « illisible »
   * de « hors-bornes ».
   */
  assert.deepEqual(analyserPersonnes("2147483648"), { faute: "trop-grand" });
  assert.deepEqual(analyserPersonnes("99999999999999999999"), { faute: "trop-grand" });
  // La borne exacte, elle, passe.
  assert.deepEqual(analyserPersonnes("2147483647"), { valeur: 2147483647 });
});

test("les trois fautes sont distinctes — c'est tout l'intérêt de les nommer", () => {
  /*
   * Le contrat que les écrans traduisent en messages : « ce n'est pas un nombre »,
   * « c'est trop peu » et « c'est trop » appellent trois conseils différents. Les
   * confondre enferme l'utilisateur dans une boucle.
   */
  const fautes = ["abc", "0", "2147483648"].map((s) => {
    const a = analyserPersonnes(s);
    return "faute" in a ? a.faute : "aucune";
  });
  assert.deepEqual(fautes, ["illisible", "trop-peu", "trop-grand"]);
  assert.equal(new Set(fautes).size, 3, "les trois fautes ne doivent pas se confondre");
});
