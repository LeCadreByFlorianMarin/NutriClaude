import { test } from "node:test";
import assert from "node:assert/strict";
import { lienDeConfirmation } from "./bascule.ts";

const params = (l: string) => new URLSearchParams(l.slice(1));

test("un lien incomplet ne produit pas d'écran de confirmation crédible", () => {
  assert.equal(lienDeConfirmation({ type: "magiclink" }), null);
  assert.equal(lienDeConfirmation({ token_hash: "abc" }), null);
  assert.equal(lienDeConfirmation({}), null);
  assert.equal(lienDeConfirmation({ token_hash: "", type: "" }), null);
});

test("`confirme=1` est toujours posé", () => {
  // Sans lui, /auth/callback renvoie à nouveau vers /auth/bascule : l'utilisateur
  // tourne en rond sans jamais se connecter.
  const l = lienDeConfirmation({ token_hash: "abc", type: "magiclink" });
  assert.ok(l);
  assert.equal(params(l).get("confirme"), "1");
});

test("`next` hostile est neutralisé, pas propagé", () => {
  for (const hostile of ["https://evil.com", "//evil.com", "/\t/evil.com"]) {
    const l = lienDeConfirmation({ token_hash: "abc", type: "magiclink", next: hostile });
    assert.ok(l);
    assert.equal(params(l).get("next"), "/", JSON.stringify(hostile));
  }
});

test("`next` légitime est conservé, absent il vaut l'accueil", () => {
  const avec = lienDeConfirmation({ token_hash: "a", type: "magiclink", next: "/foyer" });
  assert.equal(params(avec!).get("next"), "/foyer");

  const sans = lienDeConfirmation({ token_hash: "a", type: "magiclink" });
  assert.equal(params(sans!).get("next"), "/");
});

test("un token_hash à caractères réservés survit à l'aller-retour", () => {
  const brut = "a+b/c=d&e";
  const l = lienDeConfirmation({ token_hash: brut, type: "magiclink" });
  assert.ok(l);
  assert.equal(params(l).get("token_hash"), brut);
});
