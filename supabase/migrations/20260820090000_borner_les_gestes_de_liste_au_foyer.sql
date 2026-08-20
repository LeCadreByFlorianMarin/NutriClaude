-- Borne les trois gestes de liste au foyer de l'appelant, en plus de la RLS.
--
-- Revue de code de la story 4.5, décision D-1 de Florian (2026-08-19).
--
-- ⛔ **CE QUE CETTE MIGRATION CORRIGE, ET C'EST MESURÉ TROIS FOIS.** `20260817160000` a créé
-- `supprimer_article`, `archiver_les_achetes` et `vider_la_liste` sans le moindre filtre de foyer,
-- en s'en remettant entièrement à la RLS. Son en-tête l'écrivait comme une vertu :
-- « AUCUN FILTRE `household_id` À LA MAIN, NULLE PART. […] L'écrire ici laisserait croire que
-- c'est la fonction qui protège, ce qu'AD-1/AD-2 refusent. »
--
-- ⚠️ **CETTE PHRASE EST DATÉE PLUTÔT QU'EFFACÉE : elle confond deux choses.** AD-1 et AD-2
-- interdisent qu'une **surface applicative** se porte garante à la place de la base. Un `where`
-- dans une fonction SQL n'est pas une surface applicative — c'est la base elle-même, exactement
-- là où AD-1 veut que la règle vive.
--
-- **Ce que la mesure a montré** (revue du 2026-08-19, reproduite en triage) : la seule garde des
-- trois fonctions est `current_household_id() is null → raise`. Elle passe dès qu'un JWT porte un
-- `sub` connu, **quel que soit le rôle Postgres**. Or `service_role` porte `rolbypassrls = t` :
--
--     set local role service_role;
--     set local request.jwt.claims to '{"sub":"<membre du foyer A>"}';
--     select public.vider_la_liste();          -->  11
--
-- Le foyer A comptait 1 article ; la fonction en a tombstoné 11, ceux du foyer B. **Un foyer qui
-- range son panier vidait la liste d'un autre foyer**, sans erreur et sans trace.
--
-- ⚠️ **Atteignabilité au moment de la revue : NULLE, et c'est pourquoi ce n'est pas un correctif
-- d'urgence.** `grep -rn "SERVICE_ROLE" app lib proxy.ts` ne rend rien, et AD-2 interdit la clé de
-- service côté application. ⛔ **Mais c'est une mine posée pour les Epics 5 et 7** : le
-- `comment on function` de chacune promet « du foyer courant », et `lib/liste/suppression.ts` les
-- annonce comme « appelable telle quelle par le dashboard (Epic 5) et le serveur MCP (Epic 7) » —
-- précisément les surfaces qui portent une clé de service. Une story future aurait suivi une
-- promesse écrite et fausse.
--
-- ⚠️ **LA RLS RESTE LA GARANTE, ET CE FILTRE NE LA REMPLACE PAS.** Pour un appelant
-- `authenticated`, il ne change rien : la RLS a déjà borné les lignes visibles. Il n'existe que
-- pour le cas où la RLS est contournée — c'est une ceinture, et elle est nommée comme telle.
--
-- ⚠️ **`security invoker` est CONSERVÉ.** Le passer en `definer` aurait été le réflexe inverse et
-- le mauvais : une `definer` traverse la RLS et devrait alors recontrôler l'identité elle-même,
-- ce qui est le trou de `seed_default_aisles`.
--
-- ⚠️ À CONTRÔLER EN REVUE — cette migration ne touche ni colonne, ni contrainte, ni index, ni
-- politique : elle remplace trois corps de fonction. Elle ne peut pas échouer sur des données.
--
--   -- 1. AVANT : les trois fonctions existent-elles, et en `invoker` ? (attendu : 3 lignes, f)
--   select p.proname, p.prosecdef as definer
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('supprimer_article','archiver_les_achetes','vider_la_liste')
--    order by p.proname;
--
--   -- 2. APRÈS — le contrôle qui compte : un rôle qui CONTOURNE la RLS ne peut plus
--   --    toucher un autre foyer que celui du JWT. (attendu : 0 ligne touchée hors du foyer)
--   begin;
--     set local role service_role;
--     set local request.jwt.claims to '{"sub":"<un membre du foyer A>"}';
--     select public.vider_la_liste() as touchees;   -- doit valoir le compte du foyer A SEUL
--     select household_id, count(*) filter (where deleted_at is null) as vivants
--       from grocery_list_items group by household_id;
--   rollback;
--
--   -- 3. APRÈS — le chemin nominal n'a pas changé pour un membre ordinaire :
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims to '{"sub":"<un membre>","role":"authenticated"}';
--     select public.archiver_les_achetes();
--   rollback;

create or replace function public.supprimer_article(p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_foyer    uuid;
  v_touchees integer;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⚠️ **`household_id = v_foyer` est une CEINTURE, pas la garantie.** Pour un appelant
   * `authenticated`, la RLS a déjà écarté les lignes des autres foyers et ce prédicat ne
   * retire rien. Il n'existe que pour le rôle qui contourne la RLS — et sans lui, un `p_id`
   * appartenant à un autre foyer était tombstoné (mesuré le 2026-08-19).
   *
   * ⚠️ Le reste est inchangé : `deleted_at is null` rend le geste idempotent (NFR-2), et
   * `status` n'est pas touché — supprimer est distinct de cocher (FR-6).
   */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where id = p_id
     and household_id = v_foyer
     and deleted_at is null;

  get diagnostics v_touchees = row_count;
  return v_touchees;
end;
$$;

create or replace function public.archiver_les_achetes()
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_foyer    uuid;
  v_touchees integer;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /* `status` reste à `bought` : l'archivé porte les DEUX marques, ce qui le rend traçable (AC2). */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where household_id = v_foyer
     and status = 'bought'
     and deleted_at is null;

  get diagnostics v_touchees = row_count;
  return v_touchees;
end;
$$;

create or replace function public.vider_la_liste()
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_foyer    uuid;
  v_touchees integer;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /* Les deux statuts partent, aucun n'est réécrit : vider n'est pas déclarer tout acheté. */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where household_id = v_foyer
     and deleted_at is null;

  get diagnostics v_touchees = row_count;
  return v_touchees;
end;
$$;

/*
 * ⚠️ **Les `comment on function` sont RÉÉCRITS**, parce qu'ils promettaient « du foyer courant »
 * alors que la promesse était fausse sous un rôle contournant la RLS. Un commentaire qui affirme
 * une garantie inexistante est pire que pas de commentaire : c'est sur lui que la story suivante
 * s'appuie.
 */
comment on function public.supprimer_article is
  'Retire un article de la liste vivante du foyer courant par TOMBSTONE (deleted_at), jamais par '
  'DELETE — aucune politique RLS n''autorise le DELETE, qui rendrait 0 ligne sans erreur. Ne touche '
  'pas status : supprimer est distinct de cocher (FR-6, AD-3). Borne au foyer par la RLS ET par un '
  'prédicat explicite, ce dernier ne servant qu''aux rôles qui contournent la RLS. Rend le nombre '
  'de lignes touchées ; 0 si déjà supprimé (idempotent, NFR-2). security invoker.';

comment on function public.archiver_les_achetes is
  'Retire de la liste vivante tous les articles ACHETÉS du foyer courant, par tombstone. Le status '
  'reste ''bought'' : un archivé porte les deux marques, ce qui le rend traçable (FR-8). Borne au '
  'foyer par la RLS ET par un prédicat explicite. Rend le nombre d''articles archivés. security invoker.';

comment on function public.vider_la_liste is
  'Retire de la liste vivante TOUS les articles du foyer courant — à prendre comme achetés — par '
  'tombstone, sans DELETE dur (FR-8, AD-3). La confirmation exigée vit à l''écran. Borne au foyer '
  'par la RLS ET par un prédicat explicite. Rend le nombre d''articles retirés. security invoker.';
