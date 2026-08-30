-- Rezeptbase – Datenbankschema
-- Auszuführen im Supabase SQL Editor.
--
-- Stand 23.08.2026: Diese Datei bildet den tatsächlichen Zustand der Datenbank ab.
-- Der Review-Zugang (review@rezeptbase.test) ist am 23.08.2026 gelöscht worden,
-- seine Ausnahmen sind aus allen Zugriffsregeln entfernt. Wer diese Datei
-- ausführt, bekommt genau das, was jetzt live ist – keine Sonderzugänge.
--
-- Zwei Details in den Regeln unten:
--   · (select auth.uid()) statt auth.uid(): inhaltlich dasselbe, aber der Wert
--     wird einmal ermittelt statt für jede Zeile neu.
--   · "to authenticated": die Regel wird für nicht angemeldete Besucher gar
--     nicht erst geprüft.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  source_url text,
  source_type text not null default 'manual' check (source_type in ('youtube', 'short', 'tiktok', 'instagram', 'foto', 'web', 'manual')),
  video_embed_url text,
  image_url text,
  base_servings int not null default 4,
  prep_time_min int,
  cook_time_min int,
  category text,
  cuisine text,
  keywords text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  rating int check (rating between 1 and 5),
  notes text,
  last_cooked_at date,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  amount numeric,
  unit text,
  is_scalable boolean not null default true,
  sort_order int not null default 0
);

create table public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ingredient_name text not null,
  amount numeric,
  unit text,
  source_recipe_id uuid references public.recipes (id) on delete set null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index recipes_user_idx on public.recipes (user_id, created_at desc);
create index ingredients_recipe_idx on public.ingredients (recipe_id, sort_order);
create index shopping_user_idx on public.shopping_list (user_id, created_at);

-- Phase 4: Kochstatus
alter table public.recipes add column if not exists status text not null default 'zum_ausprobieren' check (status in ('zum_ausprobieren','gekocht'));

-- V1.3 Paket C: Sammlungen (eigene Rezept-Gruppen wie „Gäste-Menüs")
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.recipe_collections (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  primary key (recipe_id, collection_id)
);

create index collections_user_idx on public.collections (user_id, name);
create index recipe_collections_coll_idx on public.recipe_collections (collection_id);

-- ============================================================================
--  Row Level Security
--  Grundsatz: Du kommst an eine Zeile heran, wenn sie dir gehört. Sonst nicht.
--  Keine Ausnahmen, keine fest eingetragenen Nutzerkennungen.
-- ============================================================================

alter table public.recipes            enable row level security;
alter table public.ingredients        enable row level security;
alter table public.shopping_list      enable row level security;
alter table public.collections        enable row level security;
alter table public.recipe_collections enable row level security;

-- ---------------------------------------------------------------- recipes --
drop policy if exists "recipes select" on public.recipes;
create policy "recipes select" on public.recipes
  for select to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "recipes insert" on public.recipes;
create policy "recipes insert" on public.recipes
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

drop policy if exists "recipes update" on public.recipes;
create policy "recipes update" on public.recipes
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

drop policy if exists "recipes delete" on public.recipes;
create policy "recipes delete" on public.recipes
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- ------------------------------------------------------------ ingredients --
-- Zutaten haben keine eigene Nutzerspalte. Es zählt, wem das Rezept gehört.
drop policy if exists "ingredients select" on public.ingredients;
create policy "ingredients select" on public.ingredients
  for select to authenticated
  using ( exists ( select 1 from public.recipes r
                   where r.id = ingredients.recipe_id
                     and r.user_id = (select auth.uid()) ) );

drop policy if exists "ingredients insert" on public.ingredients;
create policy "ingredients insert" on public.ingredients
  for insert to authenticated
  with check ( exists ( select 1 from public.recipes r
                        where r.id = ingredients.recipe_id
                          and r.user_id = (select auth.uid()) ) );

drop policy if exists "ingredients update" on public.ingredients;
create policy "ingredients update" on public.ingredients
  for update to authenticated
  using ( exists ( select 1 from public.recipes r
                   where r.id = ingredients.recipe_id
                     and r.user_id = (select auth.uid()) ) )
  with check ( exists ( select 1 from public.recipes r
                        where r.id = ingredients.recipe_id
                          and r.user_id = (select auth.uid()) ) );

drop policy if exists "ingredients delete" on public.ingredients;
create policy "ingredients delete" on public.ingredients
  for delete to authenticated
  using ( exists ( select 1 from public.recipes r
                   where r.id = ingredients.recipe_id
                     and r.user_id = (select auth.uid()) ) );

-- ---------------------------------------------------------- shopping_list --
drop policy if exists "shopping select" on public.shopping_list;
create policy "shopping select" on public.shopping_list
  for select to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "shopping insert" on public.shopping_list;
create policy "shopping insert" on public.shopping_list
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

drop policy if exists "shopping update" on public.shopping_list;
create policy "shopping update" on public.shopping_list
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

drop policy if exists "shopping delete" on public.shopping_list;
create policy "shopping delete" on public.shopping_list
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- ------------------------------------------------------------ collections --
drop policy if exists "collections select" on public.collections;
create policy "collections select" on public.collections
  for select to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "collections insert" on public.collections;
create policy "collections insert" on public.collections
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

drop policy if exists "collections update" on public.collections;
create policy "collections update" on public.collections
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

drop policy if exists "collections delete" on public.collections;
create policy "collections delete" on public.collections
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- ----------------------------------------------------- recipe_collections --
-- Verknüpfungstabelle. Sie hat bewusst keine update-Regel: eine Zuordnung
-- wird nicht geändert, sondern gelöscht und neu angelegt.
drop policy if exists "recipe_collections select" on public.recipe_collections;
create policy "recipe_collections select" on public.recipe_collections
  for select to authenticated
  using ( exists ( select 1 from public.collections c
                   where c.id = recipe_collections.collection_id
                     and c.user_id = (select auth.uid()) ) );

drop policy if exists "recipe_collections insert" on public.recipe_collections;
create policy "recipe_collections insert" on public.recipe_collections
  for insert to authenticated
  with check ( exists ( select 1 from public.collections c
                        where c.id = recipe_collections.collection_id
                          and c.user_id = (select auth.uid()) )
               and exists ( select 1 from public.recipes r
                            where r.id = recipe_collections.recipe_id
                              and r.user_id = (select auth.uid()) ) );

drop policy if exists "recipe_collections delete" on public.recipe_collections;
create policy "recipe_collections delete" on public.recipe_collections
  for delete to authenticated
  using ( exists ( select 1 from public.collections c
                   where c.id = recipe_collections.collection_id
                     and c.user_id = (select auth.uid()) ) );

-- ---------------------------------------------------------------------------
-- Kochverlauf: jeder „Als gekocht markieren"-Klick erzeugt einen Eintrag.
-- So entsteht mit der Zeit eine Historie („3x gekocht, zuletzt am …").
create table public.cook_history (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  cooked_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index cook_history_recipe_idx on public.cook_history (recipe_id, cooked_at desc);

alter table public.cook_history enable row level security;

drop policy if exists "cook_history select" on public.cook_history;
create policy "cook_history select" on public.cook_history
  for select to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "cook_history insert" on public.cook_history;
create policy "cook_history insert" on public.cook_history
  for insert to authenticated
  with check ( (select auth.uid()) = user_id
               and exists ( select 1 from public.recipes r
                            where r.id = cook_history.recipe_id
                              and r.user_id = (select auth.uid()) ) );

drop policy if exists "cook_history delete" on public.cook_history;
create policy "cook_history delete" on public.cook_history
  for delete to authenticated
  using ( (select auth.uid()) = user_id );
