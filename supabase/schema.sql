-- Rezeptbase – Datenbankschema (Phase 1)
-- Auszuführen im Supabase SQL Editor.

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

-- Row Level Security: jeder Nutzer sieht nur seine eigenen Daten.
-- Ausnahme (15.08.2026): Review-Nutzer review@rezeptbase.test
-- (UUID 8e60d3c4-c4c6-4390-8680-0db0df4fd231) darf alles LESEN, nichts schreiben.
-- Zum Entfernen des Review-Zugangs: Policies ohne die Reviewer-Klauseln neu anlegen
-- und den Nutzer im Dashboard loeschen.
alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.shopping_list enable row level security;

create policy "recipes select" on public.recipes
  for select using (
    auth.uid() = user_id
    or auth.uid() = '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "recipes insert" on public.recipes
  for insert with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "recipes update" on public.recipes
  for update using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  ) with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "recipes delete" on public.recipes
  for delete using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );

create policy "ingredients select" on public.ingredients
  for select using (
    exists (select 1 from public.recipes r where r.id = recipe_id
      and (r.user_id = auth.uid() or auth.uid() = '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid))
  );
create policy "ingredients insert" on public.ingredients
  for insert with check (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "ingredients update" on public.ingredients
  for update using (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "ingredients delete" on public.ingredients
  for delete using (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );

create policy "shopping select" on public.shopping_list
  for select using (
    auth.uid() = user_id
    or auth.uid() = '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "shopping insert" on public.shopping_list
  for insert with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "shopping update" on public.shopping_list
  for update using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  ) with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "shopping delete" on public.shopping_list
  for delete using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );

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

alter table public.collections enable row level security;
alter table public.recipe_collections enable row level security;

-- Gleiche Logik wie oben: Besitzer alles, Review-Nutzer nur lesen.
create policy "collections select" on public.collections
  for select using (
    auth.uid() = user_id
    or auth.uid() = '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "collections insert" on public.collections
  for insert with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "collections update" on public.collections
  for update using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  ) with check (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );
create policy "collections delete" on public.collections
  for delete using (
    auth.uid() = user_id
    and auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
  );

create policy "recipe_collections select" on public.recipe_collections
  for select using (
    exists (select 1 from public.collections c where c.id = collection_id
      and (c.user_id = auth.uid() or auth.uid() = '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid))
  );
create policy "recipe_collections insert" on public.recipe_collections
  for insert with check (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "recipe_collections delete" on public.recipe_collections
  for delete using (
    auth.uid() <> '8e60d3c4-c4c6-4390-8680-0db0df4fd231'::uuid
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
