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
   * `meal_plan_entries.recipe_id` est `on delete cascade`. Aucun écran n'expose
   * encore le menu (stories 3.5 et 3.6), donc la confirmation de suppression ne
   * peut RIEN en dire aujourd'hui — et c'est précisément ce qui rend la
   * suppression bon marché maintenant. Ce test fige la conséquence pour que la
   * story 3.6 la trouve écrite plutôt que de la découvrir à l'écran.
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
