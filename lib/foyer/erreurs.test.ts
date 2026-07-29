import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estCourseGagneeAilleurs, refusInscription } from "./erreurs.ts";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "supabase", "migrations");

test("traduit les cinq refus des fonctions d'inscription", () => {
  assert.equal(refusInscription({ message: "Invalid invite code" }), "code-inconnu");
  assert.equal(refusInscription({ message: "Invite expired" }), "code-expire");
  assert.equal(
    refusInscription({ message: "Invite has no uses remaining" }),
    "code-epuise"
  );
  assert.equal(refusInscription({ message: "Profile already exists" }), "deja-membre");
  assert.equal(refusInscription({ message: "Not authenticated" }), "session-perdue");
});

test("retombe sur `echec` pour l'inconnu, jamais sur une levée", () => {
  assert.equal(refusInscription({ message: "quelque chose d'inattendu" }), "echec");
  assert.equal(refusInscription({}), "echec");
  assert.equal(refusInscription(null), "echec");
  assert.equal(refusInscription({ message: null, code: null }), "echec");
});

test("distingue la vraie course de l'état « déjà inscrit »", () => {
  // Deux soumissions concurrentes passent toutes deux le contrôle d'entrée et
  // la seconde échoue sur la clé primaire : l'état visé EST atteint.
  assert.equal(estCourseGagneeAilleurs({ code: "23505" }), true);
  assert.equal(
    estCourseGagneeAilleurs({
      message: 'duplicate key value violates unique constraint "profiles_pkey"',
    }),
    true
  );
  // Alors que `Profile already exists` signifie que le profil préexistait —
  // ce n'est pas une course, et le traiter comme un succès effaçait en silence
  // ce que l'utilisateur venait de saisir.
  assert.equal(estCourseGagneeAilleurs({ message: "Profile already exists" }), false);
  assert.equal(estCourseGagneeAilleurs(null), false);
});

/**
 * Le test qui fait de ce module un contrat plutôt qu'une supposition : il lit
 * les migrations et vérifie que chaque libellé attendu y est réellement levé.
 * Reformuler un `raise exception` casse ici, au lieu de dégrader en silence
 * trois refus distincts en « Ça n'a pas marché ».
 */
test("chaque libellé attendu existe dans une migration", () => {
  const sql = [
    "20260502000000_initial_schema.sql",
    "20260727161200_guard_invite_use_count.sql",
  ]
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
    .join("\n");

  for (const libelle of [
    "Invalid invite code",
    "Invite expired",
    "Invite has no uses remaining",
    "Profile already exists",
    "Not authenticated",
  ]) {
    assert.ok(
      sql.includes(`raise exception '${libelle}'`),
      `« ${libelle} » n'est plus levé par aucune migration — ` +
        `l'interface ne saura plus distinguer ce refus, corrige lib/foyer/erreurs.ts`
    );
  }
});
