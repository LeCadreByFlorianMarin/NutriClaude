import { test } from "node:test";
import assert from "node:assert/strict";
import { formaterPortions, formaterTemps } from "./lecture.ts";

/* ── formaterTemps ────────────────────────────────────────────────────────── */

test("les deux temps sont distingués, jamais additionnés", () => {
  /*
   * La story 3.1 a gardé deux champs parce qu'un livre de cuisine sépare le
   * temps actif du temps passif. Les fusionner à l'affichage défairait la
   * décision et annoncerait « 45 min » pour une recette qui demande 15 min de
   * présence.
   */
  assert.equal(
    formaterTemps(15, 30),
    "15 min de préparation, 30 min de cuisson"
  );
});

test("un seul temps renseigné n'annonce que celui-là", () => {
  assert.equal(formaterTemps(15, null), "15 min de préparation");
  assert.equal(formaterTemps(null, 30), "30 min de cuisson");
});

test("aucun temps rend null — pas même l'intitulé (AC3)", () => {
  assert.equal(formaterTemps(null, null), null);
});

test("ZÉRO s'affiche, parce que zéro est une réponse", () => {
  /*
   * ⚠️ Le piège de cette fonction, et la décision 3 du 2026-08-02. `0` est une
   * valeur SAISIE — « pas de cuisson » — distincte de `null`, qui veut dire
   * « non renseigné ». Un `if (!temps)` attraperait les deux et confondrait
   * « je n'ai pas répondu » avec « il n'y en a pas », EN SILENCE.
   */
  assert.equal(formaterTemps(0, null), "0 min de préparation");
  assert.equal(formaterTemps(null, 0), "0 min de cuisson");
  assert.equal(formaterTemps(0, 0), "0 min de préparation, 0 min de cuisson");
  assert.equal(formaterTemps(15, 0), "15 min de préparation, 0 min de cuisson");
});

/* ── formaterPortions ─────────────────────────────────────────────────────── */

test("l'accord singulier / pluriel", () => {
  assert.equal(formaterPortions(1), "Pour 1 personne");
  assert.equal(formaterPortions(2), "Pour 2 personnes");
  assert.equal(formaterPortions(12), "Pour 12 personnes");
});

test("si la garde en base sautait, l'accord ne produirait pas d'absurdité", () => {
  /*
   * `recipes_servings_positif` (story 3.1) garantit `servings > 0` en base, et
   * `servings` est `not null`. Ces valeurs sont donc INATTEIGNABLES aujourd'hui :
   * traiter le cas dans la fonction serait du code mort qui suggère une
   * possibilité qui n'existe pas. On mesure seulement ce que l'accord rendrait.
   *
   * ⚠️ Le nom précédent — « les portions ne peuvent pas être nulles ou négatives »
   * — annonçait deux cas dont il n'éprouvait aucun : `null` est impossible par
   * typage, et le négatif n'était pas assert. Trouvé par la revue du 2026-08-02.
   * Le négatif est ajouté ici, et il montre la limite : « Pour -1 personne » au
   * singulier, parce que l'accord teste `> 1`. C'est ce que fait la fonction ;
   * l'épingler vaut mieux que de le découvrir un jour sur un écran.
   */
  assert.equal(formaterPortions(0), "Pour 0 personne");
  assert.equal(formaterPortions(-1), "Pour -1 personne");
  assert.equal(formaterPortions(-3), "Pour -3 personne");
});
