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

test("l'arrondi de l'affichage n'entame pas ce que la colonne sait stocker", () => {
  /*
   * ⚠️ **Ce test mesure un invariant ENTRE DEUX FICHIERS**, il ne l'affirme pas —
   * règle §4 de `project-context.md`, et ce projet a déjà payé trois fois pour
   * l'avoir seulement affirmé.
   *
   * L'invariant : `formaterQuantite` pose `maximumFractionDigits: 2`, et la colonne
   * est un `numeric(8,2)`. Les deux doivent rester d'accord. `normaliserQuantite`
   * (`saisie.ts`) a justement SUPPRIMÉ son arrondi client au motif que « la parade
   * est de n'avoir qu'un seul arrondisseur : la colonne » — celui-ci n'est
   * acceptable que tant qu'il ne tranche rien que la base puisse rendre.
   *
   * Donc : sur les deux décimales que la colonne stocke, l'affichage est FIDÈLE.
   * Le jour où la migration passerait la colonne à `numeric(8,3)`, ce test tombe —
   * et c'est tout ce qu'on lui demande.
   */
  assert.equal(formaterQuantite(12.34), "12,34");
  assert.equal(formaterQuantite(99999.99), "99999,99");
  assert.equal(formaterQuantite(0.01), "0,01");

  /*
   * ⚠️ En revanche, au-delà de deux décimales, `Intl` ARRONDIT en silence — mesuré,
   * pas déduit. La base ne peut pas produire ces valeurs aujourd'hui ; l'épingler
   * documente ce que la fonction fait vraiment, plutôt que de laisser croire qu'elle
   * tronque ou qu'elle refuse.
   */
  assert.equal(formaterQuantite(1.005), "1,01");
  assert.equal(formaterQuantite(0.005), "0,01");
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
