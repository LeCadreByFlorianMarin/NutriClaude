import { test } from "node:test";
import assert from "node:assert/strict";
import { REPAS, repasParSlug, type CodeRepas } from "./menu.ts";

/**
 * Le pur de `lib/menu/menu.ts` : la table des repas et la garde du paramètre
 * d'URL qui en dérive.
 *
 * **Ce que ce fichier n'éprouve PAS, et pourquoi.** `casesDeLaSemaine`,
 * `casesDeRecette` et `grouperParCase` parlent à la base ou en dépendent : un
 * faux client prouverait le mapping et jamais l'isolation, et c'est
 * `test:isolation` qui porte ce contrôle. Même partage que `recettes.ts`,
 * `ingredients.ts` et `rayons.ts`, dont aucun n'a de fichier de test.
 */

test("les quatre repas que la base admet, dans l'ordre de la journée", () => {
  /*
   * ⚠️ **Ce test épingle un contrat inter-langage.** Les quatre `code` sont ceux
   * du `check` de `meal_plan_entries.meal_type` (`initial_schema.sql:180`) ; les
   * en changer un rendrait un état stockable et non affichable, et l'Epic 7
   * ouvrira une seconde surface capable de l'écrire. L'ORDRE, lui, est une
   * décision de Florian du 2026-08-04 — chronologique, la collation entre midi
   * et le soir.
   */
  assert.deepEqual(
    REPAS.map((r) => r.code),
    ["breakfast", "lunch", "snack", "dinner"]
  );
});

test("chaque repas porte un slug français, et les slugs sont distincts", () => {
  /*
   * Le slug est ce qui paraît dans l'URL (`/menu/2026-08-04/midi`). Deux repas
   * qui partageraient un slug rendraient une case inatteignable — en silence,
   * puisque `repasParSlug` rendrait toujours le premier.
   */
  const slugs = REPAS.map((r) => r.slug);
  assert.deepEqual(slugs, ["petit-dej", "midi", "collation", "soir"]);
  assert.equal(new Set(slugs).size, REPAS.length, "les slugs sont uniques");
});

test("aucun slug n'a besoin d'être encodé dans une URL", () => {
  /*
   * ⚠️ **Le piège est l'accent.** « petit-déj » paraîtrait `petit-d%C3%A9j` dans
   * la barre d'adresse, et un lien copié-collé deviendrait illisible. La garde
   * est ici plutôt que dans une revue : elle attrape aussi le slug qu'on
   * ajouterait plus tard sans y penser.
   */
  for (const repas of REPAS) {
    assert.equal(
      encodeURIComponent(repas.slug),
      repas.slug,
      `le slug « ${repas.slug} » doit traverser une URL tel quel`
    );
  }
});

test("repasParSlug rend le repas, et null sur tout le reste", () => {
  assert.equal(repasParSlug("midi")?.code, "lunch");
  assert.equal(repasParSlug("petit-dej")?.code, "breakfast");
  assert.equal(repasParSlug("collation")?.code, "snack");
  assert.equal(repasParSlug("soir")?.code, "dinner");

  /*
   * ⚠️ **Un paramètre d'URL est une SAISIE**, au même titre qu'un champ : il
   * arrive de n'importe où. Aucun de ces cas ne doit lever ni rendre un repas.
   *
   * ⚠️ **`lunch` est refusé À DESSEIN**, alors que c'est un code valide en base :
   * l'URL parle en français, et accepter les deux formes créerait deux adresses
   * pour la même case — donc deux entrées d'historique, deux favoris, et un jour
   * une divergence entre elles.
   */
  for (const saisie of ["lunch", "", "  ", "MIDI", "midi ", "déjeuner", "0", "__proto__"]) {
    assert.equal(repasParSlug(saisie), null, `« ${saisie} » n'est pas un slug`);
  }
});

test("repasParSlug encaisse l'absence de paramètre", () => {
  // Next rend `undefined` sur un segment absent, et un paramètre répété un tableau.
  assert.equal(repasParSlug(undefined), null);
  assert.equal(repasParSlug(null), null);
});

test("le libellé se lit en français et ne redit pas le jeton de la base", () => {
  const libelles = REPAS.map((r) => r.libelle);
  assert.deepEqual(libelles, ["Petit-déj", "Midi", "Collation", "Soir"]);
  /*
   * NFR-8/NFR-9 : aucun jeton anglais ne doit joindre une chaîne rendue. Le test
   * le mesure plutôt que de le recommander.
   */
  for (const repas of REPAS) {
    assert.ok(
      !repas.libelle.toLowerCase().includes(repas.code),
      `« ${repas.libelle} » ne doit pas contenir « ${repas.code} »`
    );
  }
});

test("CodeRepas reste le type des codes de REPAS", () => {
  // Garde de typage : si `REPAS` perdait son `as const`, ceci cesserait de compiler.
  const code: CodeRepas = "snack";
  assert.ok(REPAS.some((r) => r.code === code));
});
