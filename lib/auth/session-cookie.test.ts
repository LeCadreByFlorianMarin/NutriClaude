import { test } from "node:test";
import assert from "node:assert/strict";
import { estCookieDeSession } from "./session-cookie.ts";

test("reconnaît le cookie de session, entier ou découpé", () => {
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-token"), true);
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-token.0"), true);
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-token.1"), true);
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-token.12"), true);
});

test("rejette le code-verifier PKCE, écrit dès la demande de lien", () => {
  // Régression : un `includes("auth-token")` laissait passer ce cookie, donc un
  // navigateur qui n'a jamais terminé de connexion franchissait le proxy
  // pendant une panne Supabase.
  assert.equal(
    estCookieDeSession("sb-abcdefgh-auth-token-code-verifier"),
    false
  );
});

test("rejette les cookies étrangers et les suffixes non numériques", () => {
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-token.x"), false);
  assert.equal(estCookieDeSession("sb-abcdefgh-auth-tokenX"), false);
  assert.equal(estCookieDeSession("auth-token"), false);
  assert.equal(estCookieDeSession("sb-auth-token"), false); // pas de <ref>
  assert.equal(estCookieDeSession("xsb-abc-auth-token"), false);
  assert.equal(estCookieDeSession(""), false);
});
