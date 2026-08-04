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

// ── Recettes : la table n'avait JAMAIS été éprouvée ─────────────────────────
//
// La story 3.1 ouvre le premier chemin d'écriture vers `recipes`. La table et sa
// politique `recipes_all` existent depuis le squelette (`20260502000000:294-296`),
// mais aucune surface ne les avait touchées — le prototype qui le faisait a été
// retiré à la story 1.1. Une politique jamais exercée est une politique
// supposée, pas une politique prouvée (AD-17).
//
// ⚠️ Les identifiants de B sont obtenus du client `admin`, jamais du client de
// A : sous RLS, A ne peut pas les lire, et un test qui les cherche avec le
// mauvais client passe EN NE PROUVANT RIEN. Deux faux positifs de cette forme
// ont été attrapés à la story 2.2.

/** Pose une recette dans un foyer en traversant la RLS. Rend son identifiant. */
async function recetteDeService(foyerId: string, titre: string): Promise<string> {
  const { data, error } = await admin
    .from("recipes")
    .insert({ household_id: foyerId, title: titre })
    .select("id")
    .single();
  assert.equal(error, null, `création de la recette « ${titre} »`);
  return data!.id as string;
}

test("A ne lit pas les recettes de B, même en nommant leur identifiant", async () => {
  const recetteDeB = await recetteDeService(b.foyerId, "Le curry de Bruno");
  const recetteDeA = await recetteDeService(a.foyerId, "Le curry d'Alice");

  const { data: vues } = await a.client.from("recipes").select("id, household_id");
  assert.equal(vues?.length, 1, "A ne voit que sa propre recette");
  assert.equal(vues![0].id, recetteDeA);
  assert.equal(vues![0].household_id, a.foyerId);

  const { data: cible } = await a.client
    .from("recipes")
    .select("id")
    .eq("id", recetteDeB);
  assert.deepEqual(cible, [], "connaître l'UUID d'une recette ne doit rien ouvrir");
});

test("A ne peut pas poser une recette dans le foyer de B", async () => {
  const { error } = await a.client
    .from("recipes")
    .insert({ household_id: b.foyerId, title: "Recette forgée" });
  assert.notEqual(error, null, "le `with check` de recipes_all doit refuser");

  const { data: chezB } = await admin
    .from("recipes")
    .select("id")
    .eq("household_id", b.foyerId)
    .eq("title", "Recette forgée");
  assert.deepEqual(chezB, [], "rien ne doit avoir atterri chez B");
});

test("A ne peut pas modifier la recette de B", async () => {
  const recetteDeB = await recetteDeService(b.foyerId, "Titre d'origine");

  const { data, error } = await a.client
    .from("recipes")
    .update({ title: "Titre volé" })
    .eq("id", recetteDeB)
    .select("id");

  /*
   * ⚠️ Sous RLS, écrire sur une ligne masquée ne rend AUCUNE erreur : la ligne
   * est simplement invisible, donc zéro ligne touchée. Un test qui se
   * contenterait de `assert.equal(error, null)` passerait en ne prouvant rien.
   * C'est la relecture par le client `admin` qui fait la preuve.
   */
  assert.equal(error, null, "pas d'erreur — la ligne est invisible, pas refusée");
  assert.deepEqual(data, [], "aucune ligne touchée");

  const { data: apres } = await admin
    .from("recipes")
    .select("title")
    .eq("id", recetteDeB)
    .single();
  assert.equal(apres!.title, "Titre d'origine", "la recette de B est intacte");
});

test("A ne peut pas supprimer la recette de B", async () => {
  const recetteDeB = await recetteDeService(b.foyerId, "À ne pas supprimer");

  const { data, error } = await a.client
    .from("recipes")
    .delete()
    .eq("id", recetteDeB)
    .select("id");

  // Même piège que ci-dessus, et il est PIRE sur un `delete` : « pas d'erreur »
  // se lit spontanément comme « ça a marché ».
  assert.equal(error, null);
  assert.deepEqual(data, [], "aucune ligne supprimée");

  const { count } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("id", recetteDeB);
  assert.equal(count, 1, "la recette de B est toujours là");
});

test("A crée, modifie et supprime SA recette de bout en bout", async () => {
  /*
   * Le pendant positif des quatre tests ci-dessus : sans lui, une politique qui
   * refuserait TOUT les ferait passer, et l'écran serait mort.
   */
  const { data: creee, error: erreurCreation } = await a.client
    .from("recipes")
    .insert({ household_id: a.foyerId, title: "Ma recette", created_by: a.id })
    .select("id, servings")
    .single();
  assert.equal(erreurCreation, null, "A doit pouvoir créer chez elle");
  assert.equal(creee!.servings, 2, "le défaut de la colonne s'applique");

  const { data: modifiee, error: erreurEdition } = await a.client
    .from("recipes")
    .update({ title: "Ma recette revue", servings: 4, instructions: "Étape 1\nÉtape 2" })
    .eq("id", creee!.id)
    .select("title, servings, instructions")
    .single();
  assert.equal(erreurEdition, null);
  assert.equal(modifiee!.title, "Ma recette revue");
  assert.equal(modifiee!.servings, 4);
  // Le saut de ligne survit à l'aller-retour : c'est ce que la story 3.3 exige,
  // et ce que `normaliserTexte` aurait détruit côté client.
  assert.equal(modifiee!.instructions, "Étape 1\nÉtape 2");

  const { data: supprimee, error: erreurSuppression } = await a.client
    .from("recipes")
    .delete()
    .eq("id", creee!.id)
    .select("id");
  assert.equal(erreurSuppression, null);
  assert.equal(supprimee?.length, 1, "A doit pouvoir supprimer chez elle");
});

test("supprimer une recette vide les cases de menu qui la portaient", async () => {
  /*
   * `meal_plan_entries.recipe_id` est `on delete cascade`. Depuis la story 3.5,
   * `/menu` AFFICHE la grille : supprimer une recette y vide donc des cases, en
   * silence et sans confirmation qui le dise — la suppression vit sur l'écran des
   * recettes, qui n'a aucune raison de savoir ce que le menu en fera. Ce test
   * fige la conséquence pour que la story 3.6, qui rendra ces cases modifiables,
   * la trouve écrite plutôt que de la découvrir à l'écran.
   */
  const recette = await recetteDeService(a.foyerId, "Recette au menu");
  const { error: erreurMenu } = await admin.from("meal_plan_entries").insert({
    household_id: a.foyerId,
    recipe_id: recette,
    meal_date: "2026-08-04",
    meal_type: "dinner",
  });
  assert.equal(erreurMenu, null, "assignation de la recette au menu");

  await a.client.from("recipes").delete().eq("id", recette);

  const { data: cases } = await admin
    .from("meal_plan_entries")
    .select("id")
    .eq("recipe_id", recette);
  assert.deepEqual(cases, [], "la cascade a vidé la case du menu, en silence");
});

test("la base refuse un titre de recette vide", async () => {
  // Contrepartie de `normaliserTitre`. L'accord entre les deux est mesuré par
  // `contraintes.test.ts` ; ici on prouve seulement que la garde existe.
  for (const titre of ["", " ", "\t", "​", "ㅤ"]) {
    const { error } = await a.client
      .from("recipes")
      .insert({ household_id: a.foyerId, title: titre });
    assert.notEqual(error, null, `titre invisible refusé : ${JSON.stringify(titre)}`);
    assert.equal(error!.code, "23514");
    assert.match(error!.message, /recipes_titre_non_vide/);
  }
});

test("la base refuse un nombre de portions nul ou négatif", async () => {
  /*
   * L'AC3 en entier. Sans cette contrainte,
   * `generate_grocery_list_from_menu` diviserait par `nullif(servings, 0)` —
   * qui ne lève pas, mais rend NULL : les quantités de la recette
   * disparaîtraient de la liste de courses, en silence, deux epics plus tard.
   */
  for (const portions of [0, -1]) {
    const { error } = await a.client
      .from("recipes")
      .insert({ household_id: a.foyerId, title: `Portions ${portions}`, servings: portions });
    assert.notEqual(error, null, `servings=${portions} doit être refusé`);
    assert.equal(error!.code, "23514");
    assert.match(error!.message, /recipes_servings_positif/);
  }

  const { error: erreurUn } = await a.client
    .from("recipes")
    .insert({ household_id: a.foyerId, title: "Portions 1", servings: 1 });
  assert.equal(erreurUn, null, "une personne reste une valeur légitime");
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

// ── Ingrédients : la table n'avait JAMAIS été éprouvée ──────────────────────
//
// `recipe_ingredients_all` ancre l'isolation par un `exists` sur `recipes` — une
// forme différente des autres politiques, et jamais exercée jusqu'ici.
//
// ⚠️ Les identifiants de B sont obtenus du client `admin`, jamais du client de A :
// sous RLS, A ne peut pas les lire, et un test qui les cherche avec le mauvais
// client passe EN NE PROUVANT RIEN.

/** Pose une recette et un ingrédient en traversant la RLS. */
async function ingredientDeService(
  foyerId: string,
  titreRecette: string,
  nomIngredient: string,
): Promise<{ recetteId: string; ingredientId: string }> {
  const { data: r, error: er } = await admin
    .from("recipes")
    .insert({ household_id: foyerId, title: titreRecette })
    .select("id")
    .single();
  assert.equal(er, null, `création de la recette « ${titreRecette} »`);

  const { data: i, error: ei } = await admin
    .from("recipe_ingredients")
    .insert({ recipe_id: r!.id, name: nomIngredient })
    .select("id")
    .single();
  assert.equal(ei, null, `création de l'ingrédient « ${nomIngredient} »`);

  return { recetteId: r!.id as string, ingredientId: i!.id as string };
}

test("A ne lit pas les ingrédients de B", async () => {
  const chezB = await ingredientDeService(b.foyerId, "Recette de B", "Secret de B");
  const chezA = await ingredientDeService(a.foyerId, "Recette de A", "Oignon de A");

  const { data: vus } = await a.client.from("recipe_ingredients").select("id, name");
  const noms = (vus ?? []).map((l) => l.name);
  assert.ok(noms.includes("Oignon de A"), "A doit voir le sien");
  assert.ok(!noms.includes("Secret de B"), "A ne doit pas voir celui de B");

  const { data: cible } = await a.client
    .from("recipe_ingredients")
    .select("id")
    .eq("id", chezB.ingredientId);
  assert.deepEqual(cible, [], "connaître l'UUID ne doit rien ouvrir");
  assert.ok(chezA.ingredientId);
});

test("A ne peut ni poser, ni modifier, ni supprimer un ingrédient chez B", async () => {
  const chezB = await ingredientDeService(b.foyerId, "Intouchable", "Carotte de B");

  const { error: erreurInsert } = await a.client
    .from("recipe_ingredients")
    .insert({ recipe_id: chezB.recetteId, name: "Ingrédient forgé" });
  assert.notEqual(erreurInsert, null, "le `with check` doit refuser");

  /*
   * ⚠️ Sous RLS, écrire sur une ligne masquée ne rend AUCUNE erreur : la ligne est
   * invisible, donc zéro ligne touchée. Un test qui se contenterait de
   * `assert.equal(error, null)` passerait en ne prouvant rien. C'est la relecture
   * par `admin` qui fait la preuve.
   */
  const { data: modifiees, error: erreurUpdate } = await a.client
    .from("recipe_ingredients")
    .update({ name: "Nom volé" })
    .eq("id", chezB.ingredientId)
    .select("id");
  assert.equal(erreurUpdate, null, "pas d'erreur — la ligne est invisible");
  assert.deepEqual(modifiees, [], "aucune ligne touchée");

  const { data: supprimees } = await a.client
    .from("recipe_ingredients")
    .delete()
    .eq("id", chezB.ingredientId)
    .select("id");
  assert.deepEqual(supprimees, [], "aucune ligne supprimée");

  const { data: apres } = await admin
    .from("recipe_ingredients")
    .select("name")
    .eq("id", chezB.ingredientId)
    .single();
  assert.equal(apres!.name, "Carotte de B", "l'ingrédient de B est intact");
});

test("A gère les ingrédients de SA recette de bout en bout", async () => {
  // Le pendant positif : sans lui, une politique qui refuserait TOUT passerait.
  const { data: recette } = await admin
    .from("recipes")
    .insert({ household_id: a.foyerId, title: "Ma recette à ingrédients" })
    .select("id")
    .single();

  const { data: cree, error: erreurCreation } = await a.client
    .from("recipe_ingredients")
    .insert({
      recipe_id: recette!.id,
      name: "Pois chiches",
      quantity: 400,
      unit: "g",
      aisle_keyword: "conserves",
      optional: false,
      sort_order: 10,
    })
    .select("id, name, quantity, unit, aisle_keyword, optional")
    .single();
  assert.equal(erreurCreation, null, "A doit pouvoir ajouter chez elle");
  // AC1 : les cinq attributs sont bien rattachés.
  assert.equal(cree!.name, "Pois chiches");
  assert.equal(Number(cree!.quantity), 400);
  assert.equal(cree!.unit, "g");
  assert.equal(cree!.aisle_keyword, "conserves");
  assert.equal(cree!.optional, false);

  // AC2 : modification EN PLACE, sans suppression-recréation.
  const { data: modifie, error: erreurEdition } = await a.client
    .from("recipe_ingredients")
    .update({ quantity: 250, unit: "kg", optional: true })
    .eq("id", cree!.id)
    .select("id, quantity, unit, optional")
    .single();
  assert.equal(erreurEdition, null);
  assert.equal(modifie!.id, cree!.id, "MÊME ligne — pas une recréation");
  assert.equal(Number(modifie!.quantity), 250);
  assert.equal(modifie!.unit, "kg");
  assert.equal(modifie!.optional, true);

  const { data: supprime, error: erreurSuppression } = await a.client
    .from("recipe_ingredients")
    .delete()
    .eq("id", cree!.id)
    .select("id");
  assert.equal(erreurSuppression, null);
  assert.equal(supprime?.length, 1, "A doit pouvoir retirer chez elle");
});

// ── `reorder_recipe_ingredients` — LE test de cette story ────────────────────

test("A réordonne SA recette, et les ex æquo sont résorbés", async () => {
  const { data: recette } = await admin
    .from("recipes")
    .insert({ household_id: a.foyerId, title: "Recette à ordonner" })
    .select("id")
    .single();

  // `sort_order` vaut 0 PAR DÉFAUT pour tous : les ex æquo sont l'état de départ.
  const { data: poses } = await admin
    .from("recipe_ingredients")
    .insert([
      { recipe_id: recette!.id, name: "Un" },
      { recipe_id: recette!.id, name: "Deux" },
      { recipe_id: recette!.id, name: "Trois" },
    ])
    .select("id, name, sort_order");
  assert.equal(new Set((poses ?? []).map((l) => l.sort_order)).size, 1,
    "au départ, une seule position distincte");

  const parNom = Object.fromEntries((poses ?? []).map((l) => [l.name, l.id]));
  const { error } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: recette!.id,
    p_ids: [parNom.Trois, parNom.Un, parNom.Deux],
  });
  assert.equal(error, null, "A doit pouvoir réordonner sa recette");

  const { data: apres } = await admin
    .from("recipe_ingredients")
    .select("name, sort_order")
    .eq("recipe_id", recette!.id)
    .order("sort_order");
  assert.deepEqual((apres ?? []).map((l) => l.name), ["Trois", "Un", "Deux"]);
  assert.equal(new Set((apres ?? []).map((l) => l.sort_order)).size, 3,
    "autant de positions distinctes que d'ingrédients");
});

test("LE TROU : une recette annoncée, les identifiants d'une AUTRE recette du même foyer", async () => {
  /*
   * ⚠️ Le test le plus important de cette story. La RLS ne peut RIEN refuser ici :
   * les deux recettes appartiennent au foyer de A, donc tout lui est visible. La
   * version de la fonction calquée à l'identique sur `reorder_aisles` acceptait
   * cet appel et renumérotait l'autre recette — mesuré le 2026-08-02 en éprouvant
   * le mécanisme avant de le prescrire.
   *
   * Seul le filtre `and ri.recipe_id = p_recipe_id` dans l'`update` le referme :
   * zéro ligne touchée, donc la garde de comptage lève.
   */
  const { data: recettes } = await admin
    .from("recipes")
    .insert([
      { household_id: a.foyerId, title: "Cible" },
      { household_id: a.foyerId, title: "Victime" },
    ])
    .select("id, title");
  const cible = recettes!.find((r) => r.title === "Cible")!.id;
  const victime = recettes!.find((r) => r.title === "Victime")!.id;

  await admin.from("recipe_ingredients").insert([
    { recipe_id: cible, name: "C1", sort_order: 10 },
    { recipe_id: cible, name: "C2", sort_order: 20 },
  ]);
  const { data: ingrVictime } = await admin
    .from("recipe_ingredients")
    .insert([
      { recipe_id: victime, name: "V1", sort_order: 10 },
      { recipe_id: victime, name: "V2", sort_order: 20 },
    ])
    .select("id, name, sort_order");

  // Cardinal correct (2 = 2), aucun doublon, tout appartient au foyer de A.
  const { error } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: cible,
    p_ids: [ingrVictime![1].id, ingrVictime![0].id],
  });
  assert.notEqual(error, null, "l'appel forgé DOIT être refusé");
  assert.equal(error!.code, "P0001");

  const { data: apres } = await admin
    .from("recipe_ingredients")
    .select("name, sort_order")
    .eq("recipe_id", victime)
    .order("name");
  assert.deepEqual(apres, ingrVictime!.map((l) => ({ name: l.name, sort_order: l.sort_order }))
    .sort((x, y) => x.name.localeCompare(y.name)),
    "la recette victime est INTACTE");
});

test("A ne peut pas réordonner les ingrédients d'une recette de B", async () => {
  const chezB = await ingredientDeService(b.foyerId, "Recette de B à ordonner", "Ingrédient de B");

  const { error } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: chezB.recetteId,
    p_ids: [chezB.ingredientId],
  });
  // Sous RLS, A voit 0 ingrédient dans cette recette : la garde de cardinal lève.
  assert.notEqual(error, null, "la RLS rend 0, donc le cardinal ne correspond pas");
  assert.equal(error!.code, "P0001");
});

test("les gardes de cardinal et de doublon de reorder_recipe_ingredients", async () => {
  const { data: recette } = await admin
    .from("recipes")
    .insert({ household_id: a.foyerId, title: "Recette des gardes" })
    .select("id")
    .single();
  const { data: poses } = await admin
    .from("recipe_ingredients")
    .insert([
      { recipe_id: recette!.id, name: "G1" },
      { recipe_id: recette!.id, name: "G2" },
    ])
    .select("id");

  const { error: partiel } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: recette!.id,
    p_ids: [poses![0].id],
  });
  assert.notEqual(partiel, null, "un tableau partiel doit être refusé");

  const { error: doublon } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: recette!.id,
    p_ids: [poses![0].id, poses![0].id],
  });
  assert.notEqual(doublon, null, "un identifiant cité deux fois doit être refusé");

  const { error: vide } = await a.client.rpc("reorder_recipe_ingredients", {
    p_recipe_id: recette!.id,
    p_ids: [],
  });
  assert.notEqual(vide, null, "un tableau vide doit être refusé");
});

// ── Menu : la première lecture applicative de `meal_plan_entries` ───────────
//
// La story 3.5 ouvre le premier chemin de LECTURE vers `meal_plan_entries` depuis
// une surface. La table et sa politique `meal_plan_all` existent depuis le
// squelette (`20260502000000:315-318`) mais aucun écran ne les avait touchées.
// Une politique jamais exercée est une politique supposée, pas prouvée (AD-17).
//
// ⚠️ Et cette story y ajoute une FORME de lecture que le dépôt n'avait jamais
// employée : la ressource EMBARQUÉE de PostgREST (`recipes(id, title)`). Le
// projet a déjà payé une fois pour avoir cru qu'une garde couvrait une forme
// qu'elle ne couvrait pas — le trou de `seed_default_aisles`, invisible aux onze
// tests d'alors parce qu'ils portaient tous sur des tables. D'où le second test.

test("A ne lit pas les cases de menu de B", async () => {
  const recetteDeB = await recetteDeService(b.foyerId, "Le gratin de Bruno");
  const { error: pose } = await admin.from("meal_plan_entries").insert({
    household_id: b.foyerId,
    recipe_id: recetteDeB,
    meal_date: "2026-09-07",
    meal_type: "dinner",
  });
  assert.equal(pose, null, "témoin négatif : la case de B existe bien");

  const { data: vues, error } = await a.client
    .from("meal_plan_entries")
    .select("id, household_id")
    .eq("meal_date", "2026-09-07");
  assert.equal(error, null, "zéro ligne est un succès PostgREST, pas une erreur");
  assert.deepEqual(vues, [], "A ne voit aucune case de B");
});

test("LE TROU POSSIBLE : A pointe une case de SON menu sur une recette de B", async () => {
  /*
   * ⚠️ **`meal_plan_all` ne contrôle QUE `household_id`.** Son `with check` ne dit
   * rien de `recipe_id`, et la contrainte de clé étrangère, elle, s'applique sans
   * égard pour la RLS. Rien n'empêche donc A d'écrire dans SON foyer une case qui
   * pointe une recette de B — l'écriture est client-direct, A possède sa clé anon
   * et son jeton, et l'Epic 7 ouvrira une seconde surface sur la même base.
   *
   * La question que ce test tranche n'est pas « peut-on poser la ligne » mais
   * « la ligne posée FAIT-ELLE FUIR le titre de B » à travers la jointure que
   * `casesDeLaSemaine` emploie. C'est la seule chose que la RLS de `recipes` peut
   * encore défendre, et c'est une forme de lecture neuve dans ce dépôt.
   */
  const recetteDeB = await recetteDeService(b.foyerId, "SECRET DE BRUNO");

  /*
   * ⚠️ **MESURÉ le 2026-08-04 : la pose est ACCEPTÉE.** Ce n'est pas une
   * hypothèse de test, c'est l'état de la base — sonde exécutée sur le stack
   * local, `error` nul et une ligne rendue. Le test l'assure explicitement pour
   * que le jour où une migration ferme ce trou, ce soit ICI que ça se voie, et
   * pas dans une branche `if` qui l'aurait absorbé en silence.
   */
  const { data: posee, error: poseInterdite } = await a.client
    .from("meal_plan_entries")
    .insert({
      household_id: a.foyerId,
      recipe_id: recetteDeB,
      meal_date: "2026-09-14",
      meal_type: "lunch",
    })
    .select("id");

  assert.equal(
    poseInterdite,
    null,
    "état mesuré au 2026-08-04 : rien n'interdit de pointer la recette d'un autre foyer"
  );
  assert.equal(posee?.length, 1);

  /*
   * ⚠️ **Et voici ce qui tient quand même : la RLS s'applique à la ressource
   * EMBARQUÉE.** C'était la vraie question — la forme de lecture est neuve dans
   * ce dépôt, et rien ne garantissait a priori qu'une jointure PostgREST soit
   * filtrée comme une table. Elle l'est : `recipes` rend `null`, aucun titre de
   * B ne traverse. AUCUN test ne le disait avant celui-ci.
   */
  const { data: vues } = await a.client
    .from("meal_plan_entries")
    .select("id, meal_date, meal_type, servings, recipes(id, title)")
    .eq("meal_date", "2026-09-14");

  assert.equal(vues?.length, 1, "A voit bien SA case — c'est son foyer");
  assert.equal(
    vues![0].recipes,
    null,
    "la RLS filtre la ressource embarquée : aucun titre de B ne traverse"
  );
});

test("A lit SA semaine de menu de bout en bout, jointure comprise", async () => {
  /*
   * Le témoin positif : sans lui, les deux tests ci-dessus seraient verts sur une
   * lecture qui ne rend jamais rien — c'est exactement le piège que l'en-tête de
   * ce fichier décrit à propos du témoin négatif, pris dans l'autre sens.
   *
   * Il fige aussi les DEUX faits dont l'écran dépend et qu'aucun test unitaire ne
   * peut porter (NFR-10) : la jointure rend bien le titre, et deux recettes
   * tiennent dans la MÊME case — rien ne l'interdit tant que la contrainte
   * d'unicité d'AD-6 (story 3.6) n'existe pas.
   */
  const gratin = await recetteDeService(a.foyerId, "Gratin de courgettes");
  const salade = await recetteDeService(a.foyerId, "Salade de lentilles");

  const { error: pose } = await a.client.from("meal_plan_entries").insert([
    { household_id: a.foyerId, recipe_id: gratin, meal_date: "2026-09-21", meal_type: "dinner" },
    { household_id: a.foyerId, recipe_id: salade, meal_date: "2026-09-21", meal_type: "dinner" },
  ]);
  assert.equal(pose, null, "A pose deux recettes au même repas, et c'est permis");

  const { data: vues, error } = await a.client
    .from("meal_plan_entries")
    .select("id, meal_date, meal_type, servings, recipes(id, title)")
    .gte("meal_date", "2026-09-21")
    .lte("meal_date", "2026-09-27")
    .order("meal_date")
    .order("meal_type")
    .order("created_at");

  assert.equal(error, null);
  assert.equal(vues?.length, 2, "les DEUX cases du même repas sont rendues");
  assert.equal(vues![0].servings, 2, "le défaut de la colonne, pas une valeur écrite");

  /*
   * ⚠️ **Deux inférences de type se contredisent, et c'est ce test qui tranche.**
   * Le client de CE fichier n'est pas typé — les comptes sont construits par
   * `createClient(apiUrl, anonKey)` tout court, sans le générique `Database`.
   * Faute de schéma, supabase-js infère la ressource embarquée en **tableau** ;
   * le client typé de `lib/menu/menu.ts`, lui, l'infère en **objet** (mesuré le
   * 2026-08-04 par une sonde de typage).
   *
   * Les deux ne peuvent pas avoir raison, et aucune des deux ne dit ce que
   * PostgREST envoie vraiment. **L'assertion ci-dessous, elle, le mesure** : c'est
   * un objet. Sans elle, `lib/menu/menu.ts` reposerait sur une inférence que rien
   * ne corrobore — et la story 3.2 a déjà appris ici ce que vaut un invariant
   * affirmé plutôt que mesuré (règle §4).
   */
  const embarquee = vues!.map(
    (v) => v.recipes as unknown as { id: string; title: string } | null
  );
  assert.equal(
    Array.isArray(embarquee[0]),
    false,
    "PostgREST rend la ressource embarquée en OBJET, malgré ce que dit le client non typé"
  );

  const titres = embarquee.map((r) => r?.title).sort();
  assert.deepEqual(titres, ["Gratin de courgettes", "Salade de lentilles"]);
});
