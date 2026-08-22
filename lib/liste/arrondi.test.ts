import { test } from "node:test";
import assert from "node:assert/strict";
import { arrondirPourAchat } from "./arrondi.ts";
import { compteRenduGeneration } from "./generation.ts";
import { UNITES } from "../recettes/unites.ts";

/**
 * L'arrondi d'achat (D7 de la story 4.7) et le compte rendu de la génération.
 *
 * ⚠️ **`genererLaListe` n'est PAS testée ici** — même frontière que `ajout.ts` et
 * `suppression.ts` : elle prend son client en paramètre, et un faux client prouverait
 * la forme de l'appel et jamais ce qui compte. Ce qui compte est dans la base, et se
 * mesure dans `supabase/tests/isolation.test.ts`.
 */

test("les unités dénombrables montent à l'entier SUPÉRIEUR, jamais au plus proche", () => {
  /*
   * ⛔ **`1,2 → 2`, ET C'EST LE TEST QUI COMPTE.** Un `Math.round` rendrait 1, et la
   * recette manquerait un oignon. « Jamais 1,67 oignon » est la formulation de l'epic,
   * mais c'est l'arrondi VERS LE HAUT qui la tient — une liste de courses se trompe du
   * bon côté.
   */
  assert.equal(arrondirPourAchat(1.2, "pièce"), 2);
  assert.equal(arrondirPourAchat(1.67, "pièce"), 2);
  assert.equal(arrondirPourAchat(2.5, "pièce"), 3);
  // Le cas propre de la story : 2 oignons pour 4 portions, servis à 6.
  assert.equal(arrondirPourAchat(3, "pièce"), 3);
});

test("un entier déjà achetable n'est pas gonflé", () => {
  /*
   * ⚠️ **Le contrôle négatif de l'arrondi au supérieur.** `ceil` sur un entier doit
   * être l'identité ; un décalage d'une unité ferait acheter un oignon de trop à
   * chaque génération, et personne ne le verrait avant le panier.
   */
  assert.equal(arrondirPourAchat(1, "pièce"), 1);
  assert.equal(arrondirPourAchat(12, "pièce"), 12);
});

test("les unités CONTINUES sortent intactes — le contre-exemple qui a écarté D7(b)", () => {
  /*
   * ⛔ **1,2 kg de farine ne devient PAS 2 kg.** C'est une erreur d'un facteur proche
   * de 2, et c'est l'argument exact qui a écarté « arrondir tout au supérieur ».
   */
  assert.equal(arrondirPourAchat(1.2, "kg"), 1.2);
  assert.equal(arrondirPourAchat(1200, "g"), 1200);
  assert.equal(arrondirPourAchat(0.75, "L"), 0.75);
  assert.equal(arrondirPourAchat(333.33, "ml"), 333.33);
});

test("les gestes de cuisine s'arrondissent au DEMI", () => {
  assert.equal(arrondirPourAchat(1.67, "cs"), 1.5);
  assert.equal(arrondirPourAchat(1.8, "cc"), 2);
  assert.equal(arrondirPourAchat(0.2, "pincée"), 0.5);
  assert.equal(arrondirPourAchat(3, "cc"), 3);
});

test("⛔ un demi n'est JAMAIS écrasé à zéro — le cas qui ferait disparaître un ingrédient", () => {
  /*
   * ⛔ **`0,2 pincée → 0,5`, pas `0`.** Un arrondi au plus proche entier rendrait zéro,
   * et l'ingrédient disparaîtrait de la liste sans que rien ne le signale. C'est le pire
   * mode de panne de cette règle : silencieux, et il retire de la nourriture.
   */
  assert.notEqual(arrondirPourAchat(0.2, "pincée"), 0);
  assert.notEqual(arrondirPourAchat(0.1, "cc"), 0);
  assert.equal(arrondirPourAchat(0.1, "cc"), 0.5);
});

test("⛔ une quantité NULLE reste nulle — le plancher relève, il n'invente pas", () => {
  /*
   * ⛔ **TROUVÉ PAR LE BANC DE MUTATIONS, PAS PAR LA RELECTURE.** Muter `quantite > 0`
   * en `quantite >= 0` survivait à toute la suite : avec `>=`, une quantité de zéro
   * passe par `Math.max(0.5, 0)` et ressort à **0,5**. On inventerait un demi de
   * quelque chose que la recette ne demande pas.
   *
   * ⚠️ **Et ce n'est pas un cas théorique** : la génération fait `coalesce(ri.quantity, 0)`,
   * donc un ingrédient saisi SANS quantité arrive ici à zéro. Sans ce test, chaque
   * ingrédient sans quantité gagnerait une demi-cuillère à chaque génération.
   */
  assert.equal(arrondirPourAchat(0, "cc"), 0);
  assert.equal(arrondirPourAchat(0, "cs"), 0);
  assert.equal(arrondirPourAchat(0, "pincée"), 0);
  assert.equal(arrondirPourAchat(0, "pièce"), 0);
  assert.equal(arrondirPourAchat(0, "g"), 0);
});

test("une quantité absente le reste — on n'invente pas un nombre", () => {
  for (const unite of UNITES) {
    assert.equal(arrondirPourAchat(null, unite), null, `« ${unite} » a inventé une quantité`);
  }
});

test("les HUIT unités du vocabulaire sont traitées, et aucune ne rend NaN", () => {
  /*
   * ⚠️ **Un prédicat sur tout le vocabulaire, pas une énumération de cas** — règle §3.
   * Le jour où AD-7 gagne une neuvième unité, ce test l'exerce sans qu'on y pense, et
   * une unité oubliée tombe dans la branche « intacte » plutôt que de rendre `NaN`.
   */
  for (const unite of UNITES) {
    const rendu = arrondirPourAchat(2.5, unite);
    assert.ok(
      typeof rendu === "number" && Number.isFinite(rendu),
      `« ${unite} » rend ${rendu}, qui n'est pas un nombre fini`
    );
    assert.ok(rendu > 0, `« ${unite} » a fait disparaître une quantité de 2,5`);
  }
});

test("une unité INCONNUE laisse la quantité intacte, sans lever", () => {
  /*
   * ⚠️ Ne rien faire est le seul comportement qui ne peut pas fausser une quantité.
   * Le vocabulaire est verrouillé en base ; si une valeur hors vocabulaire arrive ici,
   * c'est un défaut ailleurs, et l'arrondi n'est pas l'endroit où le rattraper.
   */
  assert.equal(arrondirPourAchat(1.67, "gallon"), 1.67);
  assert.equal(arrondirPourAchat(1.67, null), 1.67);
});

test("le compte rendu accorde, et « posé » remplace « ajouté »", () => {
  /*
   * ⛔ **« POSÉ » ET NON « AJOUTÉ » — CORRECTION DE LA REVUE.** Le compte est celui des
   * articles TOUCHÉS : une ligne existante dont la quantité monte y figure, et elle n'a pas
   * été « ajoutée ». Les quatre couches ont mesuré qu'au second appel l'écran annonçait
   * « N articles ajoutés » alors que zéro l'avait été.
   */
  assert.equal(compteRenduGeneration({ ajoutes: 1, echoues: 0 }), "1 article posé sur ta liste.");
  assert.equal(compteRenduGeneration({ ajoutes: 2, echoues: 0 }), "2 articles posés sur ta liste.");
  assert.equal(compteRenduGeneration({ ajoutes: 12, echoues: 0 }), "12 articles posés sur ta liste.");
});

test("⛔ un échec se dit TOUJOURS — le membre croirait sinon sa liste complète", () => {
  /*
   * ⛔ **NÉ D'UN DÉFAUT MESURÉ EN REVUE** : un débordement de quantité annulait l'ordre entier
   * et faisait perdre toute la semaine, sans que rien ne le dise. La génération isole désormais
   * chaque article — encore faut-il que l'écran rende compte des échecs.
   */
  assert.match(compteRenduGeneration({ ajoutes: 3, echoues: 1 }), /n'a pas pu être ajouté/);
  assert.match(compteRenduGeneration({ ajoutes: 3, echoues: 2 }), /2 articles n'ont pas pu/);
  // Tout a échoué : la phrase ne doit pas annoncer un succès partiel qui n'existe pas.
  assert.ok(!compteRenduGeneration({ ajoutes: 0, echoues: 1 }).includes("posé"));
  assert.match(compteRenduGeneration({ ajoutes: 0, echoues: 1 }), /1 article n'a pas pu être ajouté/);
});

test("⛔ zéro posé n'est pas une panne, et ne se dit pas comme un compte", () => {
  /*
   * ⛔ « 0 article posé. » se lit comme un échec alors que c'est un succès sans objet.
   * ⚠️ **Et la phrase ne parle plus de la LISTE — correction de la revue.** « Ta liste avait
   * déjà tout ce qu'il faut » affirmait quelque chose de la liste alors que zéro a trois
   * causes, dont « le menu est vide », et que la liste n'est pas consultée.
   */
  const phrase = compteRenduGeneration({ ajoutes: 0, echoues: 0 });
  assert.ok(!phrase.startsWith("0"), `« ${phrase} » annonce un compte nul comme un compte`);
  assert.equal(phrase, "Rien de neuf pour ta liste.");
});

test("aucune phrase de génération n'emploie de mot technique banni (NFR-9)", () => {
  const bannis = ["synchronis", "token", "jeton", " api", "mcp", "supabase", "rls", "cache", "upsert"];
  const cas = [
    { ajoutes: 0, echoues: 0 }, { ajoutes: 1, echoues: 0 }, { ajoutes: 4, echoues: 0 },
    { ajoutes: 0, echoues: 1 }, { ajoutes: 4, echoues: 2 },
  ];
  for (const c of cas) {
    const phrase = compteRenduGeneration(c).toLowerCase();
    for (const mot of bannis) {
      assert.ok(!phrase.includes(mot), `« ${phrase} » emploie « ${mot} », banni de toute chaîne rendue`);
    }
  }
});
