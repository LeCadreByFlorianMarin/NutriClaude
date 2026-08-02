import { test } from "node:test";
import assert from "node:assert/strict";
import { formaterPortions, formaterQuantite, formaterTemps } from "./lecture.ts";

/* ── formaterQuantite ─────────────────────────────────────────────────────── */

test("la quantité s'affiche avec le séparateur décimal FRANÇAIS", () => {
  /*
   * Le produit accepte « 0,5 » à la saisie (`normaliserQuantite` convertit la
   * virgule, parce qu'un clavier français en produit une) et réafficherait
   * « 0.5 » sans cette fonction — PostgREST rendant `quantity` en nombre JSON.
   * NFR-8 exige le français ; le membre doit relire ce qu'il a tapé.
   */
  assert.equal(formaterQuantite(0.5), "0,5");
  assert.equal(formaterQuantite(1.25), "1,25");
  assert.equal(formaterQuantite(0.05), "0,05");
});

test("un entier n'a pas de décimale postiche", () => {
  // `numeric(8,2)` stocke 400.00 ; PostgREST rend 400. On affiche « 400 ».
  assert.equal(formaterQuantite(400), "400");
  assert.equal(formaterQuantite(1), "1");
  assert.equal(formaterQuantite(0), "0");
});

test("aucune quantité rend null, jamais une chaîne vide", () => {
  /*
   * `null` est distinct de `""` : l'appelant doit décider de ne rien rendre du
   * tout, plutôt que d'insérer une chaîne vide qui laisserait une espace ou un
   * `<span>` orphelin dans la ligne d'ingrédient.
   */
  assert.equal(formaterQuantite(null), null);
});

test("le séparateur de milliers n'est PAS celui de la locale", () => {
  /*
   * `(1500).toLocaleString("fr-FR")` rend « 1 500 » avec une espace insécable
   * étroite (U+202F). Sur une quantité de cuisine, ce groupement n'apporte rien
   * et introduit un caractère invisible dans un texte qu'on relit — la famille
   * de caractères que `lib/texte.ts` passe son temps à retirer.
   */
  const rendu = formaterQuantite(1500);
  assert.equal(rendu, "1500");
  assert.ok(!/\s/u.test(rendu!), "aucune espace, fût-elle insécable");
});

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

test("les portions ne peuvent pas être nulles ou négatives, et on ne fait pas semblant", () => {
  /*
   * `recipes_servings_positif` (story 3.1) le garantit en base : `servings > 0`.
   * Traiter ces cas ici serait du code mort qui suggère une possibilité qui
   * n'existe pas. On se contente de ne pas produire d'absurdité si la garde
   * venait à sauter.
   */
  assert.equal(formaterPortions(0), "Pour 0 personne");
});
