import { test } from "node:test";
import assert from "node:assert/strict";
import { uniteChoisie } from "./ajout.ts";
import { UNITES } from "../recettes/unites.ts";

/**
 * Le pur de l'ajout (story 4.4).
 *
 * ⚠️ **Pourquoi `ajouterArticle` n'est PAS testée ici.** Elle prend son client en
 * paramètre, et la frontière tracée par `liste.test.ts` vaut à l'identique : « un
 * faux client prouverait la forme de l'appel et jamais l'agrégation ». Ce qui compte
 * dans cette fonction — que la clé agrège, que le tombstone se rouvre, que la RLS
 * refuse le foyer d'autrui — se mesure contre une VRAIE base, dans
 * `supabase/tests/isolation.test.ts`.
 */

test("les huit jetons du vocabulaire fermé sont TOUS acceptés", () => {
  /*
   * ⚠️ **Mesure d'un invariant entre deux fichiers** (règle §4) : la source unique
   * est `lib/recettes/unites.ts`, et son accord avec la contrainte
   * `grocery_list_items_unite_fermee` est déjà mesuré par `contraintes.test.ts`.
   * Ce test ferme le dernier maillon : que la porte d'ajout ne rejette aucun jeton
   * légitime.
   */
  for (const u of UNITES) {
    assert.equal(uniteChoisie(u), u, `« ${u} » a été refusée alors qu'elle est au contrat`);
  }
});

test("une unité HORS vocabulaire rend undefined, elle n'est pas transmise", () => {
  /*
   * ⛔ Elle ne peut pas venir du `<select>` : si elle arrive, c'est un appel forgé
   * ou un défaut. La transmettre ferait rendre `23514` par la base — un code que
   * rien ne traduit pour le membre, donc « Réessaie » en boucle.
   */
  assert.equal(uniteChoisie("bocal"), undefined);
  assert.equal(uniteChoisie(""), undefined);
  assert.equal(uniteChoisie("PIÈCE"), undefined, "la casse n'est pas tolérée, et c'est voulu");
});

test("une forme Unicode DÉCOMPOSÉE est refusée, et c'est un défaut connu de la base", () => {
  /*
   * ⚠️ **Mesuré en revue de la story 4.1** : `insert … unit = normalize('pièce', NFD)`
   * rend `23514` — sur une unité que le membre a pourtant choisie dans une liste
   * fermée. `name` traverse `normalize(name, NFC)` dans l'expression de l'index ;
   * `unit` ne traverse rien, ni dans la contrainte ni dans la clé.
   *
   * ⛔ **Ce test FIGE le refus actuel comme voulu**, il ne le corrige pas. Sans
   * conséquence tant que l'unité vient d'un `<select>` ; à rouvrir quand le pont
   * Google écrira (AD-12), avec un texte dont personne ne contrôle la forme.
   * Reporté dans `deferred-work.md`.
   */
  const decomposee = "pièce".normalize("NFD");
  assert.notEqual(decomposee, "pièce", "la fixture doit vraiment être décomposée");
  assert.equal(uniteChoisie(decomposee), undefined);
});
