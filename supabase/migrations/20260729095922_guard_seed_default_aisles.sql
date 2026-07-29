-- Referme un chemin d'écriture inter-foyers dans `seed_default_aisles`.
--
-- ⚠️ À CONTRÔLER AVANT `db push` — cette migration remplace une fonction
-- existante. Confirmer d'abord, dans le SQL Editor, que c'est bien la version
-- du squelette qui tourne, et qu'elle est `security definer` :
--
--   select prosecdef, pg_get_functiondef(oid)
--   from pg_proc
--   where proname = 'seed_default_aisles';
--
-- Attendu : `prosecdef = t`, et un corps identique à celui de
-- `20260502000000_initial_schema.sql:330-351` — mêmes 11 rayons, mêmes
-- `sort_order`, mêmes emojis. Si le corps diffère, quelqu'un l'a modifiée
-- entre-temps : relire avant de pousser, sous peine d'écraser ce changement.
--
-- LE DÉFAUT
-- `seed_default_aisles(p_household_id uuid)` est `security definer` : elle
-- s'exécute avec les droits de son propriétaire, donc la RLS ne s'y applique
-- pas. Or elle reçoit le foyer **en paramètre** et ne le confronte à rien.
-- Elle est exposée en RPC PostgREST, et `20260729094500_grant_table_privileges`
-- accorde `execute` à `authenticated`.
--
-- Conséquence, mesurée le 2026-07-29 sur le stack local avec deux comptes :
-- le membre du foyer A appelle la fonction en passant l'identifiant du foyer B,
-- et les 11 rayons sont insérés **chez B**. C'est une écriture inter-foyers,
-- c'est-à-dire exactement ce que NFR-5 interdit.
--
-- La RLS n'est pas en cause et n'avait pas à l'être : `aisles_all` porte
-- `using` **et** `with check`, et le même compte se voit refuser un `insert`
-- direct dans les rayons de B en `42501`. C'est `security definer` qui la
-- contourne — par conception. D'où la règle générale que ce correctif
-- applique : une fonction `security definer` qui reçoit une identité en
-- paramètre doit la recontrôler elle-même, sans quoi le paramètre est une
-- porte.
--
-- Le défaut est antérieur à l'Epic 2 et vit en production depuis le squelette.
-- Il était sans portée tant qu'aucune surface n'appelait la fonction ; la
-- story 2.1 est la première à le faire (bouton « Remettre les rayons de
-- départ »), donc celle qui doit le refermer d'abord.
--
-- LE CORRECTIF
-- Une garde d'identité en tête de fonction. La signature ne change pas : aucun
-- appelant à retoucher, aucun type à régénérer, et `create_household_with_profile`
-- continue de fonctionner — elle insère la ligne `profiles` AVANT son
-- `perform seed_default_aisles(...)`, dans la même transaction, si bien que
-- `current_household_id()` voit déjà le nouveau foyer. Vérifié par exécution,
-- pas déduit : inscription complète, 11 rayons amorcés.
--
-- POURQUOI PAS UN `revoke execute` + UNE FONCTION ENVELOPPE
-- C'est la variante qu'on écrit d'instinct, et elle a été essayée : elle casse
-- PostgREST. L'appel refusé ne rend pas un `42501` propre mais
-- `PGRST001 Database client error`, et les requêtes suivantes tombent sur
-- « Could not query the database for the schema cache ». Reproduit trois fois,
-- y compris après `notify pgrst, 'reload schema'` et redémarrage du conteneur.
--
-- Le corps ci-dessous est recopié à l'identique depuis la migration initiale.
-- Toute divergence dans les noms, l'ordre ou les emojis serait une régression
-- silencieuse : c'est ce jeu-là que tout foyer existant possède déjà, et
-- `on conflict (household_id, name) do nothing` compare sur le nom.

create or replace function seed_default_aisles(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La garde. `is distinct from` et non `<>` : `current_household_id()` rend
  -- NULL pour un appelant sans profil (visiteur anonyme, identité d'appareil de
  -- l'Epic 5), et `NULL <> NULL` vaut NULL — le refus ne se déclencherait pas.
  if p_household_id is null
     or p_household_id is distinct from current_household_id() then
    raise exception 'Not your household';
  end if;

  insert into aisles (household_id, name, sort_order, icon) values
    (p_household_id, 'Fruits & Légumes',     10, '🥬'),
    (p_household_id, 'Boucherie',            20, '🥩'),
    (p_household_id, 'Poissonnerie',         30, '🐟'),
    (p_household_id, 'Crémerie',             40, '🧀'),
    (p_household_id, 'Boulangerie',          50, '🥖'),
    (p_household_id, 'Épicerie sèche',       60, '🌾'),
    (p_household_id, 'Conserves',            70, '🥫'),
    (p_household_id, 'Surgelés',             80, '🧊'),
    (p_household_id, 'Boissons',             90, '🥤'),
    (p_household_id, 'Hygiène & Entretien', 100, '🧴'),
    (p_household_id, 'Autre',               999, '📦')
  on conflict (household_id, name) do nothing;
end;
$$;
