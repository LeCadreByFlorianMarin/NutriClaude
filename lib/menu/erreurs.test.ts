import { test } from "node:test";
import assert from "node:assert/strict";
import { refusAssignation } from "./erreurs.ts";

/**
 * Les refus que la base oppose aux écritures du menu.
 *
 * **Le test EST le document du contrat**, comme pour `lib/foyer/erreurs.ts` : les
 * noms de contraintes épinglés ici sont ceux de
 * `20260804144217_contraindre_les_assignations_de_menu.sql`, et un renommage doit
 * faire échouer la CI plutôt que faire retomber trois refus distincts sur « Ça
 * n'a pas marché. Réessaie dans un instant. »
 */

test("le doublon d'assignation est nommé — c'est l'AC2 vu de l'écran", () => {
  /*
   * Forme mesurée le 2026-08-04 sur le stack local, contrainte en place :
   *   {"code":"23505","message":"duplicate key value violates unique constraint
   *    \"meal_plan_entries_assignation_unique\""}
   */
  assert.equal(
    refusAssignation({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "meal_plan_entries_assignation_unique"',
    }),
    "deja-au-menu"
  );
});

test("un nombre de personnes refusé par la base se distingue du reste", () => {
  assert.equal(
    refusAssignation({
      code: "23514",
      message:
        'new row for relation "meal_plan_entries" violates check constraint "meal_plan_entries_servings_positif"',
    }),
    "personnes-invalides"
  );
});

test("la recette a disparu sous les pieds : jamais « Réessaie »", () => {
  /*
   * ⚠️ **Les deux codes que ce dépôt a déjà payés.** Si l'autre membre supprime la
   * recette pendant qu'on remplit le formulaire, l'`insert` rend `23503` (la clé
   * étrangère n'a plus de cible) ou `42501` (le `with check` de `meal_plan_all`
   * parle, la recette n'appartenant plus au foyer). Aucun des deux n'est un nom de
   * contrainte `check`, donc les deux retomberaient sur « echec » —
   * c'est-à-dire « Réessaie dans un instant », **un conseil qui ne peut JAMAIS
   * fonctionner**. Exactement le défaut corrigé le 2026-08-03 sur le chemin
   * d'ajout d'ingrédient.
   */
  assert.equal(refusAssignation({ code: "23503", message: "…fkey…" }), "menu-change");
  assert.equal(
    refusAssignation({
      code: "42501",
      message: 'new row violates row-level security policy for table "meal_plan_entries"',
    }),
    "menu-change"
  );
});

test("le SQLSTATE prime sur le texte, et les deux familles ne se croisent pas", () => {
  /*
   * ⚠️ **L'ordre des deux familles est épinglé pour que le déplacer devienne un
   * choix visible.** En pratique elles s'excluent — un `23503` ne peut pas porter
   * un nom de contrainte `check` — donc l'ordre n'a pas de conséquence
   * observable ; ce test existe pour qu'il n'en prenne pas une en silence.
   */
  assert.equal(
    refusAssignation({
      code: "23503",
      message: "…meal_plan_entries_servings_positif…",
    }),
    "menu-change"
  );
});

test("un refus qu'on ne sait pas nommer reste générique", () => {
  /*
   * Un refus faussement précis est pire qu'un refus générique : dire « Cette
   * recette est déjà à ce repas » sur un `42P01` enverrait corriger quelque chose
   * qui n'a rien.
   */
  assert.equal(refusAssignation({ code: "42P01", message: "relation absente" }), "echec");
  assert.equal(refusAssignation({ code: null, message: null }), "echec");
  assert.equal(refusAssignation({}), "echec");
  assert.equal(refusAssignation(null), "echec");
});

test("un message qui NOMME une contrainte d'une AUTRE table ne déteint pas", () => {
  /*
   * `recipes_servings_positif` et `meal_plan_entries_servings_positif` se
   * ressemblent, et le premier est un préfixe du second à un mot près. Une
   * comparaison relâchée les confondrait — et l'écran dirait « il faut au moins
   * une personne » sur un refus qui parle de la recette.
   */
  assert.equal(
    refusAssignation({
      code: "23514",
      message:
        'new row for relation "recipes" violates check constraint "recipes_servings_positif"',
    }),
    "echec"
  );
});
