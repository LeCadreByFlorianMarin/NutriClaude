-- Accorde explicitement les privilèges de table aux rôles Supabase.
--
-- ⚠️ À CONTRÔLER AVANT `db push` — cette migration est *additive* et devrait
-- être un no-op sur la production, qui possède déjà ces privilèges. Exécuter
-- d'abord, dans le SQL Editor, pour le confirmer :
--
--   select grantee, privilege_type, count(*) as tables
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('anon','authenticated','service_role')
--     and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
--   group by grantee, privilege_type
--   order by grantee, privilege_type;
--
-- Attendu sur la production : les trois rôles × les quatre privilèges. Si la
-- requête rend beaucoup moins de lignes que prévu, ce n'est plus un no-op :
-- relire avant de pousser.
--
-- LE DÉFAUT
-- Aucune migration n'accordait de privilège de table. Le schéma s'en remettait
-- entièrement aux *privilèges par défaut* de Supabase — ce qui a fonctionné
-- pendant tout l'Epic 1 parce qu'il n'a jamais existé qu'un seul projet, créé à
-- une époque où le défaut était permissif.
--
-- Il ne l'est plus. Sur un stack `supabase start` monté le 2026-07-29, mesuré :
--
--   select defaclacl from pg_default_acl d join pg_namespace n
--     on n.oid = d.defaclnamespace
--    where n.nspname = 'public' and d.defaclobjtype = 'r';
--   -- {postgres=arwdDxtm/postgres, anon=Dxtm/postgres,
--   --  authenticated=Dxtm/postgres, service_role=Dxtm/postgres}
--
-- `Dxtm` = TRUNCATE, REFERENCES, TRIGGER. Ni SELECT, ni INSERT, ni UPDATE, ni
-- DELETE. Conséquence sur un environnement neuf : **chaque lecture et chaque
-- écriture directe rend `42501 permission denied`**, et la vue
-- `household_invites_valides` est illisible. Seules les fonctions `security
-- definer` répondent, parce que Postgres accorde `EXECUTE` à `public` par
-- défaut — ce qui masque le trou : l'inscription marche, et rien d'autre.
--
-- Autrement dit, la chaîne de migrations ne reproduisait pas la production.
-- Une branche Supabase, un nouveau projet, une restauration de sauvegarde, un
-- stack local : tous auraient rendu une application morte. Le défaut était
-- invisible tant qu'il n'existait qu'un environnement — c'est exactement ce que
-- l'ouverture d'un second environnement devait révéler, et c'est la première
-- chose qu'elle a révélée.
--
-- CE QUI EST ACCORDÉ, ET POURQUOI SI LARGE
-- On reproduit la forme qu'a *déjà* la production (`arwdDxtm` aux trois rôles),
-- et rien de plus. Restreindre `anon` au passage serait une bonne question —
-- toutes les politiques RLS exigent `auth.uid()`, donc `anon` est refusé par la
-- RLS de toute façon, et le grant ne lui ouvre rien — mais la trancher ici
-- rendrait le local *différent* de la production, ce qui est précisément le
-- défaut qu'on est en train de fermer. À rouvrir comme décision propre.
--
-- La RLS reste le seul mécanisme d'isolation. Un `grant` ouvre la porte de la
-- table ; c'est la politique qui décide des lignes. Les deux sont nécessaires.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Et pour tout ce que l'Epic 2 et les suivants créeront : sans ces trois
-- lignes, chaque nouvelle table rejouerait le même défaut en silence.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
