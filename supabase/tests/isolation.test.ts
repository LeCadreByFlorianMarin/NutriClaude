import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stackLocal } from "./stack-local.ts";

/**
 * NFR-5 — l'isolation entre foyers, prouvée par exécution.
 *
 * **Ce que ce fichier existe pour empêcher.** Pendant tout l'Epic 1 il n'y a eu
 * qu'un seul projet Supabase, et il *était* la production : la seule façon de
 * contrôler l'isolation était de créer des comptes réels et d'y laisser des
 * débris. Trois comptes témoins en sont sortis. Pendant ce temps
 * `profiles_update_own` n'avait pas de `with check` — un membre pouvait
 * réécrire son `household_id` et basculer toute la RLS vers le foyer visé. Le
 * trou a vécu l'epic entier. Un test à deux comptes l'aurait vu le premier jour.
 *
 * **Ce n'est pas un test unitaire et il n'est pas dans `npm test`.** Il exige un
 * `npx supabase start` : glob distinct (`supabase/tests/`), script distinct
 * (`npm run test:isolation`). Le faux client de `lib/` ne peut pas porter ce
 * contrôle — un faux ne modélise pas la RLS, et un test de `membresDuFoyer`
 * avec un faux prouve le mapping, jamais l'isolation.
 *
 * **Le témoin négatif n'est pas décoratif.** « A ne voit aucune ligne de B » est
 * vrai gratuitement si B n'existe pas. Le premier test lit donc la base en
 * `service_role`, qui traverse la RLS, et prouve que les deux foyers sont bien
 * là avant que les suivants prouvent que A n'en voit qu'un.
 *
 * **Les dents ont été vérifiées, et l'ordre des tests est délibéré.** Le
 * `with check` de `profiles_update_own` retiré à la main sur la base locale, la
 * suite tombe de 11/11 à 6/11 : le test NFR-5 d'abord, puis les quatre suivants.
 * Ce n'est pas un défaut de conception, c'est la démonstration du rayon de
 * souffle — une fois `household_id` réécrit, `current_household_id()` suit et A
 * devient membre de B pour tout ce qui vient après. Dépôt sain, la mutation
 * échoue et l'ordre n'a aucun effet. **Ne pas « réparer » en isolant les
 * fixtures : ça supprimerait le signal.**
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-nutriclaude";

type Compte = {
  id: string;
  email: string;
  client: SupabaseClient;
  foyerId: string;
  code: string;
};

const { apiUrl, anonKey, serviceRoleKey } = stackLocal();

/** Traverse la RLS. Sert au montage, au démontage et au témoin négatif. */
const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let a: Compte;
let b: Compte;

async function creerCompte(nomFoyer: string, prenom: string): Promise<Compte> {
  const email = `${randomUUID()}@nutriclaude.test`;

  const { data: cree, error: erreurCreation } = await admin.auth.admin.createUser({
    email,
    password: MOT_DE_PASSE,
    email_confirm: true,
  });
  assert.equal(erreurCreation, null, `création du compte ${prenom}`);
  const id = cree!.user!.id;

  /*
   * Un client par compte, `persistSession: false` : sans ça les deux sessions
   * partageraient le même stockage et le second `signIn` écraserait le premier —
   * le test passerait en ne prouvant rien.
   */
  const client = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: erreurConnexion } = await client.auth.signInWithPassword({
    email,
    password: MOT_DE_PASSE,
  });
  assert.equal(erreurConnexion, null, `connexion de ${prenom}`);

  const { data: foyerId, error: erreurFoyer } = await client.rpc(
    "create_household_with_profile",
    { p_household_name: nomFoyer, p_display_name: prenom },
  );
  assert.equal(erreurFoyer, null, `création du foyer de ${prenom}`);

  const { data: code, error: erreurCode } = await client.rpc(
    "generate_household_invite",
  );
  assert.equal(erreurCode, null, `invitation de ${prenom}`);

  return { id, email, client, foyerId: foyerId as string, code: code as string };
}

before(async () => {
  a = await creerCompte("Foyer A", "Alice");
  b = await creerCompte("Foyer B", "Bruno");
});

after(async () => {
  /*
   * Ordre imposé par le schéma : `profiles.id → auth.users` est en cascade,
   * `profiles.household_id → households` est en `restrict`. Les comptes
   * d'abord, les foyers ensuite — l'inverse échoue.
   */
  for (const compte of [a, b]) {
    if (compte) await admin.auth.admin.deleteUser(compte.id);
  }
  for (const compte of [a, b]) {
    if (compte) await admin.from("households").delete().eq("id", compte.foyerId);
  }
});

// ── Témoin négatif : les deux foyers existent vraiment ──────────────────────

test("les deux foyers et leurs rayons existent bien en base", async () => {
  const { data: foyers } = await admin
    .from("households")
    .select("id")
    .in("id", [a.foyerId, b.foyerId]);
  assert.equal(foyers?.length, 2, "les deux foyers doivent exister");

  const { data: profils } = await admin
    .from("profiles")
    .select("id")
    .in("id", [a.id, b.id]);
  assert.equal(profils?.length, 2, "les deux profils doivent exister");

  const { data: rayons } = await admin
    .from("aisles")
    .select("id, household_id")
    .in("household_id", [a.foyerId, b.foyerId]);
  assert.equal(rayons?.length, 22, "seed_default_aisles pose 11 rayons par foyer");

  assert.notEqual(a.foyerId, b.foyerId);
  assert.notEqual(a.code, b.code);
});

// ── Lecture : A ne lit aucune ligne de B ────────────────────────────────────

test("A ne lit que son foyer", async () => {
  const { data } = await a.client.from("households").select("id, name");
  assert.equal(data?.length, 1);
  assert.equal(data![0].id, a.foyerId);
  assert.equal(data![0].name, "Foyer A");
});

test("A ne lit pas le foyer de B, même en le nommant explicitement", async () => {
  const { data } = await a.client
    .from("households")
    .select("id")
    .eq("id", b.foyerId);
  assert.deepEqual(data, [], "connaître l'UUID du foyer ne doit rien ouvrir");
});

test("A ne lit pas le profil de B", async () => {
  const { data } = await a.client.from("profiles").select("id, display_name");
  assert.equal(data?.length, 1);
  assert.equal(data![0].id, a.id);

  const { data: cible } = await a.client
    .from("profiles")
    .select("id")
    .eq("id", b.id);
  assert.deepEqual(cible, []);
});

test("A ne lit pas les rayons de B", async () => {
  const { data } = await a.client.from("aisles").select("id, household_id");
  assert.equal(data?.length, 11);
  for (const rayon of data!) {
    assert.equal(rayon.household_id, a.foyerId);
  }
});

test("A ne lit pas les invitations de B", async () => {
  const { data } = await a.client.from("household_invites").select("code");
  assert.equal(data?.length, 1);
  assert.equal(data![0].code, a.code);

  const { data: cible } = await a.client
    .from("household_invites")
    .select("code")
    .eq("code", b.code);
  assert.deepEqual(cible, [], "le code de B ne doit pas être lisible par A");
});

// ── Écriture : A ne modifie rien chez B ─────────────────────────────────────

test("A ne peut pas se déplacer dans le foyer de B — le trou NFR-5 de l'Epic 1", async () => {
  const { error } = await a.client
    .from("profiles")
    .update({ household_id: b.foyerId })
    .eq("id", a.id);

  assert.notEqual(error, null, "le `with check` doit refuser l'écriture");

  /*
   * Et la ligne n'a pas bougé. Un refus qui laisserait la colonne réécrite
   * serait une réussite d'apparence — c'est exactement la classe de défaut que
   * ce fichier existe pour attraper.
   */
  const { data } = await admin
    .from("profiles")
    .select("household_id")
    .eq("id", a.id)
    .single();
  assert.equal(data!.household_id, a.foyerId);
});

test("A ne peut pas renommer le foyer de B", async () => {
  await a.client.from("households").update({ name: "Piraté" }).eq("id", b.foyerId);

  const { data } = await admin
    .from("households")
    .select("name")
    .eq("id", b.foyerId)
    .single();
  assert.equal(data!.name, "Foyer B", "le nom du foyer de B doit être intact");
});

test("A ne peut pas poser un rayon dans le foyer de B", async () => {
  const { error } = await a.client
    .from("aisles")
    .insert({ household_id: b.foyerId, name: "Rayon pirate", sort_order: 99 });

  assert.notEqual(error, null, "le `with check` de aisles_all doit refuser");

  const { count } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", b.foyerId);
  assert.equal(count, 11, "le foyer de B garde ses onze rayons");
});

test("A ne peut pas supprimer l'invitation de B", async () => {
  await a.client.from("household_invites").delete().eq("code", b.code);

  const { data } = await admin
    .from("household_invites")
    .select("code")
    .eq("code", b.code);
  assert.equal(data?.length, 1, "l'invitation de B doit survivre");
});

// ── Le chemin légitime reste ouvert ─────────────────────────────────────────

test("un troisième compte rejoint A par son code, et ne voit alors que A", async () => {
  const email = `${randomUUID()}@nutriclaude.test`;
  const { data: cree } = await admin.auth.admin.createUser({
    email,
    password: MOT_DE_PASSE,
    email_confirm: true,
  });
  const invite = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await invite.auth.signInWithPassword({ email, password: MOT_DE_PASSE });

  const { data: foyerRejoint, error } = await invite.rpc(
    "redeem_household_invite",
    { p_code: a.code, p_display_name: "Camille" },
  );
  assert.equal(error, null, "le rachat d'un code valable doit réussir");
  assert.equal(foyerRejoint, a.foyerId);

  const { data: foyers } = await invite.from("households").select("id");
  assert.equal(foyers?.length, 1);
  assert.equal(foyers![0].id, a.foyerId, "Camille voit A, et A seulement");

  const { data: membres } = await invite.from("profiles").select("id");
  assert.equal(membres?.length, 2, "Alice et Camille, jamais Bruno");

  await admin.auth.admin.deleteUser(cree!.user!.id);
});

// ── `seed_default_aisles` : le paramètre n'est pas une autorisation ─────────
//
// Ces tests couvrent un chemin que les onze précédents ne voyaient pas : les
// appels **RPC**. Ils portent tous sur des tables, et une fonction
// `security definer` ne passe pas par la RLS — c'est tout l'intérêt de
// `security definer`, et c'est ce qui rendait le trou invisible.
//
// `seed_default_aisles` reçoit le foyer en paramètre. Avant
// `20260729095922_guard_seed_default_aisles.sql`, elle ne le confrontait à rien :
// mesuré le 2026-07-29, A pouvait poser onze rayons chez B. Retirer la garde de
// la fonction sur la base locale fait tomber le premier de ces tests — c'est la
// vérification des dents, au sens de l'en-tête de ce fichier.

test("A ne peut pas amorcer les rayons du foyer de B", async () => {
  const { count: avant } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", b.foyerId);

  const { error } = await a.client.rpc("seed_default_aisles", {
    p_household_id: b.foyerId,
  });
  assert.notEqual(error, null, "la garde d'identité doit refuser");

  /*
   * Le témoin négatif compte autant que le refus. Un `insert … on conflict do
   * nothing` sur un foyer déjà amorcé ne changerait rien de toute façon : sans
   * cette mesure, le test passerait tout aussi bien sur la version vulnérable.
   * On mesure donc l'écart, pas seulement l'erreur.
   */
  const { count: apres } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", b.foyerId);
  assert.equal(apres, avant, "le foyer de B ne bouge pas");
});

test("A ne peut pas amorcer un foyer qui n'existe pas", async () => {
  // `current_household_id()` rend l'UUID de A ; un UUID quelconque ne peut donc
  // jamais l'égaler. Le cas vaut d'être épinglé : c'est celui d'un appel forgé.
  const { error } = await a.client.rpc("seed_default_aisles", {
    p_household_id: randomUUID(),
  });
  assert.notEqual(error, null, "un foyer inconnu doit être refusé");
});

test("A ré-amorce son propre foyer, et l'opération est idempotente", async () => {
  // On part du cas réel de l'écran : Alice a tout supprimé.
  const { error: erreurSuppression } = await a.client
    .from("aisles")
    .delete()
    .eq("household_id", a.foyerId);
  assert.equal(erreurSuppression, null, "supprimer ses propres rayons est permis");

  const { count: vide } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", a.foyerId);
  assert.equal(vide, 0, "le foyer de A est bien vide avant l'amorçage");

  const { error } = await a.client.rpc("seed_default_aisles", {
    p_household_id: a.foyerId,
  });
  assert.equal(error, null, "le chemin légitime doit rester ouvert");

  const { count: amorce } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", a.foyerId);
  assert.equal(amorce, 11, "onze rayons français");

  // Second appel : `on conflict (household_id, name) do nothing`.
  await a.client.rpc("seed_default_aisles", { p_household_id: a.foyerId });
  const { count: apresSecondAppel } = await admin
    .from("aisles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", a.foyerId);
  assert.equal(apresSecondAppel, 11, "rien n'est dupliqué");
});

test("A ne peut ni renommer ni supprimer un rayon de B", async () => {
  const { data: cible } = await admin
    .from("aisles")
    .select("id, name")
    .eq("household_id", b.foyerId)
    .eq("name", "Boucherie")
    .single();

  await a.client.from("aisles").update({ name: "Piraté" }).eq("id", cible!.id);
  await a.client.from("aisles").delete().eq("id", cible!.id);

  const { data: apres } = await admin
    .from("aisles")
    .select("name")
    .eq("id", cible!.id)
    .maybeSingle();
  assert.equal(apres?.name, "Boucherie", "le rayon de B est intact");
});

test("la base refuse un nom de rayon vide", async () => {
  // `aisles_name_non_vide`. Le client normalise en amont, mais la contrainte
  // couvre aussi les appels directs à l'API REST, qu'aucun écran ne voit.
  const { error } = await a.client.from("aisles").insert({
    household_id: a.foyerId,
    name: "   ",
    sort_order: 1000,
  });
  assert.notEqual(error, null, "un nom d'espaces doit être refusé");
  assert.equal(error!.code, "23514", "violation de contrainte check");
});

test("la base refuse deux rayons de même nom dans un foyer", async () => {
  const { error } = await a.client.from("aisles").insert({
    household_id: a.foyerId,
    name: "Boucherie",
    sort_order: 1010,
  });
  assert.notEqual(error, null, "le doublon doit être refusé");
  assert.equal(error!.code, "23505", "violation d'unicité — le code que `refusRayon` lit");
});

// ── `reorder_aisles` — story 2.2 ─────────────────────────────────────────────
//
// La fonction n'est **pas** `security definer`, à l'inverse de
// `seed_default_aisles` : elle ne reçoit aucune identité, seulement des
// identifiants de rayons, et c'est la RLS qui décide lesquels sont atteignables.
//
// ⚠️ **Le piège de CES tests, rencontré en éprouvant le mécanisme.** Sous RLS,
// `a.client.from("aisles").select("id").eq("household_id", b.foyerId)` ne rend
// AUCUNE ligne : A ne peut pas même LIRE les identifiants de B. Construire le
// tableau depuis le client de A donnerait donc un tableau vide, et le refus
// viendrait de la garde « aucun rayon à ordonner » — pas de celle qu'on veut
// éprouver. Le test passerait en ne prouvant rien.
//
// Les tableaux d'identifiants viennent donc TOUS du client `admin`, qui traverse
// la RLS. C'est la seule façon de forger l'appel qu'un attaquant forgerait.

/** Les identifiants d'un foyer, dans l'ordre du parcours, vus par `admin`. */
async function idsDuFoyer(foyerId: string): Promise<string[]> {
  const { data } = await admin
    .from("aisles")
    .select("id")
    .eq("household_id", foyerId)
    .order("sort_order");
  return (data ?? []).map((r) => r.id);
}

/** Les positions d'un foyer, pour le témoin négatif. */
async function positionsDuFoyer(foyerId: string): Promise<number[]> {
  const { data } = await admin
    .from("aisles")
    .select("sort_order")
    .eq("household_id", foyerId)
    .order("sort_order");
  return (data ?? []).map((r) => r.sort_order);
}

test("A ne peut pas réordonner le parcours de B", async () => {
  const idsB = await idsDuFoyer(b.foyerId);
  const avant = await positionsDuFoyer(b.foyerId);
  assert.equal(idsB.length, 11, "B a bien ses onze rayons avant l'essai");

  // Bon cardinal (11), mais tous les identifiants sont étrangers. Les gardes de
  // cardinal les laissent passer : seul le comptage des lignes affectées
  // l'attrape, parce qu'un `update` sur une ligne masquée par la RLS ne rend
  // AUCUNE erreur — il ne touche simplement rien.
  const { error } = await a.client.rpc("reorder_aisles", { p_ids: idsB });
  assert.notEqual(error, null, "un parcours étranger doit être refusé");

  const apres = await positionsDuFoyer(b.foyerId);
  assert.deepEqual(apres, avant, "le parcours de B n'a pas bougé");
});

test("A ne peut pas glisser un rayon de B dans son propre parcours", async () => {
  const idsA = await idsDuFoyer(a.foyerId);
  const idsB = await idsDuFoyer(b.foyerId);
  const avantA = await positionsDuFoyer(a.foyerId);
  const avantB = await positionsDuFoyer(b.foyerId);

  // Cardinal correct, mais un intrus : 10 des siens + 1 de B.
  const forge = [...idsA.slice(0, 10), idsB[0]];
  assert.equal(forge.length, idsA.length, "le cardinal est bien celui du parcours de A");

  const { error } = await a.client.rpc("reorder_aisles", { p_ids: forge });
  assert.notEqual(error, null, "un identifiant étranger doit être refusé");

  assert.deepEqual(await positionsDuFoyer(a.foyerId), avantA, "A n'a pas bougé");
  assert.deepEqual(await positionsDuFoyer(b.foyerId), avantB, "B n'a pas bougé");
});

test("un parcours partiel est refusé — c'est ce qui interdit les ex æquo", async () => {
  const idsA = await idsDuFoyer(a.foyerId);
  const avant = await positionsDuFoyer(a.foyerId);

  // Renuméroter 5 rayons sur 11 laisserait les six autres à leur ancienne
  // position : des positions en double, donc l'AC2 violée.
  const { error } = await a.client.rpc("reorder_aisles", { p_ids: idsA.slice(0, 5) });
  assert.notEqual(error, null, "une liste partielle doit être refusée");
  assert.deepEqual(await positionsDuFoyer(a.foyerId), avant, "rien n'a bougé");
});

test("un rayon cité deux fois est refusé", async () => {
  const idsA = await idsDuFoyer(a.foyerId);
  const avant = await positionsDuFoyer(a.foyerId);

  const doublon = [...idsA.slice(0, idsA.length - 1), idsA[0]];
  assert.equal(doublon.length, idsA.length, "le cardinal reste correct");

  const { error } = await a.client.rpc("reorder_aisles", { p_ids: doublon });
  assert.notEqual(error, null, "un doublon doit être refusé");
  assert.deepEqual(await positionsDuFoyer(a.foyerId), avant, "rien n'a bougé");
});

test("un appel anonyme est refusé", async () => {
  const anonyme = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const idsA = await idsDuFoyer(a.foyerId);
  const avant = await positionsDuFoyer(a.foyerId);

  const { error } = await anonyme.rpc("reorder_aisles", { p_ids: idsA });
  assert.notEqual(error, null, "sans session, aucun parcours n'est réordonnable");
  assert.deepEqual(await positionsDuFoyer(a.foyerId), avant, "rien n'a bougé");
});

test("A réordonne son propre parcours : positions uniques, ordre respecté", async () => {
  // Le chemin légitime. Il prouve aussi que `authenticated` a bien `execute` sur
  // la fonction — aucun `grant` n'est écrit par la migration, qui s'appuie sur
  // `alter default privileges` de `20260729094500`.
  const idsA = await idsDuFoyer(a.foyerId);
  const inverse = [...idsA].reverse();

  const { error } = await a.client.rpc("reorder_aisles", { p_ids: inverse });
  assert.equal(error, null, "le chemin légitime doit rester ouvert");

  const { data } = await admin
    .from("aisles")
    .select("id, sort_order")
    .eq("household_id", a.foyerId)
    .order("sort_order");
  const lignes = data ?? [];

  // AC2 : « positions uniques, aucun rayon perdu ou dupliqué ».
  assert.equal(lignes.length, idsA.length, "aucun rayon perdu ni ajouté");
  assert.equal(
    new Set(lignes.map((l) => l.sort_order)).size,
    lignes.length,
    "toutes les positions sont distinctes"
  );
  assert.deepEqual(
    lignes.map((l) => l.sort_order),
    idsA.map((_, i) => (i + 1) * 10),
    "renumérotées au pas de 10"
  );
  // AC1 : l'ordre persisté est bien celui qui a été demandé.
  assert.deepEqual(
    lignes.map((l) => l.id),
    inverse,
    "l'ordre lu est celui qui a été envoyé"
  );
});

test("le renumérotage résorbe des ex æquo préexistants", async () => {
  // `sort_order` n'a aucune contrainte d'unicité et vaut 100 par défaut : des
  // ex æquo sont légaux et existent dès qu'une ligne est insérée sans calcul.
  // Un simple échange de deux valeurs serait un no-op silencieux sur ce cas ;
  // le renumérotage complet, lui, le répare.
  await admin.from("aisles").update({ sort_order: 100 }).eq("household_id", a.foyerId);

  const { data: avant } = await admin
    .from("aisles")
    .select("sort_order")
    .eq("household_id", a.foyerId);
  assert.equal(
    new Set((avant ?? []).map((l) => l.sort_order)).size,
    1,
    "une seule position distincte avant"
  );

  const idsA = await idsDuFoyer(a.foyerId);
  const { error } = await a.client.rpc("reorder_aisles", { p_ids: idsA });
  assert.equal(error, null, "le renumérotage doit passer");

  const { data: apres } = await admin
    .from("aisles")
    .select("sort_order")
    .eq("household_id", a.foyerId);
  assert.equal(
    new Set((apres ?? []).map((l) => l.sort_order)).size,
    idsA.length,
    "autant de positions distinctes que de rayons"
  );
});
