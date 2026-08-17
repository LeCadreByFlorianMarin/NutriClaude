-- Élargit `grocery_list_by_aisle` aux articles ACHETÉS — la vue ne filtre plus `status`.
--
-- Story 4.3, décision D1 option (a). FR-3 (« les articles achetés restent consultables et
-- récupérables »), AD-4 (toggle idempotent), AC1 et AC3 de la story.
--
-- ⛔ **POURQUOI CETTE MIGRATION EXISTE, ET C'EST MESURÉ.** La vue portait
-- `where g.status = 'pending'` depuis la 4.1. Mesuré le 2026-08-12 sur le stack local :
--
--     insert … status = 'pending'  →  select count(*) from grocery_list_by_aisle  →  1
--     update … set status = 'bought' →  select count(*) from grocery_list_by_aisle  →  0
--
-- Autrement dit : **cocher un article le faisait disparaître de la seule surface de lecture du
-- produit.** L'AC1 exige que décocher fonctionne « dans les deux sens » — on ne décoche pas ce
-- qu'on ne voit plus — et l'AC3 exige que l'article acheté reste consultable. Les deux étaient
-- inatteignables sans cette migration.
--
-- ⚠️ **LE CHANGEMENT EST ADDITIF, ET C'EST CE QUI LE REND SÛR.** La vue rend des lignes de PLUS,
-- jamais des colonnes de moins ni des colonnes renommées. Aucun consommateur ne casse ; ceux qui
-- ne veulent que les articles à prendre filtrent sur `status`, qui a toujours été dans la
-- projection (`20260805092611:617`). Mesuré : `articlesDuFoyer` est le SEUL appelant applicatif
-- de cette vue (`git grep grocery_list_by_aisle` → `lib/liste/liste.ts` + les tests d'isolation).
--
-- ⚠️ **L'`ORDER BY` NE CHANGE PAS, ET C'EST DÉLIBÉRÉ.** Le regroupement des articles cochés en bas
-- de leur rayon (`separateur-panier`, DESIGN.md:283) est un tri d'AFFICHAGE. Le poser ici
-- l'imposerait au dashboard (Epic 5) et au serveur MCP (Epic 7), qui n'en veulent pas
-- nécessairement — et l'AC3 de la story 2.4 interdit à la couche de présentation de décider pour
-- les autres surfaces. La vue dit le parcours magasin ; l'écran dit ce qu'il fait des cochés.
--
-- ⚠️ **`security_invoker = true` est CONSERVÉ.** C'est lui qui fait que la RLS de l'invocateur
-- s'applique : l'élargir sans lui transformerait cette vue en fuite inter-foyers. Il est réécrit
-- explicitement ci-dessous plutôt que supposé hérité — `create or replace view` ne conserve PAS
-- les options si on ne les redonne pas.
--
-- ⚠️ **`deleted_at is null` RESTE.** Un tombstone n'est pas un article acheté (AD-3) : la
-- suppression est la story 4.5, et confondre les deux rendrait un article supprimé « récupérable »,
-- ce que FR-6 distingue nommément du cochage.
--
-- ⚠️ À CONTRÔLER EN REVUE — cette migration ne peut pas échouer sur des données (elle ne touche
-- aucune contrainte, aucune colonne, aucun index), mais son EFFET se mesure. Les migrations
-- s'appliquent pendant le déploiement de production (`vercel.json` →
-- `scripts/migrer-au-deploiement.mjs`) : il n'y a plus de moment humain entre l'approbation et
-- l'écriture.
--
--   -- 0. Le contexte : combien d'articles achetés vont devenir visibles en production ?
--   --    Un nombre élevé n'est pas un problème — c'est ce que FR-3 demande — mais il faut le
--   --    savoir AVANT, parce que ces lignes vont apparaître à l'écran au premier chargement.
--   select count(*) as total,
--          count(*) filter (where status = 'bought' and deleted_at is null) as achetes_visibles,
--          count(*) filter (where status = 'pending' and deleted_at is null) as a_prendre
--     from grocery_list_items;
--
--   -- 1. L'état AVANT : la vue filtre-t-elle encore ? (attendu : le `where` porte `status`)
--   select pg_get_viewdef('public.grocery_list_by_aisle'::regclass, true);
--
--   -- 2. `security_invoker` est-il bien posé AVANT ? (attendu : 'true' — on le reconduit)
--   select c.relname, c.reloptions
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname = 'grocery_list_by_aisle';
--
--   -- 3. APRÈS l'application, le contrôle qui compte : un article acheté ressort-il ?
--   --    (attendu : la vue rend autant de lignes que la table, tombstones exclus)
--   select (select count(*) from grocery_list_by_aisle) as via_vue,
--          (select count(*) from grocery_list_items where deleted_at is null) as via_table;

create or replace view grocery_list_by_aisle
  with (security_invoker = true) as
  select
    g.id, g.household_id, g.name, g.quantity, g.unit, g.product_id,
    g.aisle_id, g.recipe_id, g.added_by, g.status, g.created_at,
    a.name       as aisle_name,
    a.icon       as aisle_icon,
    a.sort_order as aisle_sort,
    g.actor_kind, g.actor_id, g.source_ref,
    g.intent_at, g.updated_at, g.deleted_at
  from grocery_list_items g
  left join aisles a on g.aisle_id = a.id
  where g.deleted_at is null
  order by coalesce(a.sort_order, 9999), g.name;

comment on view grocery_list_by_aisle is
  'La liste vivante du foyer, rayon joint, dans l''ordre du parcours magasin. '
  'Rend les articles À PRENDRE et ACHETÉS (story 4.3, FR-3) — les tombstones restent exclus. '
  'Le tri des achetés en bas de leur rayon est un choix d''AFFICHAGE, pas de contrat : '
  'il vit dans lib/liste/groupement.ts, pas ici.';
