import { test } from "node:test";
import assert from "node:assert/strict";
import { provenanceDe } from "./provenance.ts";
import { SURFACES, estSurfaceConnue } from "./surfaces.ts";

/**
 * Le pur de la provenance (story 4.6, AC2).
 *
 * ⛔ **CETTE RÈGLE VIT DANS `lib/` PARCE QU'ELLE EST TESTABLE ICI.** NFR-10 interdit un harnais de
 * composants : une règle laissée dans le JSX n'est exercée par rien.
 */

test("un article issu d'une recette porte la fourchette, quelle que soit sa surface", () => {
  const p = provenanceDe({ surface: "web", recipeId: "r1" });
  assert.equal(p?.texte, "issu d'une recette");
});

test("⛔ les SIX surfaces sont assertées une par une, icône ET texte", () => {
  /*
   * ⛔ **CORRECTIF DE LA REVUE DU 2026-08-20.** Trois surfaces sur six n'étaient assertées par
   * rien : la boucle ne vérifiait que « non nul » et « texte non vide ». Or `pont` porte la
   * décision la plus fragile du module — `project-context.md` **bannit le mot « pont »** de
   * toute chaîne rendue — et une réécriture en « pont Google » passait les six tests.
   */
  const attendu: Record<string, string> = {
    web: "ajout manuel",
    dashboard: "ajout manuel",
    mcp: "ajout manuel",
    voix: "ajouté à la voix",
    pont: "ajouté à la voix",
    dictee: "dicté / partagé",
  };
  for (const s of SURFACES) {
    const p = provenanceDe({ surface: s, recipeId: null });
    assert.notEqual(p, null, `« ${s} » est au contrat mais ne rend aucune provenance`);
    assert.equal(p!.texte, attendu[s], `« ${s} » ne rend pas le texte attendu`);
    assert.ok(p!.icone.length > 0, `« ${s} » rend un texte sans icône`);
  }
});

test("⛔ aucun texte rendu n'emploie de mot banni (NFR-9)", () => {
  /*
   * ⚠️ La liste vient de `project-context.md`. ⛔ **« pont » y est**, et c'est exactement le
   * jeton que `PAR_SURFACE` rabat sur « ajouté à la voix » : ce test est ce qui empêche une
   * future rédaction de faire fuir le mot vers l'écran.
   */
  const bannis = ["synchronis", "jeton", "token", "api", "mcp", "pont", "supabase", "rls", "cache"];
  for (const s of SURFACES) {
    const texte = provenanceDe({ surface: s, recipeId: null })!.texte.toLowerCase();
    for (const mot of bannis) {
      assert.ok(!texte.includes(mot), `« ${texte} » (surface ${s}) emploie « ${mot} »`);
    }
  }
});

test("⛔ chaque icône force la présentation TEXTE, sinon le contraste ne s'applique pas", () => {
  /*
   * ⛔ **CORRECTIF DE LA REVUE DU 2026-08-20.** `🍴`, `🎙` et `🗒` sont peints par la police
   * emoji du système : `--provenance-color` n'a **aucun effet** dessus, et le plancher
   * « icône ≥ 3:1 » de l'AC2 n'était démontré que pour le token, jamais pour le glyphe qui
   * porte l'information. Le sélecteur de variante 15 (U+FE0E) force le rendu monochrome.
   *
   * ⚠️ `＋` (U+FF0B) est déjà un caractère texte et n'en a pas besoin — le test ne l'exige donc
   * que des glyphes hors ASCII étendu.
   */
  const VS15 = "︎";
  const icones = [
    ...SURFACES.map((s) => provenanceDe({ surface: s, recipeId: null })!.icone),
    provenanceDe({ surface: null, recipeId: "r1" })!.icone,
  ];
  for (const icone of icones) {
    const premier = icone.codePointAt(0)!;
    if (premier > 0xffff) {
      assert.ok(
        icone.includes(VS15),
        `l'icône « ${icone} » est un emoji sans VS15 : la couleur du thème ne s'y applique pas`
      );
    }
  }
});

test("⛔ une provenance INCONNUE ne rend rien — on n'invente pas une origine", () => {
  assert.equal(provenanceDe({ surface: null, recipeId: null }), null);
  assert.equal(provenanceDe({ surface: "carrier-pigeon", recipeId: null }), null);
});

test("⛔ `undefined` ne doit PAS être pris pour une recette", () => {
  /*
   * ⛔ **LE DÉFAUT QUE LA REVUE A MESURÉ.** Le garde était `recipeId !== null`, qui laisse
   * passer `undefined` : **tous** les articles de la liste affichaient « issu d'une recette ».
   * Or « la valeur arrive `undefined`, silencieusement, jamais en erreur » est le mode de
   * défaillance que cette story invoque quatre fois pour se justifier — le garde n'y résistait
   * pas. `== null` couvre les deux.
   */
  const article = { surface: "web", recipeId: undefined } as unknown as {
    surface: string | null;
    recipeId: string | null;
  };
  assert.equal(provenanceDe(article)?.texte, "ajout manuel");
});

test("⛔ un recipeId absent ne prouve pas un ajout manuel — la FK est `on delete set null`", () => {
  assert.equal(provenanceDe({ surface: null, recipeId: null }), null);
  assert.equal(provenanceDe({ surface: "web", recipeId: null })?.texte, "ajout manuel");
});

test("le vocabulaire des surfaces est CLOS", () => {
  assert.equal(estSurfaceConnue("web"), true);
  assert.equal(estSurfaceConnue("carrier-pigeon"), false);
  assert.equal(estSurfaceConnue(null), false);
});
