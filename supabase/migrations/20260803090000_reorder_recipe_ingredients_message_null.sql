-- Corrige le message de la garde 2 de `reorder_recipe_ingredients` sur un `NULL`.
--
-- ⚠️ À CONTRÔLER EN REVUE — et disons d'emblée ce que ce contrôle ÉTABLIT, parce
-- que la revue adversariale du 2026-08-03 a mesuré que la formulation habituelle
-- promettait plus qu'elle ne tenait :
--
--   select proname, pronargs from pg_proc
--   where proname = 'reorder_recipe_ingredients';
--
-- Attendu : une ligne, `pronargs = 2`. Cette requête dit que la fonction existe et
-- avec quelle arité — RIEN de plus. Un `create or replace function` **ne peut pas**
-- échouer sur des données : contrairement à un `add constraint`, le succès du
-- déploiement ne prouvera donc AUCUNE propriété du contenu de la table. C'est
-- exactement l'écart que la revue a relevé sur `20260802112749`, dont le report
-- affirmait après coup que « le succès du déploiement PROUVE ce que la requête
-- devait établir » : vrai pour la migration des trois `check`, faux pour celle-ci.
--
-- ── CE QUE ÇA CHANGE, ET CE QUE ÇA NE CHANGE PAS ────────────────────────────
--
-- **Aucun trou n'est refermé : il n'y en avait pas.** La revue a vérifié
-- algébriquement qu'aucune combinaison de `NULL` ne franchit les gardes — avec *m*
-- valeurs nulles dans un tableau de *n* éléments, `count(distinct id)` les ignore,
-- donc *n ≥ d + m > d* et la garde 2 refuse toujours.
--
-- Ce qui change est le MESSAGE. `p_ids = [null, id1]` donnait « Un ingrédient est
-- cité deux fois » — et le développeur qui lit `console.error` partait chercher un
-- doublon qui n'existe pas. Une garde qui accuse le mauvais coupable coûte une
-- heure à qui la lit ; c'est la seule raison de cette migration.
--
-- ⚠️ Le message ne remonte PAS à l'utilisateur : `refusOrdreIngredients` mappe tous
-- les `P0001` sur « La liste des ingrédients vient de changer. La voilà à jour. »,
-- et c'est voulu — du point de vue du membre, les gardes disent une seule chose.

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

  -- Garde 1 bis — un `NULL` dans le tableau. AVANT la garde des doublons, sinon
  -- c'est elle qui parle : `count(distinct id)` IGNORE les NULL, donc le cardinal
  -- ne correspond jamais et l'appel se voyait reprocher un doublon inexistant.
  -- Aucun trou n'est refermé ici — la garde 2 arrêtait déjà ces appels — mais elle
  -- les arrêtait en accusant le mauvais coupable.
  if array_position(p_ids, null) is not null then
    raise exception 'Un identifiant d''ingrédient est vide';
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
  -- ⚠️ `and ri.recipe_id = p_recipe_id` : c'est la seule chose qui empêche un appel
  -- forgé de renuméroter une AUTRE recette du même foyer. La RLS est par FOYER, la
  -- portée de la garde est la RECETTE, et les deux ne coïncident pas — contrairement
  -- aux rayons, d'où `reorder_aisles` a été calquée. Éprouvé par mutation : le
  -- retirer fait tomber un test, et le bon.
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
