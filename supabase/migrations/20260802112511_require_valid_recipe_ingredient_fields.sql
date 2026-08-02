-- Trois règles que `recipe_ingredients` ne portait pas, et dont deux sont des
-- contrats avec l'Epic 4.
--
-- ⚠️ À CONTRÔLER EN REVUE, AVANT LA FUSION — ces contraintes ÉCHOUERONT si une
-- ligne existante ne les respecte pas, et depuis le 2026-07-29 elles s'appliquent
-- **pendant le déploiement de production**. Exécuter dans le SQL Editor :
--
--   select id, recipe_id, name, quantity, unit from recipe_ingredients
--   where (quantity is not null and quantity < 0)
--      or (unit is not null and unit not in ('g', 'kg', 'ml', 'L', 'pièce', 'cs', 'cc', 'pincée'))
--      or regexp_replace(name, '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180E\u2800\u3164\uFE00-\uFE0F\uFFA0]', '', 'g') = '';
--
-- Attendu : **zéro ligne**, et c'est une DÉDUCTION, pas une mesure. Aucune surface
-- n'a jamais écrit dans `recipe_ingredients` : le prototype qui le faisait a été
-- retiré à la story 1.1, la story 3.1 ouvre `recipes` sans toucher aux ingrédients.
-- Le dépôt n'étant pas lié, je n'ai aucun accès à la production. **Si la requête
-- rend des lignes, les corriger avant de fusionner — n'assouplis aucune des trois.**
--
-- ── 1. `recipe_ingredients_unite_fermee` — LE CONTRAT AVEC L'EPIC 4 ───────────
--
-- `unit` est un `text` sans aucune contrainte. AC3 de la story 3.2 — « elle
-- provient du vocabulaire d'unités fermé » — n'avait donc **aucune frontière**.
--
-- ⚠️ **Le commentaire du squelette CONTREDIT l'architecture.** `initial_schema.sql:162`
-- annonce `-- 'g', 'ml', 'piece', 'cs', 'cc'` : CINQ jetons, et `piece` SANS
-- ACCENT. AD-7 en nomme HUIT : `g, kg, ml, L, pièce, cs, cc, pincée`. C'est AD-7
-- qui fait foi ; le commentaire du squelette a tort et n'est pas corrigé ici — on
-- ne modifie pas une migration déjà appliquée.
--
-- ⚠️ **Pourquoi la FORME exacte du jeton compte au-delà de cet écran.**
-- `generate_grocery_list_from_menu` (`:554`) groupe par `ri.name, ri.unit` **brut**
-- et recopie `ri.unit` dans `grocery_list_items.unit` (`:562`). Or AD-3 fait de
-- `(household_id, nom normalisé, unité)` la **clé canonique** de toute la liste de
-- courses. La chaîne écrite ici devient donc la clé d'agrégation de l'Epic 4.
--
-- Mesuré le 2026-08-02 : « pièce » composé (NFC, 5 points de code, 6 octets) et
-- décomposé (NFD, 6 points de code, 7 octets) sont deux chaînes que Postgres juge
-- **inégales**. Deux « pièce » de formes Unicode différentes seraient deux lignes
-- de courses qui ne fusionneraient JAMAIS, et rien ne dirait pourquoi.
--
-- La parade tient en deux endroits : l'écran offre un `<select>` — l'utilisateur ne
-- tape rien, donc aucune forme décomposée ne peut naître — et cette contrainte
-- refuse tout ce qui n'est pas un des huit jetons, y compris pour un appel REST
-- direct que le `<select>` ne voit pas.
--
-- ⚠️ **`unit is null or` n'est pas une faiblesse.** La colonne est nullable et
-- « du sel » est un ingrédient légitime sans quantité ni unité. La resserrer en
-- `not null` ne serait pas additif.
--
-- ── 2. `recipe_ingredients_nom_non_vide` — la CINQUIÈME de cette famille ──────
--
-- Après `display_name`, `households.name`, `aisles.name` et `recipes.title`. Même
-- motif, même raison : un champ libre partagé par tout le foyer descend en base
-- (AD-1/AD-2), et le contrôle navigateur ne voit pas les appels REST directs.
--
-- La regex est **extraite par script** de `20260729095923:80`, jamais retapée.
-- ⚠️ Les `\uXXXX` qu'elle contient sont des échappées de l'analyseur d'EXPRESSIONS
-- RATIONNELLES de Postgres, pas de l'analyseur de chaînes — la lecture naïve est
-- plausible et fausse. Mesuré et démontré dans l'en-tête de `20260801124553`.
--
-- ── 3. `recipe_ingredients_quantite_positive` ─────────────────────────────────
--
-- Aucun critère de la story ne la demande, et c'est délibéré de l'ajouter quand
-- même : le critère du projet est « la valeur est-elle consommée par un CALCUL ? ».
-- C'est lui qui a valu sa contrainte à `recipes.servings` en story 3.1 et qui l'a
-- refusée aux temps de préparation et de cuisson, qui ne sont qu'affichés.
--
-- `quantity` est consommée : `coalesce(ri.quantity, 0) * (mpe.servings / r.servings)`
-- (`:544-547`). Une quantité négative produirait des quantités de courses négatives,
-- additionnées à celles des autres recettes par l'UPSERT-incrémente d'AD-6.
--
-- ⚠️ `>= 0` et non `> 0` : une quantité **nulle** n'a pas de sens mais n'est pas
-- dangereuse, et l'interdire refuserait une saisie transitoire sans rien protéger.
--
-- Aucune de ces trois ne change la forme du schéma : pas de régénération de types.

alter table recipe_ingredients
  add constraint recipe_ingredients_unite_fermee
  check (unit is null or unit in ('g', 'kg', 'ml', 'L', 'pièce', 'cs', 'cc', 'pincée'));

alter table recipe_ingredients
  add constraint recipe_ingredients_nom_non_vide
  check (
    regexp_replace(name, '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180E\u2800\u3164\uFE00-\uFE0F\uFFA0]', '', 'g') <> ''
  );

alter table recipe_ingredients
  add constraint recipe_ingredients_quantite_positive
  check (quantity is null or quantity >= 0);
