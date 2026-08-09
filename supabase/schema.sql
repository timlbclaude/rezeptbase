-- Rezeptbase – Datenbankschema (Phase 1)
-- Auszuführen im Supabase SQL Editor.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  source_url text,
  source_type text not null default 'manual' check (source_type in ('youtube', 'short', 'web', 'manual')),
  video_embed_url text,
  image_url text,
  base_servings int not null default 4,
  prep_time_min int,
  cook_time_min int,
  category text,
  cuisine text,
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

-- Row Level Security: jeder Nutzer sieht nur seine eigenen Daten
alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.shopping_list enable row level security;

create policy "own recipes" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own ingredients" on public.ingredients
  for all using (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );

create policy "own shopping list" on public.shopping_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
