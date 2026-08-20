-- La provenance d'un article : qui l'a ajouté, et par quelle surface.
--
-- Story 4.6. FR-7, AD-9 (un appareil n'est jamais une personne), AD-6 (l'ajout est autoritaire
-- côté serveur), AD-1/AD-2 (la règle vit en Postgres).
--
-- ⛔ **POURQUOI UNE COLONNE `surface` NEUVE, ET SURTOUT PAS `source_ref`.** ⚠️ Elle s'appelait
-- `source` jusqu'à la revue du 2026-08-20 : ce nom obligeait à réécrire six fois la mise en garde
-- ci-dessous, dans quatre fichiers. Un nom qui exige un commentaire est un nom faux — et le
-- domaine avait déjà le bon mot. L'AC1 exige
-- d'enregistrer « la surface d'arrivée ». Mesuré : aucune colonne ne la porte. La seule candidate
-- apparente est `source_ref` — et elle est **déjà prise** :
--
--   · AD-12, mot pour mot : « **Idempotence = colonne `source_ref`** (référence de la ligne source
--     Google/Shortcut) : un rejeu ne réinsère pas » ;
--   · l'ERD de la colonne vertébrale la légende « dedup pont/shortcut FR-47 » ;
--   · AD-17 nomme « dédup pont par `source_ref` » parmi les tests obligatoires ;
--   · la 4.1 a **daté** son index `unique (household_id, source_ref) where source_ref is not null`
--     à l'Epic 6, avec le pont qui l'écrit.
--
-- ⛔ **Y écrire une surface casserait cet index avant qu'il existe** : deux ajouts web du même
-- foyer porteraient `source_ref = 'web'` et se dédupliqueraient l'un l'autre. Les deux questions
-- sont distinctes — *d'où vient la ligne source* (`source_ref`) et *par quelle surface elle est
-- entrée* (`surface`) — et le schéma doit les séparer.
--
-- ⚠️ **LE VOCABULAIRE EST FERMÉ, ET CE N'EST PAS UNE ÉNUMÉRATION PERDANTE.** La règle §3 du dépôt
-- interdit d'énumérer un ensemble qu'on ne contrôle pas (points de code Unicode, SQLSTATE). Les
-- surfaces sont l'inverse : **nous** les écrivons, une par une, et chacune arrive avec sa story.
-- C'est le même raisonnement que le vocabulaire d'unités d'AD-7.
--
-- ⛔ **LE PIÈGE QUI CASSE TOUT SI ON L'IGNORE : AJOUTER UN PARAMÈTRE CRÉE UNE SURCHARGE.**
-- **Mesuré le 2026-08-20**, en `begin … rollback` :
--
--     create or replace function ajouter_article(text, numeric, text, text default null)
--     →  2 fonctions `ajouter_article` coexistent
--     select public.ajouter_article('x', 1, 'kg')
--     →  ERROR: function public.ajouter_article(unknown, integer, unknown) is not unique
--
-- Autrement dit : sans le `drop`, **le chemin d'ajout du produit cesse de fonctionner**, et
-- l'erreur ne parle ni au membre ni au développeur. On retire donc l'ancienne signature **avant**
-- de créer la nouvelle, pour qu'à aucun instant deux surcharges ne coexistent.
--
-- ⚠️ **`drop function` n'est pas `drop column`.** `docs/migrations.md` interdit le second sans
-- décision et sauvegarde : il détruit des données. Retirer une signature de fonction n'en détruit
-- aucune, et c'est ici la seule façon de ne pas casser l'appel existant.
--
-- ⛔ **LA PROVENANCE N'EST PLUS DÉCLARÉE PAR LE CLIENT, ELLE EST ESTAMPILLÉE.** Mesuré le
-- 2026-08-20 : un membre peut aujourd'hui s'attribuer un article **au nom d'un autre membre**
-- (`actor_id` d'autrui accepté), et déclarer `actor_kind = 'device'` avec un `uuid` qui ne désigne
-- **aucun** appareil — la table `device_credentials` d'AD-9 n'existe même pas encore.
-- La 4.4 a fermé ce chemin sans le chercher : « ajouter » passe obligatoirement par cette fonction
-- (AD-6, « jamais un INSERT nu »), donc **c'est elle qui pose `auth.uid()`**. Le client n'a plus
-- rien à déclarer, et ne peut donc plus mentir sur le chemin nominal.
--
-- ⚠️ **LA CEINTURE RLS EST SUR `insert` SEULEMENT, ET C'EST MESURABLE PLUTÔT QUE PRUDENT.**
-- La candidate datée par la revue de la 4.1 est
-- `with check (actor_kind is distinct from 'profile' or actor_id = auth.uid())`.
-- ⛔ **La poser aussi sur `update` casserait le produit** : une politique `with check` s'applique à
-- la ligne NOUVELLE, et RLS **ne peut pas comparer l'ancienne à la nouvelle**. Or cocher, décocher,
-- supprimer ou archiver l'article d'un CO-MEMBRE laisse `actor_id` à sa valeur d'origine, qui n'est
-- pas `auth.uid()` — chaque geste sur l'article d'autrui serait refusé. La liste est partagée
-- (AD-16) : ce serait casser la story 4.3 pour fermer un trou d'écriture.
-- ⚠️ **Ce qui reste donc ouvert, et qui est daté** : un `update` peut encore réécrire `actor_id`.
-- Le fermer demande un TRIGGER (le seul outil qui voit OLD et NEW), pas une politique. Reporté.
--
-- ⚠️ **`actor_kind = 'device'` N'EST CONTRAINT PAR RIEN, ET C'EST VOULU.** `auth.uid()` y est
-- dépourvu de sens (AD-9 : un appareil n'est jamais une FK `profiles`), et `device_credentials`
-- n'existe pas. C'est exactement pourquoi la 4.1 avait reporté cette contrainte plutôt que de la
-- poser de travers. L'Epic 5 la refermera avec la table qui la rend exprimable.
--
-- ⚠️ **`added_by` N'EST PAS SUPPRIMÉE** (report de la 4.1, tranché ici) : elle est **vide** sur les
-- 15 lignes (mesuré), donc rien à migrer, et son unique écrivain est
-- `generate_grocery_list_from_menu` — la fonction qui segfaute, propriété de la 4.7. Le retrait est
-- daté vers elle plutôt que fait ici sur une fonction qu'on ne touche pas.
--
-- ⚠️ **AUCUN INDEX UNIQUE SUR `source_ref` N'EST POSÉ ICI** : il appartient à l'Epic 6.
--
-- ⚠️ À CONTRÔLER EN REVUE — le volet 1 ajoute une colonne nullable et une contrainte qui ne peut
-- être violée par aucune ligne existante (elles sont toutes à `null`). Le volet 2 retire puis
-- recrée une fonction. Rien ne peut échouer sur des données.
--
--   -- 0. Le contexte : la provenance est-elle peuplée quelque part ? (attendu : que des zéros)
--   select count(*) as lignes,
--          count(actor_kind) as avec_acteur,
--          count(source_ref) as avec_source_ref,
--          count(added_by)   as avec_added_by
--     from grocery_list_items;
--
--   -- 1. AVANT : combien de signatures d'ajouter_article ? (attendu : exactement 1, à 3 arguments)
--   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'ajouter_article';
--
--   -- 2. APRÈS — le contrôle qui compte : une seule signature, à 4 arguments, et l'ajout
--   --    estampille l'identité de l'appelant SANS qu'il l'ait déclarée.
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims to '{"sub":"<un membre>","role":"authenticated"}';
--     select public.ajouter_article('Sonde46', 1, 'kg', 'web');
--     select name, actor_kind, actor_id = '<le même membre>' as estampille, surface
--       from grocery_list_items where name = 'Sonde46';
--   rollback;
--
--   -- 3. APRÈS — la ceinture : un membre ne peut plus attribuer un INSERT direct à autrui.
--   --    (attendu : 42501, refus de la politique)
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims to '{"sub":"<membre A>","role":"authenticated"}';
--     insert into grocery_list_items (household_id, name, actor_kind, actor_id)
--     values (public.current_household_id(), 'Sonde46b', 'profile', '<membre B>');
--   rollback;

-- ═══ Volet 1 — la surface d'arrivée ════════════════════════════════════════════════════════
alter table grocery_list_items
  add column surface text;

alter table grocery_list_items
  add constraint grocery_list_items_surface_fermee
  check (surface is null or surface in ('web', 'dashboard', 'voix', 'dictee', 'pont', 'mcp'));

comment on column grocery_list_items.surface is
  'La surface par laquelle l''article est entré (FR-7). Vocabulaire fermé. Nullable : les '
  'articles antérieurs à la story 4.6 n''ont pas de surface connue, et on ne leur en invente pas.';

-- ═══ Volet 2 — l'ajout estampille la provenance ════════════════════════════════════════════
--
-- ⛔ **LE `drop` VIENT AVANT LE `create`, ET CE N'EST PAS UN DÉTAIL DE STYLE.** Créer d'abord
-- ferait coexister deux surcharges, et tout appel à 3 arguments rendrait alors
-- `function ajouter_article(unknown, integer, unknown) is not unique` — mesuré. On ne laisse
-- jamais cet état exister, fût-ce le temps d'une instruction.
drop function if exists public.ajouter_article(text, numeric, text);

create or replace function public.ajouter_article(
  p_nom      text,
  p_quantite numeric default null,
  p_unite    text    default null,
  p_surface  text    default null
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
  /*
   * ⛔ **LA PROVENANCE EST ESTAMPILLÉE ICI, PAS DÉCLARÉE PAR L'APPELANT — story 4.6.**
   * `auth.uid()` est lu côté serveur : le client ne transmet aucune identité, donc il ne peut
   * pas en usurper une. Mesuré avant ce correctif : un membre pouvait attribuer un article à
   * un AUTRE membre, et inventer un `actor_kind = 'device'` désignant un appareil inexistant.
   *
   * ⚠️ **`actor_kind` vaut toujours `'profile'` ici, et c'est exact** : cette fonction n'est
   * appelable qu'avec une session humaine (`current_household_id()` lève sinon). Le jour où
   * une identité d'appareil existera (AD-9, Epic 5), elle passera par son propre chemin —
   * un appareil n'est jamais une FK `profiles`.
   *
   * ⚠️ **`p_source` est la SURFACE, pas `source_ref`** (qui est l'idempotence du pont, AD-12).
   */
  insert into grocery_list_items (
    household_id, name, quantity, unit, aisle_id, intent_at,
    actor_kind, actor_id, surface
  )
  values (
    v_foyer, p_nom, p_quantite, p_unite, v_rayon, now(),
    'profile', auth.uid(), p_surface
  )
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
     * ⛔ **LA PROVENANCE SUIT LA MÊME RÈGLE QUE LA QUANTITÉ — story 4.6.** Une ligne
     * TOMBSTONÉE qu'on réajoute commence une vie neuve : sa provenance est celle de qui la
     * rouvre, comme sa quantité repart de l'ajout. Une ligne VIVANTE garde la sienne : c'est
     * la trace de qui l'a mise sur la liste, et un co-membre qui incrémente la quantité ne
     * s'en approprie pas l'origine.
     *
     * ⚠️ **Le `coalesce` est du côté de l'ANCIENNE valeur pour `surface`** : une ligne créée
     * avant cette story n'a pas de surface, et un réajout est l'occasion de la renseigner
     * sans pour autant réécrire celle d'une ligne qui en a déjà une.
     */
    actor_kind = case when grocery_list_items.deleted_at is not null
                      then 'profile' else grocery_list_items.actor_kind end,
    actor_id   = case when grocery_list_items.deleted_at is not null
                      then auth.uid() else grocery_list_items.actor_id end,
    surface    = case when grocery_list_items.deleted_at is not null
                      then excluded.surface
                      else coalesce(grocery_list_items.surface, excluded.surface) end,
    /*
     * ⛔ **`recipe_id` SE REMET À ZÉRO AVEC LE RESTE — correctif de la revue du 2026-08-20.**
     * Il ne le faisait pas : une ligne tombstonée gardait sa recette, et un article resaisi
     * AU CLAVIER réaffichait 🍴 « issu d'une recette ». `provenanceDe` donnant la priorité
     * absolue à la recette, la ligne mentait sur son origine pour toujours.
     * ⚠️ Même règle que la quantité et l'acteur : une ligne rouverte est une vie neuve.
     */
    recipe_id  = case when grocery_list_items.deleted_at is not null
                      then excluded.recipe_id else grocery_list_items.recipe_id end,
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

revoke all on function public.ajouter_article(text, numeric, text, text) from public;
grant execute on function public.ajouter_article(text, numeric, text, text) to authenticated;

comment on function public.ajouter_article is
  'Ajoute un article à la liste du foyer courant, ou INCRÉMENTE sa quantité si la clé canonique '
  'est déjà occupée par un article VIVANT — acheté compris. Si la ligne était TOMBSTONÉE, la '
  'quantité ET la provenance repartent de cet ajout (story 4.5, 4.6) : une ligne rouverte est une '
  'vie neuve. ⛔ La provenance est ESTAMPILLÉE côté serveur (auth.uid()), jamais déclarée par '
  'l''appelant. p_source est la SURFACE d''arrivée, à ne pas confondre avec source_ref, qui est '
  'l''idempotence du pont Google (AD-12). AD-6, FR-5, FR-7. security invoker.';

-- ═══ Volet 3 — la ceinture RLS, sur l'INSERT seulement ═════════════════════════════════════
--
-- Report daté de la revue de la 4.1 : « Rien n'attache `actor_id` à l'appelant — pour la 4.6 ».
-- La candidate qui y est écrite est reprise telle quelle.
--
-- ⚠️ **CE N'EST QU'UNE CEINTURE.** Le chemin nominal passe par `ajouter_article`, qui estampille
-- déjà `auth.uid()` : cette politique ne s'y applique jamais utilement. Elle existe pour le seul
-- chemin restant — un `insert` client direct sur la table, que `grocery_insert` autorisait sans
-- rien vérifier de la provenance.
--
-- ⛔ **ELLE N'EST PAS POSÉE SUR `update`, ET LA RAISON EST MÉCANIQUE.** Une politique `with check`
-- juge la ligne NOUVELLE ; RLS ne peut pas comparer l'ancienne à la nouvelle. Or cocher, décocher,
-- retirer ou archiver l'article d'un CO-MEMBRE laisse `actor_id` à sa valeur d'origine, différente
-- d'`auth.uid()`. La même règle sur `update` refuserait donc **tout geste sur l'article d'autrui**,
-- sur une liste que le produit veut partagée (AD-16). Ce serait casser la 4.3 pour fermer la 4.6.
--
-- ⚠️ **CE QUI RESTE OUVERT, ET QUI EST DATÉ** : un `update` peut encore réécrire `actor_id`. Le
-- fermer demande un TRIGGER — le seul outil qui voit `OLD` et `NEW` — et non une politique.
-- Reporté dans `deferred-work.md`.
--
-- ⚠️ **`device` reste délibérément non contraint** : `auth.uid()` n'a pas de sens pour un appareil
-- (AD-9), et `device_credentials` n'existe pas encore. L'Epic 5 le refermera avec la table qui rend
-- la contrainte exprimable. C'est précisément pour ne pas la poser de travers que la 4.1 a reporté.
drop policy grocery_insert on grocery_list_items;

create policy grocery_insert on grocery_list_items for insert
  with check (
    household_id = public.current_household_id()
    and (actor_kind is distinct from 'profile' or actor_id = auth.uid())
  );

-- ═══ Volet 4 — la vue doit projeter la colonne neuve ═══════════════════════════════════════
--
-- ⛔ **AJOUTER UNE COLONNE À LA TABLE NE L'AJOUTE PAS À LA VUE, et c'est délibéré depuis la 4.1.**
-- `grocery_list_by_aisle` énumère ses colonnes une par une parce que « `g.*` dans une vue est un
-- piège dormant : Postgres fige l'expansion à la création, les colonnes ajoutées ensuite n'y
-- apparaissent jamais ». La conséquence est ici : sans ce volet, `surface` existe en base, la
-- lecture la demande, et PostgREST répond `column 'surface' does not exist`.
--
-- ⚠️ **TROUVÉ PAR LE TYPAGE, pas à l'exécution** : `supabase-js` infère le type des lignes depuis
-- la chaîne `.select()` et a rendu `SelectQueryError<"column 'surface' does not exist">`. Sans ce
-- typage, le défaut se serait manifesté à l'écran, en production, sur une requête refusée.
--
-- ⚠️ **`surface` EST AJOUTÉE EN FIN DE PROJECTION**, et ce n'est pas un choix esthétique :
-- `create or replace view` n'autorise l'ajout de colonnes **qu'à la fin** (mesuré en story 4.1 —
-- renommer ou intercaler rend `cannot change name of view column`).
--
-- ⚠️ **`security_invoker = true` est RECONDUIT explicitement.** `create or replace view` ne
-- conserve PAS les options si on ne les redonne pas : l'oublier transformerait cette vue en fuite
-- inter-foyers. La 4.3 l'écrivait déjà en élargissant cette même vue.
--
-- ⚠️ **Le `where` et l'`order by` ne changent pas** : les tombstones restent exclus, et le tri
-- reste celui du parcours magasin.
create or replace view grocery_list_by_aisle
  with (security_invoker = true) as
  select
    g.id, g.household_id, g.name, g.quantity, g.unit, g.product_id,
    g.aisle_id, g.recipe_id, g.added_by, g.status, g.created_at,
    a.name       as aisle_name,
    a.icon       as aisle_icon,
    a.sort_order as aisle_sort,
    g.actor_kind, g.actor_id, g.source_ref,
    g.intent_at, g.updated_at, g.deleted_at,
    g.surface
  from grocery_list_items g
  left join aisles a on g.aisle_id = a.id
  where g.deleted_at is null
  order by coalesce(a.sort_order, 9999), g.name;

comment on view grocery_list_by_aisle is
  'La liste vivante du foyer, rayon joint, dans l''ordre du parcours magasin. '
  'Rend les articles À PRENDRE et ACHETÉS (story 4.3, FR-3) — les tombstones restent exclus. '
  'Porte la provenance depuis la story 4.6 : actor_kind, actor_id, recipe_id et surface (la '
  'surface d''arrivée). '
  'Le tri des achetés en bas de leur rayon est un choix d''AFFICHAGE, pas de contrat : '
  'il vit dans lib/liste/groupement.ts, pas ici.';
