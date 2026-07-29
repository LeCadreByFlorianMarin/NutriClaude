import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next.ts";

const ORIGINE = "https://nutriclaude.test";

/** Où la valeur retenue emmène réellement le navigateur, cf. `route.ts`. */
const destination = (v: string | null | undefined) =>
  new URL(safeNext(v), ORIGINE).href;

test("laisse passer un chemin local", () => {
  assert.equal(safeNext("/foyer"), "/foyer");
  assert.equal(safeNext("/menu?jour=lundi"), "/menu?jour=lundi");
  assert.equal(destination("/foyer"), `${ORIGINE}/foyer`);
});

test("retombe sur l'accueil quand il n'y a rien à honorer", () => {
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(undefined), "/");
  assert.equal(safeNext(""), "/");
});

test("rejette les URL absolues et protocol-relative", () => {
  for (const hostile of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
    assert.equal(safeNext(hostile), "/", hostile);
    assert.equal(destination(hostile), `${ORIGINE}/`, hostile);
  }
});

test("rejette les caractères que le parseur d'URL retire avant de parser", () => {
  // Régression : ces trois entrées passaient un contrôle « une seule barre
  // oblique », puis `new URL()` supprimait le caractère de contrôle et
  // résolvait `//evil.com` — soit une redirection ouverte, sur le parcours de
  // connexion, après émission d'un cookie de session valide.
  for (const hostile of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com"]) {
    assert.equal(safeNext(hostile), "/", JSON.stringify(hostile));
    assert.equal(destination(hostile), `${ORIGINE}/`, JSON.stringify(hostile));
  }
});

test("normalise sans dénaturer une destination légitime", () => {
  // Le caractère est retiré, la destination reste locale.
  assert.equal(destination("/fo\tyer"), `${ORIGINE}/foyer`);
});
