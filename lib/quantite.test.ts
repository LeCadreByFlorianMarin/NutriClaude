import { test } from "node:test";
import assert from "node:assert/strict";
import { formaterQuantite, formaterQuantiteEtUnite } from "./quantite.ts";
import { UNITES } from "./recettes/unites.ts";

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

test("une quantité NON FINIE rend null, jamais « NaN » ni « ∞ »", () => {
  /*
   * ⛔ **Défaut mesuré en revue le 2026-08-12.** Seul `=== null` était gardé :
   * `formaterQuantite(NaN)` rendait la chaîne `"NaN"`, `Infinity` rendait `"∞"`,
   * et `ListeCourses` les affichait tels quels — « **NaN kg** » à droite de la
   * ligne, dans la liste de courses d'un membre.
   *
   * ⚠️ **Ce n'est pas théorique** : `quantity` est un `numeric(8,2)` sans
   * AUCUNE contrainte (la positivité est reportée à la 4.4, écrit dans l'en-tête
   * de la migration), `numeric` accepte le littéral `'NaN'`, et l'écriture de la
   * liste est client-direct. Le présentateur frère `lib/rayons/carte.ts` a reçu
   * son `Number.isInteger` le 2026-08-07 pour exactement ce défaut.
   */
  assert.equal(formaterQuantite(Number.NaN), null);
  assert.equal(formaterQuantite(Number.POSITIVE_INFINITY), null);
  assert.equal(formaterQuantite(Number.NEGATIVE_INFINITY), null);
});

/* ── formaterQuantiteEtUnite ──────────────────────────────────────────────── */

test("l'unité s'ACCORDE EN NOMBRE à partir de 2", () => {
  /*
   * ⛔ **Défaut mesuré en revue le 2026-08-12 : l'écran affichait « 2 pièce ».**
   * L'appariement vivait dans le JSX de `ListeCourses`, donc aucun test ne
   * pouvait l'atteindre — NFR-10 interdit un harnais de composants. Le descendre
   * dans `lib/quantite.ts` est ce qui rend le cas couvrable ; c'est la raison du
   * déplacement, pas un rangement.
   */
  assert.equal(formaterQuantiteEtUnite(2, "pièce"), "2 pièces");
  assert.equal(formaterQuantiteEtUnite(3, "pincée"), "3 pincées");
  assert.equal(formaterQuantiteEtUnite(1, "pièce"), "1 pièce");
});

test("la frontière du pluriel français est 2, donc 1,5 reste au SINGULIER", () => {
  // Règle française : le pluriel commence à 2, pas au-dessus de 1.
  assert.equal(formaterQuantiteEtUnite(1.5, "pièce"), "1,5 pièce");
  assert.equal(formaterQuantiteEtUnite(1.99, "pincée"), "1,99 pincée");
  assert.equal(formaterQuantiteEtUnite(2, "pincée"), "2 pincées");
});

test("un SYMBOLE d'unité ne prend jamais la marque du pluriel", () => {
  /*
   * Six des huit jetons du vocabulaire fermé sont des symboles : « 500 gs »
   * serait une faute. Le `Record<Unite, boolean>` de `quantite.ts` force à
   * trancher pour tout jeton neuf, plutôt que de laisser une `Set` l'ignorer.
   */
  assert.equal(formaterQuantiteEtUnite(500, "g"), "500 g");
  assert.equal(formaterQuantiteEtUnite(2, "kg"), "2 kg");
  assert.equal(formaterQuantiteEtUnite(3, "L"), "3 L");
  assert.equal(formaterQuantiteEtUnite(250, "ml"), "250 ml");
  assert.equal(formaterQuantiteEtUnite(2, "cs"), "2 cs");
  assert.equal(formaterQuantiteEtUnite(4, "cc"), "4 cc");
});

test("les huit jetons du vocabulaire fermé sont TOUS traités, aucun ne rend undefined", () => {
  /*
   * ⚠️ **Mesure d'un invariant entre deux fichiers, pas une affirmation** —
   * règle §4. `ACCORDE_EN_NOMBRE` est un `Record<Unite, boolean>`, donc le
   * compilateur refuse déjà un jeton manquant ; ce test mesure la même chose à
   * l'exécution, et surtout qu'aucun jeton ne sort déformé.
   */
  for (const unite of UNITES) {
    const rendu = formaterQuantiteEtUnite(2, unite);
    assert.ok(rendu !== null, `${unite} doit se rendre`);
    assert.ok(rendu.startsWith("2 "), `${unite} doit suivre la quantité`);
    assert.ok(
      rendu === `2 ${unite}` || rendu === `2 ${unite}s`,
      `${unite} rend « ${rendu} » : ni la forme simple ni l'accord`
    );
  }
});

test("une UNITÉ SANS QUANTITÉ ne rend rien — c'est la quantité qui commande", () => {
  /*
   * Le couple `(null, 'kg')` est possible et mesuré : `grocery_list_items_unite_fermee`
   * ne contraint que le VOCABULAIRE, rien ne couple les deux colonnes, et le
   * helper de test du dépôt insère précisément `{ name, unit }` sans `quantity`.
   * Rendre « kg » tout seul à droite de la ligne serait un mot d'unité sans rien
   * à mesurer — défaut trouvé en revue le 2026-08-07.
   */
  assert.equal(formaterQuantiteEtUnite(null, "kg"), null);
  assert.equal(formaterQuantiteEtUnite(null, null), null);
});

test("une quantité SANS unité rend le nombre nu", () => {
  // Un nombre nu (« 3 ») dit déjà quelque chose, contrairement à une unité nue.
  assert.equal(formaterQuantiteEtUnite(3, null), "3");
  assert.equal(formaterQuantiteEtUnite(0.5, null), "0,5");
});

test("une unité HORS VOCABULAIRE passe telle quelle, sans accord", () => {
  /*
   * Elle ne peut pas venir de l'application (contrainte en base + `<select>`) :
   * si elle arrive, c'est un appel forgé ou un défaut. La déformer masquerait le
   * signal — on veut la voir telle qu'elle est.
   */
  assert.equal(formaterQuantiteEtUnite(2, "bocal"), "2 bocal");
  assert.equal(formaterQuantiteEtUnite(2, "piece"), "2 piece");
});

test("la garde de finitude vaut aussi pour le couple quantité + unité", () => {
  assert.equal(formaterQuantiteEtUnite(Number.NaN, "kg"), null);
  assert.equal(formaterQuantiteEtUnite(Number.POSITIVE_INFINITY, "pièce"), null);
});
