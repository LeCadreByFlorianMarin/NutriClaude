import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le motif du matcher décide quels chemins subissent le contrôle d'accès : tout
 * ce qui n'est pas apparié contourne le proxy entièrement. Une édition d'un
 * caractère dé-protège donc silencieusement des familles de routes entières.
 *
 * Il est lu **depuis `proxy.ts`** plutôt qu'importé, parce que Next exige que
 * `config.matcher` soit un littéral statique analysable à la compilation : le
 * sortir dans un module partagé fait échouer le build (« Entry `matcher[0]` need
 * to be static strings »). Le lire garde une source de vérité unique, sans
 * recopie qui pourrait diverger.
 */
function motifDuProxy(): string {
  const source = readFileSync(
    join(import.meta.dirname, "..", "..", "proxy.ts"),
    "utf8"
  );
  const trouve = source.match(/"(\/\(\(\?!.*?\)\.\*\))"/);
  assert.ok(
    trouve,
    "motif introuvable dans proxy.ts — la forme de `config.matcher` a changé, " +
      "revois ce test avant de le contourner"
  );
  return JSON.parse(`"${trouve[1]}"`);
}

/** Next ancre le motif du matcher aux deux bouts. */
const proxifie = (chemin: string) =>
  new RegExp(`^${motifDuProxy()}$`).test(chemin);

test("protège les routes de l'application", () => {
  for (const chemin of ["/", "/foyer", "/login", "/auth/callback", "/menu"]) {
    assert.equal(proxifie(chemin), true, chemin);
  }
});

test("laisse sortir les internes du framework et les trois fichiers racine", () => {
  for (const chemin of [
    "/_next/static/chunks/main.js",
    "/_next/image/",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    assert.equal(proxifie(chemin), false, chemin);
  }
});

test("les exclusions sont ancrées : aucun chemin ne s'y glisse par suffixe", () => {
  for (const chemin of [
    "/robots.txtsecret",
    "/favicon.icoX",
    "/sitemap.xml.bak",
    "/recettes/photo.png",
    "/_next/staticky",
  ]) {
    assert.equal(proxifie(chemin), true, chemin);
  }
});

test("le manifeste PWA traverse encore le proxy — décision à rouvrir en Epic 6", () => {
  // Ce test ne défend pas un état souhaitable, il **fige la conséquence
  // assumée** documentée dans `proxy.ts` : le jour où l'Epic 6 exclura le
  // manifeste et les icônes PWA, il échouera — et c'est exactement le moment où
  // la décision doit être reprise en connaissance de cause.
  assert.equal(proxifie("/manifest.webmanifest"), true);
});
