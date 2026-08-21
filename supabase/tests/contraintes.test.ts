import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stackLocal } from "./stack-local.ts";
import { normaliserNomRayon } from "../../lib/rayons/saisie.ts";
import { normaliserEntier, normaliserQuantite, normaliserTitre } from "../../lib/recettes/saisie.ts";
import { UNITES, estUniteConnue } from "../../lib/recettes/unites.ts";
import { arrondirPourAchat } from "../../lib/liste/arrondi.ts";
import { SURFACES, estSurfaceConnue } from "../../lib/liste/surfaces.ts";
import { normaliserTexte } from "../../lib/texte.ts";
import { ingredientsDeRecette } from "../../lib/recettes/ingredients.ts";
import { analyserPersonnes } from "../../lib/personnes.ts";

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

// ── Ingrédients : le vocabulaire d'unités, contrat avec l'Epic 4 ─────────────

/**
 * Une recette de service, pour y accrocher des ingrédients.
 *
 * ⚠️ **Créée à la DEMANDE, pas dans le corps du premier test.** La rédaction
 * précédente l'affectait à l'intérieur de « chaque jeton de UNITES … », et les cinq
 * tests suivants s'en servaient comme `recipe_id` sans garde. Deux conséquences,
 * relevées par la revue adversariale du 2026-08-03 : lancer un seul cas avec
 * `--test-name-pattern` faisait insérer `recipe_id: undefined` et produisait un
 * `TypeError` au lieu d'une assertion ; et l'échec du premier test faisait échouer
 * les cinq autres sur un message sans rapport. La recette n'était jamais nettoyée.
 */
let recetteDesContraintes: string | null = null;

async function recetteDeService(): Promise<string> {
  if (recetteDesContraintes) return recetteDesContraintes;
  const { data, error } = await admin
    .from("recipes")
    .insert({ household_id: foyerId, title: "Recette des contraintes" })
    .select("id")
    .single();
  assert.equal(error, null, "la recette de service n'a pas pu être créée");
  recetteDesContraintes = data!.id as string;
  return recetteDesContraintes;
}

/*
 * Pas de nettoyage dédié : l'`after` du foyer emporte la recette par cascade, et
 * la recette emporte ses ingrédients. Un second `after` serait une redondance qui
 * se périmerait le jour où la cascade changerait.
 */

test("AC4 : l'ordre de LECTURE, ex æquo compris", async () => {
  const recette = await recetteDeService();
  /*
   * ⚠️ **Le seul critère de la story 3.2 que rien n'exécutait.** AC4 dit « le
   * nouvel ordre est … respecté à l'AFFICHAGE ». Le côté ÉCRITURE était solidement
   * mesuré — positions distinctes, appel forgé, cardinal, doublon, tableau vide —
   * mais le côté LECTURE, c'est-à-dire `.order("sort_order").order("created_at")`
   * de `ingredientsDeRecette`, n'était tenu que par un commentaire de douze lignes.
   * Règle §4 : un invariant se mesure. Revue adversariale du 2026-08-03.
   *
   * ⚠️ **Le tri SECONDAIRE est le point.** `sort_order` vaut 0 par défaut pour
   * TOUS les ingrédients : sur cette table, les ex æquo sont l'état de DÉPART de
   * toute recette, pas un cas limite. Sans `created_at`, l'ordre affiché serait
   * celui que Postgres choisit ce jour-là — donc instable, et le défaut ne se
   * verrait qu'à l'écran, un jour, sans rien pour le signaler.
   *
   * Ce test passe par `ingredientsDeRecette` et non par une requête écrite ici :
   * recopier le tri prouverait que la copie trie, pas que la fonction trie.
   */
  const { data: r } = await admin
    .from("recipes")
    .insert({ household_id: foyerId, title: "Recette de l'ordre" })
    .select("id")
    .single();
  const recetteOrdre = r!.id as string;

  // Trois ex æquo à 0 insérés en séquence, puis deux rangés explicitement.
  for (const nom of ["premier arrivé", "deuxième arrivé", "troisième arrivé"]) {
    const { error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recetteOrdre, name: nom });
    assert.equal(error, null, `insertion de « ${nom} »`);
  }
  await admin
    .from("recipe_ingredients")
    .insert([
      { recipe_id: recetteOrdre, name: "rangé en 20", sort_order: 20 },
      { recipe_id: recetteOrdre, name: "rangé en 10", sort_order: 10 },
    ]);

  const lus = await ingredientsDeRecette(admin, recetteOrdre);
  assert.deepEqual(
    lus.map((i) => i.nom),
    [
      // Les trois ex æquo à 0 d'abord, dans leur ordre d'ARRIVÉE.
      "premier arrivé",
      "deuxième arrivé",
      "troisième arrivé",
      "rangé en 10",
      "rangé en 20",
    ],
    "l'ordre de lecture ne respecte pas sort_order puis created_at"
  );

  // Un identifiant qui n'est pas un uuid rend une liste vide, sans lever.
  assert.deepEqual(await ingredientsDeRecette(admin, "pas-un-uuid"), []);

  await admin.from("recipes").delete().eq("id", recetteOrdre);
});

test("la base REFUSE un nom d'ingrédient vide ou invisible", async () => {
  /*
   * ⚠️ **La dent qui manquait à `recipe_ingredients_nom_non_vide`, et c'est mesuré.**
   * La revue adversariale du 2026-08-03 a retiré la contrainte du stack local et
   * relancé la suite : **55/55, zéro test tombé** — alors que les deux autres
   * contraintes de la même migration en avaient bien une (unité 55→53, quantité
   * 55→54). La Task 8 affirmait pourtant les avoir toutes passées au banc des dents.
   *
   * ⚠️ **Et ça se démontre sans stack, par simple lecture.** Le seul test qui
   * touchait le nom — « le client n'est jamais plus laxiste que la base » —
   * n'insère QUE ce que le client accepte, puis vérifie que la base l'accepte
   * aussi. Retirer la contrainte rend la base *plus permissive* : chaque insertion
   * réussit toujours, la liste des laxistes reste vide, le test passe. **Il ne peut
   * structurellement pas tomber sur une contrainte relâchée.**
   *
   * Celui-ci prend le sens inverse — « la base REFUSE » — qui est le seul à mordre.
   * C'est le pendant de ce que la story 3.1 avait écrit pour les titres de recette.
   */
  const recette = await recetteDeService();
  for (const vide of ["", " ", "​", " ‍", "\t\n"]) {
    const { error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: vide });
    assert.notEqual(
      error,
      null,
      `la base a accepté un nom vide : ${JSON.stringify(vide)}`
    );
    assert.match(error!.message, /recipe_ingredients_nom_non_vide/);
  }
});

test("chaque jeton de UNITES est accepté par la base, et rien d'autre", async () => {
  /*
   * ⚠️ L'invariant central de la story 3.2. `UNITES` (code) et
   * `recipe_ingredients_unite_fermee` (base) prétendent nommer le même ensemble.
   * Un commentaire qui l'affirmerait serait faux un jour sans que rien ne le
   * dise — et la conséquence ne se verrait qu'en Epic 4, sous la forme de deux
   * lignes de courses qui refusent de fusionner.
   */
  const recette = await recetteDeService();

  for (const unite of UNITES) {
    const { data, error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: `test ${unite}`, unit: unite })
      .select("id");
    assert.equal(error, null, `la base a refusé le jeton « ${unite} » que le code publie`);
    await admin.from("recipe_ingredients").delete().eq("id", data![0].id);
  }
});

test("⛔ l'arrondi d'achat dit la MÊME chose en TypeScript et en base", async () => {
  /*
   * ⛔ **L'INVARIANT DE LA STORY 4.7, ET IL EXISTE PARCE QUE DEUX DÉCISIONS SE
   * CONTREDISAIENT.** D7 prescrivait « la règle d'arrondi ne vit jamais dans le SQL » ;
   * D1(a) mettait la boucle de génération DANS la base — donc c'est la base qui écrit la
   * quantité, donc c'est elle qui doit l'arrondir. Un arrondi qui ne vivrait que dans
   * `lib/` n'arrondirait rien de ce qui est stocké.
   *
   * ⚠️ **La règle vit donc en DEUX exemplaires**, et ce fichier porte déjà trois
   * précédents du même genre (les unités, deux fois, puis les surfaces). La règle §4 est
   * explicite : « un invariant entre deux fichiers se MESURE, il ne s'affirme pas ». Un
   * commentaire qui promettrait l'accord serait faux un jour sans que rien ne le dise, et
   * la conséquence se lirait sur une liste de courses — 2 kg de farine au lieu de 1,2.
   *
   * ⛔ **Les entrées ne sont pas décoratives.** Chacune vise un désaccord possible :
   * l'arrondi au supérieur (1,2), le demi (1,67), le PLANCHER du demi (0,1 — la pincée
   * qui disparaissait), le zéro qui doit rester zéro, et l'entier déjà achetable.
   */
  const entrees = [0, 0.1, 0.2, 0.5, 1, 1.2, 1.5, 1.67, 2, 2.5, 3, 12, 250, 1200, 0.75, 333.33];

  for (const unite of UNITES) {
    for (const valeur of entrees) {
      const { data, error } = await admin.rpc("arrondir_pour_achat", {
        p_quantite: valeur,
        p_unite: unite,
      });
      assert.equal(error, null, `la base a refusé d'arrondir ${valeur} ${unite}`);

      const attendu = arrondirPourAchat(valeur, unite);

      /*
       * ⚠️ **La base rend un `numeric`, que PostgREST sérialise en chaîne ou en nombre
       * selon l'échelle.** On compare des NOMBRES, pas des représentations : « 1.50 » et
       * 1.5 sont la même quantité, et faire échouer le test là-dessus masquerait les vrais
       * désaccords derrière du bruit de formatage.
       */
      assert.equal(
        Number(data),
        attendu,
        `désaccord sur ${valeur} « ${unite} » : la base rend ${data}, le code rend ${attendu}`
      );
    }
  }
});

test("chaque jeton de SURFACES est accepté par la base, et rien d'autre", async () => {
  /*
   * ⛔ **L'INVARIANT DE LA STORY 4.6, ET IL N'ÉTAIT MESURÉ PAR RIEN — revue du 2026-08-20.**
   * `SURFACES` (code) et `grocery_list_items_surface_fermee` (base) prétendent nommer le même
   * ensemble, et le module l'AFFIRMAIT dans un commentaire. C'est exactement la forme que la
   * règle §4 interdit — « un invariant entre deux fichiers se mesure, il ne s'affirme pas » —
   * alors que ce fichier portait déjà DEUX précédents qui le mesurent, pour les unités.
   *
   * ⚠️ **Le sens qui manquait est celui qui ne casse rien tout de suite** : un septième jeton
   * ajouté au `check` sans être ajouté à `SURFACES` passe toutes les portes, puis n'affiche
   * aucune provenance et journalise un avertissement par lecture.
   *
   * ⚠️ Les tests neufs de la 4.6 n'envoyaient que deux jetons sur six à la base ; une coquille
   * sur `dashboard`, `voix`, `dictee` ou `pont` restait verte des deux côtés.
   */
  for (const surface of SURFACES) {
    const { data, error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `zzsurf ${surface}`, surface })
      .select("id");
    assert.equal(error, null, `la base a refusé le jeton « ${surface} » que le code publie`);
    await admin.from("grocery_list_items").delete().eq("id", data![0].id);
  }
});

test("une surface hors vocabulaire est refusée par la base, comme par le code", async () => {
  for (const faux of ["Web", "WEB", "shortcut", "sms", "partage", " web", "voice"]) {
    assert.equal(estSurfaceConnue(faux), false, `le code accepte « ${faux} »`);
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: "hors vocabulaire", surface: faux });
    assert.notEqual(error, null, `la base accepte « ${faux} »`);
    assert.match(error!.message, /grocery_list_items_surface_fermee/);
  }
});

test("une unité hors vocabulaire est refusée par la base, comme par le code", async () => {
  const recette = await recetteDeService();
  for (const faux of ["piece", "l", "G", "litre", "oz", "cuillère", " g"]) {
    assert.equal(estUniteConnue(faux), false, `le code accepte « ${faux} »`);
    const { error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: "hors vocabulaire", unit: faux });
    assert.notEqual(error, null, `la base accepte « ${faux} »`);
    assert.match(error!.message, /recipe_ingredients_unite_fermee/);
  }
});

test("« pièce » DÉCOMPOSÉ est refusé — le cas qui casserait la clé canonique", async () => {
  const recette = await recetteDeService();
  /*
   * Mesuré : NFC 5 points de code / 6 octets, NFD 6 / 7, et Postgres les juge
   * inégaux. Sans cette contrainte, deux « pièce » visuellement identiques
   * seraient deux unités distinctes pour l'agrégation de l'Epic 4.
   */
  const decomposee = "pièce".normalize("NFD");
  assert.notEqual(decomposee, "pièce");
  const { error } = await admin
    .from("recipe_ingredients")
    .insert({ recipe_id: recette, name: "pièce NFD", unit: decomposee });
  assert.notEqual(error, null, "la base a accepté une forme décomposée");
  assert.match(error!.message, /recipe_ingredients_unite_fermee/);
});

test("une unité absente reste permise — « du sel » est légitime", async () => {
  const recette = await recetteDeService();
  const { data, error } = await admin
    .from("recipe_ingredients")
    .insert({ recipe_id: recette, name: "sel" })
    .select("id, unit, quantity");
  assert.equal(error, null);
  assert.equal(data![0].unit, null);
  assert.equal(data![0].quantity, null);
  await admin.from("recipe_ingredients").delete().eq("id", data![0].id);
});

test("le client n'est jamais plus laxiste que la base sur un NOM d'ingrédient", async () => {
  const recette = await recetteDeService();
  const laxistes: string[] = [];
  for (const [nom, saisie] of [...INVISIBLES_REELS, ...NOMS_LEGITIMES]) {
    const normalise = normaliserTitre(saisie);
    if (normalise === null) continue;
    const { data, error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: normalise })
      .select("id");
    if (error) laxistes.push(nom);
    else await admin.from("recipe_ingredients").delete().eq("id", data![0].id);
  }
  assert.deepEqual(laxistes, [], "le client laisse passer ce que la base refuse");
});

test("la quantité : le client n'est jamais plus laxiste que la base", async () => {
  const recette = await recetteDeService();
  /*
   * Le client refuse ce qui n'est pas un nombre et ce qui dépasse numeric(8,2) ;
   * la base tient la seule règle métier, `>= 0`. L'invariant reste le même.
   */
  const laxistes: string[] = [];
  for (const saisie of ["", "0", "0,5", "400", "-1", "-0,5", "999999.99", "1000000", "2e3"]) {
    const valeur = saisie === "" ? null : normaliserQuantite(saisie);
    // La règle d'écran : un nombre lisible, et jamais négatif.
    if (saisie !== "" && (valeur === null || valeur < 0)) continue;

    const { data, error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: `q ${saisie}`, quantity: valeur })
      .select("id");
    if (error) laxistes.push(saisie);
    else await admin.from("recipe_ingredients").delete().eq("id", data![0].id);
  }
  assert.deepEqual(laxistes, [], "le client laisse passer une quantité que la base refuse");
});

test("la base refuse une quantité négative, que le client l'ait vue ou non", async () => {
  const recette = await recetteDeService();
  for (const q of [-0.01, -1, -999]) {
    const { error } = await admin
      .from("recipe_ingredients")
      .insert({ recipe_id: recette, name: "négatif", quantity: q });
    assert.notEqual(error, null, `quantity=${q} doit être refusée`);
    assert.match(error!.message, /recipe_ingredients_quantite_positive/);
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Le nombre de personnes : `lib/personnes.ts` face aux deux contraintes posées
 * par `20260804144217_contraindre_les_assignations_de_menu.sql`.
 *
 * ⚠️ **Deux colonnes, deux tables, une seule règle d'écran.** `analyserPersonnes`
 * sert l'assignation d'un repas (`meal_plan_entries.servings`) ET le réglage du
 * foyer (`households.default_servings`). Si l'une des deux contraintes divergeait
 * de l'autre, l'écran serait juste sur une surface et faux sur l'autre — et rien
 * ne le dirait, les deux formulaires partageant leur message.
 * ───────────────────────────────────────────────────────────────────────────── */

test("le nombre de personnes d'un REPAS : le client n'est jamais plus laxiste que la base", async () => {
  const recette = await recetteDeService();
  const saisies = ["", "0", "-1", "1", "2", "4", "2e3", "2,5", "abc", "2147483648"];
  const laxistes: string[] = [];

  for (const [rang, saisie] of saisies.entries()) {
    const analyse = analyserPersonnes(saisie);
    if ("faute" in analyse) continue; // le client refuse : la base peut être plus permissive

    const { data, error } = await admin
      .from("meal_plan_entries")
      .insert({
        household_id: foyerId,
        recipe_id: recette,
        // Une date par saisie : la contrainte d'unicité d'AD-6 refuserait
        // autrement la deuxième insertion de la même recette au même repas, et
        // le test se lirait « la base refuse » pour une tout autre raison.
        meal_date: `2026-11-${String(rang + 1).padStart(2, "0")}`,
        meal_type: "dinner",
        servings: analyse.valeur,
      })
      .select("id");
    if (error) {
      laxistes.push(saisie);
      continue;
    }
    await admin.from("meal_plan_entries").delete().eq("id", data![0].id);
  }

  assert.deepEqual(
    laxistes,
    [],
    "le client laisse passer un nombre de personnes que la base refuse"
  );
});

test("la base refuse 0 et le négatif au menu, que le client les ait vus ou non", async () => {
  /*
   * Le contrôle d'écran est contournable par un appel REST direct ; c'est la
   * contrainte qui tient (AD-1/AD-2). Et l'enjeu n'est pas cosmétique :
   * `generate_grocery_list_from_menu` met `mpe.servings` au NUMÉRATEUR, donc un
   * négatif verserait des quantités négatives dans la liste de courses, qui
   * s'additionneraient aux autres par l'UPSERT-incrémente d'AD-6.
   */
  const recette = await recetteDeService();
  for (const servings of [0, -1, -12]) {
    const { error } = await admin.from("meal_plan_entries").insert({
      household_id: foyerId,
      recipe_id: recette,
      meal_date: "2026-11-20",
      meal_type: "lunch",
      servings,
    });
    assert.notEqual(error, null, `servings=${servings} doit être refusé`);
    assert.match(error!.message, /meal_plan_entries_servings_positif/);
  }
});

test("le nombre de personnes du FOYER : le client n'est jamais plus laxiste que la base", async () => {
  const saisies = ["", "0", "-1", "1", "2", "6", "2e3", "2,5", "abc", "2147483648"];
  const laxistes: string[] = [];

  for (const saisie of saisies) {
    const analyse = analyserPersonnes(saisie);
    if ("faute" in analyse) continue;

    const { error } = await admin
      .from("households")
      .update({ default_servings: analyse.valeur })
      .eq("id", foyerId)
      .select("id");
    if (error) laxistes.push(saisie);
  }

  // Remettre le foyer de contrôle dans l'état où le reste du fichier l'attend.
  await admin.from("households").update({ default_servings: 2 }).eq("id", foyerId);

  assert.deepEqual(
    laxistes,
    [],
    "le client laisse passer un réglage de foyer que la base refuse"
  );
});

test("la base refuse un réglage de foyer à 0 ou négatif", async () => {
  for (const personnes of [0, -1]) {
    const { error } = await admin
      .from("households")
      .update({ default_servings: personnes })
      .eq("id", foyerId);
    assert.notEqual(error, null, `default_servings=${personnes} doit être refusé`);
    assert.match(error!.message, /households_default_servings_positif/);
  }
});

// ── Liste de courses : la clé canonique et ses contraintes (story 4.1) ───────

/*
 * ⚠️ **POURQUOI CES TESTS SONT ICI ET PAS DANS `isolation.test.ts`.** Ils
 * n'éprouvent aucune frontière entre foyers : ils mesurent qu'une contrainte de la
 * base et une constante du code nomment bien le même ensemble (règle §4). Le
 * versant isolation de la story 4.1 — lecture, écriture et DELETE chez l'autre —
 * vit dans l'autre fichier.
 *
 * ⚠️ **`admin` TRAVERSE LA RLS, ET C'EST VOULU ICI.** Une contrainte `check` et un
 * index unique s'appliquent à tous les rôles, y compris `service_role` : les
 * mesurer avec la clé de service prouve qu'ils tiennent au niveau de la DONNÉE,
 * sans mêler la question des politiques. C'est aussi la seule façon de NETTOYER,
 * puisque la story 4.1 retire le verbe DELETE aux surfaces.
 */

/** Repart d'une liste vide : la clé canonique est unique PAR FOYER. */
async function viderLaListe(): Promise<void> {
  const { error } = await admin.from("grocery_list_items").delete().eq("household_id", foyerId);
  assert.equal(error, null, "le nettoyage de la liste a échoué");
}

/**
 * Pose un article et rend l'erreur PostgREST, ou `null` si la base l'a accepté.
 *
 * ⚠️ **Ne nettoie pas derrière elle** : les tests de clé canonique ont besoin que
 * la première ligne SURVIVE pour que la seconde la heurte.
 */
async function poserArticle(
  nom: string,
  unite: string | null
): Promise<{ code: string; message: string } | null> {
  const { error } = await admin
    .from("grocery_list_items")
    .insert({ household_id: foyerId, name: nom, unit: unite });
  return error ? { code: error.code ?? "", message: error.message } : null;
}

test("chaque jeton de UNITES est accepté par la liste de courses, et rien d'autre", async () => {
  /*
   * Jumeau du test de `recipe_ingredients_unite_fermee`, et il porte davantage :
   * ici `unit` est un MORCEAU DE LA CLÉ CANONIQUE (AD-3). Une unité libre ne
   * produirait pas un champ mal rempli, elle FRAGMENTERAIT la clé — « L », « l »
   * et « litre » feraient trois lignes de lait qui ne fusionneraient jamais.
   *
   * ⚠️ Chaque jeton a besoin d'un NOM DIFFÉRENT : à nom égal, c'est l'unité qui
   * distingue les lignes, et huit insertions de même nom passeraient pour huit
   * lignes légitimes — le test resterait vert en ne mesurant rien.
   */
  await viderLaListe();
  for (const unite of UNITES) {
    const erreur = await poserArticle(`article ${unite}`, unite);
    assert.equal(erreur, null, `la base a refusé le jeton « ${unite} » que le code publie`);
  }
  await viderLaListe();
});

test("une unité hors vocabulaire est refusée par la liste, comme par le code", async () => {
  await viderLaListe();
  for (const faux of ["piece", "l", "G", "litre", "oz", "cuillère", " g"]) {
    assert.equal(estUniteConnue(faux), false, `le code accepte « ${faux} »`);
    const erreur = await poserArticle(`hors vocabulaire ${faux}`, faux);
    assert.notEqual(erreur, null, `la base accepte « ${faux} »`);
    assert.match(erreur!.message, /grocery_list_items_unite_fermee/);
  }
});

test("la clé canonique fusionne la CASSE", async () => {
  await viderLaListe();
  assert.equal(await poserArticle("Crème fraîche", "L"), null, "la première ligne");
  const erreur = await poserArticle("CRÈME FRAÎCHE", "L");
  assert.notEqual(erreur, null, "« CRÈME FRAÎCHE » a créé une seconde ligne");
  assert.equal(erreur!.code, "23505");
  assert.match(erreur!.message, /grocery_list_items_cle_canonique/);
});

test("la clé canonique fusionne les ACCENTS — décision de Florian du 2026-08-05", async () => {
  /*
   * ⚠️ **C'est le seul test qui tient la décision D1, et elle a été prise CONTRE
   * la recommandation.** Ce qu'elle achète : le membre qui tape vite, sans
   * accents, sur un téléphone à une main dans un magasin, retombe sur la ligne
   * existante — et c'est aussi ce que produiront la dictée et le pont Google, dont
   * personne ne contrôle l'accentuation (AD-12).
   *
   * Si ce test tombe un jour, la question à se poser n'est pas « comment le faire
   * repasser » mais « `strip_accents` fait-elle encore ce qu'elle promet » (voir
   * le test du dictionnaire, plus bas).
   */
  await viderLaListe();
  assert.equal(await poserArticle("Crème fraîche", "L"), null, "la première ligne");
  const erreur = await poserArticle("creme fraiche", "L");
  assert.notEqual(erreur, null, "« creme fraiche » a créé une seconde ligne");
  assert.equal(erreur!.code, "23505");
});

test("la clé canonique fusionne les formes NFC et NFD d'un mot accentué", async () => {
  /*
   * Le défaut exact que `lib/texte.ts` documente pour `unique(household_id, name)`
   * sur les rayons : « deux rayons rigoureusement identiques à l'œil, aucun 23505,
   * et rien pour les distinguer ». Mesuré ici sur la table où il coûte le plus cher.
   *
   * ⚠️ **CE TEST NE TIENT PAS `normalize(name, NFC)`, ET LA PREMIÈRE RÉDACTION
   * PRÉTENDAIT LE CONTRAIRE.** Mesuré au banc des dents le 2026-08-05 : retirer
   * `normalize` de la clé laisse ce test VERT. La raison est que `unaccent` retire
   * les diacritiques COMBINANTS tout seul —
   *
   *   select public.strip_accents('cr' || 'e' || U&'\0300' || 'me');  -- « creme »
   *
   * — donc sur un mot accentué, `strip_accents` referme le cas à lui seul. Ce test
   * mesure le COMPORTEMENT attendu de la clé, ce qui a sa valeur ; c'est le test
   * suivant qui tient `normalize`, et lui seul.
   */
  await viderLaListe();
  const nfd = "Crème fraîche".normalize("NFD");
  assert.notEqual(nfd, "Crème fraîche", "le cas de test n'est pas décomposé");
  assert.equal(nfd.normalize("NFC"), "Crème fraîche", "le cas de test se compose bien");

  assert.equal(await poserArticle("Crème fraîche", "L"), null, "la première ligne");
  const erreur = await poserArticle(nfd, "L");
  assert.notEqual(erreur, null, "la forme décomposée a créé une seconde ligne");
  assert.equal(erreur!.code, "23505");
});

test("la clé canonique COMPOSE avant de comparer — ce que `normalize(NFC)` tient, seul", async () => {
  /*
   * ⚠️ **CE TEST EXISTE PARCE QUE LE BANC DES DENTS A TROUVÉ UN TROU.** Le test
   * précédent était censé tenir `normalize(name, NFC)` ; mesuré le 2026-08-05,
   * retirer `normalize` de la clé ne le faisait pas tomber — `unaccent` fait déjà
   * le travail sur un mot accentué. Sans ce test-ci, la première opération de la
   * clé n'aurait été tenue par RIEN.
   *
   * Le cas qui distingue les deux, mesuré :
   *
   *   -- jamo Hangul décomposés vs syllabe composée
   *   select public.strip_accents(U&'\1100' || U&'\1161')
   *        = public.strip_accents(U&'\AC00');   -- false : unaccent ne les confond pas
   *   select normalize(U&'\1100' || U&'\1161', NFC) = U&'\AC00';  -- true
   *
   * ⚠️ **Ce n'est pas un cas d'école déguisé en test.** L'enjeu n'est pas le
   * coréen : c'est que la clé canonique NORMALISE la forme Unicode elle-même,
   * plutôt que de s'en remettre au dictionnaire d'`unaccent` — dont tout
   * l'en-tête de la migration explique qu'il peut changer sous nos pieds. Sans
   * `normalize`, ce jour-là, la composition Unicode régresserait AUSSI, en
   * silence.
   */
  await viderLaListe();
  const compose = "\uAC00";              // 가, syllabe précomposée
  const decompose = "\u1100\u1161";       // les mêmes jamo, séparés
  assert.notEqual(compose, decompose, "le cas de test n'oppose pas deux formes");
  assert.equal(decompose.normalize("NFC"), compose, "NFC doit bien les réunir");

  assert.equal(await poserArticle(compose, "g"), null, "la première ligne");
  const erreur = await poserArticle(decompose, "g");
  assert.notEqual(erreur, null, "les deux formes ont fait deux lignes");
  assert.equal(erreur!.code, "23505");
});

test("la clé canonique fusionne les INVISIBLES", async () => {
  /*
   * Un espace de largeur nulle collé depuis une messagerie. Sans le
   * `regexp_replace` de la clé, il produirait une ligne jumelle indiscernable à
   * l'œil et impossible à fusionner.
   */
  await viderLaListe();
  assert.equal(await poserArticle("Crème fraîche", "L"), null, "la première ligne");
  // ⚠️ Écrit en échappée, jamais collé : un U+200B littéral ne se voit pas en
  // relecture, et personne ne saurait dire si le cas de test le contient encore.
  const erreur = await poserArticle("Crème\u200B fraîche", "L");
  assert.notEqual(erreur, null, "l'invisible a créé une seconde ligne");
  assert.equal(erreur!.code, "23505");
});

test("une unité NULLE ne fait pas deux lignes — ce que `nulls not distinct` tient", async () => {
  /*
   * ⚠️ **LE TEST QUI EMPÊCHE LE CRITÈRE D'ÊTRE FAUX EN SILENCE.** Mesuré le
   * 2026-08-05 : avec un index unique ORDINAIRE, deux articles de même nom et
   * d'unité NULLE sont acceptés — deux lignes, aucune erreur, rien qui le
   * signale. Or un article ajouté SANS unité est le cas nominal de l'ajout vocal
   * et de l'ajout manuel rapide : le critère serait faux précisément là où il
   * compte.
   *
   * Les dents ont été vérifiées : `nulls not distinct` retiré de la migration en
   * local, ce test tombe, et lui seul.
   */
  await viderLaListe();
  assert.equal(await poserArticle("Sel", null), null, "la première ligne");
  const erreur = await poserArticle("sel", null);
  assert.notEqual(erreur, null, "deux articles sans unité ont fait deux lignes");
  assert.equal(erreur!.code, "23505");
});

test("deux unités DIFFÉRENTES font bien deux lignes — le versant AD-7", async () => {
  /*
   * Le contrepoids des six tests précédents. AD-7 : « deux unités différentes ne
   * sont jamais additionnées ni converties ». Sans ce test, une clé qui ignorerait
   * l'unité passerait tous les autres — ils ne mesurent que la fusion.
   */
  await viderLaListe();
  assert.equal(await poserArticle("lait", "L"), null, "lait en litres");
  assert.equal(await poserArticle("lait", "ml"), null, "lait en millilitres refusé à tort");
  const { count } = await admin
    .from("grocery_list_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", foyerId);
  assert.equal(count, 2, "« L » et « ml » sont deux unités, pas deux échelles d'une même unité");
  await viderLaListe();
});

test("`strip_accents` rend ce que le dictionnaire promet", async () => {
  /*
   * ⚠️ **CE TEST N'EST PAS REDONDANT AVEC CEUX DE LA CLÉ — il est le seul filet
   * d'une PROMESSE.** `strip_accents` est déclarée `immutable` alors qu'`unaccent`
   * est `STABLE` : son dictionnaire est un fichier sur disque, qu'une montée de
   * version de Postgres peut remplacer. Le jour où il change, l'index de clé
   * canonique garde des clés calculées avec l'ANCIEN dictionnaire, Postgres ne les
   * recalcule pas, et une recherche peut manquer une ligne qui existe — sans
   * erreur, sans log.
   *
   * Les tests de clé, eux, insèrent et relisent dans la même session : ils
   * resteraient verts. Celui-ci tombe, et il dit pourquoi.
   *
   * **Si tu lis ce test parce qu'il vient d'échouer :** le dictionnaire d'`unaccent`
   * a changé. Rejouer `reindex index grocery_list_items_cle_canonique;` sur chaque
   * base, puis mettre ces attendus à jour — dans cet ordre.
   */
  const attendus: ReadonlyArray<readonly [string, string]> = [
    ["crème", "creme"],
    ["Épinard", "Epinard"], // la casse est PRÉSERVÉE : c'est `lower` qui la plie
    ["pâté", "pate"],
    ["curaçao", "curacao"],
    ["œuf", "oeuf"], // la ligature est développée
    ["sel", "sel"], // sans accent, la fonction ne touche à rien
  ];
  for (const [entree, attendu] of attendus) {
    const { data, error } = await admin.rpc("strip_accents", { p_texte: entree });
    assert.equal(error, null, `strip_accents(« ${entree} ») a levé : ${error?.message}`);
    assert.equal(
      data,
      attendu,
      `le dictionnaire d'unaccent a changé : « ${entree} » rend « ${data} » et non « ${attendu} »`
    );
  }
});

test("le nom d'article : le client n'est jamais plus laxiste que la base", async () => {
  /*
   * ⚠️ **Le sens du désaccord n'est pas symétrique**, comme pour les rayons et les
   * titres de recette : « le client refuse, la base accepterait » est bénin ; « le
   * client accepte, la base refuse » produit un message d'erreur sur un champ que
   * le membre voit rempli, sans rien à corriger. C'est celui-là qu'on interdit.
   *
   * ⚠️ **`normaliserTexte` est employée NUE, sans enveloppe de domaine.** Le
   * `normaliserNomArticle` qui lui correspondra vit dans la story 4.4, avec le
   * premier écran qui ajoute un article ; l'écrire ici lui donnerait zéro
   * consommateur. Ce qui se mesure est le normaliseur SOUS l'enveloppe — et
   * `normaliserNomRayon` comme `normaliserTitre` ne sont qu'un appel à celui-ci.
   */
  /*
   * ⚠️ **LA BOUCLE VIDE LA LISTE AVANT CHAQUE CAS, ET C'EST UN CORRECTIF DE
   * REVUE.** La première rédaction nettoyait *après* l'insertion et sautait ce
   * nettoyage sur `if (erreur.code === "23505") continue;`. Deux défauts, mesurés
   * le 2026-08-05 :
   *
   *  1. deux fixtures se normalisent vers le même nom — `normaliserTexte` rend
   *     « Boucherie » pour « Boucherie​ » comme pour « Bou​cherie » —
   *     donc la seconde heurtait la clé et n'atteignait **jamais** l'assertion ;
   *  2. le `continue` sautant le nettoyage, la ligne survivante faisait
   *     collisionner toutes les itérations suivantes, qui étaient sautées à leur
   *     tour. Le test **dégénérait en no-op sans rien signaler**.
   *
   * En vidant AVANT, chaque cas est mesuré seul : un `23505` devient impossible,
   * donc toute erreur est bien un refus de contrainte. Et le compte des cas
   * réellement éprouvés est asserté — « que se passe-t-il s'il ne trouve rien à
   * contrôler ? » vaut pour une boucle autant que pour un glob.
   */
  const laxistes: string[] = [];
  let eprouves = 0;

  for (const [nom, saisie] of [...INVISIBLES_REELS, ...NOMS_LEGITIMES]) {
    const propre = normaliserTexte(saisie, 120);
    if (propre === null) continue; // le client refuse : rien à mesurer côté base

    await viderLaListe();
    const erreur = await poserArticle(propre, null);
    eprouves += 1;
    if (erreur) laxistes.push(`${nom} (${erreur.code})`);
  }
  await viderLaListe();

  assert.deepEqual(laxistes, [], "le client laisse passer un nom d'article que la base refuse");
  assert.ok(
    eprouves >= 10,
    `seulement ${eprouves} cas atteignent la base — les fixtures ne mesurent plus grand-chose`
  );
});

test("un nom entièrement invisible est refusé — il produirait une clé canonique VIDE", async () => {
  /*
   * ⚠️ **Ici la contrainte de nom porte plus qu'ailleurs.** Un nom sans rien
   * d'affichable donne une clé canonique `''` : un seul emplacement par foyer et
   * par unité pour tous les articles fantômes, et le second rendrait `23505` sur
   * un ajout que le membre croit normal.
   */
  await viderLaListe();
  for (const invisible of ["\u200B", " \u200B", "\u3164\uFFA0", " \u2800"]) {
    assert.equal(normaliserTexte(invisible, 120), null, "le client aurait dû refuser");
    const erreur = await poserArticle(invisible, null);
    assert.notEqual(erreur, null, "la base a accepté un nom qui ne montre rien");
    assert.match(erreur!.message, /grocery_list_items_nom_non_vide/);
  }
});

test("`actor_kind` n'accepte que les deux formes de la provenance polymorphe", async () => {
  /*
   * `actor_kind` n'a pas de clé étrangère à laquelle s'adosser — c'est tout le
   * point d'AD-9 : un appareil n'est jamais une FK `profiles`. Le seul endroit où
   * son vocabulaire peut vivre est donc une contrainte, et sans elle la colonne
   * est un champ texte libre que n'importe quel appel REST remplit à sa guise.
   */
  /*
   * ⚠️ **CHAQUE CAS PORTE SON `actor_id`, ET C'EST UN AJUSTEMENT DE REVUE.**
   * Depuis le 2026-08-05 la contrainte `grocery_list_items_acteur_couple` exige
   * que les deux champs soient posés ou absents ENSEMBLE (AD-9 : la provenance
   * *est* le couple). Sans l'identifiant, ce test tomberait désormais sur la
   * mauvaise contrainte et ne mesurerait plus le vocabulaire d'`actor_kind`.
   */
  await viderLaListe();
  for (const bon of ["profile", "device"]) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `acteur ${bon}`, actor_kind: bon, actor_id: randomUUID() });
    assert.equal(error, null, `la base a refusé « ${bon} »`);
  }
  for (const mauvais of ["Profile", "user", "bridge", "", "membre"]) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({
        household_id: foyerId,
        name: `acteur ${mauvais}`,
        actor_kind: mauvais,
        actor_id: randomUUID(),
      });
    assert.notEqual(error, null, `la base a accepté « ${mauvais} »`);
    assert.match(error!.message, /grocery_list_items_acteur_connu/);
  }
  await viderLaListe();
});

test("la clé canonique fusionne les invisibles QUE `[^[:graph:]]` NE RETIRE PAS", async () => {
  /*
   * ⚠️ **CE TEST DONNE SES DENTS À LA LISTE EXPLICITE, ET IL EST NÉ D'UN TROU.**
   * Le test « la clé canonique fusionne les INVISIBLES » emploie U+200B, que
   * `[^[:graph:]]` retire **à lui seul** : retirer toute l'alternation
   * `|[͏…]` de l'expression d'index le laissait vert. Mesuré en revue le
   * 2026-08-05 — même motif que le trou de `normalize(NFC)`, non refermé.
   *
   * Les points de code ci-dessous sont **tous `[:graph:]` pour Postgres**
   * (mesuré) : seule la liste explicite les retire. Chacun est placé AU MILIEU
   * du nom, jamais au bord, pour que `trim()` ne puisse pas être ce qui mesure.
   *
   * ⚠️ **Les deux derniers ont été AJOUTÉS EN REVUE.** La liste d'origine
   * laissait passer 241 points de code `Default_Ignorable` — mesuré par sonde,
   * en deux plages : U+180F (voisin immédiat de `᠋-᠎`, ajouté par
   * Unicode 14) et U+E0100–U+E01EF. Trois « Creme fraiche » indiscernables à
   * l'œil coexistaient dans le même foyer et la même unité.
   */
  const invisiblesGraphiques: ReadonlyArray<readonly [string, string]> = [
    ["U+034F joncteur de graphème", "͏"],
    ["U+115F remplisseur Hangul Choseong", "ᅟ"],
    ["U+1160 remplisseur Hangul Jungseong", "ᅠ"],
    ["U+2800 braille blanc", "⠀"],
    ["U+3164 remplisseur Hangul", "ㅤ"],
    ["U+FE0F sélecteur de variante", "️"],
    ["U+FFA0 remplisseur demi-largeur", "ﾠ"],
    ["U+180F FVS4 — ajouté en revue", "᠏"],
    ["U+E0100 sélecteur supplémentaire — ajouté en revue", "\u{E0100}"],
  ];

  for (const [nom, invisible] of invisiblesGraphiques) {
    await viderLaListe();
    assert.equal(await poserArticle("Farine de ble", "kg"), null, `première ligne (${nom})`);
    const erreur = await poserArticle(`Farine de${invisible} ble`, "kg");
    assert.notEqual(erreur, null, `${nom} a créé une seconde ligne indiscernable à l'œil`);
    assert.equal(erreur!.code, "23505", `${nom}`);
  }
  await viderLaListe();
});

test("un nom fait UNIQUEMENT de diacritiques combinants est refusé", async () => {
  /*
   * ⚠️ **TROUVÉ EN REVUE le 2026-08-05 : la contrainte et la clé n'employaient
   * PAS le même prédicat, alors que la migration l'affirmait deux fois.**
   * `nom_non_vide` n'appliquait que `regexp_replace(name, …)` ; la clé
   * appliquait en plus `normalize(NFC)` et `strip_accents`. Or `strip_accents`
   * VIDE un nom fait de diacritiques combinants — 106 points de code `[:graph:]`
   * sont dans ce cas.
   *
   * Conséquence mesurée avant correctif : `chr(768)` passait la contrainte,
   * puis `chr(769)` rendait `23505` sur `Key (…, , null)`. Un seul emplacement
   * par foyer et par unité pour tous les articles fantômes — exactement le
   * défaut que la contrainte existe pour fermer.
   *
   * La contrainte porte désormais l'expression ENTIÈRE de la clé, et ce test
   * est ce qui l'empêche de redivergentifier en silence (règle §4).
   */
  await viderLaListe();
  for (const fantome of ["̀", "́̂", "̧̀̈"]) {
    const erreur = await poserArticle(fantome, null);
    assert.notEqual(erreur, null, "la base a accepté un nom qui produit une clé VIDE");
    assert.match(erreur!.message, /grocery_list_items_nom_non_vide/);
  }
});

test("le nom d'article est borné EN BASE, pas seulement dans le navigateur", async () => {
  /*
   * ⚠️ **AJOUTÉE EN REVUE. Sans elle, la clé rendait `54000`, pas un refus.**
   * Mesuré le 2026-08-05 : un nom incompressible de 3840 caractères rendait
   * `index row size 3880 exceeds btree version 4 maximum 2704` — une erreur que
   * `lib/foyer/erreurs.ts` ne traduit pas, sur un chemin où l'écriture est
   * client-direct (AD-13), donc hors de portée de tout contrôle de navigateur.
   *
   * ⚠️ **Et le défaut était INTERMITTENT** : `repeat('a', 3000)` passait, la
   * compression d'index masquant le seuil. C'est la pire forme — elle ne se
   * reproduit pas quand on la cherche.
   *
   * ⚠️ **200 n'est PAS la règle produit.** Le plafond du membre est celui du
   * client (120 aujourd'hui) et son vrai nom, `MAX_NOM_ARTICLE`, appartient à la
   * story 4.4. Celle-ci empêche un plantage, et elle est délibérément PLUS LARGE
   * que le client pour que le désaccord reste dans le sens bénin.
   */
  await viderLaListe();

  const auPlafond = "a".repeat(200);
  assert.equal(await poserArticle(auPlafond, null), null, "200 caractères doivent passer");
  await viderLaListe();

  for (const trop of ["a".repeat(201), "é".repeat(400), "🥬".repeat(300)]) {
    const erreur = await poserArticle(trop, null);
    assert.notEqual(erreur, null, `un nom de ${[...trop].length} points de code a été accepté`);
    assert.match(erreur!.message, /grocery_list_items_nom_borne/);
    assert.equal(erreur!.code, "23514", "ce doit être un refus de contrainte, jamais un `54000`");
  }

  // Le cas exact qui rendait `54000` : incompressible, donc l'index ne le comprime pas.
  const incompressible = Array.from({ length: 400 }, (_, i) => `x${i}y`).join("");
  const erreur = await poserArticle(incompressible, null);
  assert.equal(erreur!.code, "23514", "le nom incompressible rend encore une erreur d'index");
});

test("la provenance est un COUPLE, jamais une moitié", async () => {
  /*
   * AD-9 : la provenance est `(actor_kind ∈ {profile, device}, actor_id)`.
   * ⚠️ **AJOUTÉE EN REVUE.** Mesuré le 2026-08-05, les deux moitiés passaient :
   * `('profile', null)` et `(null, <uuid>)`. Une moitié n'est pas une provenance
   * dégradée, c'est une provenance illisible pour la story 4.6 — un type sans
   * identité, ou une identité sans type.
   *
   * ⚠️ **Ce que ce test NE mesure PAS, et c'est daté** : rien n'attache encore
   * `actor_id` à l'appelant, donc un membre peut attribuer un article à un autre
   * membre de son foyer. Reporté à la 4.6 (`deferred-work.md`, 2026-08-05), la
   * forme correcte dépendant de l'Epic 5.
   */
  await viderLaListe();

  const complets: ReadonlyArray<readonly [string | null, string | null]> = [
    ["profile", randomUUID()],
    ["device", randomUUID()],
    [null, null], // l'absence de provenance reste licite : la colonne est nullable
  ];
  for (const [kind, id] of complets) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `couple ${kind} ${id}`, actor_kind: kind, actor_id: id });
    assert.equal(error, null, `la base a refusé un couple complet (${kind}, ${id})`);
  }
  await viderLaListe();

  const moities: ReadonlyArray<readonly [string | null, string | null]> = [
    ["profile", null],
    ["device", null],
    [null, randomUUID()],
  ];
  for (const [kind, id] of moities) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `moitie ${kind} ${id}`, actor_kind: kind, actor_id: id });
    assert.notEqual(error, null, `la base a accepté la moitié (${kind}, ${id})`);
    assert.match(error!.message, /grocery_list_items_acteur_couple/);
  }
  await viderLaListe();
});

test("`intent_at` n'accepte pas une intention hors du temps", async () => {
  /*
   * ⚠️ **AJOUTÉE EN REVUE.** `intent_at` est L'ARBITRE du LWW (AD-3), et
   * l'écriture de la liste est client-direct (AD-13) : mesuré le 2026-08-05,
   * `intent_at = 'infinity'` était accepté, et une intention forgée gagnait
   * **définitivement** tout arbitrage futur — 4.5, 4.9, 4.10.
   *
   * ⚠️ **C'est un GARDE-FOU, pas la politique de LWW.** La borne est
   * volontairement généreuse (un jour) pour qu'une horloge d'appareil légèrement
   * en avance ne soit jamais refusée. L'horloge du geste est la story 4.9,
   * l'arbitrage la 4.10.
   */
  await viderLaListe();

  const passe = [new Date(Date.now() - 86_400_000).toISOString(), new Date().toISOString()];
  for (const quand of passe) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `intention ${quand}`, intent_at: quand });
    assert.equal(error, null, `la base a refusé une intention légitime (${quand})`);
  }
  await viderLaListe();

  const refuses = ["infinity", new Date(Date.now() + 7 * 86_400_000).toISOString(), "2999-01-01T00:00:00Z"];
  for (const quand of refuses) {
    const { error } = await admin
      .from("grocery_list_items")
      .insert({ household_id: foyerId, name: `intention ${quand}`, intent_at: quand });
    assert.notEqual(error, null, `la base a accepté une intention en ${quand}`);
    assert.match(error!.message, /grocery_list_items_intention_bornee/);
  }
  await viderLaListe();
});

test("`updated_at` est posé SERVEUR à l'insertion, pas seulement à la mise à jour", async () => {
  /*
   * ⚠️ **TROUVÉ EN REVUE le 2026-08-05 : le trigger était `before update` seul**,
   * alors que le volet 5 de la migration s'intitule « `updated_at` posé serveur ».
   * Mesuré : `insert … (updated_at) values ('1970-01-01Z')` conservait la valeur
   * du client (`pg_trigger.tgtype = 19` = ROW|BEFORE|UPDATE), et
   * `lib/supabase/types.ts` expose bien `updated_at?` en `Insert`.
   *
   * Pourquoi ça compte : AD-3 fait d'`updated_at` l'horodatage d'affichage et de
   * **Realtime**. Une lecture incrémentale `where updated_at > dernier_vu`
   * aurait raté pour toujours une ligne insérée avec un horodatage forgé dans le
   * passé — sans erreur, sans log.
   */
  await viderLaListe();
  const { data, error } = await admin
    .from("grocery_list_items")
    .insert({ household_id: foyerId, name: "Horodatage forgé", updated_at: "1970-01-01T00:00:00Z" })
    .select("updated_at")
    .single();
  assert.equal(error, null);
  assert.ok(
    new Date(data!.updated_at as string).getTime() > Date.now() - 60_000,
    `le trigger n'a pas écrasé l'horodatage du client : ${data!.updated_at}`
  );
  await viderLaListe();
});
