-- Supprime la fenêtre de course sur `redeem_household_invite`.
--
-- LE DÉFAUT
-- La fonction lisait `uses_remaining` puis, plus loin, le décrémentait :
--
--   select household_id, uses_remaining, expires_at into ... from household_invites
--   ...
--   if v_uses_left <= 0 then raise exception 'Invite has no uses remaining'; end if;
--   insert into profiles ...
--   update household_invites set uses_remaining = uses_remaining - 1 where code = p_code;
--
-- Aucun verrou entre la lecture et l'écriture. Un code posté dans une
-- conversation de famille et tapé par trois personnes dans la même seconde :
-- les trois lisent `uses_remaining = 1`, les trois passent le contrôle, les
-- trois insèrent leur profil, et le compteur atterrit à -2. Un code que son
-- émetteur croyait à usage unique a fait entrer trois membres.
--
-- LE CORRECTIF
-- Le contrôle et le décrément deviennent une seule instruction atomique :
-- `update ... where uses_remaining > 0 returning household_id`. Postgres
-- verrouille la ligne pour la durée de l'update, donc deux transactions
-- concurrentes s'exécutent l'une après l'autre — et la seconde ne trouve plus
-- de ligne satisfaisant la clause. Plus fiable qu'un `select ... for update`
-- ajouté en amont, parce qu'il n'y a plus deux endroits à garder cohérents.
--
-- La distinction des trois refus est conservée : le code inexistant, le code
-- expiré et le code épuisé lèvent toujours trois exceptions différentes, dans
-- cet ordre — l'interface s'appuie dessus pour ses messages.
--
-- `create or replace function` écrase la version en place (docs/migrations.md).
-- La signature, le type de retour et les messages d'exception sont identiques :
-- aucun appelant n'a à changer.

create or replace function redeem_household_invite(
  p_code         text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_expires_at   timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_user_id) then
    raise exception 'Profile already exists';
  end if;

  -- Existence et expiration d'abord : ce sont des refus définitifs, et ils
  -- doivent rester distincts de « plus d'usages » pour l'écran d'inscription.
  select expires_at into v_expires_at
    from household_invites where code = p_code;

  if v_expires_at is null then
    raise exception 'Invalid invite code';
  end if;
  if v_expires_at < now() then
    raise exception 'Invite expired';
  end if;

  -- Contrôle et décrément en une seule instruction : c'est ici que la course
  -- se ferme. Si deux appels concurrents visent le dernier usage, le second ne
  -- trouve aucune ligne et repart en exception plutôt qu'en membre supplémentaire.
  update household_invites
     set uses_remaining = uses_remaining - 1
   where code = p_code
     and uses_remaining > 0
  returning household_id into v_household_id;

  if v_household_id is null then
    raise exception 'Invite has no uses remaining';
  end if;

  insert into profiles (id, household_id, display_name)
    values (v_user_id, v_household_id, p_display_name);

  return v_household_id;
end;
$$;
