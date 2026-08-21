-- Story 4.7 — Générer la liste depuis le menu, sans rien écraser.
--
-- ⛔ CE QUE CETTE MIGRATION RÉPARE, ET CE QU'ELLE A DÉJÀ COÛTÉ.
--
-- La génération d'avant faisait un `delete ... where status = 'pending'` puis un `insert`
-- nu. Trois défauts mesurés, tous les trois destructeurs :
--
--   M4/M5  un article AJOUTÉ À LA MAIN disparaît à la génération suivante (2 → 1), et
--          sans tombstone — donc invisible à la synchro, contre AD-3
--   M6     un article ACHETÉ de même clé canonique survit au delete, puis fait échouer
--          l'insert en `23505`
--   M7     deux ingrédients de même nom+unité mais de `product_id` distincts produisent
--          deux lignes de même clé canonique → `23505`
--
-- ⚠️ ET UN QUATRIÈME, TROUVÉ EN CHEMIN LE 2026-08-20 : la fonction, révoquée mais laissée
-- dans `public`, permettait à un ANONYME de faire tomber la base. Fermé à part
-- (`20260821090000`), parce qu'un arrêt de service ne s'attend pas la fin d'une story.

-- ── REQUÊTES DE CONTRÔLE — à exécuter en PRODUCTION avant d'appliquer. ────────
--
-- ⛔ **N°1 — LA SEULE QUI CONDITIONNE UN `drop column` (D6).** `docs/migrations.md` exige
-- une décision explicite et une vérification : on ne retire pas une colonne sur la foi
-- d'un raisonnement. Si elle rend autre chose que 0, **ne pas appliquer le volet 4** et
-- rouvrir D6.
--
--   select count(*) as lignes_avec_added_by
--   from grocery_list_items
--   where added_by is not null;
--
-- ATTENDU : 0. `added_by` n'a qu'un écrivain — la génération — et `actor_kind`/`actor_id`
-- la supplantent depuis la 4.1. Si le compte n'est pas nul, la génération a tourné en
-- production et la colonne porte de l'information que personne ne relit.
--
-- ⚠️ **N°2 — l'arité d'`ajouter_article`, pour ne pas recréer la surcharge de la 4.6.**
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as signature
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'ajouter_article';
--
-- ATTENDU : exactement UNE ligne. Deux lignes = surcharge déjà installée, et tout appel
-- à l'ancienne arité rend `function ... is not unique` — le chemin d'ajout du produit
-- cesse de fonctionner. Mesuré en 4.6.
--
-- ⚠️ **N°3 — la génération est-elle bien absente**, après le correctif `20260821090000` ?
--
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'generate_grocery_list_from_menu';
--
-- ATTENDU : 0 avant cette migration, 1 après. En LECTURE SEULE : ne jamais l'APPELER pour
-- le savoir tant que le correctif n'est pas appliqué — c'était l'arrêt de service.

-- ── Volet 1 : la règle d'arrondi, énoncée UNE fois (D7). ──────────────────────
--
-- ⛔ **D7 DISAIT « JAMAIS DANS LE SQL », ET D1(a) REND CELA IMPOSSIBLE.** Les deux défauts
-- prescrits se contredisent : D1(a) met la boucle de génération DANS la base, donc c'est la
-- base qui écrit la quantité, donc c'est elle qui doit l'arrondir. Un arrondi qui ne vivrait
-- que dans `lib/` n'arrondirait rien de ce qui est stocké.
--
-- ⚠️ **Le dépôt a déjà tranché ce genre de tension, deux fois** : `UNITES` et `SURFACES`
-- vivent en TypeScript, leur contrepartie vit en base, et l'accord entre les deux est
-- **mesuré** par `contraintes.test.ts` — jamais affirmé. On fait pareil : la règle est
-- énoncée ici ET dans `lib/liste/arrondi.ts`, et un test les fait tourner sur les mêmes
-- entrées. C'est ce que la règle §4 demande d'un invariant entre deux fichiers.
--
-- ⛔ **ACCORDÉE À `anon`, DÉLIBÉRÉMENT.** Depuis le 2026-08-20 on sait qu'une fonction de
-- `public` dont `EXECUTE` est révoqué permet un arrêt de service anonyme. Toute fonction
-- créée ici est donc accordée, et sa sûreté vient de la RLS — jamais d'un `revoke`.
create or replace function public.arrondir_pour_achat(p_quantite numeric, p_unite text)
returns numeric
language sql
immutable
as $fonction$
  select case
    -- Pas de quantité : on n'en invente pas une.
    when p_quantite is null then null
    -- ⛔ Dénombrable : on n'achète pas 1,67 oignon. Vers le HAUT, jamais au plus proche —
    -- arrondir 1,2 à 1 ferait manquer un oignon à la recette.
    when p_unite = 'pièce' then ceil(p_quantite)
    -- ⚠️ Mesures de cuisine : au demi. Personne ne dose 1,67 cuillère, et prétendre le
    -- contraire afficherait une précision que le geste n'a pas.
    --
    -- ⛔ **LE `greatest` EMPÊCHE UN INGRÉDIENT DE DISPARAÎTRE.** L'arrondi au demi tout
    -- nu rend 0 pour toute quantité sous 0,25 : `round(0.1 * 2) / 2 = 0`. Une pincée de
    -- safran sortirait de la liste sans un mot. Trouvé par le test de `lib/liste/
    -- arrondi.test.ts`, qui portait l'assertion « un demi n'est jamais écrasé à zéro » —
    -- pas par la relecture.
    -- ⚠️ `p_quantite > 0` et non `>= 0` : le plancher relève une quantité trop petite,
    -- il n'en invente pas là où il n'y en a pas.
    when p_unite in ('cs', 'cc', 'pincée') then
      -- ⚠️ Pas de branche « sinon arrondir quand même » : à zéro les deux formes
      -- coïncident, donc aucun test ne pourrait distinguer la juste de la fautive.
      case when p_quantite > 0 then greatest(0.5, round(p_quantite * 2) / 2)
           else p_quantite end
    -- ⛔ Continues (`g`, `kg`, `ml`, `L`) : INTACTES. Arrondir 1,2 kg de farine au supérieur
    -- donnerait 2 kg — une erreur d'un facteur proche de 2. C'est le contre-exemple qui a
    -- écarté l'option (b) de D7.
    else p_quantite
  end;
$fonction$;

grant execute on function public.arrondir_pour_achat(numeric, text) to anon, authenticated, service_role;

-- ── Volet 2 : `ajouter_article` apprend la recette, le produit et l'intention. ─
--
-- ⛔ **`drop function` DE L'ANCIENNE SIGNATURE AVANT DE CRÉER LA NOUVELLE.** Mesuré en 4.6 :
-- ajouter un paramètre ne remplace pas la fonction, il en crée une SECONDE. Les deux
-- coexistent, et tout appel à l'ancienne arité rend `function ... is not unique` — le
-- chemin d'ajout du produit cesse de fonctionner, sans qu'aucune barrière ne bronche.
drop function if exists public.ajouter_article(text, numeric, text, text);

create or replace function public.ajouter_article(
  p_nom        text,
  p_quantite   numeric     default null,
  p_unite      text        default null,
  p_surface    text        default null,
  p_recette_id uuid        default null,
  p_produit_id uuid        default null,
  p_intention  timestamptz default null
)
returns uuid
language plpgsql
set search_path to 'public', 'extensions'
as $fonction$
declare
  v_foyer uuid;
  v_rayon uuid;
  v_id    uuid;
begin
  /*
   * ⚠️ Le foyer vient de `current_household_id()`, JAMAIS d'un paramètre. Le laisser
   * passer par l'appelant rendrait la fonction capable d'écrire ailleurs.
   */
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⚠️ **`p_produit_id` EST NOUVEAU, ET IL SERT D'ABORD LE RAYON.** `resolve_aisle_id`
   * cherche d'abord une correspondance EXACTE de produit ; sans le produit, cette branche
   * est perdue.
   *
   * ⛔ **MESURÉ le 2026-08-21 : la perte est de ZÉRO aujourd'hui.** `product_aisle_map`
   * est VIDE, donc les trois branches rendent `null` quoi qu'on leur passe. On câble
   * quand même le produit, parce que le jour où la 2.3 peuplera la table, un chemin
   * oublié ici se traduirait par des articles « À classer » sans que rien ne le signale.
   *
   * ⚠️ **Le mot-clé de repli de la recette (`p_fallback_kw`) n'est PAS câblé** — dette
   * datée, consignée. Il ne sert que la 3e branche, morte elle aussi aujourd'hui, et un
   * sixième paramètre pour une branche morte serait de la généralité spéculative.
   */
  v_rayon := public.resolve_aisle_id(v_foyer, p_produit_id, p_nom, null);

  /*
   * ⛔ **L'EXPRESSION DU `on conflict` EST CELLE DE L'INDEX, RECOPIÉE À L'IDENTIQUE.**
   * Toute divergence — un espace, un `lower` déplacé — et Postgres ne trouve plus l'index.
   */
  insert into grocery_list_items (
    household_id, name, quantity, unit, aisle_id, intent_at,
    actor_kind, actor_id, surface, recipe_id, product_id
  )
  values (
    v_foyer, p_nom, p_quantite, p_unite, v_rayon, coalesce(p_intention, now()),
    'profile', auth.uid(), p_surface, p_recette_id, p_produit_id
  )
  on conflict (
    household_id,
    lower(public.strip_accents(
      regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g')
    )),
    unit
  )
  do update set
    quantity   = case
                   when grocery_list_items.deleted_at is not null then excluded.quantity
                   else coalesce(grocery_list_items.quantity, 0) + coalesce(excluded.quantity, 0)
                 end,
    actor_kind = case when grocery_list_items.deleted_at is not null
                      then 'profile' else grocery_list_items.actor_kind end,
    actor_id   = case when grocery_list_items.deleted_at is not null
                      then auth.uid() else grocery_list_items.actor_id end,
    surface    = case when grocery_list_items.deleted_at is not null
                      then excluded.surface
                      else coalesce(grocery_list_items.surface, excluded.surface) end,
    recipe_id  = case when grocery_list_items.deleted_at is not null
                      then excluded.recipe_id else grocery_list_items.recipe_id end,
    /*
     * ⚠️ Le produit ne s'écrase pas : une ligne vivante garde le sien, une ligne rouverte
     * prend celui de l'ajout, et une ligne qui n'en avait pas peut en gagner un.
     */
    product_id = case when grocery_list_items.deleted_at is not null
                      then excluded.product_id
                      else coalesce(grocery_list_items.product_id, excluded.product_id) end,
    status     = 'pending',
    deleted_at = null,
    aisle_id   = coalesce(grocery_list_items.aisle_id, excluded.aisle_id),
    intent_at  = coalesce(p_intention, now())
  /*
   * ⛔ **C'EST CE `where` QUI TIENT L'AC3, ET IL TIENT AUSSI LA 4.4 INTACTE.**
   *
   * Sans lui, `ajouter_article` rouvre INCONDITIONNELLEMENT un tombstone — correct pour un
   * ajout manuel (le membre qui retape un nom veut l'article), faux pour la génération :
   * celle de dimanche ressusciterait l'article retiré samedi, et retirerait au membre sa
   * décision.
   *
   * ⚠️ **Le `where` d'un `on conflict do update` ne fait pas échouer l'ordre : il SAUTE la
   * mise à jour.** La ligne reste exactement dans l'état où elle était — tombstone compris —
   * et `returning` ne rend rien, donc `v_id` reste `null`. C'est le signal dont la génération
   * se sert pour ne pas compter l'article.
   *
   * ⛔ **`p_intention is null` EST LA PORTE DE SORTIE DE L'AJOUT MANUEL**, et son défaut
   * `null` est ce qui garantit qu'aucun appel existant ne change de comportement. Sans lui,
   * la 4.4 et l'écran d'ajout se mettraient à refuser silencieusement de rouvrir.
   *
   * ⚠️ **Ceci est un avant-goût de la 4.10**, pas son travail : le LWW y sera généralisé à
   * TOUS les champs. Ici l'arbitrage porte sur le SEUL `deleted_at`, parce que c'est le
   * minimum que l'AC3 exige. Que la 4.10 ne croie pas le travail fait.
   */
  where grocery_list_items.deleted_at is null
     or p_intention is null
     or p_intention > grocery_list_items.deleted_at
  returning id into v_id;

  return v_id;
end;
$fonction$;

grant execute on function public.ajouter_article(text, numeric, text, text, uuid, uuid, timestamptz)
  to anon, authenticated, service_role;

-- ── Volet 3 : la génération, réécrite — plus de DELETE, plus d'INSERT nu. ─────
--
-- ⛔ **`security invoker`, ET C'EST LA CONDITION DE D1(a).** `ajouter_article` est `invoker` :
-- une `definer` qui l'appellerait ferait tourner la RLS sous l'identité du PROPRIÉTAIRE, pas
-- de l'appelant — la fonction pourrait écrire dans n'importe quel foyer. L'ancienne était
-- `definer` ; c'est un changement délibéré, pas un oubli.
create or replace function public.generate_grocery_list_from_menu(
  p_start_date date,
  p_end_date   date
)
returns integer
language plpgsql
security invoker
set search_path to 'public', 'extensions'
as $fonction$
declare
  v_foyer     uuid;
  v_intention timestamptz := now();
  v_ids       uuid[] := '{}';
  v_id        uuid;
  v_ing       record;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⛔ **LE `group by` NE PORTE PLUS `product_id` NI `aisle_keyword`, ET C'EST LE CORRECTIF
   * DE M7.** L'ancien groupait sur `(name, unit, product_id, aisle_keyword)` : deux « Sel /
   * g » de produits distincts formaient deux groupes, donc deux lignes de MÊME clé
   * canonique `(foyer, sel, g)` — et le second `insert` mourait en `23505`.
   *
   * ⚠️ **On ne recopie PAS l'expression de normalisation de l'index pour autant.** Elle vit
   * dans l'index (AD-1/AD-6) et la 4.4 a mesuré ce que coûte une copie : les échappements
   * `\uXXXX` s'étaient transformés en chemin. Grouper sur le nom BRUT suffit ici, parce que
   * `ajouter_article` additionne ce qui partage la clé canonique — deux « Sel » et « sel »
   * arriveront séparément et FUSIONNERONT, au lieu de se heurter.
   *
   * ⚠️ **D'où le comptage par ids DISTINCTS plus bas** : deux groupes qui fusionnent rendent
   * le même `id`, et annoncer « 2 articles ajoutés » serait faux.
   */
  for v_ing in
    select
      ri.name  as nom,
      ri.unit  as unite,
      /*
       * ⛔ **`recipe_id` SEULEMENT SI UNE SEULE RECETTE A CONTRIBUÉ (D5).** Le modèle porte
       * un `uuid` unique ; désigner « la première » affirmerait une origine fausse dans la
       * moitié des cas, et l'icône 🍴 de la 4.6 mentirait. Un ingrédient partagé par deux
       * recettes n'affiche AUCUNE provenance — c'est le prix, et il est cohérent avec
       * « on n'invente pas une origine ».
       */
      /*
       * ⚠️ **`min(uuid)` N'EXISTE PAS EN POSTGRESQL** — la story prescrivait
       * `min(r.id)`, et ça ne compile pas (`function min(uuid) does not exist`,
       * mesuré le 2026-08-21). `array_agg` distinct puis `[1]` dit la même chose et
       * compile : quand il n'y a qu'une valeur distincte, c'est celle-là.
       */
      case when count(distinct r.id) = 1
           then (array_agg(distinct r.id))[1] end as recette_id,
      /*
       * Même honnêteté pour le produit : un seul contributeur, ou rien.
       * ⚠️ Le `filter` écarte les `null` — `count(distinct)` les ignore déjà, mais
       * `array_agg(distinct)` les GARDERAIT, et `[1]` pourrait rendre `null` alors
       * qu'un produit unique existe.
       */
      case when count(distinct ri.product_id) = 1
           then (array_agg(distinct ri.product_id)
                 filter (where ri.product_id is not null))[1] end as produit_id,
      /*
       * ⚠️ `mpe.servings` est au NUMÉRATEUR et `r.servings` au dénominateur : une recette
       * pour 4 servie à 6 multiplie par 6/4. `nullif(r.servings, 0)` évite la division par
       * zéro — une recette à 0 portion rend `null`, pas une erreur.
       */
      sum(
        coalesce(ri.quantity, 0) * (mpe.servings::numeric / nullif(r.servings, 0))
      ) as quantite
    from meal_plan_entries mpe
    join recipes r             on r.id  = mpe.recipe_id
    join recipe_ingredients ri on ri.recipe_id = r.id
    where mpe.household_id = v_foyer
      and mpe.meal_date between p_start_date and p_end_date
      and ri.optional = false
    group by ri.name, ri.unit
  loop
    /*
     * ⛔ **UN SEUL CHEMIN D'ÉCRITURE DANS TOUT LE PRODUIT.** C'est D1(a) : l'UPSERT-incrémente,
     * le tombstone, l'acheté ramené à `pending`, le rayon, la provenance — tout est déjà écrit
     * une fois, dans `ajouter_article`. Une seconde copie de ces règles divergerait.
     *
     * ⚠️ **`v_intention` est pris UNE fois, avant la boucle** : tous les articles d'une même
     * génération partagent la même intention. Pris dans la boucle, deux articles supprimés à
     * la même seconde seraient arbitrés différemment.
     *
     * ⚠️ **La surface reste `web` (D4)** : aucun jeton `menu` n'est ajouté au vocabulaire.
     * C'est `recipe_id` qui commande l'icône 🍴, et la surface dit d'où le membre a cliqué.
     */
    v_id := public.ajouter_article(
      v_ing.nom,
      public.arrondir_pour_achat(v_ing.quantite, v_ing.unite),
      v_ing.unite,
      'web',
      v_ing.recette_id,
      v_ing.produit_id,
      v_intention
    );

    -- `null` = le `where` du `do update` a sauté : un tombstone plus RÉCENT que cette
    -- génération. L'article n'a pas été ajouté, et il ne doit pas être compté.
    if v_id is not null then
      v_ids := v_ids || v_id;
    end if;
  end loop;

  -- ⚠️ DISTINCT : deux groupes fusionnés par la clé canonique sont UN article.
  return coalesce(array_length(array(select distinct u from unnest(v_ids) u), 1), 0);
end;
$fonction$;

grant execute on function public.generate_grocery_list_from_menu(date, date)
  to anon, authenticated, service_role;

-- ── Volet 4 : retirer `added_by` (D6) — et la vue qui en dépend. ──────────────
--
-- ⛔ **REPORTÉ DEUX FOIS (4.1 puis 4.6), ET LA 4.6 AVAIT DATÉ LE MOMENT** : « le retrait
-- appartient à la 4.7, qui réécrit la génération — son unique écrivain ». C'est fait
-- au-dessus : la nouvelle génération passe par `ajouter_article`, qui n'écrit
-- qu'`actor_kind`/`actor_id`. La colonne n'a donc plus aucun écrivain.
--
-- ⛔ **`drop column` ÉCHOUERAIT SANS CE `drop view`, ET `cascade` EMPORTERAIT LA VUE.**
-- `grocery_list_by_aisle` sélectionne `g.added_by`. C'est le MIROIR exact du piège de la
-- 4.6 — où ajouter une colonne à la table ne l'avait pas ajoutée à la vue. Une vue ne suit
-- pas sa table ; il faut la refaire à la main, dans les deux sens.
--
-- ⚠️ `create or replace view` ne saurait pas RETIRER une colonne — il exige la même liste,
-- dans le même ordre. D'où le `drop` puis le `create`.
drop view if exists public.grocery_list_by_aisle;

create view public.grocery_list_by_aisle
with (security_invoker = true)
as
  select
    g.id, g.household_id, g.name, g.quantity, g.unit, g.product_id, g.aisle_id,
    g.recipe_id, g.status, g.created_at,
    a.name       as aisle_name,
    a.icon       as aisle_icon,
    a.sort_order as aisle_sort,
    g.actor_kind, g.actor_id, g.source_ref, g.intent_at, g.updated_at, g.deleted_at,
    g.surface
  from grocery_list_items g
  left join aisles a on g.aisle_id = a.id
  where g.deleted_at is null
  order by coalesce(a.sort_order, 9999), g.name;

grant select on public.grocery_list_by_aisle to anon, authenticated, service_role;

-- ⚠️ La colonne part APRÈS la vue, jamais avant.
alter table public.grocery_list_items drop column if exists added_by;
