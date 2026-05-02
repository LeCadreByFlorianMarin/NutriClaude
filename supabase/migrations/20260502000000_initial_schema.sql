-- =========================================================================
-- NutriClaude — Initial schema
-- =========================================================================
-- Bounded contexts:
--   1. Household & Profiles  (sharing unit + individual nutritional profiles)
--   2. Recipe Management     (recipes + ingredients)
--   3. Aisle Configuration   (custom supermarket aisles + product mapping)
--   4. Meal Planning         (weekly menu)
--   5. Grocery List          (shopping list grouped by aisle)
--
-- Conventions:
--   - All shared data carries a `household_id` for RLS isolation.
--   - Profile lookup is the single source of truth for "current household".
--   - Tables that don't need cross-household uniqueness use uuid PKs.
--   - All `*_at` timestamps are timestamptz, default now().
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. HOUSEHOLDS & PROFILES
-- -------------------------------------------------------------------------

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  household_id    uuid not null references households(id) on delete restrict,
  display_name    text not null,
  daily_calories  int,
  daily_protein_g int,
  daily_carbs_g   int,
  daily_fat_g     int,
  daily_fiber_g   int,
  restrictions    text[] default '{}',
  preferences     jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_profiles_household on profiles(household_id);

-- Helper: current user's household (used by every RLS policy below)
create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid()
$$;

-- Invite codes to join an existing household
create table household_invites (
  code           text primary key,
  household_id   uuid not null references households(id) on delete cascade,
  created_by     uuid references auth.users(id) on delete set null,
  expires_at     timestamptz not null default (now() + interval '7 days'),
  uses_remaining int  not null default 5,
  created_at     timestamptz not null default now()
);

create index idx_invites_household on household_invites(household_id);

-- -------------------------------------------------------------------------
-- 2. AISLES (supermarket aisles, sort order = physical store path)
-- -------------------------------------------------------------------------

create table aisles (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 100,
  icon         text,
  created_at   timestamptz not null default now(),
  unique (household_id, name)
);

create index idx_aisles_household on aisles(household_id, sort_order);

-- -------------------------------------------------------------------------
-- 3. PRODUCTS (Open Food Facts cache, shared across households)
-- -------------------------------------------------------------------------

create table products (
  id                 uuid primary key default gen_random_uuid(),
  barcode            text unique,
  name               text not null,
  brand              text,
  categories         text[],
  nutriscore         char(1),
  energy_kcal_100g   numeric(7,2),
  protein_100g       numeric(7,2),
  carbs_100g         numeric(7,2),
  fat_100g           numeric(7,2),
  fiber_100g         numeric(7,2),
  salt_100g          numeric(7,2),
  sugar_100g         numeric(7,2),
  saturated_fat_100g numeric(7,2),
  image_url          text,
  off_data           jsonb,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_products_name_search
  on products using gin (to_tsvector('french', name));

-- Mapping product ↔ aisle, by exact product OR by keyword (e.g. "poulet" → Boucherie)
create table product_aisle_map (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  product_id   uuid references products(id) on delete cascade,
  keyword      text,
  aisle_id     uuid not null references aisles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (product_id is not null or keyword is not null)
);

create index idx_aisle_map_keyword
  on product_aisle_map using gin (to_tsvector('french', keyword));
create index idx_aisle_map_household on product_aisle_map(household_id);

-- -------------------------------------------------------------------------
-- 4. RECIPES & INGREDIENTS
-- -------------------------------------------------------------------------

create table recipes (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  title           text not null,
  description     text,
  instructions    text,
  servings        int  not null default 2,
  prep_time_min   int,
  cook_time_min   int,
  tags            text[] default '{}',
  total_kcal      numeric(8,2),
  total_protein_g numeric(7,2),
  total_carbs_g   numeric(7,2),
  total_fat_g     numeric(7,2),
  source          text not null default 'manual',  -- 'manual' | 'claude' | 'import'
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_recipes_household on recipes(household_id, created_at desc);
create index idx_recipes_tags on recipes using gin(tags);

create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  name          text not null,
  quantity      numeric(8,2),
  unit          text,                     -- 'g', 'ml', 'piece', 'cs', 'cc'
  aisle_keyword text,                     -- fallback for aisle resolution
  optional      boolean not null default false,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id, sort_order);

-- -------------------------------------------------------------------------
-- 5. MEAL PLAN (weekly menu)
-- -------------------------------------------------------------------------

create table meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id    uuid not null references recipes(id) on delete cascade,
  meal_date    date not null,
  meal_type    text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  servings     int  not null default 2,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_meal_plan_household_date
  on meal_plan_entries(household_id, meal_date);

-- -------------------------------------------------------------------------
-- 6. GROCERY LIST
-- -------------------------------------------------------------------------

create table grocery_list_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  quantity     numeric(8,2),
  unit         text,
  product_id   uuid references products(id) on delete set null,
  aisle_id     uuid references aisles(id) on delete set null,
  recipe_id    uuid references recipes(id) on delete set null,
  added_by     uuid references auth.users(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'bought')),
  created_at   timestamptz not null default now()
);

create index idx_grocery_household_status
  on grocery_list_items(household_id, status);
create index idx_grocery_household_aisle
  on grocery_list_items(household_id, aisle_id);

-- View: pending grocery items, joined with aisle, ordered by aisle path.
-- security_invoker = true makes the view respect the caller's RLS rather
-- than the view owner's — required so foyers stay isolated.
create or replace view grocery_list_by_aisle
  with (security_invoker = true) as
  select
    g.*,
    a.name       as aisle_name,
    a.icon       as aisle_icon,
    a.sort_order as aisle_sort
  from grocery_list_items g
  left join aisles a on g.aisle_id = a.id
  where g.status = 'pending'
  order by coalesce(a.sort_order, 9999), g.name;

-- -------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
-- -------------------------------------------------------------------------
-- Pattern: every table with household_id is filtered by current_household_id().
-- profiles is filtered by id = auth.uid() (read all in same household for display).
-- households is filtered by id = current_household_id().
-- products is shared (cache) — readable by any authenticated user.

alter table households            enable row level security;
alter table profiles              enable row level security;
alter table household_invites     enable row level security;
alter table aisles                enable row level security;
alter table products              enable row level security;
alter table product_aisle_map     enable row level security;
alter table recipes               enable row level security;
alter table recipe_ingredients    enable row level security;
alter table meal_plan_entries     enable row level security;
alter table grocery_list_items    enable row level security;

-- households -------------------------------------------------------------
create policy households_select on households for select
  using (id = current_household_id());
create policy households_update on households for update
  using (id = current_household_id());
-- INSERT: anyone authenticated can create a household (during onboarding,
-- before they have a profile). The profile insert is the gating step.
create policy households_insert on households for insert
  with check (auth.uid() is not null);

-- profiles ---------------------------------------------------------------
create policy profiles_select_own_household on profiles for select
  using (household_id = current_household_id() or id = auth.uid());
create policy profiles_update_own on profiles for update
  using (id = auth.uid());
create policy profiles_insert_own on profiles for insert
  with check (id = auth.uid());

-- household_invites ------------------------------------------------------
create policy invites_select_own on household_invites for select
  using (household_id = current_household_id());
create policy invites_insert_own on household_invites for insert
  with check (household_id = current_household_id());
create policy invites_delete_own on household_invites for delete
  using (household_id = current_household_id());
-- Note: redeeming an invite is done via a SECURITY DEFINER function below
-- because the redeemer doesn't yet belong to the target household.

-- aisles -----------------------------------------------------------------
create policy aisles_all on aisles for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- products (shared cache) ------------------------------------------------
create policy products_select_authenticated on products for select
  using (auth.uid() is not null);
create policy products_insert_authenticated on products for insert
  with check (auth.uid() is not null);
create policy products_update_authenticated on products for update
  using (auth.uid() is not null);

-- product_aisle_map ------------------------------------------------------
create policy aisle_map_all on product_aisle_map for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- recipes ----------------------------------------------------------------
create policy recipes_all on recipes for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- recipe_ingredients (inherited from recipe.household_id) ---------------
create policy recipe_ingredients_all on recipe_ingredients for all
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id = current_household_id()
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id = current_household_id()
    )
  );

-- meal_plan_entries ------------------------------------------------------
create policy meal_plan_all on meal_plan_entries for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- grocery_list_items -----------------------------------------------------
create policy grocery_all on grocery_list_items for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- -------------------------------------------------------------------------
-- 8. FUNCTIONS — onboarding + invites
-- -------------------------------------------------------------------------

-- Seed default aisles for a brand-new household
create or replace function seed_default_aisles(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into aisles (household_id, name, sort_order, icon) values
    (p_household_id, 'Fruits & Légumes',     10, '🥬'),
    (p_household_id, 'Boucherie',            20, '🥩'),
    (p_household_id, 'Poissonnerie',         30, '🐟'),
    (p_household_id, 'Crémerie',             40, '🧀'),
    (p_household_id, 'Boulangerie',          50, '🥖'),
    (p_household_id, 'Épicerie sèche',       60, '🌾'),
    (p_household_id, 'Conserves',            70, '🥫'),
    (p_household_id, 'Surgelés',             80, '🧊'),
    (p_household_id, 'Boissons',             90, '🥤'),
    (p_household_id, 'Hygiène & Entretien', 100, '🧴'),
    (p_household_id, 'Autre',               999, '📦')
  on conflict (household_id, name) do nothing;
end;
$$;

-- Onboarding: create household + profile + default aisles in one transaction
create or replace function create_household_with_profile(
  p_household_name text,
  p_display_name   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_user_id) then
    raise exception 'Profile already exists';
  end if;

  insert into households (name) values (p_household_name)
    returning id into v_household_id;

  insert into profiles (id, household_id, display_name)
    values (v_user_id, v_household_id, p_display_name);

  perform seed_default_aisles(v_household_id);

  return v_household_id;
end;
$$;

-- Onboarding: redeem an invite to join an existing household
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
  v_uses_left    int;
  v_expires_at   timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_user_id) then
    raise exception 'Profile already exists';
  end if;

  select household_id, uses_remaining, expires_at
    into v_household_id, v_uses_left, v_expires_at
  from household_invites where code = p_code;

  if v_household_id is null then
    raise exception 'Invalid invite code';
  end if;
  if v_expires_at < now() then
    raise exception 'Invite expired';
  end if;
  if v_uses_left <= 0 then
    raise exception 'Invite has no uses remaining';
  end if;

  insert into profiles (id, household_id, display_name)
    values (v_user_id, v_household_id, p_display_name);

  update household_invites
     set uses_remaining = uses_remaining - 1
   where code = p_code;

  return v_household_id;
end;
$$;

-- Generate an invite code (8-char base32) for the current household
create or replace function generate_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := current_household_id();
  v_code         text;
begin
  if v_household_id is null then
    raise exception 'No household for current user';
  end if;
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into household_invites (code, household_id, created_by)
    values (v_code, v_household_id, auth.uid());
  return v_code;
end;
$$;

-- -------------------------------------------------------------------------
-- 9. FUNCTIONS — grocery list generation
-- -------------------------------------------------------------------------

-- Resolve the aisle for an ingredient via:
--   1. product_aisle_map.product_id (exact product match)
--   2. product_aisle_map.keyword    (substring match, French-aware)
--   3. ingredient.aisle_keyword     (recipe-level fallback)
-- Returns null if no match — UI shows these as "À classer".
create or replace function resolve_aisle_id(
  p_household_id  uuid,
  p_product_id    uuid,
  p_ingredient    text,
  p_fallback_kw   text
)
returns uuid
language plpgsql
stable
as $$
declare
  v_aisle_id uuid;
begin
  -- 1. Exact product match
  if p_product_id is not null then
    select aisle_id into v_aisle_id
    from product_aisle_map
    where household_id = p_household_id and product_id = p_product_id
    limit 1;
    if v_aisle_id is not null then return v_aisle_id; end if;
  end if;

  -- 2. Keyword inside ingredient name
  select m.aisle_id into v_aisle_id
  from product_aisle_map m
  where m.household_id = p_household_id
    and m.keyword is not null
    and lower(p_ingredient) like '%' || lower(m.keyword) || '%'
  order by length(m.keyword) desc
  limit 1;
  if v_aisle_id is not null then return v_aisle_id; end if;

  -- 3. Recipe-level fallback keyword
  if p_fallback_kw is not null then
    select m.aisle_id into v_aisle_id
    from product_aisle_map m
    where m.household_id = p_household_id
      and m.keyword is not null
      and lower(p_fallback_kw) like '%' || lower(m.keyword) || '%'
    order by length(m.keyword) desc
    limit 1;
  end if;

  return v_aisle_id;
end;
$$;

-- Generate the grocery list from the current household's meal plan
-- between two dates (inclusive). Aggregates duplicate ingredients
-- by name+unit, scales quantities by (planned_servings / recipe_servings).
-- Replaces any existing 'pending' items in that household.
create or replace function generate_grocery_list_from_menu(
  p_start_date date,
  p_end_date   date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := current_household_id();
  v_inserted     int;
begin
  if v_household_id is null then
    raise exception 'No household for current user';
  end if;

  -- Wipe pending items from prior generations (keep 'bought' as history)
  delete from grocery_list_items
  where household_id = v_household_id and status = 'pending';

  with planned as (
    select
      ri.name        as ingredient_name,
      ri.unit        as unit,
      ri.product_id  as product_id,
      ri.aisle_keyword as aisle_keyword,
      sum(
        coalesce(ri.quantity, 0) *
        (mpe.servings::numeric / nullif(r.servings, 0))
      ) as total_qty
    from meal_plan_entries mpe
    join recipes r            on r.id  = mpe.recipe_id
    join recipe_ingredients ri on ri.recipe_id = r.id
    where mpe.household_id = v_household_id
      and mpe.meal_date between p_start_date and p_end_date
      and ri.optional = false
    group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword
  )
  insert into grocery_list_items
    (household_id, name, quantity, unit, product_id, aisle_id, added_by, status)
  select
    v_household_id,
    p.ingredient_name,
    nullif(p.total_qty, 0),
    p.unit,
    p.product_id,
    resolve_aisle_id(v_household_id, p.product_id, p.ingredient_name, p.aisle_keyword),
    auth.uid(),
    'pending'
  from planned p;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- -------------------------------------------------------------------------
-- 10. UPDATED_AT TRIGGERS
-- -------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger recipes_updated_at
  before update on recipes
  for each row execute function set_updated_at();
