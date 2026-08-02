-- Réordonner le parcours magasin en une seule transaction.
--
-- ⚠️ REQUÊTE DE CONTRÔLE — à exécuter EN REVUE, avant la fusion.
-- Il n'y a plus de `db push` manuel : fusionner cette PR applique la migration
-- (`vercel.json` → `scripts/migrer-au-deploiement.mjs`). Cette revue est donc le
-- dernier contrôle humain avant la production.
--
--   -- 1) La fonction ne doit pas déjà exister. Attendu : 0 ligne.
--   --    Une ligne signifierait que `create or replace` remplace quelque chose
--   --    que personne n'a lu.
--   select proname, pronargs, prosecdef from pg_proc where proname = 'reorder_aisles';
--
--   -- 2) Informatif, et sans effet bloquant : y a-t-il déjà des ex æquo de
--   --    position en production ? Attendu : 0 ligne. Un résultat non vide ne
--   --    bloque rien — cette fonction les résorbe au premier déplacement — mais
--   --    il informe la décision « pas de contrainte d'unicité » (story 2.2, D3).
--   select household_id, sort_order, count(*) from aisles
--    group by 1, 2 having count(*) > 1;
--
--
-- POURQUOI UNE FONCTION, ET PAS DES `update` DEPUIS LE NAVIGATEUR
--
-- L'AC2 de la story 2.2 exige que l'ordre reste cohérent : « positions uniques,
-- aucun rayon perdu ou dupliqué ». C'est un invariant qui porte sur PLUSIEURS
-- LIGNES À LA FOIS. Onze `update` HTTP successifs depuis le navigateur ne sont
-- pas atomiques : une coupure au sixième laisse un parcours à moitié renuméroté,
-- avec des ex æquo et un ordre que personne n'a demandé. AD-1/AD-2 : la règle
-- métier vit en Postgres, jamais dans la vigilance d'une surface.
--
-- Ce n'est pas une entorse à AD-13, qui arbitre Server Action contre
-- client-direct : l'appel RPC part bien du navigateur. Ce qui change, c'est où
-- vit la transaction, pas qui l'émet.
--
--
-- ⚠️⚠️ POURQUOI ELLE N'EST **PAS** `security definer`
--
-- `seed_default_aisles` l'était, recevait le foyer EN PARAMÈTRE et ne le
-- confrontait à rien : le foyer A pouvait écrire onze rayons chez B (mesuré le
-- 2026-07-29, refermé par `20260729095922_guard_seed_default_aisles.sql`).
--
-- Ici, il n'y a AUCUNE identité en paramètre — seulement des identifiants de
-- rayons. C'est la RLS (`aisles_all`, `using` ET `with check`) qui décide
-- lesquels sont atteignables, et le `count(*)` de la garde 3 ne voit lui aussi
-- que le foyer de l'appelant. Poser `security definer` ici contournerait la RLS
-- et rouvrirait exactement le trou que la story 2.1 a refermé.
--
-- Corollaire non évident, et c'est la raison d'être de la garde 4 : sous RLS, un
-- `update` qui vise une ligne masquée ne rend AUCUNE erreur. Il ne touche
-- simplement rien. Sans comptage des lignes affectées, un appel forgé portant
-- onze identifiants étrangers RÉUSSIRAIT en n'ayant rien déplacé, et l'écran
-- afficherait « C'est noté. ». C'est « lire `data` autant qu'`error` » du client
-- PostgREST, transposé au SQL.
--
-- Aucun `grant execute` : `20260729094500_grant_table_privileges.sql` pose
-- `alter default privileges … grant all on functions`, qui couvre les fonctions
-- créées ensuite. Que `authenticated` l'exécute est prouvé par le test
-- d'isolation du chemin légitime, pas affirmé ici.

create or replace function reorder_aisles(p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  v_attendu int;
  v_touches int;
begin
  -- Garde 1 — rien à ordonner.
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Aucun rayon à ordonner';
  end if;

  -- Garde 2 — un rayon cité deux fois occuperait deux positions.
  if array_length(p_ids, 1) <> (select count(distinct id) from unnest(p_ids) as t(id)) then
    raise exception 'Un rayon est cité deux fois';
  end if;

  -- Garde 3 — le tableau doit couvrir TOUT le parcours. Un renumérotage partiel
  -- laisserait les rayons omis à leur ancienne position et créerait des ex æquo,
  -- ce que l'AC2 interdit. Sous RLS, ce `count` ne voit que le foyer de
  -- l'appelant : c'est ce qui rend la comparaison sûre sans jamais nommer un
  -- `household_id`.
  select count(*) into v_attendu from aisles;

  if array_length(p_ids, 1) <> v_attendu then
    raise exception 'La liste des rayons a changé (% cités, % en base)',
      array_length(p_ids, 1), v_attendu;
  end if;

  -- Le pas de 10 est celui du jeu amorcé par `seed_default_aisles`, et il laisse
  -- de la place pour insérer à la main entre deux rayons. Renuméroter TOUT le
  -- parcours plutôt qu'échanger deux valeurs est ce qui rend les positions
  -- uniques (AC2) : l'échange est un no-op quand les deux valeurs sont égales,
  -- et `sort_order` n'a aucune contrainte d'unicité — son défaut vaut 100, déjà
  -- pris par « Hygiène & Entretien ».
  update aisles a
     set sort_order = t.rang * 10
    from unnest(p_ids) with ordinality as t(id, rang)
   where a.id = t.id;

  -- Garde 4 — voir l'en-tête. C'est la seule qui attrape un appel forgé dont le
  -- cardinal est correct mais dont les identifiants appartiennent à un autre
  -- foyer : les gardes 1 à 3 le laissent passer.
  get diagnostics v_touches = row_count;

  if v_touches <> array_length(p_ids, 1) then
    raise exception 'La liste des rayons a changé (% déplacés sur %)',
      v_touches, array_length(p_ids, 1);
  end if;
end;
$$;

comment on function reorder_aisles(uuid[]) is
  'Renumérote tout le parcours du foyer appelant selon l''ordre du tableau reçu '
  '(pas de 10). SECURITY INVOKER : la RLS filtre les lignes atteignables, et le '
  'comptage des lignes affectées refuse tout tableau qui ne couvre pas '
  'exactement le parcours de l''appelant.';
