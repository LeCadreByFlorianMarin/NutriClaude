import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stackLocal } from "./stack-local.ts";
import { normaliserNomRayon } from "../../lib/rayons/saisie.ts";
import { normaliserEntier, normaliserTitre } from "../../lib/recettes/saisie.ts";

/**
 * Les contraintes de la base, confrontées à la normalisation applicative.
 *
 * **Pourquoi ce fichier existe, et pourquoi il est distinct d'`isolation.test.ts`.**
 * `lib/texte.ts` et `aisles_name_non_vide` prétendent refuser la même chose : un
 * nom qui ne montre rien. Ils ne peuvent pas y arriver de la même façon — le
 * client emploie des propriétés Unicode (`\p{Cf}`, `Default_Ignorable_Code_Point`)
 * que les expressions rationnelles de Postgres n'ont pas, et Postgres emploie
 * `[[:graph:]]` que JavaScript n'a pas.
 *
 * **Cet accord a été AFFIRMÉ deux fois et FAUX deux fois** (revues du
 * 2026-07-29). D'abord `btrim(name) <> ''`, qui ne retirait que l'espace ASCII.
 * Puis une énumération de seize points de code, qui laissait passer U+115F et
 * U+1160 — les frères pleine largeur du U+3164 qu'elle citait en exemple. Un
 * commentaire ne tient pas un invariant ; un test exécuté, si.
 *
 * ⚠ **Le sens du désaccord n'est pas symétrique.** « Le client refuse, la base
 * accepterait » est bénin : le client est simplement plus strict. « Le client
 * accepte, la base refuse » est le cas qui blesse — l'utilisateur reçoit un
 * `23514` traduit en « Il faut un nom. » sur un champ qu'il voit rempli, sans
 * rien à corriger. C'est celui-là que ce fichier interdit.
 *
 * Il reste un résidu **irréductible** : au 2026-07-29, 79 points de code sur
 * 63 492 sont acceptés par le client et refusés par la base, parce que Node et
 * le Postgres du conteneur ne suivent pas la même version d'Unicode. Ce fichier
 * ne les éprouve pas : ils bougeront à chaque montée de version de l'un ou de
 * l'autre, et un test qui les fige casserait pour une bonne raison. Il éprouve
 * la famille qui compte — les invisibles assignés de longue date, ceux qu'un
 * copier-coller depuis une messagerie transporte pour de vrai.
 */

const { apiUrl, serviceRoleKey } = stackLocal();

/** Traverse la RLS : ici on éprouve les contraintes, pas l'isolation. */
const admin: SupabaseClient = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let foyerId: string;

before(async () => {
  const { data, error } = await admin
    .from("households")
    .insert({ name: "Foyer des contraintes" })
    .select("id")
    .single();
  if (error) throw new Error(`création du foyer de contrôle : ${error.message}`);
  foyerId = data.id;
});

after(async () => {
  if (foyerId) await admin.from("households").delete().eq("id", foyerId);
});

/** Tente l'insertion et dit si la base l'a acceptée. */
async function baseAccepte(nom: string): Promise<boolean> {
  const { error } = await admin
    .from("aisles")
    .insert({ household_id: foyerId, name: nom, sort_order: 10 });
  if (!error) {
    await admin.from("aisles").delete().eq("household_id", foyerId).eq("name", nom);
    return true;
  }
  // 23514 = violation de contrainte `check`. Toute autre erreur est un vrai
  // problème et doit faire échouer le test plutôt que se lire « refusé ».
  if (error.code !== "23514") throw new Error(`erreur inattendue (${error.code}) : ${error.message}`);
  return false;
}

/**
 * Les invisibles qui circulent réellement — collés depuis une messagerie, un
 * générateur de « caractère vide », ou un partage de contact.
 */
const INVISIBLES_REELS: ReadonlyArray<readonly [string, string]> = [
  ["U+0009 tabulation", "\u0009"],
  ["U+000A saut de ligne", "\u000A"],
  ["U+0085 NEL", "\u0085"],
  ["U+00A0 espace insécable", "\u00A0"],
  ["U+00AD trait d'union conditionnel", "\u00AD"],
  ["U+034F joncteur de graphème", "\u034F"],
  ["U+115F remplisseur Hangul Choseong", "\u115F"],
  ["U+1160 remplisseur Hangul Jungseong", "\u1160"],
  ["U+180E séparateur mongol", "\u180E"],
  ["U+200B espace de largeur nulle", "\u200B"],
  ["U+200D liant de largeur nulle", "\u200D"],
  ["U+202E forçage droite-à-gauche", "\u202E"],
  ["U+2060 séparateur de mots", "\u2060"],
  ["U+2800 braille blanc", "\u2800"],
  ["U+3164 remplisseur Hangul", "\u3164"],
  ["U+FE0F sélecteur de variante", "\uFE0F"],
  ["U+FEFF marque d'ordre des octets", "\uFEFF"],
  ["U+FFA0 remplisseur demi-largeur", "\uFFA0"],
];

/** Des noms légitimes, que ni l'un ni l'autre ne doit refuser. */
const NOMS_LEGITIMES: ReadonlyArray<readonly [string, string]> = [
  ["français", "Boucherie"],
  ["accentué", "Crémerie"],
  ["esperluette", "Fruits & Légumes"],
  ["cyrillique", "Молоко"],
  ["arabe", "بقالة"],
  ["chinois", "杂货"],
  ["emoji seul", "\u{1F96C}"],
  ["emoji à jointure", "\u{1F9D1}\u200D\u{1F373}"],
  ["emoji à sélecteur de variante", "\u{1F373}\uFE0F"],
  ["ponctuation seule", "&"],
  ["nom suivi d'un invisible", "Boucherie\u200B"],
  ["nom entrecoupé d'un invisible", "Bou\u200Bcherie"],
];

test("aucun invisible réel n'est accepté, ni par le client ni par la base", async () => {
  for (const [nom, saisie] of INVISIBLES_REELS) {
    const client = normaliserNomRayon(saisie) !== null;
    const base = await baseAccepte(saisie);

    assert.equal(client, false, `${nom} : le client l'a accepté`);
    assert.equal(base, false, `${nom} : la base l'a accepté`);
  }
});

test("aucun nom légitime n'est refusé, ni par le client ni par la base", async () => {
  for (const [nom, saisie] of NOMS_LEGITIMES) {
    const normalise = normaliserNomRayon(saisie);
    assert.notEqual(normalise, null, `${nom} : le client l'a refusé`);
    assert.equal(await baseAccepte(normalise as string), true, `${nom} : la base l'a refusé`);
  }
});

test("le client n'est jamais plus laxiste que la base sur les invisibles réels", async () => {
  /*
   * L'invariant qui compte, énoncé directement plutôt que déduit des deux tests
   * précédents : il ne doit exister aucune saisie que le client laisse passer et
   * que la base refuse. C'est ce cas-là qui produit « Il faut un nom. » sur un
   * champ visiblement rempli, sans rien à corriger pour l'utilisateur.
   */
  const laxistes: string[] = [];
  for (const [nom, saisie] of [...INVISIBLES_REELS, ...NOMS_LEGITIMES]) {
    const normalise = normaliserNomRayon(saisie);
    if (normalise === null) continue; // le client refuse : rien n'atteint la base
    if (!(await baseAccepte(normalise))) laxistes.push(nom);
  }
  assert.deepEqual(laxistes, [], "le client laisse passer ce que la base refuse");
});

// ── Recettes : le même invariant, sur le titre et sur les portions ──────────
//
// `recipes_titre_non_vide` recopie **à la lettre** la regex de
// `aisles_name_non_vide` — mêmes octets, extraits du fichier plutôt que retapés.
// Les deux tables devraient donc se comporter à l'identique. « Devraient » n'est
// pas « se comportent » : c'est ce fichier qui le mesure.

/** Tente l'insertion d'une recette et dit si la base l'a acceptée. */
async function baseAccepteTitre(titre: string): Promise<boolean> {
  const { data, error } = await admin
    .from("recipes")
    .insert({ household_id: foyerId, title: titre })
    .select("id");
  if (!error) {
    await admin.from("recipes").delete().eq("id", data![0].id);
    return true;
  }
  if (error.code !== "23514") {
    throw new Error(`erreur inattendue (${error.code}) : ${error.message}`);
  }
  return false;
}

test("le client n'est jamais plus laxiste que la base sur un TITRE de recette", async () => {
  /*
   * L'invariant qui blesse, dans le seul sens qui blesse : une saisie que le
   * client laisse passer et que la base refuse produit « Il faut un titre. » sur
   * un champ visiblement rempli, sans rien à corriger.
   */
  const laxistes: string[] = [];
  for (const [nom, saisie] of [...INVISIBLES_REELS, ...NOMS_LEGITIMES]) {
    const normalise = normaliserTitre(saisie);
    if (normalise === null) continue;
    if (!(await baseAccepteTitre(normalise))) laxistes.push(nom);
  }
  assert.deepEqual(laxistes, [], "le client laisse passer ce que la base refuse");
});

test("aucun invisible réel n'est accepté comme titre, ni par le client ni par la base", async () => {
  for (const [nom, saisie] of INVISIBLES_REELS) {
    assert.equal(normaliserTitre(saisie), null, `${nom} : le client l'a accepté`);
    assert.equal(await baseAccepteTitre(saisie), false, `${nom} : la base l'a accepté`);
  }
});

test("aucun titre légitime n'est refusé, ni par le client ni par la base", async () => {
  for (const [nom, saisie] of NOMS_LEGITIMES) {
    const normalise = normaliserTitre(saisie);
    assert.notEqual(normalise, null, `${nom} : le client l'a refusé`);
    assert.equal(await baseAccepteTitre(normalise as string), true, `${nom} : la base l'a refusé`);
  }
});

test("titre et nom de rayon se comportent à l'identique — les deux regex sont les mêmes octets", async () => {
  /*
   * Ce que ce test empêche : qu'une des deux migrations soit un jour amendée
   * sans l'autre. Elles portent la même règle ; le jour où elles divergent, le
   * produit refuse un nom de rayon qu'il accepte comme titre de recette, ou
   * l'inverse, et personne ne le voit.
   */
  const divergences: string[] = [];
  for (const [nom, saisie] of [...INVISIBLES_REELS, ...NOMS_LEGITIMES]) {
    const pourRayon = normaliserNomRayon(saisie);
    const pourTitre = normaliserTitre(saisie);
    if (pourRayon === null || pourTitre === null) {
      if ((pourRayon === null) !== (pourTitre === null)) divergences.push(`${nom} (client)`);
      continue;
    }
    const rayon = await baseAccepte(pourRayon);
    const titre = await baseAccepteTitre(pourTitre);
    if (rayon !== titre) divergences.push(`${nom} (base)`);
  }
  assert.deepEqual(divergences, [], "les deux contraintes ne disent plus la même chose");
});

test("les portions : le client et la base refusent exactement la même chose", async () => {
  /*
   * Ici le client fait DEUX choses que la base ne peut pas faire seule : il
   * refuse ce qui n'est pas un entier (« 2e3 », « 2,5 »), et il refuse le vide.
   * La base, elle, tient la seule règle qui compte pour l'Epic 4 : `> 0`.
   * L'invariant à mesurer reste le même — le client ne doit jamais être plus
   * laxiste.
   */
  const saisies = ["", "0", "-1", "1", "2", "4", "2e3", "2,5", "abc"];
  const laxistes: string[] = [];

  for (const saisie of saisies) {
    const valeur = normaliserEntier(saisie);
    // La règle d'écran : un entier, et au moins une personne.
    const clientAccepte = valeur !== null && valeur >= 1;
    if (!clientAccepte) continue;

    const { data, error } = await admin
      .from("recipes")
      .insert({ household_id: foyerId, title: `Portions ${saisie}`, servings: valeur })
      .select("id");
    if (error) {
      laxistes.push(saisie);
      continue;
    }
    await admin.from("recipes").delete().eq("id", data![0].id);
  }

  assert.deepEqual(laxistes, [], "le client laisse passer un nombre de portions que la base refuse");
});

test("la base refuse 0 et le négatif, que le client les ait vus ou non", async () => {
  // Le contrôle d'écran est contournable par un appel REST direct ; c'est la
  // contrainte qui est la frontière (AD-2).
  for (const portions of [0, -1, -2147483648]) {
    const { error } = await admin
      .from("recipes")
      .insert({ household_id: foyerId, title: `Direct ${portions}`, servings: portions });
    assert.notEqual(error, null, `servings=${portions} doit être refusé`);
    assert.match(error!.message, /recipes_servings_positif/);
  }
});
