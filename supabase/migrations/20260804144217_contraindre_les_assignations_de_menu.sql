-- Contraint les assignations de recettes au menu, et rend le nombre de personnes
-- réglable au niveau du foyer.
--
-- ⚠️ À CONTRÔLER EN REVUE, AVANT LA FUSION — trois des quatre volets ÉCHOUERONT si une
-- ligne existante les viole, et depuis le 2026-07-29 ils s'appliquent **pendant le
-- déploiement de production** (`vercel.json` → `scripts/migrer-au-deploiement.mjs`). Il n'y
-- a plus de `db push` humain, donc plus de moment pour sonder la base entre l'écriture et
-- l'application : le contrôle se fait en revue de PR, pas après. Exécuter dans le SQL
-- Editor :
--
--   -- 1. Doublons d'assignation (bloqueraient la contrainte unique du volet 1)
--   select household_id, meal_date, meal_type, recipe_id, count(*)
--     from meal_plan_entries
--    group by 1, 2, 3, 4 having count(*) > 1;
--
--   -- 2. Cases pointant la recette d'un AUTRE foyer (volet 2)
--   select m.id, m.household_id, r.household_id
--     from meal_plan_entries m join recipes r on r.id = m.recipe_id
--    where r.household_id <> m.household_id;
--
--   -- 3. Nombre de personnes non exploitable (volet 3)
--   select id, servings from meal_plan_entries where servings <= 0;
--
-- Attendu : **zéro ligne** aux trois, et c'est une DÉDUCTION, pas une mesure. Aucune
-- surface n'a jamais écrit dans `meal_plan_entries` : la story 3.5 est le premier écran de
-- cette table et elle ne fait que LIRE. Le stack local en rend 0 aux trois (mesuré le
-- 2026-08-04), ce qui ne prouve rien sur le distant — il est vide. **Si l'une des requêtes
-- rend des lignes, corriger les données avant de fusionner, et n'assouplir aucun volet
-- pour les accommoder.**
--
-- ⚠️ **LE VOLET 4 N'A RIEN À CONTRÔLER, ET C'EST ÉCRIT PLUTÔT QUE TU.** Ajouter une colonne
-- `not null` **avec valeur par défaut** ne peut pas échouer sur des données existantes
-- (`docs/migrations.md`, « autorisé sans précaution » : Postgres remplit les lignes
-- existantes avec le défaut). Inventer une requête pour faire nombre serait pire que son
-- absence — ce serait consigner un contrôle qui ne contrôle rien.
--
-- ⚠️ **UN SEUL FICHIER POUR QUATRE VOLETS, DÉLIBÉRÉMENT.** `supabase db push` n'est pas
-- atomique sur un LOT de fichiers : sur deux migrations dont la seconde échoue, la première
-- est appliquée et enregistrée. Les quatre volets servent la même story et se contrôlent par
-- la même requête ; les séparer multiplierait les points d'échec partiel sans rien gagner.
--
--
-- VOLET 1 — L'UNICITÉ D'ASSIGNATION (AD-6)
--
-- Le spine la prescrit mot pour mot : « `meal_plan_entries` porte
-- `unique(household_id, meal_date, meal_type, recipe_id)` (empêche le doublon
-- d'assignation) ». Elle manquait depuis le squelette du 2026-05-02.
--
-- ⚠️ **ELLE N'INTERDIT PAS LA PLURALITÉ, et c'est le contresens à ne pas faire.** Elle
-- interdit *la même recette deux fois dans la même case*. Elle laisse passer :
--   · deux recettes DIFFÉRENTES au même repas — « Soir : gratin + salade » est un menu
--     normal, et `casesDeLaSemaine` rend exprès une LISTE par case ;
--   · la même recette dans deux cases différentes — un plat cuisiné le dimanche et remangé
--     le mardi, qui est le cas d'usage central du batch-cooking.
-- Une contrainte sur `(household_id, meal_date, meal_type)` seul casserait les deux.
--
-- L'index unique qu'elle crée sert aussi les lectures par case.
--
--
-- VOLET 2 — LA PROVENANCE DE `recipe_id`
--
-- ⚠️ **LE TROU QU'IL FERME A ÉTÉ MESURÉ**, sonde à deux comptes réels sur le stack local le
-- 2026-08-04 (story 3.5) : A pouvait poser dans SON menu une case pointant une recette de B.
-- `meal_plan_all` ne contrôlait que `household_id` ; une contrainte de clé étrangère, elle,
-- s'applique sans égard pour la RLS. L'écriture étant client-direct (le membre possède sa
-- clé anon et son jeton), un `POST` PostgREST direct suffisait.
--
-- **Ce n'était PAS une fuite d'isolation** — NFR-5 tient, la RLS filtre bien la ressource
-- embarquée, et `supabase/tests/isolation.test.ts` le mesure. C'était un défaut d'INTÉGRITÉ
-- référentielle : un foyer pouvait se fabriquer une case qui ne s'afficherait jamais, et que
-- la génération de liste de l'Epic 4 traverserait sans rien y trouver.
--
-- ⚠️ **`alter policy` ne touche QUE le `with check`.** Le `using` d'`initial_schema.sql:317`
-- reste tel quel, et il ne faut pas le réécrire : la LECTURE n'est pas concernée. Une case
-- déjà posée en violation resterait donc lisible — c'est voulu, la requête de contrôle 2
-- existe pour qu'il n'y en ait aucune.
--
-- ⚠️ **L'ÉGALITÉ SUR `household_id` DANS LE SOUS-SELECT EST GARDÉE BIEN QUE REDONDANTE.**
-- Le sous-`select` subit la RLS de `recipes` (`recipes_all`), donc il ne verrait de toute
-- façon que les recettes du foyer courant. Elle est écrite quand même parce qu'elle dit ce
-- que la règle EXIGE, au lieu de dépendre d'une propriété d'une politique voisine que
-- personne ne mesure ici. C'est la règle §4 de `project-context.md` appliquée à du SQL : un
-- invariant entre deux endroits ne s'affirme pas.
--
-- ⚠️ **CE QUE CETTE FORME NE FAIT PAS, et c'est assumé** : une politique ne lie ni le rôle
-- de service ni une fonction `security definer`. C'est une frontière de RLS, pas une
-- contrainte. AD-2 interdisant `SUPABASE_SERVICE_KEY` côté application, le seul porteur est
-- le harnais d'isolation — délibérément, comme témoin négatif. **Si une surface future
-- traversait la RLS, cette prémisse se rouvrirait** (règle §5).
--
-- La forme alternative — une clé étrangère composite `(recipe_id, household_id)` vers
-- `recipes(id, household_id)` — a été ÉCARTÉE par Florian le 2026-08-04, et pas par
-- paresse : deux clés étrangères entre les deux mêmes tables rendent l'embarquement
-- PostgREST ambigu (`PGRST201`), donc `recipes(id, title)` de `casesDeLaSemaine` cesserait
-- de résoudre et la grille du menu casserait. Ce point est DÉDUIT de la documentation
-- PostgREST, non mesuré ici. Le motif retenu est celui de `recipe_ingredients_all`
-- (`initial_schema.sql:299-313`), qui ancre déjà son isolation par un `exists` sur une table
-- voisine.
--
--
-- VOLET 3 — UN NOMBRE DE PERSONNES EXPLOITABLE
--
-- `servings int not null default 2` accepte **0 et le négatif**, et la conséquence
-- n'apparaîtrait qu'à l'Epic 4. `generate_grocery_list_from_menu`
-- (`20260502000000:544-547`) calcule :
--
--   sum(coalesce(ri.quantity, 0) * (mpe.servings::numeric / nullif(r.servings, 0)))
--
-- ⚠️ **C'est le raisonnement de `20260801124553`, appliqué à l'AUTRE bout de la division.**
-- Cette migration-là a posé `recipes_servings_positif` sur le DÉNOMINATEUR. Ici c'est le
-- NUMÉRATEUR : un `servings` à 0 verse les ingrédients dans la liste de courses avec une
-- quantité nulle, sans erreur ni signal ; un `servings` négatif rend des quantités
-- **négatives**, qui s'additionneront à celles des autres recettes par l'UPSERT-incrémente
-- d'AD-6.
--
-- La story 3.6 est la PREMIÈRE à écrire cette colonne depuis une surface. C'est donc le seul
-- moment où la contrainte ne coûte rien — poser une contrainte sur une colonne déjà peuplée
-- par des saisies libres est ce que ce projet a déjà eu à faire deux fois.
--
-- `min={1}` sur un `<input type="number">` n'est pas une frontière : il se contourne dans
-- les outils de développement, et il n'existe pas du tout pour un appel REST direct.
-- AD-1/AD-2 : la règle métier vit en Postgres, jamais dans la vigilance d'une surface.
--
--
-- VOLET 4 — LE NOMBRE DE PERSONNES PAR DÉFAUT DU FOYER
--
-- Décision de Florian du 2026-08-04 : le nombre de personnes se règle **au niveau du
-- foyer**, puis s'ajuste **par assignation**.
--
--   households.default_servings   →  proposé à l'ouverture du formulaire d'assignation
--   meal_plan_entries.servings    →  ajusté à la main, case par case
--
-- ⚠️ **`default 2` N'EST PAS UN CHIFFRE NEUF** : c'est exactement le défaut que
-- `meal_plan_entries.servings` porte depuis le squelette du 2026-05-02. Le reprendre évite
-- d'introduire une seconde valeur arbitraire dans le produit.
--
-- ⚠️ **CE RÉGLAGE NE RÉÉCRIT AUCUNE ASSIGNATION EXISTANTE.** Il est lu au moment d'ouvrir un
-- formulaire, et nulle part ailleurs. Une case déjà posée garde son nombre — c'est ce que
-- l'AC3 de la story rend modifiable, une case à la fois.
--
-- ⚠️ **C'EST UN RÉGLAGE DE FOYER, PAS DE MEMBRE.** AD-16 : le foyer est symétrique, et
-- `profiles` n'a aucune colonne de rôle. Le changer change ce que voit l'autre membre.
--
-- ⚠️ **AUCUNE POLITIQUE RLS N'EST DUE POUR CETTE COLONNE.** `households_update`
-- (`initial_schema.sql:250-251`) existe depuis le squelette et porte
-- `using (id = current_household_id())` ; une politique RLS s'applique par LIGNE, pas par
-- colonne. `supabase/tests/isolation.test.ts:214-223` l'éprouve déjà avec deux comptes
-- réels — il n'y a rien à ajouter, et un test de plus serait de la redondance.
--
-- ⚠️ **CETTE MIGRATION CHANGE LA FORME DU SCHÉMA** — contrairement aux trois autres volets,
-- qui n'ajoutent que des contraintes. `lib/supabase/types.ts` est régénéré dans le même
-- commit (`npx supabase gen types typescript --local`, après `npx supabase db reset`).
-- ⚠️ `--local` et non `--linked` : le distant n'a pas encore la migration au moment où l'on
-- génère.
--
-- Aucune fonction n'est créée ni remplacée : le compte de `docs/migrations.md` est inchangé.

-- Volet 1 — l'unicité d'assignation (AD-6)
alter table meal_plan_entries
  add constraint meal_plan_entries_assignation_unique
  unique (household_id, meal_date, meal_type, recipe_id);

-- Volet 2 — la recette assignée doit appartenir au foyer courant
alter policy meal_plan_all on meal_plan_entries
  with check (
    household_id = current_household_id()
    and exists (
      select 1 from recipes r
      where r.id = meal_plan_entries.recipe_id
        and r.household_id = current_household_id()
    )
  );

-- Volet 3 — un nombre de personnes exploitable par la mise à l'échelle
alter table meal_plan_entries
  add constraint meal_plan_entries_servings_positif
  check (servings > 0);

-- Volet 4 — le nombre de personnes par défaut du foyer
alter table households
  add column default_servings int not null default 2;

alter table households
  add constraint households_default_servings_positif
  check (default_servings > 0);
