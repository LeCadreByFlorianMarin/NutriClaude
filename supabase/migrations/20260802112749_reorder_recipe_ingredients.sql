-- Renumérote les ingrédients d'UNE recette selon l'ordre reçu.
--
-- ⚠️ À CONTRÔLER EN REVUE — `create or replace function` ne peut pas échouer sur
-- des données, mais la règle du dépôt veut une requête de contrôle en en-tête.
-- Celle-ci dit si des ex æquo de position existent déjà en production :
--
--   select recipe_id, count(*) as ingredients, count(distinct sort_order) as positions
--   from recipe_ingredients group by recipe_id having count(*) <> count(distinct sort_order);
--
-- Attendu : zéro ligne, parce que `recipe_ingredients` est vide en production
-- (DÉDUIT — aucune surface n'y a jamais écrit). Si elle rend des lignes, ce n'est
-- **pas bloquant** : cette fonction résorbe précisément les ex æquo. Mais dis-le
-- dans la PR, ça informe la décision « pas de contrainte d'unicité sur sort_order ».
--
-- ── CE QUI DIFFÈRE DE `reorder_aisles`, ET POURQUOI ÇA N'EST PAS COSMÉTIQUE ───
--
-- `reorder_aisles` (story 2.2) tient sa sûreté de deux choses qui coïncidaient :
-- elle est `security invoker`, donc la RLS filtre les lignes atteignables, et son
-- cardinal se compare à `select count(*) from aisles` — qui, sous RLS, ne voit que
-- le foyer de l'appelant. **Portée de la garde = portée de la RLS = le foyer.**
--
-- Ici, elles ne coïncident plus. La portée est la **recette** ; la RLS reste par
-- **foyer**. Deux recettes du même foyer sont mutuellement visibles.
--
-- ⚠️ **MESURÉ le 2026-08-02 sur le stack local, en éprouvant la version calquée à
-- l'identique sur `reorder_aisles`.** Deux recettes A et B dans le même foyer, deux
-- ingrédients chacune. Appel annonçant la recette A et citant les identifiants de
-- la recette B — cardinal correct, 2 = 2 :
--
--     --- AVANT ---            --- APRÈS l'appel forgé ---
--     A-ail       0            A-ail       0
--     A-oignon    0            A-oignon    0
--     B-carotte   0            B-carotte   20   <-- renumérotée
--     B-poireau   0            B-poireau   10   <-- renumérotée
--
-- L'appel a RÉUSSI. Aucune des quatre gardes ne l'a vu : le tableau n'est pas vide,
-- il n'a pas de doublon, son cardinal égale le compte des ingrédients de A, et les
-- deux lignes visées ont bien été touchées. La RLS n'avait rien à refuser — tout
-- appartient au foyer de l'appelant.
--
-- **Le correctif est la clause `and ri.recipe_id = p_recipe_id` dans l'`update`.**
-- Les lignes touchées tombent alors à 0 et la garde de comptage refuse. C'est la
-- ligne la plus importante de ce fichier ; ne la retire pas en « simplifiant ».
--
-- ⚠️ `security INVOKER`, comme `reorder_aisles` et à l'inverse de
-- `seed_default_aisles`. Une fonction `security definer` qui reçoit un identifiant
-- en paramètre doit le recontrôler elle-même — c'est le trou que la story 2.1 a dû
-- refermer. En `invoker`, la RLS fait le travail pour le foyer, et le filtre
-- ci-dessus fait le reste pour la recette.

create or replace function reorder_recipe_ingredients(p_recipe_id uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  v_attendu int;
  v_touches int;
begin
  -- Garde 1 — rien à ordonner.
  if p_recipe_id is null or p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Aucun ingrédient à ordonner';
  end if;

  -- Garde 2 — un ingrédient cité deux fois occuperait deux positions.
  if array_length(p_ids, 1) <> (select count(distinct id) from unnest(p_ids) as t(id)) then
    raise exception 'Un ingrédient est cité deux fois';
  end if;

  -- Garde 3 — le tableau doit couvrir TOUTE la recette. Un renumérotage partiel
  -- laisserait les ingrédients omis à leur ancienne position et créerait des ex
  -- æquo. Sous RLS, ce `count` ne voit que les recettes du foyer de l'appelant :
  -- une recette étrangère rend 0, donc tout tableau non vide est refusé ici.
  select count(*) into v_attendu
    from recipe_ingredients
   where recipe_id = p_recipe_id;

  if array_length(p_ids, 1) <> v_attendu then
    raise exception 'La liste des ingrédients a changé (% cités, % en base)',
      array_length(p_ids, 1), v_attendu;
  end if;

  -- Le pas de 10 laisse de la place pour insérer à la main entre deux ingrédients,
  -- comme le parcours des rayons. Renuméroter TOUT plutôt qu'échanger deux valeurs
  -- est ce qui rend les positions uniques : l'échange est un no-op quand les deux
  -- valeurs sont égales — et ici elles le sont presque toujours, `sort_order` valant
  -- **0 par défaut pour tous les ingrédients**.
  --
  -- ⚠️ `and ri.recipe_id = p_recipe_id` : voir l'en-tête. C'est la seule chose qui
  -- empêche un appel forgé de renuméroter une AUTRE recette du même foyer.
  update recipe_ingredients ri
     set sort_order = t.rang * 10
    from unnest(p_ids) with ordinality as t(id, rang)
   where ri.id = t.id
     and ri.recipe_id = p_recipe_id;

  -- Garde 4 — la seule qui attrape un appel dont le cardinal est correct mais dont
  -- les identifiants ne sont pas ceux de cette recette. Les gardes 1 à 3 le laissent
  -- passer.
  get diagnostics v_touches = row_count;

  if v_touches <> array_length(p_ids, 1) then
    raise exception 'La liste des ingrédients a changé (% déplacés sur %)',
      v_touches, array_length(p_ids, 1);
  end if;
end;
$$;

comment on function reorder_recipe_ingredients(uuid, uuid[]) is
  'Renumérote les ingrédients de la recette reçue selon l''ordre du tableau '
  '(pas de 10). SECURITY INVOKER : la RLS filtre par foyer, et le filtre '
  'ri.recipe_id = p_recipe_id dans l''update empêche un appel forgé de '
  'renuméroter une autre recette du MÊME foyer — trou mesuré le 2026-08-02 sur '
  'la version calquée sur reorder_aisles, où la RLS ne pouvait rien refuser.';
