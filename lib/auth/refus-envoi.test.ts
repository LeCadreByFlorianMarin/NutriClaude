import { test } from "node:test";
import assert from "node:assert/strict";
import { versCleMessage } from "./refus-envoi.ts";

test("les deux plafonds d'envoi tombent sur le même message", () => {
  assert.equal(versCleMessage("over_email_send_rate_limit", 429), "trop-de-demandes");
  assert.equal(versCleMessage("over_request_rate_limit", 429), "trop-de-demandes");
});

test("les deux formes d'adresse invalide sont distinguées du reste", () => {
  assert.equal(versCleMessage("email_address_invalid", 400), "adresse-invalide");
  assert.equal(versCleMessage("validation_failed", 422), "adresse-invalide");
});

test("l'adresse non autorisée a son propre message", () => {
  // Premier écueil d'une nouvelle personne du foyer : sans service d'envoi
  // dédié, seules les adresses rattachées au projet reçoivent le lien.
  assert.equal(
    versCleMessage("email_address_not_authorized", 403),
    "adresse-non-autorisee"
  );
});

test("un 429 sans code connu reste un plafond atteint", () => {
  assert.equal(versCleMessage(undefined, 429), "trop-de-demandes");
  assert.equal(versCleMessage("code_jamais_vu", 429), "trop-de-demandes");
});

test("tout le reste retombe sur le message générique", () => {
  assert.equal(versCleMessage(undefined, undefined), "envoi-impossible");
  assert.equal(versCleMessage("signup_disabled", 422), "envoi-impossible");
  assert.equal(versCleMessage("code_jamais_vu", 500), "envoi-impossible");
});
