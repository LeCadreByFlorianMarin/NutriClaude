import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aujourdhuiAParis,
  estJourISO,
  formaterJourCourt,
  formaterJourLong,
  formaterPlageDeSemaine,
  joursDeLaSemaine,
  lundiDeLaSemaine,
  semaineVoisine,
} from "./semaine.ts";

/* ── estJourISO ───────────────────────────────────────────────────────────── */

test("estJourISO accepte une date bien formée, et elle seule", () => {
  assert.equal(estJourISO("2026-08-03"), true);
  assert.equal(estJourISO("2028-02-29"), true, "année bissextile");
});

test("estJourISO refuse ce que Date.UTC accepterait EN DÉBORDANT", () => {
  /*
   * ⚠️ **Le vrai piège de cette fonction.** `Date.UTC` ne lève pas sur une date
   * impossible, il déborde : `Date.UTC(2026, 12, 45)` vaut le 14 février 2027.
   * Une garde écrite avec `isNaN` laisserait donc passer « le 45 janvier » et
   * afficherait tranquillement une autre semaine. La validation se fait par
   * ALLER-RETOUR — reconstruire la chaîne et exiger l'égalité.
   */
  assert.equal(estJourISO("2026-13-45"), false);
  assert.equal(estJourISO("2026-02-30"), false, "le 30 février n'existe pas");
  assert.equal(estJourISO("2027-02-29"), false, "2027 n'est pas bissextile");
  assert.equal(estJourISO("2026-00-10"), false);
});

test("estJourISO refuse toute forme qui n'est pas AAAA-MM-JJ", () => {
  assert.equal(estJourISO(""), false);
  assert.equal(estJourISO(null), false);
  assert.equal(estJourISO(undefined), false);
  assert.equal(estJourISO("04/08/2026"), false, "le format français");
  assert.equal(estJourISO("2026-2-4"), false, "sans zéro de tête");
  assert.equal(estJourISO("2026-08-03T00:00:00Z"), false, "avec une heure");
  assert.equal(estJourISO("lol"), false);
  assert.equal(estJourISO("99-08-03"), false, "année à deux chiffres");
});

/* ── lundiDeLaSemaine ─────────────────────────────────────────────────────── */

test("le lundi d'un DIMANCHE est celui de la semaine qui s'achève", () => {
  /*
   * ⚠️ **Le cas qui trahit `getUTCDay()`**, qui rend `0` pour dimanche et non
   * pour lundi. Sans le décalage `(jour + 6) % 7`, le dimanche 9 août renverrait
   * le lundi 10 — celui de la semaine SUIVANTE — et la grille afficherait la
   * mauvaise semaine un jour sur sept.
   */
  assert.equal(lundiDeLaSemaine("2026-08-09"), "2026-08-03");
});

test("le lundi d'un lundi est lui-même", () => {
  assert.equal(lundiDeLaSemaine("2026-08-03"), "2026-08-03");
});

test("le lundi traverse un changement de mois", () => {
  // Samedi 1er août 2026 → lundi 27 juillet.
  assert.equal(lundiDeLaSemaine("2026-08-01"), "2026-07-27");
});

test("le lundi traverse un changement d'année", () => {
  // Vendredi 1er janvier 2027 → lundi 28 décembre 2026.
  assert.equal(lundiDeLaSemaine("2027-01-01"), "2026-12-28");
});

test("le lundi traverse un 29 février", () => {
  // Mardi 29 février 2028 → lundi 28 février 2028.
  assert.equal(lundiDeLaSemaine("2028-02-29"), "2028-02-28");
});

/* ── joursDeLaSemaine ─────────────────────────────────────────────────────── */

test("une semaine fait sept jours, dans l'ordre, lundi en tête", () => {
  assert.deepEqual(joursDeLaSemaine("2026-08-03"), [
    "2026-08-03",
    "2026-08-04",
    "2026-08-05",
    "2026-08-06",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
  ]);
});

test("une semaine à cheval sur deux mois reste continue", () => {
  assert.deepEqual(joursDeLaSemaine("2026-06-29"), [
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
  ]);
});

/* ── semaineVoisine ───────────────────────────────────────────────────────── */

test("la semaine voisine est à sept jours, dans les deux sens", () => {
  assert.equal(semaineVoisine("2026-08-03", 1), "2026-08-10");
  assert.equal(semaineVoisine("2026-08-03", -1), "2026-07-27");
});

test("le changement d'HEURE ne décale pas la semaine voisine", () => {
  /*
   * ⚠️ Le dimanche 29 mars 2026 est le passage à l'heure d'été : cette semaine-là
   * ne dure que 167 heures en heure locale. Tout calcul fait avec les accesseurs
   * LOCAUX de `Date` produirait ici le dimanche 29 au lieu du lundi 30. Ce test
   * est le filet de la règle « tout se calcule en UTC », et il tomberait à la
   * seconde où quelqu'un remplacerait `getUTCDate` par `getDate`.
   */
  assert.equal(semaineVoisine("2026-03-23", 1), "2026-03-30");
  assert.equal(semaineVoisine("2026-03-30", -1), "2026-03-23");
});

test("la semaine voisine traverse un changement d'année", () => {
  assert.equal(semaineVoisine("2026-12-28", 1), "2027-01-04");
});

/* ── aujourdhuiAParis ─────────────────────────────────────────────────────── */

test("le jour courant est celui de PARIS, pas celui du serveur", () => {
  /*
   * ⚠️ **Le défaut que ce test existe pour empêcher, et il n'arrive qu'en
   * production.** L'écran est rendu côté serveur ; le poste et la CI tournent en
   * `Europe/Paris`, mais Vercel exécute en UTC. À 00 h 30 heure française un
   * 4 août, il est encore le 3 en UTC : la grille ouvrirait sur la mauvaise
   * semaine et marquerait le mauvais jour « aujourd'hui » — sans que le poste
   * puisse jamais le reproduire.
   *
   * L'instant est INJECTÉ, sinon ce test ne pourrait rien prouver.
   */
  assert.equal(
    aujourdhuiAParis(new Date("2026-08-03T22:30:00Z")),
    "2026-08-04",
    "22 h 30 UTC en été = 00 h 30 à Paris, le lendemain"
  );
});

test("le décalage vaut aussi en HIVER, où il n'est que d'une heure", () => {
  // Le défaut change de saison sans changer de nature : +1 h en janvier.
  assert.equal(
    aujourdhuiAParis(new Date("2026-01-14T23:30:00Z")),
    "2026-01-15"
  );
});

test("en pleine journée, Paris et UTC tombent d'accord", () => {
  // Le témoin qui empêche le test précédent d'être vrai par accident.
  assert.equal(aujourdhuiAParis(new Date("2026-08-04T12:00:00Z")), "2026-08-04");
});

/* ── formatage ────────────────────────────────────────────────────────────── */

test("le jour se nomme en français, capitale en tête", () => {
  /*
   * ⚠️ La locale est écrite EN DUR, pour la même raison que `LOCALE` dans
   * `lib/recettes/lecture.ts` : sans argument, `Intl` suit la locale du
   * navigateur, et un membre dont le système est en anglais lirait « Monday ».
   * Le produit est en français par NFR-8, pas par coïncidence de configuration.
   */
  assert.equal(formaterJourLong("2026-08-03"), "Lundi 3 août");
  assert.equal(formaterJourCourt("2026-08-03"), "Lun.");
});

test("la plage d'une semaine tenue dans un seul mois ne le répète pas", () => {
  assert.equal(formaterPlageDeSemaine("2026-08-03"), "Du 3 au 9 août");
});

test("la plage nomme les deux mois quand la semaine est à cheval", () => {
  assert.equal(formaterPlageDeSemaine("2026-06-29"), "Du 29 juin au 5 juillet");
});

test("la plage nomme les deux ANNÉES quand la semaine est à cheval", () => {
  /*
   * Le seul cas où l'année est écrite : « du 28 décembre au 3 janvier » est
   * ambigu, et c'est la semaine que Florian consultera le plus tard dans l'année.
   * Partout ailleurs elle est du bruit.
   */
  assert.equal(
    formaterPlageDeSemaine("2026-12-28"),
    "Du 28 décembre 2026 au 3 janvier 2027"
  );
});
