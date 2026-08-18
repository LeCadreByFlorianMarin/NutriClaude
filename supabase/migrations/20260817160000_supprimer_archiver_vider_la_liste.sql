-- Supprimer un article, archiver les achetés, vider la liste — par tombstone, jamais par DELETE.
--
-- Story 4.5. AD-3 (tombstone, LWW par champ), AD-1/AD-2 (la règle vit en Postgres), AD-13,
-- FR-6 (supprimer est distinct de cocher), FR-8 (archivage et vidage avec confirmation).
--
-- ⛔ **POURQUOI DES FONCTIONS PLUTÔT QU'UN `.update()` CLIENT — ET CE N'EST PAS UNE PRÉFÉRENCE.**
-- Ces trois gestes écrivent `deleted_at`, c'est-à-dire **le champ que la story 4.10 arbitre**.
-- L'écrire depuis le navigateur le daterait à l'horloge du CLIENT, alors que l'insertion et
-- `ajouter_article` le datent à celle du SERVEUR. **Mesuré le 2026-08-16** : le conteneur
-- Postgres est **+0,740 s en avance** sur l'hôte. Le défaut `intent_at` est ouvert et daté
-- (à trancher avant la 4.10) ; cette migration ne l'élargit pas à un troisième chemin d'écriture.
-- `now()` dans une fonction SQL est l'horloge serveur, la même qu'à l'insertion.
--
-- ⚠️ **`security invoker` — JAMAIS `definer`.** La RLS de l'appelant s'applique intégralement :
-- `grocery_update` (ancrée sur `current_household_id()`) reste seule garante. Une `definer`
-- devrait recontrôler l'identité elle-même — c'est le trou de `seed_default_aisles`. Mesuré le
-- 2026-08-17 : un archivage en masse `where status = 'bought'` sans le moindre filtre de foyer
-- ne touche déjà que les lignes de l'appelant (2 lignes du foyer A, foyer B jamais vu).
--
-- ⛔ **AUCUNE POLITIQUE `for delete` N'EST CRÉÉE ICI, ET C'EST LE POINT.** Le volet 6 de
-- `20260805092611` s'intitule « la RLS, et le DELETE qui disparaît » : il a remplacé
-- `grocery_all` par `select` / `insert` / `update`. **Mesuré le 2026-08-17**, et c'est le fait le
-- plus contre-intuitif de cette story :
--
--     -- privilège de table DELETE : ACCORDÉ à authenticated (20260729094500)
--     -- politique RLS for delete  : AUCUNE
--     delete from grocery_list_items where name = '…';   →   DELETE 0, AUCUNE ERREUR
--
-- Postgres ne refuse pas : il ne voit aucune ligne. Côté client, PostgREST rendrait donc
-- `error: null` sur une suppression qui n'a rien supprimé — un écran optimiste montrerait
-- l'article disparu, et il **reviendrait au chargement suivant**, sans qu'aucune porte ni aucun
-- journal ne le dise. Le DELETE dur doit rester impossible : c'est AD-3.
--
-- ⛔ **`bought` + tombstone N'EST PAS UNE INCOHÉRENCE À CONTRAINDRE — C'EST L'ARCHIVAGE.**
-- `deferred-work.md` signale que « `(status, deleted_at)` n'est contraint par rien », et c'est
-- vrai (mesuré : les deux ensemble sont acceptés). ⚠️ **Ne pas « réparer » ce point** : un
-- archivé est précisément un article `bought` **et** tombstoné, ce qui le distingue d'une
-- suppression pure (`pending` + tombstone). C'est ce qui rend l'AC2 traçable — « retirés de la
-- liste active tout en restant traçables ». Une contrainte d'exclusion casserait l'AC2.
--
-- ⚠️ **L'IDEMPOTENCE PASSE PAR `deleted_at is null` DANS LE `where`.** Supprimer deux fois, ou
-- supprimer un article qu'un autre membre vient de supprimer, rend **0** et non une erreur —
-- `EXPERIENCE.md:122` l'exige (« supprimer un article coché ailleurs n'est jamais une erreur ni
-- un arbitrage demandé »). Le premier tombstone garde son intention : la réécrire ferait reculer
-- l'arbitre du LWW à chaque geste répété.
--
-- ⚠️ À CONTRÔLER EN REVUE — le volet 1 ÉCHOUERA si une ligne porte déjà un `deleted_at` lointain,
-- et les migrations s'appliquent **pendant le déploiement de production** (`vercel.json` →
-- `scripts/migrer-au-deploiement.mjs`). Il n'y a plus de moment humain entre l'approbation et
-- l'écriture.
--
--   -- 0. Le contexte : une ligne violerait-elle la borne haute ? (`violeraient` DOIT valoir 0,
--   --    sinon le volet 1 échoue et le déploiement s'arrête)
--   select count(*) as total,
--          count(*) filter (where deleted_at is not null) as tombstones,
--          count(*) filter (where deleted_at > now() + interval '1 day') as violeraient
--     from grocery_list_items;
--
--   -- 1. Le DELETE dur est-il bien sans politique ? (attendu : select, insert, update — et RIEN
--   --    d'autre. Si une politique `for delete` apparaît un jour, AD-3 est en danger)
--   select policyname, cmd from pg_policies
--    where tablename = 'grocery_list_items' order by cmd;
--
--   -- 2. La signature EXACTE d'ajouter_article, que le volet 3 remplace :
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'ajouter_article';
--
--   -- 3. APRÈS application — le correctif de quantité du volet 3 tient-il ?
--   --    (attendu : 10 archivées puis 4 réajoutées rendent 4, PAS 14)
--   begin;
--   select public.ajouter_article('Sonde45', 10, 'pièce');
--   update grocery_list_items set status = 'bought' where name = 'Sonde45';
--   select public.archiver_les_achetes();
--   select public.ajouter_article('Sonde45', 4, 'pièce');
--   select quantity, status, deleted_at from grocery_list_items where name = 'Sonde45';
--   rollback;
--
--   -- 4. APRÈS application — l'agrégation NORMALE (hors tombstone) additionne toujours ?
--   --    (attendu : UNE ligne, quantité 3 — c'est le contrôle n°3 de 20260816180000, REJOUÉ
--   --     parce que le volet 3 réécrit la fonction qui le promettait)
--   begin;
--   select public.ajouter_article('Sonde45b', 1, 'kg');
--   select public.ajouter_article('sonde45b', 2, 'kg');
--   select count(*), sum(quantity) from grocery_list_items where name ilike 'sonde45b';
--   rollback;

-- ═══ Volet 1 — un tombstone ne se date pas dans le futur ════════════════════════════════════
--
-- Report daté de la revue de la 4.1 (« la 4.5 possède le chemin d'écriture du tombstone »), que
-- la 4.4 a explicitement laissé ouvert : « elle ne borne pas par le haut. Un `deleted_at` dans le
-- futur reste accepté, et la question appartient à la 4.5 et à la 4.10. » Cette story pose le
-- chemin d'écriture : elle tranche.
--
-- **Mesuré le 2026-08-17** : `deleted_at = now() + 100 ans` est accepté aujourd'hui. ⛔ La
-- conséquence n'est pas cosmétique — la vue teste `deleted_at is null`, jamais `deleted_at <=
-- now()`, donc un tombstone de 2999 fait disparaître la ligne **immédiatement** ET gagnerait
-- **tout** arbitrage LWW (AD-3) à jamais. Une intention forgée ou une horloge folle deviendrait
-- irrattrapable.
--
-- ⚠️ **La tolérance d'un jour n'est pas de la prudence, c'est la symétrie.** La borne basse
-- (`grocery_list_items_tombstone_posterieur`, 4.4) l'emploie, et
-- `grocery_list_items_intention_bornee` avant elle, avec cette raison écrite : « la borne est
-- volontairement GÉNÉREUSE (un jour) pour qu'une horloge d'appareil légèrement en avance ne soit
-- jamais refusée ». Un téléphone en avance de deux minutes doit pouvoir supprimer.
--
-- ⚠️ **`now()` dans un `check` est accepté sur ce schéma, et c'est MESURÉ, pas supposé** :
-- `grocery_list_items_intention_bornee` en contient un (`intent_at <= now() + '1 day'`). La
-- contrainte n'est évaluée qu'à l'écriture — elle ne réécrit aucune ligne existante.
alter table grocery_list_items
  add constraint grocery_list_items_tombstone_borne_haute
  check (deleted_at is null or deleted_at <= now() + interval '1 day');

-- ═══ Volet 2 — les trois gestes ════════════════════════════════════════════════════════════
--
-- ⚠️ **AUCUN FILTRE `household_id` À LA MAIN, NULLE PART.** La politique `grocery_update` est
-- ancrée sur `current_household_id()` en `using` ET en `with check`. L'écrire ici laisserait
-- croire que c'est la fonction qui protège, ce qu'AD-1/AD-2 refusent — et ferait de la RLS une
-- ceinture qu'on croit doublée alors qu'elle est seule.
--
-- ⚠️ **Les trois rendent le NOMBRE DE LIGNES TOUCHÉES**, jamais `void`. L'écran doit pouvoir dire
-- « 3 articles rangés » — un geste de masse qui ne dit pas ce qu'il a fait laisse le membre
-- vérifier à l'œil sur trente lignes.
--
-- ⚠️ **`raise` quand il n'y a pas de foyer, plutôt que 0 en silence.** Sans session,
-- `current_household_id()` rend `null` et l'UPDATE toucherait 0 ligne — indiscernable d'une liste
-- déjà vide. Motif d'`ajouter_article`.

create or replace function public.supprimer_article(p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_touchees integer;
begin
  if public.current_household_id() is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⛔ **UN `UPDATE`, PAS UN `DELETE` — c'est tout AD-3.** Et ce n'est pas une préférence de
   * style : aucune politique RLS n'autorise le DELETE, donc un `delete` rendrait 0 ligne
   * SANS erreur (mesuré). Le tombstone est le seul chemin qui existe.
   *
   * ⚠️ `deleted_at is null` rend le geste IDEMPOTENT : supprimer un article déjà supprimé
   * ailleurs rend 0, pas une erreur (NFR-2, EXPERIENCE.md:122), et n'écrase pas l'intention
   * du premier tombstone — l'arbitre du LWW ne doit pas reculer à chaque geste répété.
   *
   * ⚠️ **`status` N'EST PAS TOUCHÉ, ET C'EST FR-6.** Supprimer est distinct de cocher : un
   * article supprimé alors qu'il était `pending` reste `pending`, un archivé reste `bought`.
   * C'est cette différence qui rend l'archivage traçable.
   */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where id = p_id and deleted_at is null;

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
  v_touchees integer;
begin
  if public.current_household_id() is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⚠️ **`status` reste à `bought`, délibérément.** L'archivé porte les DEUX marques — acheté
   * et tombstoné — et c'est ce qui le distingue d'une suppression pure au moment où on lira
   * l'historique. AC2 : « retirés de la liste active tout en restant traçables ».
   */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where status = 'bought' and deleted_at is null;

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
  v_touchees integer;
begin
  if public.current_household_id() is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⚠️ **Les deux statuts partent, et aucun n'est réécrit.** Vider, c'est retirer la liste —
   * pas déclarer tout acheté. La confirmation exigée par l'AC3 vit à l'écran : une fonction
   * ne peut pas confirmer quoi que ce soit, et l'y simuler par un paramètre booléen serait
   * une garde que n'importe quel appelant contournerait.
   */
  update grocery_list_items
     set deleted_at = now(), intent_at = now()
   where deleted_at is null;

  get diagnostics v_touchees = row_count;
  return v_touchees;
end;
$$;

/*
 * ⚠️ **`grant execute` EXPLICITE, pour les trois.** `20260729094500` a mesuré qu'aucune migration
 * du dépôt n'accordait de privilège : on ne suppose rien. `anon` n'en a pas besoin —
 * `current_household_id()` rend `null` sans session et les trois lèvent `P0001`.
 */
revoke all on function public.supprimer_article(uuid) from public;
revoke all on function public.archiver_les_achetes() from public;
revoke all on function public.vider_la_liste() from public;

grant execute on function public.supprimer_article(uuid) to authenticated;
grant execute on function public.archiver_les_achetes() to authenticated;
grant execute on function public.vider_la_liste() to authenticated;

comment on function public.supprimer_article is
  'Retire un article de la liste vivante par TOMBSTONE (deleted_at), jamais par DELETE — aucune '
  'politique RLS n''autorise le DELETE, qui rendrait 0 ligne sans erreur. Ne touche pas status : '
  'supprimer est distinct de cocher (FR-6, AD-3). Rend le nombre de lignes touchées ; 0 si '
  'l''article était déjà supprimé (idempotent, NFR-2). security invoker.';

comment on function public.archiver_les_achetes is
  'Retire de la liste vivante tous les articles ACHETÉS du foyer courant, par tombstone. Le '
  'status reste ''bought'' : un archivé porte les deux marques, ce qui le rend traçable et le '
  'distingue d''une suppression pure (FR-8). Rend le nombre d''articles archivés. security invoker.';

comment on function public.vider_la_liste is
  'Retire de la liste vivante TOUS les articles du foyer courant — à prendre comme achetés — par '
  'tombstone, sans DELETE dur (FR-8, AD-3). La confirmation exigée vit à l''écran. Rend le nombre '
  'd''articles retirés. security invoker.';

-- ═══ Volet 3 — la quantité repart de zéro au réajout d'un article supprimé ══════════════════
--
-- ⛔ **CE VOLET FERME UN DÉFAUT QUE CETTE STORY VIENT DE RENDRE ATTEIGNABLE.** La 4.5 est la
-- PREMIÈRE à écrire des tombstones ; jusqu'ici, aucune surface ne le faisait. Or archiver ne
-- libère pas la clé canonique — l'index est TOTAL (mesuré en 4.4). La ligne archivée reste donc
-- là, avec sa quantité, et `ajouter_article` additionnait dessus.
--
-- **Mesuré le 2026-08-17, avant correctif :**
--
--     10 pommes achetées  →  archivées  →  4 pommes réajoutées  →  quantity = 14
--
-- Le membre a acheté dix pommes la semaine dernière, en demande quatre cette semaine, et la
-- liste lui en annonce quatorze. Il ne peut ni le comprendre ni le corriger autrement qu'en
-- supprimant la ligne.
--
-- ⚠️ **LE CORRECTIF NE TOUCHE QUE LE CAS DU TOMBSTONE, ET C'EST DÉLIBÉRÉ.** Un article `bought`
-- mais TOUJOURS DANS LA LISTE continue de s'additionner — « Pommes 6 pièces » déjà dans le panier
-- + 4 → 10, comportement vérifié à l'écran le 2026-08-17 et qui est le bon : cet article est
-- encore de cette liste-ci. Un tombstone, non : c'est une vie précédente, et sa quantité est morte
-- avec elle. Le raisonnement vaut identiquement pour une suppression simple.
--
-- ⚠️ **`excluded.quantity` peut valoir `null`, et c'est correct** : réajouter un article supprimé
-- sans dire combien rend une ligne sans quantité, pas une ligne à zéro. C'est le cas nominal de
-- l'ajout vocal.
--
-- ⚠️ **LE CORPS CI-DESSOUS EST CELUI DE `20260816180000`, EXTRAIT PAR SCRIPT ET NON RECOPIÉ.**
-- L'expression du `on conflict` doit reproduire celle de l'index **à l'octet près** : la première
-- rédaction de la 4.4 avait transformé ses échappements `\uXXXX` en caractères littéraux, ce qui
-- est le piège nommé de cette famille de migration. Seules les lignes de `quantity` diffèrent.
create or replace function public.ajouter_article(
  p_nom      text,
  p_quantite numeric default null,
  p_unite    text    default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_foyer uuid;
  v_rayon uuid;
  v_id    uuid;
begin
  /*
   * ⚠️ Le foyer vient de `current_household_id()`, JAMAIS d'un paramètre. Le laisser
   * passer par l'appelant rendrait la fonction capable d'écrire ailleurs — la RLS le
   * refuserait, mais l'erreur serait alors un `42501` illisible plutôt qu'un refus net.
   */
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⚠️ **Le rayon est résolu par le SERVEUR (AC3, AD-6).** `resolve_aisle_id` rend `null`
   * pour tout aujourd'hui — `product_aisle_map` est vide, les règles mot-clé sont la story
   * 2.3 et le câblage la 4.16. On l'appelle quand même : le chemin est écrit une fois, et
   * `null` remonte proprement dans le groupe « À classer », que l'écran sait déjà rendre.
   *
   * ⛔ **QUATRE ARGUMENTS, ET LA PREMIÈRE RÉDACTION EN AVAIT SUPPOSÉ DEUX.** La signature
   * réelle est `(p_household_id, p_product_id, p_ingredient, p_fallback_kw)` — la fonction
   * vient du squelette et sert d'abord la génération depuis une recette. Un ajout manuel
   * n'a ni produit ni mot-clé de repli : les deux valent `null`, et seul le nom compte.
   * ⚠️ Le défaut a été trouvé en exécutant la requête de contrôle n°2 de cet en-tête. Elle
   * existe pour ça ; ne pas la lancer avant d'écrire coûte un aller-retour.
   */
  v_rayon := public.resolve_aisle_id(v_foyer, null, p_nom, null);

  /*
   * ⛔ **L'EXPRESSION DU `on conflict` EST CELLE DE L'INDEX, RECOPIÉE À L'IDENTIQUE.**
   * Toute divergence — un espace, un `lower` déplacé — et Postgres ne trouve plus l'index.
   * L'ordre des quatre opérations n'est pas commutatif : NFC d'abord (composer avant de
   * mesurer), puis le retrait des invisibles, puis le pliage des accents, puis `lower`.
   *
   * ⚠️ `coalesce(…, 0)` DES DEUX CÔTÉS : un article posé sans quantité, puis réajouté avec
   * une quantité, doit donner la quantité — et non `null` par propagation. C'est le cas
   * nominal de l'ajout vocal, qui ne dit pas toujours combien.
   */
  insert into grocery_list_items (household_id, name, quantity, unit, aisle_id, intent_at)
  values (v_foyer, p_nom, p_quantite, p_unite, v_rayon, now())
  on conflict (
    household_id,
    lower(public.strip_accents(
      regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g')
    )),
    unit
  )
  do update set
    /*
     * ⛔ **LA QUANTITÉ REPART DE ZÉRO SI LA LIGNE ÉTAIT TOMBSTONÉE — story 4.5.** Mesuré :
     * 10 archivées + 4 réajoutées rendaient **14**, le tombstone ne libérant pas la clé
     * canonique (index TOTAL). Une quantité archivée appartient à une vie précédente.
     * ⚠️ Un article acheté mais TOUJOURS VIVANT continue de s'additionner : il est encore de
     * cette liste-ci (6 dans le panier + 4 → 10, vérifié à l'écran le 2026-08-17).
     */
    quantity   = case
                   when grocery_list_items.deleted_at is not null then excluded.quantity
                   else coalesce(grocery_list_items.quantity, 0) + coalesce(excluded.quantity, 0)
                 end,
    /*
     * ⛔ **LE TOMBSTONE SE ROUVRE ET L'ACHETÉ REDEVIENT À PRENDRE.** Les deux occupent la
     * clé sans être visibles dans `grocery_list_by_aisle` : sans ces deux lignes, un membre
     * réajouterait un article et rien n'apparaîtrait à l'écran. Ajouter, c'est vouloir
     * acheter.
     */
    status     = 'pending',
    deleted_at = null,
    /*
     * ⚠️ Le rayon n'est réécrit QUE s'il était nul : un rayon corrigé à la main par un
     * membre (story 4.18) ne doit pas être écrasé par une résolution automatique.
     */
    aisle_id   = coalesce(grocery_list_items.aisle_id, excluded.aisle_id),
    intent_at  = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.ajouter_article is
  'Ajoute un article à la liste du foyer courant, ou INCRÉMENTE sa quantité si la clé canonique '
  '(foyer, nom normalisé, unité) est déjà occupée par un article VIVANT — acheté compris. '
  'Si la ligne était TOMBSTONÉE, la quantité REPART de celle de l''ajout (story 4.5) : une '
  'quantité archivée appartient à une vie précédente et ne s''additionne pas. AD-6, FR-5. '
  'security invoker : la RLS reste seule garante.';
