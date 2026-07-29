-- Une seule définition de « invitation valable », et une seule horloge.
--
-- LE DÉFAUT
-- `app/foyer/invitation.ts` réécrivait en TypeScript le prédicat que
-- `redeem_household_invite` applique déjà :
--
--   .gt("expires_at", maintenant.toISOString())   -- horloge Node, sur Vercel
--   .gt("uses_remaining", 0)
--
-- alors que la fonction de rachat évalue `expires_at < now()` et
-- `uses_remaining > 0` avec l'horloge Postgres. Deux écritures de la même règle,
-- deux horloges, et rien pour signaler qu'elles doivent rester d'accord.
--
-- La dérive NTP est négligeable ; le coût réel est ailleurs. Le jour où la
-- validité évoluera — un délai de grâce, une révocation, une règle de rachat —
-- l'écran continuerait d'afficher comme valable un code que la base refuse, ou
-- l'inverse. L'écart serait silencieux : ni `typecheck`, ni `lint`, ni CI ne le
-- verraient.
--
-- LE CORRECTIF
-- Une vue porte le prédicat, une fois. L'application ne garde que ce qui lui
-- appartient réellement : « laquelle montrer ? » — la plus récente — qui est
-- une règle de présentation, pas une règle métier. Plusieurs codes peuvent
-- coexister, c'est une décision produit assumée.
--
-- `security_invoker = true` : la vue s'exécute avec les droits de l'appelant,
-- donc la RLS de `household_invites` (`invites_select_own`, ancrée sur
-- `current_household_id()`) continue de s'appliquer entièrement. Sans ce
-- paramètre, une vue Postgres s'exécute avec les droits de son propriétaire et
-- contournerait l'isolation entre foyers — exactement ce que NFR-5 interdit.
--
-- Le précédent existe déjà dans ce schéma : `grocery_list_by_aisle`
-- (`20260502000000_initial_schema.sql`) est construite de la même façon.
--
-- Strictement additive : aucune table, aucune politique, aucune fonction
-- existante n'est touchée.

create or replace view household_invites_valides
with (security_invoker = true)
as
  select code, household_id, expires_at, uses_remaining, created_at
    from household_invites
   where expires_at > now()
     and uses_remaining > 0;

comment on view household_invites_valides is
  'Invitations encore utilisables. Prédicat unique, horloge Postgres — voir '
  'redeem_household_invite, qui doit rester d''accord avec cette définition.';
