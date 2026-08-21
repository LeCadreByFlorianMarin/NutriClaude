-- Correctif isolé — arrêt de service anonyme, mesuré le 2026-08-20.
--
-- ⛔ CE QUE CETTE MIGRATION RÉPARE, ET POURQUOI CE N'EST PAS CE QU'ON CROYAIT.
--
-- Depuis le 2026-08-07, un test était sauté avec pour motif « chaque appel de
-- `generate_grocery_list_from_menu` fait tomber PostgreSQL en signal 11 ». Le fait
-- était juste, la cause attribuée était fausse : on l'imputait à l'agrégation de la
-- génération. Mesuré le 2026-08-20 avec témoins, sur Postgres 17.6 (image Supabase) :
--
--   fonction minimale `return 42`, EXECUTE révoqué, appelée par anon  →  segfault
--   idem en `sql` comme en `plpgsql`, en `definer` comme en `invoker` →  segfault
--   SELECT refusé sur une TABLE                                      →  erreur propre
--   fonction INEXISTANTE                                             →  erreur propre
--   fonction ACCORDÉE, même si elle lève une exception               →  erreur propre
--
-- Autrement dit : c'est le chemin d'erreur « permission denied for function » qui
-- crashe le serveur. Le corps de la fonction n'y est pour rien.
--
-- ⛔ D'OÙ LE RETOURNEMENT : la mitigation posée en revue de la 4.5 ÉTAIT le danger.
-- Révoquer `EXECUTE` en laissant la fonction dans `public` — donc exposée par
-- PostgREST — a transformé « un membre peut détourner la génération » en « n'importe
-- qui peut coucher la base ». Un seul POST anonyme suffit : ni compte, ni session, la
-- seule clé publiable, qui est publique par construction dans le bundle navigateur.
-- Reproduit délibérément deux fois, isolément, journal du conteneur à l'appui.
--
-- ⚠️ Et le vecteur est plus large que cette fonction : une fonction accordée aux seuls
-- MEMBRES crashe aussi la base quand un anonyme l'appelle (mesuré). L'état dangereux
-- n'est donc pas « révoquée pour tous » mais « pas exécutable par `anon` ».

-- ── REQUÊTE DE CONTRÔLE — à exécuter en PRODUCTION avant et après. ────────────
--
-- ⛔ ELLE EST EN LECTURE SEULE, ET CE N'EST PAS UN DÉTAIL DE STYLE. La seule façon
-- de « vérifier » le défaut en l'exerçant serait de faire tomber la base du foyer.
-- Cette requête interroge le catalogue ; elle n'appelle AUCUNE fonction.
--
--   select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fonction,
--          has_function_privilege('anon', p.oid, 'execute') as anon_peut_appeler
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind = 'f'
--     and not has_function_privilege('anon', p.oid, 'execute')
--   order by 1;
--
-- AVANT (attendu) : une ligne — generate_grocery_list_from_menu(...), anon_peut_appeler = f.
--                   C'est l'arrêt de service : cette ligne EST le vecteur.
-- APRÈS (attendu) : zéro ligne.
--
-- ⚠️ Si la requête AVANT rend zéro ligne en production, ne pas en conclure « rien à
-- faire » sans regarder pourquoi : soit la migration `20260805092611` n'y est pas
-- appliquée, soit la fonction y porte une autre signature. Les deux se lisent avec :
--
--   select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'generate_grocery_list_from_menu';

-- ── Volet 1 : rendre la génération INJOIGNABLE, pas « refusée ». ───────────────
--
-- On la SUPPRIME au lieu de durcir sa révocation, parce que révoquer davantage
-- aggraverait le défaut au lieu de le fermer. Aucun code produit ne l'appelle : elle
-- n'a jamais eu de point d'appel (constaté à la 4.1, revérifié le 2026-08-20 par
-- recherche sur tout le dépôt). La story 4.7 reconstruit la génération sur
-- `ajouter_article`, ACCORDÉE, dont la sûreté vient de la RLS et non d'un `revoke`.
--
-- `if exists` parce que la production et le stack local ne sont pas au même état, et
-- qu'une migration doit pouvoir s'appliquer aux deux.
drop function if exists public.generate_grocery_list_from_menu(date, date);

-- ── Volet 2 : la garde de fond, pour que l'état dangereux ne revienne pas. ─────
--
-- ⚠️ Ce qu'on garde n'est PAS « cette fonction-ci a disparu » — ce serait un test
-- d'énumération, et la prochaine révocation passerait sous la barrière. On garde le
-- PRÉDICAT : aucune fonction de `public` ne doit être injoignable à `anon`.
--
-- ⛔ Cette sonde est elle-même ACCORDÉE à `anon`. Ce n'est pas une négligence : une
-- sonde d'audit révoquée serait exactement l'état qu'elle dénonce, et se signalerait
-- elle-même — en couchant la base au passage. Elle ne divulgue d'ailleurs rien de
-- neuf : PostgREST publie déjà la liste des fonctions de `public` dans son OpenAPI.
create or replace function public.fonctions_publiques_sans_execute()
returns setof text
language sql
security invoker
stable
set search_path to 'public'
as $fonction$
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and not has_function_privilege('anon', p.oid, 'execute')
  order by 1;
$fonction$;

grant execute on function public.fonctions_publiques_sans_execute() to anon, authenticated, service_role;
