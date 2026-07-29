import { test } from "node:test";
import assert from "node:assert/strict";
import { usages, validite } from "./libelles-invitation.ts";

const MAINTENANT = new Date("2026-07-28T12:00:00.000Z");
const dans = (ms: number) => new Date(MAINTENANT.getTime() + ms).toISOString();

const MINUTE = 60_000;
const HEURE = 3_600_000;
const JOUR = 86_400_000;

test("au-delà d'un jour, le compte se fait en jours pleins", () => {
  assert.equal(validite(dans(7 * JOUR), MAINTENANT), "Encore 7 jours.");
  assert.equal(validite(dans(2 * JOUR), MAINTENANT), "Encore 2 jours.");
  assert.equal(validite(dans(JOUR), MAINTENANT), "Encore 1 jour.");
  // Le point qui mentait auparavant : arrondi vers le BAS, jamais vers le haut.
  assert.equal(validite(dans(JOUR + 23 * HEURE), MAINTENANT), "Encore 1 jour.");
});

test("sous un jour, le compte passe en heures — le cas qui trompait", () => {
  // Ces trois-là annonçaient tous « Encore 1 jour. »
  assert.equal(validite(dans(23 * HEURE), MAINTENANT), "Il expire dans 23 heures.");
  assert.equal(validite(dans(2 * HEURE), MAINTENANT), "Il expire dans 2 heures.");
  assert.equal(validite(dans(HEURE), MAINTENANT), "Il expire dans 1 heure.");
});

test("sous une heure, le compte passe en minutes", () => {
  assert.equal(validite(dans(30 * MINUTE), MAINTENANT), "Il expire dans 30 minutes.");
  assert.equal(validite(dans(2 * MINUTE), MAINTENANT), "Il expire dans 2 minutes.");
  assert.equal(validite(dans(MINUTE), MAINTENANT), "Il expire dans 1 minute.");
  // Quelques secondes : on ne dit pas « 0 minute », on dit la plus petite unité.
  assert.equal(validite(dans(5_000), MAINTENANT), "Il expire dans 1 minute.");
});

test("l'expiration atteinte a bien un libellé — la branche n'est plus morte", () => {
  assert.equal(validite(dans(0), MAINTENANT), "Il a expiré.");
  assert.equal(validite(dans(-JOUR), MAINTENANT), "Il a expiré.");
});

test("les usages s'accordent, et zéro a son propre message", () => {
  assert.equal(usages(5), "5 personnes peuvent encore s'en servir.");
  assert.equal(usages(2), "2 personnes peuvent encore s'en servir.");
  assert.equal(usages(1), "1 personne peut encore s'en servir.");
  assert.equal(usages(0), "Il n'a plus d'usage disponible.");
});
