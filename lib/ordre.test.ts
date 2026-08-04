import { test } from "node:test";
import assert from "node:assert/strict";
import {
  indexCibleDuGlisser,
  ordreApresDeplacement,
  ordreDeplace,
} from "./ordre.ts";

/**
 * Le pur du réordonnancement.
 *
 * **Ce que ce fichier existe pour tenir : l'AC2 au niveau du pur** — « positions
 * uniques, aucun élément perdu ou dupliqué ». La moitié base de cet invariant est
 * mesurée par `supabase/tests/isolation.test.ts` ; la moitié client est ici, et
 * elle se résume à une assertion qu'on oublie facilement : **l'ensemble des
 * identifiants rendus est exactement celui reçu**. Une permutation qui perd ou
 * duplique un élément passerait tous les tests d'ordre et échouerait celui-là.
 */

/** Un parcours nommé par des lettres — l'`ordre` est là pour être ignoré. */
function parcours(...ids: string[]) {
  return ids.map((id, i) => ({ id, ordre: (i + 1) * 10 }));
}

/**
 * L'assertion structurelle, à appeler sur CHAQUE cas qui rend un ordre.
 * Elle ne regarde pas la position : seulement qu'aucun élément n'a disparu ni
 * n'est apparu deux fois.
 */
function memeEnsemble(rendu: string[], depart: ReadonlyArray<{ id: string }>) {
  assert.equal(rendu.length, depart.length, "aucun élément perdu ni ajouté");
  assert.equal(new Set(rendu).size, rendu.length, "aucun doublon");
  assert.deepEqual(
    [...rendu].sort(),
    depart.map((r) => r.id).sort(),
    "exactement les mêmes identifiants"
  );
}

// ── ordreApresDeplacement — le chemin des flèches ────────────────────────

test("monter un élément du milieu l'échange avec son prédécesseur", () => {
  const p = parcours("a", "b", "c", "d");
  const rendu = ordreApresDeplacement(p, "c", "haut");
  assert.deepEqual(rendu, ["a", "c", "b", "d"]);
  memeEnsemble(rendu!, p);
});

test("descendre un élément du milieu l'échange avec son successeur", () => {
  const p = parcours("a", "b", "c", "d");
  const rendu = ordreApresDeplacement(p, "b", "bas");
  assert.deepEqual(rendu, ["a", "c", "b", "d"]);
  memeEnsemble(rendu!, p);
});

test("monter le premier élément ne fait rien", () => {
  assert.equal(ordreApresDeplacement(parcours("a", "b", "c"), "a", "haut"), null);
});

test("descendre le dernier élément ne fait rien", () => {
  assert.equal(ordreApresDeplacement(parcours("a", "b", "c"), "c", "bas"), null);
});

test("une liste d'un seul élément ne bouge dans aucun sens", () => {
  const p = parcours("a");
  assert.equal(ordreApresDeplacement(p, "a", "haut"), null);
  assert.equal(ordreApresDeplacement(p, "a", "bas"), null);
});

test("une liste de deux éléments s'inverse dans les deux sens", () => {
  const p = parcours("a", "b");
  assert.deepEqual(ordreApresDeplacement(p, "b", "haut"), ["b", "a"]);
  assert.deepEqual(ordreApresDeplacement(p, "a", "bas"), ["b", "a"]);
});

test("un identifiant inconnu ne fait rien", () => {
  // Le cas réel : l'autre membre du foyer vient de supprimer cet élément, et les
  // propriétés de l'écran n'ont pas encore été rafraîchies.
  assert.equal(ordreApresDeplacement(parcours("a", "b"), "zzz", "haut"), null);
});

test("un parcours vide ne fait rien", () => {
  assert.equal(ordreApresDeplacement([], "a", "haut"), null);
});

// ── ordreDeplace — le primitif, et le chemin du glisser ──────────────────

test("le premier élément peut aller en dernier", () => {
  const p = parcours("a", "b", "c", "d");
  const rendu = ordreDeplace(p, "a", 3);
  assert.deepEqual(rendu, ["b", "c", "d", "a"]);
  memeEnsemble(rendu!, p);
});

test("le dernier élément peut aller en premier", () => {
  const p = parcours("a", "b", "c", "d");
  const rendu = ordreDeplace(p, "d", 0);
  assert.deepEqual(rendu, ["d", "a", "b", "c"]);
  memeEnsemble(rendu!, p);
});

test("déplacer un élément vers sa propre place ne fait rien", () => {
  // Le glisser relâché à son point de départ. Aucun appel à la base, aucun
  // message : il ne s'est rien passé.
  assert.equal(ordreDeplace(parcours("a", "b", "c"), "b", 1), null);
});

test("un index hors bornes ne fait rien", () => {
  const p = parcours("a", "b", "c");
  assert.equal(ordreDeplace(p, "a", -1), null);
  assert.equal(ordreDeplace(p, "a", 3), null);
});

test("un index non entier ne fait rien", () => {
  assert.equal(ordreDeplace(parcours("a", "b", "c"), "a", 1.5), null);
});

test("chaque déplacement possible conserve l'ensemble des identifiants", () => {
  // Le balayage exhaustif de l'AC2 sur un parcours de six : toutes les
  // permutations atteignables par un déplacement unique.
  const p = parcours("a", "b", "c", "d", "e", "f");
  for (const r of p) {
    for (let cible = 0; cible < p.length; cible++) {
      const rendu = ordreDeplace(p, r.id, cible);
      if (rendu === null) continue;
      memeEnsemble(rendu, p);
      assert.equal(rendu[cible], r.id, "l'élément atterrit bien à la place visée");
    }
  }
});

test("des ex æquo de `ordre` n'ont aucune influence", () => {
  // `sort_order` n'est pas unique en base et vaut 100 par défaut. Ces fonctions
  // travaillent sur la POSITION dans le tableau reçu, jamais sur `ordre` — sans
  // quoi deux éléments ex æquo seraient indiscernables.
  const p = [
    { id: "a", ordre: 100 },
    { id: "b", ordre: 100 },
    { id: "c", ordre: 100 },
  ];
  assert.deepEqual(ordreApresDeplacement(p, "c", "haut"), ["a", "c", "b"]);
  assert.deepEqual(ordreDeplace(p, "a", 2), ["b", "c", "a"]);
});

// ── indexCibleDuGlisser — la géométrie, extraite pour être testable ──────

test("tiré au-dessus de tous, il vise la première place", () => {
  assert.equal(indexCibleDuGlisser([100, 150, 200], 20), 0);
});

test("tiré en dessous de tous, il vise la dernière place", () => {
  assert.equal(indexCibleDuGlisser([100, 150, 200], 400), 3);
});

test("tiré entre deux lignes, il vise l'intervalle correspondant", () => {
  assert.equal(indexCibleDuGlisser([100, 150, 200], 120), 1);
  assert.equal(indexCibleDuGlisser([100, 150, 200], 180), 2);
});

test("des hauteurs de ligne inégales sont respectées", () => {
  // Une ligne dont le nom passe sur deux lignes EST plus haute que ses voisines :
  // c'est pour ça qu'on compare des centres mesurés et non un pas constant.
  const centres = [50, 130, 160]; // la première ligne est deux fois plus haute
  assert.equal(indexCibleDuGlisser(centres, 40), 0);
  assert.equal(indexCibleDuGlisser(centres, 100), 1);
  assert.equal(indexCibleDuGlisser(centres, 145), 2);
  assert.equal(indexCibleDuGlisser(centres, 200), 3);
});

test("sans autre ligne, la cible est toujours la seule place", () => {
  assert.equal(indexCibleDuGlisser([], 123), 0);
});

test("un centre exactement à la même hauteur ne compte pas comme au-dessus", () => {
  // Strictement au-dessus : à égalité, on ne déplace pas. Ça évite qu'un
  // frémissement du doigt d'un pixel fasse basculer l'index.
  assert.equal(indexCibleDuGlisser([100, 200], 100), 0);
});
