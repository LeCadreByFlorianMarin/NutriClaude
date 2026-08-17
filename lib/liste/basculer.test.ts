import { test } from "node:test";
import assert from "node:assert/strict";
import { statutApresGeste } from "./basculer.ts";

/**
 * Le pur de la bascule (story 4.3).
 *
 * ⚠️ **Pourquoi `basculerStatut` n'est PAS testée ici.** Elle prend son client en
 * paramètre, et la frontière tracée par `liste.test.ts` vaut à l'identique : « un
 * faux client prouverait la forme de la requête et jamais l'isolation ». Ce qui
 * compte dans cette fonction — que la RLS refuse le foyer d'autrui, que recocher
 * ne rende pas d'erreur, qu'`intent_at` bouge vraiment — se mesure contre une
 * VRAIE base, dans `supabase/tests/isolation.test.ts`.
 *
 * Ce qui se teste ici est le seul pur du module : la traduction du geste en état.
 */

test("une case COCHÉE veut dire « dans le panier »", () => {
  assert.equal(statutApresGeste(true), "bought");
});

test("une case DÉCOCHÉE veut dire « à prendre »", () => {
  /*
   * ⛔ **C'est l'AC1, et c'est le bug littéral du produit d'origine.** Le PRD le
   * trace : « Cocher / décocher : Cassé — case codée en dur, un article acheté
   * ne peut pas revenir » (`prd.md:207`). Le sens retour est donc un critère à
   * part entière, pas la symétrie évidente de l'aller.
   */
  assert.equal(statutApresGeste(false), "pending");
});

test("la traduction est TOTALE : les deux gestes rendent un statut du vocabulaire", () => {
  /*
   * ⚠️ **Mesure d'un invariant entre deux fichiers** (règle §4) : `StatutArticle`
   * est le type que `liste.ts` dérive de la contrainte `check (status in
   * ('pending','bought'))`. Si quelqu'un ajoutait un troisième état en base sans
   * le refléter ici, ce test ne le verrait pas — mais il verrait tout de suite
   * une traduction qui rendrait autre chose que ces deux valeurs.
   */
  const rendus = [statutApresGeste(true), statutApresGeste(false)];
  for (const r of rendus) {
    assert.ok(
      r === "pending" || r === "bought",
      `« ${r} » n'appartient pas au vocabulaire fermé de la colonne`
    );
  }
  assert.equal(new Set(rendus).size, 2, "les deux gestes doivent DIFFÉRER");
});
