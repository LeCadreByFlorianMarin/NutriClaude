import { test } from "node:test";
import assert from "node:assert/strict";
import { messageDe } from "./messages.ts";

const TABLE = {
  "lien-expire": "Ce lien n'est plus bon.",
  echec: "Ça n'a pas marché.",
} as const;

test("rend le message déclaré", () => {
  assert.equal(messageDe(TABLE, "lien-expire", "echec"), "Ce lien n'est plus bon.");
});

test("rend le repli pour une clé inconnue", () => {
  assert.equal(messageDe(TABLE, "clé-jamais-vue", "echec"), "Ça n'a pas marché.");
});

test("ne rend rien quand il n'y a pas de clé", () => {
  assert.equal(messageDe(TABLE, undefined, "echec"), undefined);
});

test("les clés héritées d'Object ne traversent pas", () => {
  // Régression : `TABLE[cle] ?? TABLE.echec` rendait ici un objet ou une
  // fonction — truthy, donc le repli ne se déclenchait pas — et React levait.
  // `/login?error=__proto__` suffisait à casser l'écran de connexion.
  for (const hostile of ["__proto__", "constructor", "toString", "valueOf"]) {
    const rendu = messageDe(TABLE, hostile, "echec");
    assert.equal(typeof rendu, "string", hostile);
    assert.equal(rendu, "Ça n'a pas marché.", hostile);
  }
});
