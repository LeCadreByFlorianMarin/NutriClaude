import { test } from "node:test";
import assert from "node:assert/strict";
import { compteRenduArchivage, compteRenduVidage } from "./suppression.ts";

/**
 * Le pur de la suppression (story 4.5).
 *
 * ⚠️ **Pourquoi `supprimerArticle`, `archiverLesAchetes` et `viderLaListe` ne sont
 * PAS testées ici.** Elles prennent leur client en paramètre, et la frontière tracée
 * par `liste.test.ts` puis `ajout.test.ts` vaut à l'identique : un faux client
 * prouverait la forme de l'appel et jamais ce qui compte. Or ce qui compte tient
 * entièrement dans la base — que le tombstone se pose sans toucher `status`, que
 * l'archivage n'emporte que les achetés, qu'un DELETE dur ne supprime rien, et que
 * la RLS refuse le foyer d'autrui. Tout cela se mesure contre une VRAIE base, dans
 * `supabase/tests/isolation.test.ts`.
 *
 * ⛔ **Ce fichier ne garde donc qu'une chose : les phrases.** Elles sont ici, et non
 * dans le JSX, parce que NFR-10 interdit un harnais de composants — une règle laissée
 * dans un composant n'est exercée par rien. Le dépôt a payé cette leçon deux fois
 * (« 2 pièce » dans la carte-rayon, `comparerGroupes` dont la mutation survivait).
 */

test("l'archivage accorde son compte rendu au singulier et au pluriel", () => {
  /*
   * ⚠️ **C'est exactement le défaut « 2 pièce » de la story 4.2**, transposé. Il
   * n'avait été trouvé qu'à l'œil parce que la règle vivait dans le JSX.
   */
  assert.equal(compteRenduArchivage(1), "1 article rangé.");
  assert.equal(compteRenduArchivage(2), "2 articles rangés.");
  assert.equal(compteRenduArchivage(12), "12 articles rangés.");
});

test("archiver ZÉRO article n'est pas une panne, et ne se dit pas comme un compte", () => {
  /*
   * ⛔ **« 0 article rangé. » se lit comme un échec alors que c'est un succès sans
   * objet** — le cas nominal du membre dont l'autre moitié du foyer vient de faire
   * le geste. Ce n'est pas de la coquetterie : le dépôt a déjà payé un état vide qui
   * AFFIRMAIT un fait faux (« Ta liste est vide. » sous un message d'échec, revue de
   * la 4.2), et la leçon écrite était « un état vide se mérite ».
   */
  assert.equal(compteRenduArchivage(0), "Il n'y avait rien à ranger.");
});

test("le vidage accorde son compte rendu, et son zéro a sa propre phrase", () => {
  assert.equal(compteRenduVidage(1), "1 article retiré.");
  assert.equal(compteRenduVidage(3), "3 articles retirés.");
  assert.equal(compteRenduVidage(0), "Ta liste était déjà vide.");
});

test("aucune phrase ne promet une destruction que le tombstone ne fait pas", () => {
  /*
   * ⛔ **AD-3 : la suppression est un tombstone.** Réajouter l'article le fait
   * revenir — mesuré, `ajouter_article` rouvre la ligne. Écrire « supprimé
   * définitivement » ou « effacé » serait donc faux, et le membre qui retape le nom
   * la semaine suivante verrait le contraire de ce qu'on lui a promis.
   *
   * ⚠️ **Un test sur des mots INTERDITS, pas sur une formulation exacte** : la
   * phrase peut changer, la promesse non. C'est aussi le seul filet contre le mot
   * qu'une future rédaction réintroduira sans y penser.
   */
  const interdits = ["effac", "définitiv", "irréversible", "perdu"];
  const phrases = [
    compteRenduArchivage(0),
    compteRenduArchivage(1),
    compteRenduArchivage(4),
    compteRenduVidage(0),
    compteRenduVidage(1),
    compteRenduVidage(4),
  ];

  for (const phrase of phrases) {
    for (const mot of interdits) {
      assert.ok(
        !phrase.toLowerCase().includes(mot),
        `« ${phrase} » emploie « ${mot} », qui promet une destruction que le tombstone ne fait pas`
      );
    }
  }
});

test("aucune phrase n'emploie de mot technique banni (NFR-9)", () => {
  /*
   * ⚠️ **La liste vient de `project-context.md`**, qui la tient d'UX-DR12/NFR-8/NFR-9 :
   * « Mots bannis dans toute chaîne rendue : synchronisation, jeton/token, API, MCP,
   * pont, Supabase, RLS, cache. » On y ajoute le vocabulaire de cette story, qui a
   * toutes les chances de fuir depuis le SQL : « tombstone », « archiver » au sens
   * technique n'est pas banni (c'est du français courant), mais « tombstone » l'est.
   */
  const bannis = ["synchronis", "token", "jeton", " api", "mcp", "supabase", "rls", "cache", "tombstone"];
  const phrases = [
    compteRenduArchivage(0),
    compteRenduArchivage(2),
    compteRenduVidage(0),
    compteRenduVidage(2),
  ];

  for (const phrase of phrases) {
    for (const mot of bannis) {
      assert.ok(
        !phrase.toLowerCase().includes(mot),
        `« ${phrase} » emploie « ${mot} », banni de toute chaîne rendue`
      );
    }
  }
});
