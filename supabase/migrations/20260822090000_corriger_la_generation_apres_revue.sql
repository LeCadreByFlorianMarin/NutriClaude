-- Revue de code de la story 4.7 — les correctifs, et trois changements de la story elle-même.
--
-- ⛔ QUATRE COUCHES DE REVUE ONT CONVERGÉ SUR LES MÊMES DÉFAUTS PAR DES CHEMINS DIFFÉRENTS.
-- Ce fichier ferme ceux qui vivent en base. Trois d'entre eux ne sont pas des bogues
-- d'implémentation mais des DÉCISIONS de Florian du 2026-08-22, prises contre le texte de la
-- story — elles sont signalées comme telles à leur volet.

-- ── REQUÊTES DE CONTRÔLE — à exécuter en PRODUCTION, en LECTURE SEULE. ────────
--
-- ⛔ **LEÇON DE LA MIGRATION PRÉCÉDENTE, PAYÉE COMPTANT.** `20260821110000` portait un volet
-- conditionnel (« si la requête rend autre chose que 0, ne pas appliquer le volet 4 ») dans le
-- MÊME fichier que des volets indispensables. La chaîne de déploiement applique le lot entier :
-- la condition était donc décorative, elle décrivait un choix que personne ne pouvait faire.
-- **Ce fichier-ci ne porte AUCUN volet conditionnel.** Tout ce qu'il contient s'applique.
--
-- N°1 — combien de lignes portent une quantité que le nouvel arrondi changerait ?
--
--   select count(*) from grocery_list_items
--   where quantity is not null and quantity <> public.arrondir_pour_achat(quantity, unit);
--
-- ATTENDU : informatif. Cette migration ne réécrit AUCUNE quantité existante — un arrondi
-- rétroactif changerait des nombres que le membre a lus. Le compte dit seulement combien de
-- lignes anciennes portent une valeur que la génération n'écrirait plus.
--
-- N°2 — la clé canonique change-t-elle pour une ligne existante ?
--
--   select count(*) from grocery_list_items g1 join grocery_list_items g2
--     on g1.id < g2.id and g1.household_id = g2.household_id
--    and public.cle_canonique_nom(g1.name) = public.cle_canonique_nom(g2.name)
--    and g1.unit is not distinct from g2.unit;
--
-- ⛔ ATTENDU : **0**. La fonction du volet 1 recopie l'expression de l'index à l'identique, donc
-- aucune collision neuve ne peut apparaître — mais l'index est DÉPOSÉ et RECRÉÉ, et un `create
-- unique index` échouerait sur une collision. Cette requête le dit avant, pas pendant.

-- ── Volet 1 : la clé canonique devient une fonction NOMMÉE. ───────────────────
--
-- ⛔ **DÉCISION 2 DE LA REVUE.** Le `group by` de la génération portait sur le nom BRUT alors que
-- la fusion se fait sur la clé CANONIQUE. Mesuré : « Oignon » et « oignon » formaient deux
-- groupes, donc l'arrondi tombait DEUX fois (⌈1,5⌉+⌈1,5⌉ = 4 au lieu de ⌈3⌉ = 3, +33 %) et
-- `recipe_id` prenait celui du premier groupe — l'icône 🍴 nommait une recette sur deux
-- contributrices, ce que D5 interdit.
--
-- ⚠️ **D3(a) interdisait de RECOPIER l'expression de l'index, pas de la PARTAGER.** Une seule
-- définition, deux usagers : l'index et la génération. C'est ce qui rend la divergence impossible
-- au lieu de la rendre seulement improbable.
--
-- ⛔ **`immutable` N'EST PAS DÉCORATIF** : un index d'expression l'exige. Les quatre composants le
-- sont (mesuré : `provolatile = 'i'` pour `lower`, `normalize`, `regexp_replace`, `strip_accents`).
create or replace function public.cle_canonique_nom(p_nom text)
returns text
language sql
immutable
as $fonction$
  select lower(public.strip_accents(
    regexp_replace(normalize(p_nom, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g')
  ));
$fonction$;

comment on function public.cle_canonique_nom(text) is
  'La clé de fusion des articles : NFC, retrait des invisibles, pliage des accents, minuscules. '
  'Définie UNE fois et partagée par l''index unique et par le groupement de la génération — '
  'toute divergence entre les deux ferait des articles qui refusent de fusionner.';

grant execute on function public.cle_canonique_nom(text) to anon, authenticated, service_role;

-- ── Volet 2 : l'index unique est reconstruit sur la fonction. ─────────────────
--
-- ⚠️ **L'expression est identique à l'octet près** — elle a été EXTRAITE du fichier de la
-- migration précédente par script, jamais retapée. Une couche de revue a reproduit le piège en la
-- retapant : les `\uXXXX` se transforment en caractères et l'index cesse d'être trouvé.
--
-- ⛔ `drop index` puis `create unique index` : `create or replace` n'existe pas pour un index, et
-- l'expression change de forme même si elle dit la même chose.
drop index if exists public.grocery_list_items_cle_canonique;

create unique index grocery_list_items_cle_canonique
  on public.grocery_list_items (household_id, public.cle_canonique_nom(name), unit)
  nulls not distinct;

-- ── Volet 3 : `arrondir_pour_achat` reçoit son `search_path`. ─────────────────
--
-- ⚠️ Elle était la seule fonction neuve à en manquer. Sans conséquence mesurée (elle n'appelle que
-- des opérateurs de `pg_catalog` et `anon` n'a pas `CREATE` sur `public`), mais elle rejoignait
-- l'exception plutôt que la règle du dépôt.
alter function public.arrondir_pour_achat(numeric, text) set search_path to 'public';

-- ── Volet 4 : `ajouter_article` — deux décisions de la revue, et une faille. ──
--
-- ⛔ **DÉCISION 1 : LA GÉNÉRATION NE TOUCHE PLUS UN ARTICLE DÉJÀ PRIS.** Mesuré par les quatre
-- couches : `status = 'pending'` inconditionnel décochait un article acheté ET gonflait sa
-- quantité. L'AC2 nomme pourtant « des articles ajoutés à la main **ou déjà achetés** … elle ne
-- les **écrase jamais** », et l'écran l'affirmait au membre.
--
-- ⛔ **DÉCISION 4 : LA GÉNÉRATION NE RESSUSCITE PLUS JAMAIS UN TOMBSTONE.** Et c'est un
-- changement de CRITÈRE, pas d'implémentation. L'AC3 demandait un LWW sur `deleted_at` ; le code
-- le faisait correctement. Mais mesuré par la porte du produit : tous les chemins de suppression
-- posent `deleted_at = now()`, et la génération prend son intention PLUS TARD — donc
-- `p_intention > deleted_at` était **toujours vrai** et l'article revenait toujours. La garde ne
-- se déclenchait que sur un tombstone daté dans le FUTUR, que seul un test fabrique.
--
-- ⚠️ **Le LWW arbitre des écritures CONCURRENTES entre appareils.** Ici il n'y a aucune
-- concurrence : la génération est postérieure par construction. L'appliquer donnait à la machine
-- une victoire garantie sur une décision humaine. Désormais, seul un geste HUMAIN rouvre un
-- article — retaper un nom, c'est le vouloir.
--
-- ⚠️ **Contrepartie assumée par Florian** : un article retiré par erreur ne reviendra plus tout
-- seul. Le membre le retape, et c'est un geste d'une seconde.
--
-- ⛔ **`drop function` DE L'ANCIENNE SIGNATURE AVANT DE CRÉER LA NOUVELLE** — la signature ne
-- change pas ici, mais la règle vaut à chaque fois qu'on y touche (surcharge mesurée en 4.6).
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
  v_foyer     uuid;
  v_rayon     uuid;
  v_id        uuid;
  v_intention timestamptz;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  /*
   * ⛔ **L'INTENTION EST BORNÉE AU PRÉSENT, ET C'EST UNE FAILLE QUE LA REVUE A TROUVÉE.**
   * `p_intention` est exposé en RPC et accordé à `anon, authenticated` : n'importe quel membre
   * pouvait poster une intention DATÉE DANS LE FUTUR et gagner tous les arbitrages à venir.
   * C'est exactement le motif que la 4.6 avait fermé pour la provenance — « estampillée côté
   * serveur, plus déclarée par le client » — rouvert par inadvertance pour l'horodatage.
   *
   * ⚠️ **La 4.10 en héritait falsifiable.** Le `check grocery_list_items_intention_bornee` ne
   * bornait qu'à +1 jour ; `least(…, now())` ferme la porte pour de bon.
   */
  v_intention := least(coalesce(p_intention, now()), now());

  v_rayon := public.resolve_aisle_id(v_foyer, p_produit_id, p_nom, null);

  /*
   * ⚠️ **LE `on conflict` NOMME DÉSORMAIS LA FONCTION, PAS L'EXPRESSION.** C'est tout l'intérêt
   * du volet 1 : l'index et cet ordre ne peuvent plus diverger, puisqu'ils désignent le même
   * objet. Fini la comparaison octet à octet, et fini le piège des `\uXXXX`.
   */
  insert into grocery_list_items (
    household_id, name, quantity, unit, aisle_id, intent_at,
    actor_kind, actor_id, surface, recipe_id, product_id
  )
  values (
    v_foyer, p_nom, p_quantite, p_unite, v_rayon, v_intention,
    'profile', auth.uid(), p_surface, p_recette_id, p_produit_id
  )
  on conflict (household_id, public.cle_canonique_nom(name), unit)
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
    product_id = case when grocery_list_items.deleted_at is not null
                      then excluded.product_id
                      else coalesce(grocery_list_items.product_id, excluded.product_id) end,
    status     = 'pending',
    deleted_at = null,
    aisle_id   = coalesce(grocery_list_items.aisle_id, excluded.aisle_id),
    intent_at  = v_intention
  /*
   * ⛔ **C'EST CE `where` QUI PORTE LES DEUX DÉCISIONS, ET IL DISTINGUE L'HUMAIN DE LA MACHINE.**
   *
   *   `p_intention is null`  →  un geste HUMAIN (l'ajout manuel, la 4.4). Rien ne change :
   *                            le tombstone se rouvre, l'acheté redevient à prendre, la
   *                            quantité s'additionne. « Ajouter, c'est vouloir acheter. »
   *
   *   sinon                  →  la GÉNÉRATION. Elle n'écrit que sur une ligne VIVANTE et NON
   *                            ACHETÉE. Un tombstone reste un tombstone (décision 4), un
   *                            acheté reste acheté avec sa quantité (décision 1).
   *
   * ⚠️ **Le `where` d'un `on conflict do update` ne fait pas échouer l'ordre : il SAUTE la mise à
   * jour.** La ligne reste exactement dans l'état où elle était, et `returning` ne rend rien —
   * donc `v_id` reste `null`. C'est le signal dont la génération se sert pour ne pas compter.
   */
  where p_intention is null
     or (grocery_list_items.deleted_at is null and grocery_list_items.status <> 'bought')
  returning id into v_id;

  return v_id;
end;
$fonction$;

comment on function public.ajouter_article(text, numeric, text, text, uuid, uuid, timestamptz) is
  'La SEULE porte d''écriture d''un article (AD-6) : UPSERT-incrémente sur la clé canonique. '
  'Sans `p_intention`, c''est un geste humain — le tombstone se rouvre et l''acheté redevient à '
  'prendre. Avec, c''est la génération — elle n''écrit que sur une ligne vivante et non achetée. '
  'Le commentaire avait été emporté par un `drop function` de la 4.7 ; il est reposé ici.';

grant execute on function public.ajouter_article(text, numeric, text, text, uuid, uuid, timestamptz)
  to anon, authenticated, service_role;

-- ── Volet 5 : la génération — groupement canonique, isolation, deux comptes. ──
--
-- ⛔ **DÉCISION 3 : CHAQUE ARTICLE EST ISOLÉ.** Mesuré : `quantity` est `numeric(8,2)`, l'écran
-- autorise 999 999,99 par ingrédient, et la boucle n'isolait rien — un seul article qui déborde
-- annulait l'ordre ENTIER et perdait toute la semaine. L'écran disait « On n'a pas réussi à
-- générer ta liste » sans nommer le fautif, et l'état n'était pas transitoire : le membre était
-- bloqué. ⚠️ L'accumulation y menait seule, vers la onzième régénération.
--
-- ⛔ **LA FONCTION REND DÉSORMAIS DEUX NOMBRES**, et c'est un changement de contrat assumé : un
-- compte rendu qui tait les échecs est un compte rendu qui ment.
--
-- ⚠️ **`drop function` : le type de retour change**, `create or replace` refuserait.
drop function if exists public.generate_grocery_list_from_menu(date, date);

create or replace function public.generate_grocery_list_from_menu(
  p_start_date date,
  p_end_date   date
)
returns table (ajoutes integer, echoues integer)
language plpgsql
security invoker
set search_path to 'public', 'extensions'
as $fonction$
declare
  v_foyer     uuid;
  v_intention timestamptz := now();
  v_ids       uuid[] := '{}';
  v_echoues   int := 0;
  v_id        uuid;
  v_ing       record;
begin
  v_foyer := public.current_household_id();
  if v_foyer is null then
    raise exception 'Aucun foyer' using errcode = 'P0001';
  end if;

  for v_ing in
    select
      /*
       * ⚠️ **`min(ri.name)` PLUTÔT QUE « le premier arrivé ».** Le nom affiché doit être
       * déterministe : sans `min`, c'est l'ordre du plan qui décide, et une couche de revue a
       * relevé que rien ne le garantissait. Le nom retenu est arbitraire mais STABLE.
       */
      min(ri.name) as nom,
      ri.unit      as unite,
      /*
       * ⛔ **LE GROUPEMENT EST DÉSORMAIS CANONIQUE (décision 2), ET C'EST CE QUI REND CES DEUX
       * `count(distinct …)` HONNÊTES.** Groupés sur le nom brut, ils comptaient les
       * contributeurs d'une graphie, pas ceux de l'article — d'où une provenance qui nommait
       * une recette sur deux.
       */
      case when count(distinct r.id) = 1
           then (array_agg(distinct r.id))[1] end as recette_id,
      case when count(distinct ri.product_id) = 1
           then (array_agg(distinct ri.product_id)
                 filter (where ri.product_id is not null))[1] end as produit_id,
      /*
       * ⛔ **`nullif(…, 0)` RESTAURÉ — LA 4.7 L'AVAIT PERDU.** L'implémentation remplacée
       * (`20260502000000`) l'avait ; sans lui, `coalesce(ri.quantity, 0)` transforme « on ne
       * sait pas » en « zéro », et la liste affiche « 0 pincée ». Mesuré par trois couches.
       * ⚠️ L'ajout manuel écrit `null` et n'affiche rien : les deux chemins doivent dire la
       * même chose de la même absence.
       *
       * ⚠️ `nullif(r.servings, 0)` est une CEINTURE, pas un cas atteignable :
       * `recipes_servings_positif` interdit déjà zéro. Le commentaire de la 4.7 prétendait le
       * contraire — corrigé ici plutôt que laissé à croire.
       */
      nullif(
        sum(coalesce(ri.quantity, 0) * (mpe.servings::numeric / nullif(r.servings, 0))),
        0
      ) as quantite
    from meal_plan_entries mpe
    join recipes r             on r.id  = mpe.recipe_id
    join recipe_ingredients ri on ri.recipe_id = r.id
    where mpe.household_id = v_foyer
      and mpe.meal_date between p_start_date and p_end_date
      and ri.optional = false
    group by public.cle_canonique_nom(ri.name), ri.unit
  loop
    /*
     * ⛔ **UN BLOC PAR ARTICLE : UN ÉCHEC N'EMPORTE PLUS LA SEMAINE.** Le `exception` ouvre un
     * sous-bloc transactionnel — ce qui a été écrit avant reste écrit.
     *
     * ⚠️ **On attrape `others` DÉLIBÉRÉMENT**, et c'est la seule fois. Ce qu'on veut n'est pas
     * de traiter un code d'erreur particulier, c'est qu'AUCUN article ne puisse faire perdre
     * les autres — un débordement aujourd'hui, autre chose demain.
     */
    begin
      v_id := public.ajouter_article(
        v_ing.nom,
        public.arrondir_pour_achat(v_ing.quantite, v_ing.unite),
        v_ing.unite,
        'web',
        v_ing.recette_id,
        v_ing.produit_id,
        v_intention
      );

      -- `null` = le `where` du `do update` a sauté : tombstone, ou article déjà pris.
      -- Ce n'est PAS un échec — c'est un refus voulu, et il ne se compte nulle part.
      if v_id is not null then
        v_ids := v_ids || v_id;
      end if;
    exception
      when others then
        v_echoues := v_echoues + 1;
    end;
  end loop;

  -- ⚠️ DISTINCT : deux graphies fusionnées sont UN article. Depuis le groupement canonique,
  -- le cas ne devrait plus se produire — la garde reste, elle ne coûte rien.
  ajoutes := coalesce(array_length(array(select distinct u from unnest(v_ids) u), 1), 0);
  echoues := v_echoues;
  return next;
end;
$fonction$;

comment on function public.generate_grocery_list_from_menu(date, date) is
  'Génère la liste depuis le menu, sans rien écraser (FR-16/FR-17). N''écrit jamais sur un '
  'article supprimé ni sur un article déjà pris. Rend le nombre d''articles posés et le nombre '
  'd''articles qui ont échoué — un compte rendu qui tait ses échecs ment.';

grant execute on function public.generate_grocery_list_from_menu(date, date)
  to anon, authenticated, service_role;

-- ── Volet 6 : la sonde d'audit cesse de divulguer, et voit enfin tout l'état. ─
--
-- ⛔ **MA JUSTIFICATION ÉTAIT FAUSSE, ET JE NE L'AVAIS PAS MESURÉE AVANT DE L'ÉCRIRE.**
-- `20260821090000` affirmait : « elle ne divulgue rien de neuf, PostgREST publie déjà la liste
-- des fonctions dans son OpenAPI ». Remesuré le 2026-08-22 : **l'OpenAPI est filtré par
-- privilège**. Une fonction accordée à `anon` y figure, une fonction révoquée en est absente — et
-- la sonde rendait précisément les seconde. Elle donnait donc à un anonyme le nom, la signature
-- complète, et la liste exacte des cibles à couper. C'est la règle §1 : une justification
-- s'écrit APRÈS la mesure.
--
-- ⛔ **ET LE PRÉDICAT MANQUAIT LA MOITIÉ DE L'ÉTAT DANGEREUX.** Il ne regardait qu'`anon` ; une
-- fonction accordée à `anon` mais révoquée à `authenticated` fait tomber la base sur un MEMBRE
-- connecté. Mesuré par une couche de revue.
--
-- ⚠️ **Elle rend un COMPTE, plus des noms.** Zéro suffit à garder l'invariant ; un non-zéro
-- envoie le développeur interroger le catalogue, ce qu'un anonyme ne peut pas faire.
drop function if exists public.fonctions_publiques_sans_execute();

create or replace function public.compte_fonctions_injoignables()
returns integer
language sql
security invoker
stable
set search_path to 'public'
as $fonction$
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and not (
      has_function_privilege('anon', p.oid, 'execute')
      and has_function_privilege('authenticated', p.oid, 'execute')
    );
$fonction$;

comment on function public.compte_fonctions_injoignables() is
  'Combien de fonctions de `public` sont injoignables à `anon` OU à `authenticated`. Cet état '
  'permet un arrêt de service : le refus de permission sur une fonction segfaute l''image '
  'Postgres du projet. Rend un COMPTE et non des noms — la version précédente divulguait à un '
  'anonyme exactement ce que l''OpenAPI de PostgREST lui cache.';

grant execute on function public.compte_fonctions_injoignables() to anon, authenticated, service_role;

-- ── Volet 7 : le commentaire de la vue, emporté par le `drop view` de la 4.7. ─
--
-- ⚠️ **Le miroir du piège que la 4.7 revendiquait avoir évité.** Elle avait retenu qu'une vue ne
-- suit pas sa table ; elle n'a pas vu qu'un commentaire ne suit pas sa vue. `create or replace`
-- l'aurait gardé, `drop` l'a détruit.
comment on view public.grocery_list_by_aisle is
  'La liste vivante du foyer, groupée par rayon et ordonnée selon le parcours du magasin (FR-2). '
  'Exclut les tombstones ; les articles achetés y restent visibles. `security_invoker` : la RLS '
  'de l''appelant s''applique.';
