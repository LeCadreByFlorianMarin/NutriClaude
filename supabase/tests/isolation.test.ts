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

test("LE TROU REFERMÉ : A ne peut plus pointer une case de SON menu sur une recette de B", async () => {
  /*
   * ⚠️ **CE TEST DISAIT L'INVERSE JUSQU'AU 2026-08-04, ET C'ÉTAIT JUSTE.**
   * `meal_plan_all` ne contrôlait alors que `household_id` : son `with check` ne
   * disait rien de `recipe_id`, et une contrainte de clé étrangère s'applique sans
   * égard pour la RLS. A pouvait donc écrire dans SON foyer une case pointant une
   * recette de B — **mesuré**, `error` nul et une ligne rendue.
   *
   * La story 3.6 a refermé le trou (`20260804144217`, volet 2) en resserrant le
   * `with check` de la politique. Ce test a été inversé **dans le même commit** :
   * sa rédaction précédente avait justement demandé que « le jour où une migration
   * ferme ce trou, ce soit ICI que ça se voie, et pas dans une branche `if` qui
   * l'aurait absorbé en silence ». C'est ici que ça s'est vu.
   *
   * ⚠️ **Ce n'était PAS une fuite d'isolation**, et ça n'a jamais été présenté
   * comme tel : la RLS filtrait déjà la ressource embarquée (second volet
   * ci-dessous). C'était un défaut d'INTÉGRITÉ — un foyer pouvait se fabriquer une
   * case qui ne s'afficherait jamais.
   */
  const recetteDeB = await recetteDeService(b.foyerId, "SECRET DE BRUNO");

  const { error: poseInterdite } = await a.client
    .from("meal_plan_entries")
    .insert({
      household_id: a.foyerId,
      recipe_id: recetteDeB,
      meal_date: "2026-09-14",
      meal_type: "lunch",
    })
    .select("id");

  assert.notEqual(
    poseInterdite,
    null,
    "la politique doit refuser une case pointant la recette d'un autre foyer"
  );
  /*
   * ⚠️ **Le SQLSTATE, pas le texte.** `42501` est le code d'un refus de politique
   * RLS ; le message français qui l'accompagne est rédigé par Postgres et pourrait
   * être reformulé par une montée de version. Même règle que `refusOrdre` :
   * SQLSTATE d'abord, et on ne s'appuie sur un texte que s'il fait partie du
   * schéma — ce qu'un nom de contrainte est, et qu'un message n'est pas.
   */
  assert.equal(poseInterdite!.code, "42501", "un refus de politique RLS");

  /*
   * ⚠️ **ET LE FAIT QUE CE TEST PORTAIT DÉJÀ RESTE MESURÉ : la RLS s'applique à la
   * ressource EMBARQUÉE.** C'est la seule chose qui l'atteste dans ce dépôt, et la
   * forme de lecture — une jointure PostgREST, pas une table — est la plus récente
   * du produit. Rien ne garantissait a priori qu'elle soit filtrée comme une table.
   *
   * ⚠️ **La pose passe désormais par le client de SERVICE**, faute de pouvoir passer
   * par A : le témoin négatif du fichier, celui qui traverse la RLS par conception.
   * Sans ce détour, la fermeture du trou aurait emporté la seule mesure de ce fait —
   * et personne ne l'aurait vu, puisque le test serait resté vert.
   */
  const { error: poseDeService } = await admin.from("meal_plan_entries").insert({
    household_id: a.foyerId,
    recipe_id: recetteDeB,
    meal_date: "2026-09-14",
    meal_type: "lunch",
  });
  assert.equal(
    poseDeService,
    null,
    "témoin : le rôle de service traverse la RLS, donc la ligne incohérente existe"
  );

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

test("l'unicité d'assignation refuse le doublon, et RIEN d'autre", async () => {
  /*
   * ⚠️ **Les deux cas NÉGATIFS comptent autant que le positif.** Une contrainte trop
   * large — sur `(household_id, meal_date, meal_type)` seul — refuserait le doublon
   * elle aussi, et un test qui ne vérifie que le refus la laisserait passer. Ce
   * qu'AD-6 autorise et qu'il ne faut PAS casser :
   *   · deux recettes DIFFÉRENTES au même repas (« Soir : gratin + salade ») ;
   *   · la même recette dans deux cases différentes (le batch-cooking).
   */
  /*
   * ⚠️ **Des dates À SOI, hors de toute fenêtre lue ailleurs.** Ce fichier ne nettoie
   * pas entre les tests : les cases s'accumulent dans la même base. Réemployer le
   * 2026-09-21 faisait compter 5 lignes au témoin positif qui en attend 2 — attrapé
   * à l'exécution, et c'est le genre de couplage qu'un `.eq("id", …)` masquerait au
   * lieu de le supprimer.
   */
  const gratin = await recetteDeService(a.foyerId, "Gratin à compter");
  const salade = await recetteDeService(a.foyerId, "Salade à compter");

  const case1 = {
    household_id: a.foyerId,
    recipe_id: gratin,
    meal_date: "2026-10-05",
    meal_type: "dinner",
  };

  const { error: premiere } = await a.client.from("meal_plan_entries").insert(case1);
  assert.equal(premiere, null, "la première assignation passe");

  const { error: doublon } = await a.client.from("meal_plan_entries").insert(case1);
  assert.notEqual(doublon, null, "AC2 : le doublon d'assignation est refusé");
  assert.equal(doublon!.code, "23505", "violation d'unicité");
  assert.match(doublon!.message, /meal_plan_entries_assignation_unique/);

  const { error: autreRecette } = await a.client
    .from("meal_plan_entries")
    .insert({ ...case1, recipe_id: salade });
  assert.equal(
    autreRecette,
    null,
    "deux recettes différentes au même repas restent permises (AD-6)"
  );

  const { error: autreJour } = await a.client
    .from("meal_plan_entries")
    .insert({ ...case1, meal_date: "2026-10-06" });
  assert.equal(
    autreJour,
    null,
    "la même recette un autre jour reste permise — c'est le batch-cooking"
  );
});

test("A ne peut ni poser, ni modifier, ni supprimer une case de menu chez B", async () => {
  /*
   * La LECTURE est couverte par « A ne lit pas les cases de menu de B ». L'ÉCRITURE
   * ne l'était pas — et c'est la story 3.6 qui l'ouvre, donc c'est elle qui la doit
   * (AD-17 : une politique jamais exercée est une politique supposée).
   *
   * ⚠️ Les trois verbes, sur le modèle de « A ne peut ni poser, ni modifier, ni
   * supprimer un ingrédient chez B » : un `update` et un `delete` refusés par la RLS
   * rendent **zéro ligne et AUCUNE erreur**, donc c'est l'état de la base qui
   * tranche, jamais le code de retour.
   */
  const recetteDeB = await recetteDeService(b.foyerId, "Le pot-au-feu de Bruno");
  const { data: caseDeB, error: pose } = await admin
    .from("meal_plan_entries")
    .insert({
      household_id: b.foyerId,
      recipe_id: recetteDeB,
      meal_date: "2026-09-28",
      meal_type: "dinner",
      servings: 3,
    })
    .select("id")
    .single();
  assert.equal(pose, null, "témoin négatif : la case de B existe bien");

  const { error: poseChezB } = await a.client.from("meal_plan_entries").insert({
    household_id: b.foyerId,
    recipe_id: recetteDeB,
    meal_date: "2026-09-29",
    meal_type: "lunch",
  });
  assert.notEqual(poseChezB, null, "A ne pose pas une case dans le foyer de B");

  await a.client
    .from("meal_plan_entries")
    .update({ servings: 99 })
    .eq("id", caseDeB!.id);
  await a.client.from("meal_plan_entries").delete().eq("id", caseDeB!.id);

  const { data: apres } = await admin
    .from("meal_plan_entries")
    .select("id, servings")
    .eq("id", caseDeB!.id)
    .maybeSingle();
  assert.notEqual(apres, null, "la case de B n'a pas été supprimée");
  assert.equal(apres!.servings, 3, "le nombre de personnes de B est intact");
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

// ── Liste de courses : isolation, et le DELETE qui n'existe plus (story 4.1) ─
//
// ⚠️ **AUCUN test ne touchait `grocery_list_items` avant cette story** — mesuré le
// 2026-08-05. La table existe depuis le squelette du 2026-05-02 et sa politique
// `grocery_all` n'a jamais été éprouvée par rien. AD-17 : l'isolation se prouve par
// un test EXÉCUTÉ.
//
// ⚠️ **La story 4.1 retire le verbe DELETE aux surfaces** : `grocery_all … for all`
// est remplacée par trois politiques nommées, et l'ABSENCE de politique DELETE est
// le mécanisme (la RLS refuse par défaut ce qu'aucune politique n'autorise). C'est
// la seule forme qui tienne le critère « suppression par tombstone, JAMAIS par
// DELETE dur » (AD-3) au niveau de la donnée plutôt que dans la vigilance d'une
// surface (AD-1/AD-2).

/** Pose un article chez `foyer` avec la clé de service, et rend son identifiant. */
async function articleDeService(
  foyerId: string,
  nom: string,
  unite: string | null = null
): Promise<string> {
  const { data, error } = await admin
    .from("grocery_list_items")
    .insert({ household_id: foyerId, name: nom, unit: unite })
    .select("id")
    .single();
  assert.equal(error, null, `l'article « ${nom} » n'a pas pu être posé`);
  return data!.id as string;
}

test("A ne lit pas les articles de B, même en nommant leur identifiant", async () => {
  const chezB = await articleDeService(b.foyerId, "Poireaux de Bruno");

  const { data: tout, error } = await a.client.from("grocery_list_items").select("id, name");
  assert.equal(error, null);
  assert.equal(
    tout?.some((l) => l.id === chezB),
    false,
    "A voit un article de B dans sa propre liste"
  );

  // Et en le désignant explicitement : la RLS filtre les LIGNES, pas la requête.
  const { data: cible } = await a.client
    .from("grocery_list_items")
    .select("id, name")
    .eq("id", chezB);
  assert.deepEqual(cible, [], "A lit un article de B en le nommant");

  // La vue aussi : `security_invoker = true` est ce qui le garantit.
  const { data: parRayon } = await a.client
    .from("grocery_list_by_aisle")
    .select("id")
    .eq("id", chezB);
  assert.deepEqual(parRayon, [], "la vue laisse fuir un article de B");
});

test("A ne peut ni poser, ni modifier un article chez B", async () => {
  const chezB = await articleDeService(b.foyerId, "Beurre de Bruno");

  const { error: pose } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: b.foyerId, name: "Intrus" });
  assert.notEqual(pose, null, "A a posé un article dans le foyer de B");

  /*
   * ⚠️ **Zéro ligne modifiée est un SUCCÈS PostgREST, pas une erreur.** Sous RLS,
   * écrire sur une ligne masquée ne rend AUCUNE erreur — le `update` porte sur un
   * ensemble vide. C'est le faux positif que la story 2.2 a mesuré : sans
   * `.select()` et sans compter les lignes rendues, ce test passerait en ne
   * prouvant rien.
   */
  const { data: modifiees, error: modif } = await a.client
    .from("grocery_list_items")
    .update({ name: "Détourné" })
    .eq("id", chezB)
    .select("id");
  assert.equal(modif, null, "erreur inattendue");
  assert.deepEqual(modifiees, [], "A a modifié un article de B");

  const { data: intact } = await admin
    .from("grocery_list_items")
    .select("name")
    .eq("id", chezB)
    .single();
  assert.equal(intact!.name, "Beurre de Bruno", "le nom de l'article de B a bougé");
});

test("A ne peut pas SUPPRIMER son propre article — la suppression est un tombstone", async () => {
  /*
   * ⚠️ **LE TEST LE PLUS IMPORTANT DE LA STORY 4.1.** Le critère dit « la
   * suppression se fait par tombstone, JAMAIS par DELETE dur ». Ce n'est pas une
   * convention de code : c'est l'absence de politique DELETE qui le tient, au
   * niveau de la donnée (AD-1/AD-2). L'écriture de la liste étant client-direct
   * (AD-13), le membre possède sa clé anon et son jeton — un `DELETE` PostgREST
   * direct est à un appel près.
   *
   * ⚠️ **Il passe par le client authentifié de A, JAMAIS par `admin`.** La clé de
   * service traverse la RLS : le même test écrit avec `admin` supprimerait la ligne
   * et « prouverait » l'inverse.
   *
   * ⚠️ **Et comme au-dessus, zéro ligne supprimée est un succès PostgREST.** C'est
   * le compte des lignes rendues qui mesure, pas l'absence d'erreur.
   */
  const { data: pose, error: erreurPose } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: "Article que A voudrait effacer" })
    .select("id")
    .single();
  assert.equal(erreurPose, null, "A n'a pas pu poser son propre article");
  const sien = pose!.id as string;

  const { data: supprimees, error } = await a.client
    .from("grocery_list_items")
    .delete()
    .eq("id", sien)
    .select("id");
  assert.equal(error, null, "erreur inattendue");
  assert.deepEqual(supprimees, [], "A a supprimé une ligne en dur : le tombstone est contournable");

  const { data: survivant } = await admin
    .from("grocery_list_items")
    .select("id, deleted_at")
    .eq("id", sien)
    .single();
  assert.notEqual(survivant, null, "la ligne a disparu de la base");
  assert.equal(survivant!.deleted_at, null, "rien n'aurait dû poser de tombstone ici");
});

test("A ne peut pas supprimer un article de B non plus", async () => {
  // Le pendant inter-foyers du test précédent : deux raisons de refuser se
  // superposent (aucune politique DELETE, et la ligne n'est pas visible). Le
  // mesurer séparément évite qu'un futur assouplissement de l'une passe inaperçu.
  const chezB = await articleDeService(b.foyerId, "Pommes de Bruno");
  const { data: supprimees, error } = await a.client
    .from("grocery_list_items")
    .delete()
    .eq("id", chezB)
    .select("id");
  assert.equal(error, null, "erreur inattendue");
  assert.deepEqual(supprimees, [], "A a supprimé un article de B");

  const { count } = await admin
    .from("grocery_list_items")
    .select("id", { count: "exact", head: true })
    .eq("id", chezB);
  assert.equal(count, 1, "l'article de B a disparu");
});

test("A gère SON article de bout en bout, tombstone compris", async () => {
  /*
   * ⚠️ **LE TÉMOIN POSITIF, et il n'est pas décoratif.** Sans lui, tous les tests
   * négatifs ci-dessus passeraient sur une table simplement inaccessible — c'est la
   * forme de faux positif la plus difficile à voir, et le dépôt l'a déjà rencontrée
   * (story 3.5 : supprimer une politique rend la table PLUS restrictive, donc les
   * tests négatifs restent verts gratuitement).
   */
  const { data: pose, error: erreurPose } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: "Farine", unit: "kg", quantity: 1 })
    .select("id, updated_at")
    .single();
  assert.equal(erreurPose, null, "A n'a pas pu poser son article");
  const sien = pose!.id as string;

  // Il apparaît dans la vue groupée par rayon : « À classer », sans rayon résolu.
  const { data: visible } = await a.client
    .from("grocery_list_by_aisle")
    .select("id, name, aisle_name")
    .eq("id", sien);
  assert.equal(visible?.length, 1, "l'article de A n'apparaît pas dans sa propre vue");
  assert.equal(visible![0].aisle_name, null, "sans rayon résolu, c'est « À classer » (story 4.17)");

  // Il se modifie.
  const { data: modifie, error: erreurModif } = await a.client
    .from("grocery_list_items")
    .update({ status: "bought" })
    .eq("id", sien)
    .select("id, status, updated_at")
    .single();
  assert.equal(erreurModif, null, "A n'a pas pu modifier son article");
  assert.equal(modifie!.status, "bought");
  assert.notEqual(
    modifie!.updated_at,
    pose!.updated_at,
    "le trigger `set_updated_at` n'a pas posé le nouvel horodatage"
  );

  // Et il se supprime — par tombstone, la seule voie qui reste.
  const { data: tombstone, error: erreurTombstone } = await a.client
    .from("grocery_list_items")
    .update({ deleted_at: new Date().toISOString(), status: "pending" })
    .eq("id", sien)
    .select("id, deleted_at")
    .single();
  assert.equal(erreurTombstone, null, "A n'a pas pu poser le tombstone");
  assert.notEqual(tombstone!.deleted_at, null);

  // Tombstoné, il quitte la vue — sans quitter la table.
  const { data: apres } = await a.client.from("grocery_list_by_aisle").select("id").eq("id", sien);
  assert.deepEqual(apres, [], "la vue montre encore un article supprimé");

  const { data: enBase } = await a.client
    .from("grocery_list_items")
    .select("id")
    .eq("id", sien);
  assert.equal(enBase?.length, 1, "le tombstone a fait disparaître la ligne de la table");
});

test("le tombstone GARDE sa clé canonique — rajouter est un UPDATE, jamais un INSERT", async () => {
  /*
   * ⚠️ **La conséquence de l'index TOTAL (aucun `where deleted_at is null`), et
   * celle que les stories 4.5 et 4.7 doivent connaître AVANT de coder.** AD-3 :
   * « l'id sur lequel s'arbitre LWW/tombstone doit rester stable ». Un index
   * partiel laisserait naître une ligne neuve à côté du tombstone, et un cochage
   * hors ligne flushé après une suppression arbitrerait contre une ligne disparue.
   *
   * Ce test dit donc deux choses au développeur de la 4.5 : ton INSERT rendra
   * `23505` sur un geste parfaitement légitime, et ton UPDATE est la bonne voie.
   */
  const nom = "Lentilles corail";
  const { data: pose } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: nom, unit: "g" })
    .select("id")
    .single();
  const ligne = pose!.id as string;

  await a.client
    .from("grocery_list_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", ligne);

  // Rajouter par INSERT : refusé, la clé est toujours occupée.
  const { error: reinsertion } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: nom, unit: "g" });
  assert.notEqual(reinsertion, null, "un INSERT a créé une ligne jumelle à côté du tombstone");
  assert.equal(reinsertion!.code, "23505");

  // Rajouter par UPDATE : c'est la voie, et elle ressuscite la MÊME ligne.
  const { data: ressuscite, error: erreurUpdate } = await a.client
    .from("grocery_list_items")
    .update({ deleted_at: null })
    .eq("id", ligne)
    .select("id, deleted_at")
    .single();
  assert.equal(erreurUpdate, null, "l'UPDATE de résurrection a été refusé");
  assert.equal(ressuscite!.id, ligne, "la ligne ressuscitée n'est pas la même");
  assert.equal(ressuscite!.deleted_at, null);
});

test("A ne peut pas déplacer son article vers le foyer de B", async () => {
  /*
   * L'écriture chez l'autre foyer par la porte de derrière : A garde la main sur sa
   * ligne (le `using` la lui donne) et change son `household_id`.
   *
   * ⚠️ **CE TEST MESURE LE RÉSULTAT, PAS LE `with check` — et la première rédaction
   * de ce commentaire prétendait le contraire.** Mesuré au banc des dents le
   * 2026-08-05, en `set local role authenticated` avec un claim JWT forgé :
   *
   *   with check (true) + grocery_select using (household_id = …)  →  42501, refusé
   *   with check (true) + grocery_select using (true)              →  ACCEPTÉ
   *
   * C'est donc la politique **SELECT** qui refuse la ligne d'arrivée : Postgres
   * exige que le nouvel état d'une ligne mise à jour reste visible à celui qui la
   * modifie. Retirer le seul `with check` ne fait tomber aucun test, et c'est écrit
   * ici plutôt que laissé croire — le `with check` est gardé comme ceinture en plus
   * des bretelles, pour le jour où `grocery_select` s'assouplira (dashboard, pont).
   */
  const { data: pose } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: "Article voyageur" })
    .select("id")
    .single();
  const sien = pose!.id as string;

  const { data: deplacees, error } = await a.client
    .from("grocery_list_items")
    .update({ household_id: b.foyerId })
    .eq("id", sien)
    .select("id");
  assert.notEqual(
    error === null && (deplacees?.length ?? 0) > 0,
    true,
    "A a déplacé son article dans le foyer de B"
  );

  const { data: reste } = await admin
    .from("grocery_list_items")
    .select("household_id")
    .eq("id", sien)
    .single();
  assert.equal(reste!.household_id, a.foyerId, "l'article a changé de foyer");
});

test("un appel ANONYME ne lit ni n'écrit la liste", async () => {
  /*
   * Toutes les politiques s'ancrent sur `current_household_id()`, qui résout depuis
   * `profiles.id = auth.uid()`. Sans session, `auth.uid()` est nul, donc la
   * fonction rend `null`, et `household_id = null` n'est jamais vrai. Le mesurer
   * plutôt que le déduire : c'est le raisonnement qui a été démenti deux fois sur
   * ce dépôt.
   */
  const anonyme = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const chezA = await articleDeService(a.foyerId, "Article visible de personne");

  const { data: lu } = await anonyme.from("grocery_list_items").select("id").eq("id", chezA);
  assert.deepEqual(lu, [], "un appel anonyme lit la liste");

  const { error: ecrit } = await anonyme
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: "Intrus anonyme" });
  assert.notEqual(ecrit, null, "un appel anonyme écrit dans la liste");
});

test("le MÊME article existe chez A et chez B — la clé est unique PAR FOYER", async () => {
  /*
   * ⚠️ **AJOUTÉ EN REVUE le 2026-08-05, parce que `household_id` n'avait AUCUNE
   * dent.** Tous les noms insérés par les 21 tests de la story étaient deux à
   * deux distincts entre foyers (« Poireaux de Bruno », « Farine », « Lentilles
   * corail »…), et `contraintes.test.ts` travaille sur un foyer unique. Retirer
   * `household_id` de l'index — donc unicité **globale** — laissait toute la
   * suite verte.
   *
   * Ce que ça aurait coûté : une **fuite d'information inter-foyers par
   * `23505`**. Un membre apprend qu'un autre foyer a déjà « lait / L » en
   * essayant de l'ajouter chez lui. C'est un défaut NFR-5 qu'aucun test négatif
   * n'aurait vu, puisqu'aucune ligne n'aurait été lue.
   */
  const nom = "Article rigoureusement homonyme";

  const { error: chezA } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: nom, unit: "L" });
  assert.equal(chezA, null, "A n'a pas pu poser son article");

  const { error: chezB } = await b.client
    .from("grocery_list_items")
    .insert({ household_id: b.foyerId, name: nom, unit: "L" });
  assert.equal(
    chezB,
    null,
    "B ne peut pas poser le même nom que A : la clé n'est pas ancrée sur le foyer"
  );

  // Et chacun ne voit que le sien.
  const { data: vusParA } = await a.client
    .from("grocery_list_items")
    .select("id, household_id")
    .eq("name", nom);
  assert.equal(vusParA?.length, 1, "A voit plus que son propre article homonyme");
  assert.equal(vusParA![0].household_id, a.foyerId);

  // Le doublon reste refusé À L'INTÉRIEUR du foyer — sans quoi ce test passerait
  // sur une clé qui aurait simplement perdu son unicité.
  const { error: doublon } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: nom.toUpperCase(), unit: "L" });
  assert.notEqual(doublon, null, "la clé n'est plus unique dans le foyer");
  assert.equal(doublon!.code, "23505");
});

/* ─────────────────────────────────────────────────────────────────────────
 * L'ORDRE rendu par la vue, et le `left join` côté RENSEIGNÉ (story 4.2)
 *
 * ⛔ **DEUX TROUS MESURÉS LE 2026-08-05, ET C'EST CETTE STORY QUI LES OUVRE.**
 * (M14) Trois tests touchent `grocery_list_by_aisle`, tous de la story 4.1, et
 * **aucun ne mesure l'ORDRE** — or « dans l'ordre du parcours » (FR-2) est le
 * critère central de la 4.2. (M8) Et les articles de tous les tests existants
 * ont `aisle_id` nul, parce que `product_aisle_map` est vide (story 2.3) : le
 * `left join` de la vue n'a **jamais été éprouvé côté renseigné**.
 *
 * ⚠️ **Lu par le client authentifié de A, JAMAIS par `admin`** : la clé de
 * service traverse la RLS, et le test passerait en ne prouvant rien.
 * ───────────────────────────────────────────────────────────────────────── */

/** Un rayon posé par A elle-même, à une position choisie. */
async function rayonDeA(
  nom: string,
  ordre: number,
  icone: string | null = null,
) {
  const { data, error } = await a.client
    .from("aisles")
    .insert({
      household_id: a.foyerId,
      name: nom,
      sort_order: ordre,
      icon: icone,
    })
    .select("id")
    .single();
  assert.equal(error, null, `le rayon « ${nom} » n'a pas pu être posé`);
  return data!.id as string;
}

/*
 * ⛔ **UN PRÉFIXE PAR TEST, ET C'EST UNE GARDE, PAS UNE COQUETTERIE.** Les trois
 * tests ci-dessous écrivent dans LE MÊME foyer. Le premier compare la liste
 * rendue à une séquence EXACTE de cinq noms : si les deux autres semaient sous
 * le même préfixe, il suffirait de les réordonner — ou de lancer la suite avec
 * `--test-name-pattern` — pour que le premier échoue sur des données qui ne le
 * concernent pas. Un échec dont la cause n'a rien à voir avec son objet est
 * exactement ce que l'encadré du segfault, plus bas, déplore.
 */
const PREFIXE_ORDRE = "zzordre-";

/** Un article posé par A, éventuellement rattaché à un rayon. */
async function articleDeA(nom: string, rayonId: string | null) {
  const { error } = await a.client
    .from("grocery_list_items")
    .insert({ household_id: a.foyerId, name: nom, aisle_id: rayonId });
  assert.equal(error, null, `l'article « ${nom} » n'a pas pu être posé`);
}

test("la vue rend l'ordre du parcours, et DEUX RAYONS EX ÆQUO INTERCALENT leurs articles", async () => {
  /*
   * ⛔ **LE TEST QUI JUSTIFIE `grouperParRayon`.** `aisles.sort_order` n'a
   * aucune contrainte d'unicité (M11) : deux rayons peuvent légalement partager
   * une position. La vue trie par `(coalesce(sort_order, 9999), g.name)` —
   * `g.name` étant le nom de l'**ARTICLE**, pas celui du rayon. Deux rayons ex
   * æquo voient donc leurs articles **s'intercaler** dans le flux rendu.
   *
   * C'est ce que ce test mesure, et c'est la raison pour laquelle un
   * regroupement « j'ouvre une carte quand le rayon change » rendrait deux
   * cartes portant le même rayon.
   */
  const precoce = await rayonDeA("ZZ Précoce", 5);
  const alpha = await rayonDeA("ZZ Alpha", 20);
  const exaequo = await rayonDeA("ZZ Exaequo", 20);

  // Les noms sont choisis pour que l'ordre alphabétique CROISE l'ordre des rayons.
  await articleDeA("zzordre-aaa", exaequo);
  await articleDeA("zzordre-bbb", alpha);
  await articleDeA("zzordre-ccc", exaequo);
  await articleDeA("zzordre-ddd", precoce);
  await articleDeA("zzordre-eee", null); // sans rayon → « À classer »

  /*
   * Lecture SANS `order=` : c'est l'`ORDER BY` de la vue elle-même qu'on mesure
   * ici, pas celui qu'on demanderait.
   */
  const { data: brut, error } = await a.client
    .from("grocery_list_by_aisle")
    .select("name, aisle_name, aisle_sort");
  assert.equal(error, null, "A n'a pas pu lire sa propre liste");

  const rendus = (brut ?? [])
    .filter((l) => (l.name as string | null)?.startsWith(PREFIXE_ORDRE))
    .map((l) => l.name as string);

  assert.deepEqual(
    rendus,
    ["zzordre-ddd", "zzordre-aaa", "zzordre-bbb", "zzordre-ccc", "zzordre-eee"],
    "l'ordre du parcours n'est pas celui que la vue rend",
  );

  /*
   * ⛔ **L'ASSERTION QUI COMPTE** : entre `zzordre-aaa` et `zzordre-ccc`, tous deux du
   * rayon « ZZ Exaequo », se glisse `zzordre-bbb` qui est du rayon « ZZ Alpha ».
   * Les lignes d'un même rayon NE SONT PAS consécutives.
   */
  const rayonsRendus = (brut ?? [])
    .filter((l) => (l.name as string | null)?.startsWith(PREFIXE_ORDRE))
    .map((l) => l.aisle_name as string | null);
  assert.deepEqual(
    rayonsRendus,
    ["ZZ Précoce", "ZZ Exaequo", "ZZ Alpha", "ZZ Exaequo", null],
    "les rayons ex æquo n'intercalent plus leurs articles — le piège a disparu",
  );

  /*
   * ⚠️ **Règle §4 : l'accord entre la vue et la requête explicite se MESURE.**
   * `articlesDuFoyer` écrit `.order("aisle_sort").order("name")` alors que la
   * vue porte déjà son `ORDER BY`. Les deux doivent rendre la même chose — sinon
   * l'un des deux ment, et rien ne le dirait.
   */
  const { data: trie } = await a.client
    .from("grocery_list_by_aisle")
    .select("name")
    .order("aisle_sort")
    .order("name");
  assert.deepEqual(
    (trie ?? [])
      .filter((l) => (l.name as string | null)?.startsWith(PREFIXE_ORDRE))
      .map((l) => l.name as string),
    rendus,
    "le tri explicite de `articlesDuFoyer` diverge de celui de la vue",
  );
});

test("un article dont le rayon EXISTE rend son nom, son icône et son ordre", async () => {
  /*
   * ⛔ **Trou M8 : tous les tests existants ont `aisle_id` nul**, parce que
   * `product_aisle_map` est vide (story 2.3). Le `left join` de la vue n'était
   * donc éprouvé que du côté où il ne joint rien — et un écran groupé par rayon
   * repose entièrement sur l'autre côté.
   */
  const rayon = await rayonDeA("ZZ Crèmerie", 42, "🧀");
  await articleDeA("zzjoint-fromage", rayon);

  const { data, error } = await a.client
    .from("grocery_list_by_aisle")
    .select("name, aisle_id, aisle_name, aisle_icon, aisle_sort")
    .eq("name", "zzjoint-fromage");
  assert.equal(error, null);
  assert.equal(
    data?.length,
    1,
    "l'article rattaché n'apparaît pas dans la vue",
  );

  const ligne = data![0];
  assert.equal(ligne.aisle_id, rayon, "la vue perd le rattachement au rayon");
  assert.equal(ligne.aisle_name, "ZZ Crèmerie");
  assert.equal(ligne.aisle_icon, "🧀");
  assert.equal(ligne.aisle_sort, 42, "l'ordre du parcours ne remonte pas");
});

test("supprimer un rayon bascule ses articles en « À classer », il ne les détruit pas", async () => {
  /*
   * ⚠️ `grocery_list_items.aisle_id` est une FK `on delete set null` (M12).
   * C'est ce qui rend le groupe « À classer » atteignable autrement que par une
   * résolution manquante — et donc ce qui rend la carte à `rayonId` nul un cas
   * NOMINAL de l'écran, pas une anomalie.
   */
  const rayon = await rayonDeA("ZZ Éphémère", 77);
  await articleDeA("zzorph-orphelin", rayon);

  const { error: suppression } = await a.client
    .from("aisles")
    .delete()
    .eq("id", rayon);
  assert.equal(suppression, null, "A n'a pas pu supprimer son propre rayon");

  const { data } = await a.client
    .from("grocery_list_by_aisle")
    .select("name, aisle_id, aisle_name")
    .eq("name", "zzorph-orphelin");
  assert.equal(data?.length, 1, "l'article a disparu avec son rayon");
  assert.equal(
    data![0].aisle_id,
    null,
    "l'article n'a pas basculé en « À classer »",
  );
  assert.equal(data![0].aisle_name, null);
});

/* ⛔ ────────────────────────────────────────────────────────────────────────
 * LE TEST CI-DESSOUS EST **SAUTÉ** DEPUIS LE 2026-08-07, ET C'EST LA DÉCISION
 * D-1 DE LA REVUE DE LA STORY 4.2 (Florian).
 *
 * ⚠️ **MESURÉ le 2026-08-07** : chaque appel de `generate_grocery_list_from_menu`
 * fait tomber PostgreSQL en `signal 11: Segmentation fault` sur le stack local
 * (sonde à deux appels → **delta de exactement 2 segfauts**, journal du
 * conteneur `supabase_db_nutriclaude`). Tout ce qui s'exécute APRÈS lui frappe
 * une base en `recovery mode` et échoue sans rapport avec son objet.
 *
 * ⛔ **ET IL PASSAIT POUR LA MAUVAISE RAISON.** Il assertionne `error !== null`
 * sans regarder LEQUEL. L'erreur réellement rendue est
 * `PGRST001 « no connection to the server »` — l'erreur du CRASH, pas un refus
 * de permission. **Il ne démontrait donc pas le `revoke execute` du volet 8** ;
 * il observait sa propre panne, en vert.
 *
 * ⛔ **POURQUOI `skip` PLUTÔT QU'UN ORDRE D'EXÉCUTION CHOISI.** La première
 * rédaction plaçait simplement les tests de la 4.2 avant lui. Ça protégeait les
 * tests de la 4.2 et rien d'autre : la garde n'était qu'un encadré, à ~190
 * lignes de distance dans un fichier de 1913, et la story suivante qui ajoute
 * son test à la fin du fichier — l'endroit naturel — retombait dedans.
 * **`skip` est mécanique** : plus aucun test ne peut tomber derrière le crash,
 * et surtout un test sauté le DIT, là où un test vert le cachait. C'est la
 * règle §1 appliquée à une porte : une case vide honnête vaut mieux qu'une case
 * cochée à tort.
 *
 * ⚠️ **CE QUI EST PERDU, ET QUI DOIT ÊTRE ROUVERT** : le `revoke execute` du
 * volet 8 n'est plus mesuré par rien. Il ne l'était déjà pas — le test observait
 * le crash — donc `skip` ne retire aucune couverture réelle, il cesse d'en
 * simuler une. **Story 4.7** : diagnostiquer le segfault, puis RÉTABLIR ce test
 * avec une assertion sur le SQLSTATE (`42501`) et non sur « une erreur,
 * n'importe laquelle ».
 *
 * ⚠️ **Pré-existant, hors périmètre de la story 4.2**, daté dans
 * `deferred-work.md`. Mesuré sur le stack LOCAL seulement : rien n'a été
 * vérifié en production, et rien n'est affirmé à son sujet.
 * ──────────────────────────────────────────────────────────────────────── */

test.skip("un membre authentifié ne peut PAS appeler la génération de liste", async () => {
  /*
   * ⚠️ **LE TEST DU VOLET 8, ET IL EST NÉ D'UN DÉFAUT QUE LA STORY DÉCLARAIT
   * FERMÉ.** La story affirmait « l'AC4 est tenu pour les SURFACES, et pas pour
   * cette fonction `security definer` ». Mesuré en revue le 2026-08-05 : cette
   * fonction *est* une surface. PostgREST l'expose en RPC, et `execute` lui était
   * accordé à `anon` et `authenticated` — dont, surtout, **par l'entrée `PUBLIC`
   * de son ACL**, que révoquer les rôles nommés ne retire pas.
   *
   * Ce qu'un membre ordinaire pouvait donc faire, avec sa seule clé anon et son
   * jeton (AD-13) :
   *
   *   avant  = 2 lignes (1 vivante + 1 tombstonée)
   *   POST /rest/v1/rpc/generate_grocery_list_from_menu
   *   après  = 0 ligne, tombstones compris
   *
   * — un DELETE dur, exactement ce que l'AC4 proscrit, par la porte de derrière.
   *
   * ⚠️ **Ce test ne dit PAS que la fonction est réparée.** Elle ne l'est pas :
   * elle échoue en `23505` sur deux chemins mesurés et fait toujours son DELETE
   * dur. C'est la story 4.7, et c'est daté. Ce test dit seulement qu'aucune
   * surface ne peut plus l'atteindre.
   */
  const { error } = await a.client.rpc("generate_grocery_list_from_menu", {
    p_start_date: "2026-08-01",
    p_end_date: "2026-08-07",
  });
  assert.notEqual(error, null, "un membre authentifié peut encore appeler la génération");

  // Et un appel anonyme non plus — même mécanisme, mesuré séparément pour qu'un
  // futur assouplissement de l'un ne passe pas inaperçu derrière l'autre.
  const anonyme = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: sansSession } = await anonyme.rpc("generate_grocery_list_from_menu", {
    p_start_date: "2026-08-01",
    p_end_date: "2026-08-07",
  });
  assert.notEqual(sansSession, null, "un appel anonyme peut encore appeler la génération");
});
