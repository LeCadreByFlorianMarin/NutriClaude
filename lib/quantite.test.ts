import { test } from "node:test";
import assert from "node:assert/strict";
import { formaterQuantite } from "./quantite.ts";

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
