-- L'ajout d'un article : UPSERT-incrémente sur la clé canonique, et la positivité des quantités.
--
-- Story 4.4. AD-6 (autorité serveur, agrégation sur clé canonique), AD-3 (ligne canonique),
-- AD-7 (vocabulaire fermé), FR-4, FR-5, FR-52.
--
-- ⛔ **POURQUOI UNE FONCTION SQL PLUTÔT QU'UNE ÉCRITURE CLIENT-DIRECTE (AD-13).** Deux raisons,
-- et la seconde est mécanique :
--
--   1. AD-6 le dit : « résolution de rayon, agrégation et mise à l'échelle sont **autoritaires
--      côté serveur** (fonctions SQL). Agrégation = UPSERT-incrémente sur la clé canonique :
--      "ajouter" n'est **jamais** un INSERT nu (FR-5). »
--   2. **PostgREST ne sait pas INCRÉMENTER en upsert.** Son `on_conflict` écrase la valeur, il
--      ne l'additionne pas. Un `quantity = ancienne + nouvelle` n'a donc aucune expression
--      possible côté client — sinon un lire-puis-écrire, qui perdrait une addition dès que deux
--      surfaces ajoutent le même article en même temps (ce que NFR-2 interdit).
--
-- ⚠️ **`security invoker`, ET C'EST LE POINT DE SÉCURITÉ DE CETTE MIGRATION.** La RLS de
-- l'appelant s'applique donc intégralement : `grocery_insert` et `grocery_update` restent seules
-- garantes (AD-1/AD-2), et cette fonction n'ouvre aucun chemin qu'un membre n'avait pas déjà.
-- ⛔ Une `security definer` aurait dû **recontrôler l'identité elle-même** — c'est exactement le
-- trou de `seed_default_aisles`, resté invisible aux onze tests d'isolation d'alors parce qu'ils
-- portaient tous sur des tables.
--
-- ⛔ **`on conflict` PORTE L'EXPRESSION DE L'INDEX, PAS UNE LISTE DE COLONNES.** Écrire
-- `on conflict (household_id, name, unit)` ne correspond à AUCUN index et fait échouer la
-- création de la fonction. L'expression est recopiée **à l'identique** de
-- `grocery_list_items_cle_canonique` (volet 4 de `20260805092611`), `strip_accents` et regex
-- comprises. Toute divergence, fût-elle d'un espace, casse l'inférence.
--
-- ⛔ **LA CLÉ EST OCCUPÉE PAR DES LIGNES QUE LA VUE NE MONTRE PAS.** L'index est TOTAL : ni les
-- tombstones ni les articles achetés n'en sont exclus. Mesuré le 2026-08-16 :
--
--     ('Beurre','g','bought')  puis insert ('Beurre','g','pending')  →  23505
--     ('Riz','kg', deleted_at) puis insert ('Riz','kg')              →  23505
--
-- C'est la raison d'être du `do update` ci-dessous : il rouvre le tombstone (`deleted_at` remis
-- à nul) et ramène un article acheté à `pending`. **« Rajouter un article supprimé » est un
-- UPDATE, jamais un INSERT** — la migration de la 4.1 l'écrivait déjà pour les stories 4.5 et 4.7.
--
-- ⚠️ **`intent_at` EST POSÉ PAR `now()`, DONC PAR L'HORLOGE DU SERVEUR — ET C'EST DÉLIBÉRÉ.**
-- L'en-tête de `20260805092611` le dit : « le défaut `now()` est l'horloge SERVEUR : honnête pour
-- une écriture directe, et remplacé par l'horloge du geste dès que l'outbox existe (story 4.9) ».
-- ⛔ La story 4.3 a écrit `intent_at` depuis l'horloge du CLIENT ; mesuré le 2026-08-16, le
-- conteneur Postgres est **+0,740 s en avance** sur l'hôte, donc une bascule y écrit un
-- horodatage ANTÉRIEUR à l'insertion et l'arbitre du LWW recule. Le défaut est ouvert et daté ;
-- cette fonction ne le reproduit pas.
--
-- ⚠️ **LE NOM N'EST PAS NORMALISÉ DANS LA DONNÉE.** La normalisation vit dans l'expression de
-- l'index. « Crème fraîche » se stocke et se réaffiche « Crème fraîche ».
--
-- ⚠️ À CONTRÔLER EN REVUE — la contrainte de positivité ÉCHOUERA si une ligne existante la viole,
-- et les migrations s'appliquent **pendant le déploiement de production** (`vercel.json` →
-- `scripts/migrer-au-deploiement.mjs`). Il n'y a plus de moment humain entre l'approbation et
-- l'écriture.
--
--   -- 0. Le contexte : la table est-elle seulement peuplée ?
--   select count(*) as total,
--          count(*) filter (where quantity < 0) as negatives,
--          count(*) filter (where deleted_at is not null and deleted_at < created_at) as tombstones_anterieurs
--     from grocery_list_items;
--   --    ⚠️ `negatives` DOIT valoir 0, sinon le volet 1 échoue et le déploiement s'arrête.
--   --    `tombstones_anterieurs` doit valoir 0 pour le volet 2.
--
--   -- 1. L'expression de l'index, à comparer À L'IDENTIQUE avec celle du volet 3 :
--   select indexdef from pg_indexes where indexname = 'grocery_list_items_cle_canonique';
--
--   -- 2. `resolve_aisle_id` existe-t-elle, et avec quelle signature ?
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'resolve_aisle_id';
--
--   -- 3. APRÈS application — l'agrégation fait-elle ce qu'elle promet ?
--   --    (attendu : UNE ligne, quantité 3)
--   begin;
--   select public.ajouter_article('Sonde', 1, 'kg');
--   select public.ajouter_article('sonde', 2, 'kg');
--   select count(*), sum(quantity) from grocery_list_items where name ilike 'sonde';
--   rollback;

-- ═══ Volet 1 — la positivité des quantités ══════════════════════════════════════════════════
--
-- ⚠️ **LA FENÊTRE BON MARCHÉ SE REFERME ICI, et c'est pour ça que la contrainte arrive
-- maintenant.** La story 4.1 l'avait laissée nommément : « le critère du projet est — la valeur
-- est-elle consommée par un CALCUL ? Elle l'est, mais l'agrégation qui la consomme est la 4.4. »
-- Cette story est celle qui additionne : une quantité négative y rendrait une somme fausse
-- **sans erreur**. Mesuré le 2026-08-16 : `insert … quantity = -5` est accepté aujourd'hui.
--
-- ⚠️ **`>= 0` et non `> 0`**, comme le report le prescrit : une quantité nulle n'a pas de sens
-- mais n'est pas dangereuse, et la refuser transformerait un ajout maladroit en erreur.
alter table grocery_list_items
  add constraint grocery_list_items_quantite_positive
  check (quantity is null or quantity >= 0);

-- ═══ Volet 2 — un tombstone ne précède pas la ligne qu'il enterre ═══════════════════════════
--
-- Reportée par la revue de la 4.1 vers « la 4.5 / la 4.10 », avec cette note : « **la fenêtre bon
-- marché se referme à la 4.4** (table encore vide) : après, c'est une migration de données ».
-- On la pose donc ici, pendant qu'elle coûte une ligne.
--
-- ⛔ **LA BORNE EST GÉNÉREUSE D'UN JOUR, ET LA PREMIÈRE RÉDACTION NE L'ÉTAIT PAS.** Elle disait
-- `deleted_at >= created_at`, et elle a **cassé un test d'isolation préexistant** — « A gère SON
-- article de bout en bout, tombstone compris » — en rendant `23514`.
--
-- **Mesuré le 2026-08-16, et c'est la cause :** `created_at` est posé par le SERVEUR (`now()`),
-- `deleted_at` par le CLIENT (`new Date()`), et le conteneur Postgres est **+0,740 s en avance**
-- sur l'hôte. Le tombstone d'un geste parfaitement normal précède donc la création de la ligne.
-- ⛔ **Conséquence si la borne restait stricte : un membre dont le téléphone retarde d'une
-- seconde ne pourrait plus RIEN supprimer.** La contrainte aurait transformé un décalage
-- d'horloge banal en panne dure, sur le chemin d'écriture de la story 4.5.
--
-- ⚠️ **Le dépôt avait déjà tranché ce cas, et la borne le reprend mot pour mot.**
-- `grocery_list_items_intention_bornee` emploie `now() + interval '1 day'` avec cette raison
-- écrite : « la borne est volontairement GÉNÉREUSE (un jour) pour qu'une horloge d'appareil
-- légèrement en avance ne soit jamais refusée ». Même problème, même réponse.
--
-- **Ce que la contrainte attrape encore** : un tombstone daté de 1970, ou d'avant la ligne de
-- plusieurs jours — c'est-à-dire une horloge fausse ou une intention forgée, pas une dérive.
--
-- ⚠️ **CE QU'ELLE NE DIT TOUJOURS PAS** : elle ne borne pas par le haut. Un `deleted_at` dans le
-- futur reste accepté, et la question « un tombstone futur veut-il dire quelque chose ? »
-- appartient à la 4.5 et à la 4.10 (arbitrage LWW). Poser `deleted_at <= now()` ici figerait une
-- politique que personne n'a tranchée.
alter table grocery_list_items
  add constraint grocery_list_items_tombstone_posterieur
  check (deleted_at is null or deleted_at >= created_at - interval '1 day');

-- ═══ Volet 3 — l'UPSERT-incrémente ═════════════════════════════════════════════════════════
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
    quantity   = coalesce(grocery_list_items.quantity, 0) + coalesce(excluded.quantity, 0),
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

/*
 * ⚠️ **`grant execute` EXPLICITE.** La migration `20260729094500` a mesuré qu'aucune migration
 * du dépôt n'accordait de privilège : la chaîne locale ne reproduisait pas la production. On ne
 * suppose donc plus rien.
 * ⚠️ `anon` n'en a pas besoin : `current_household_id()` rend `null` sans session, et la
 * fonction lève alors `P0001`. Le lui accorder n'ouvrirait rien, mais ne servirait à rien.
 */
revoke all on function public.ajouter_article(text, numeric, text) from public;
grant execute on function public.ajouter_article(text, numeric, text) to authenticated;

comment on function public.ajouter_article is
  'Ajoute un article à la liste du foyer courant, ou INCRÉMENTE sa quantité si la clé canonique '
  '(foyer, nom normalisé, unité) est déjà occupée — y compris par un article acheté ou tombstoné, '
  'que la vue grocery_list_by_aisle ne montre pas. AD-6, FR-5. security invoker : la RLS reste '
  'seule garante.';
