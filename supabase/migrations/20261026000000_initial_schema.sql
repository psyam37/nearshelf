-- =============================================================================
-- Pharmacy Stock Finder: initial schema
--
-- Who can see what (B2B, pharmacy staff only):
--   * Pharmacies and the medicines catalogue are public information.
--   * Stock levels are readable without signing in FOR NOW, so you can build
--     search (Days 3-6) before auth exists. Day 7: restrict to authenticated.
--   * Only staff linked to a pharmacy can change that pharmacy's stock.
--   * Stock requests are visible to the two pharmacies involved.
-- We store availability LEVELS (in stock / low / out), never exact counts.
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.stock_level as enum ('in_stock', 'low', 'out_of_stock');
create type public.request_status as enum ('pending', 'confirmed', 'declined');

-- ---------------------------------------------------------------------------
-- Pharmacies
-- ---------------------------------------------------------------------------
create table public.pharmacies (
  id            uuid primary key default gen_random_uuid(),
  ods_code      text unique,                 -- NHS ODS code (fake in seed data)
  name          text not null,
  address_line  text not null,
  town          text not null,
  postcode      text not null,
  phone         text,
  location      extensions.geography(point, 4326) not null,
  opening_hours jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index pharmacies_location_idx on public.pharmacies using gist (location);

-- ---------------------------------------------------------------------------
-- Medicines (shaped after the NHS dm+d)
--   dmd_vmp_id        = Virtual Medicinal Product id, e.g. "Sertraline 50mg tablets"
--   equivalence_group = the VTM (Virtual Therapeutic Moiety), e.g. "Sertraline",
--                       used to find equivalent products across brands/strengths
-- ---------------------------------------------------------------------------
create table public.medicines (
  id                uuid primary key default gen_random_uuid(),
  dmd_vmp_id        text unique,             -- null until real dm+d data is imported
  name              text not null,
  strength          text,
  form              text,
  equivalence_group text not null,
  is_controlled     boolean not null default false,
  created_at        timestamptz not null default now()
);

create index medicines_name_trgm_idx
  on public.medicines using gin (name extensions.gin_trgm_ops);
create index medicines_equivalence_group_idx
  on public.medicines (equivalence_group);

-- ---------------------------------------------------------------------------
-- Staff membership: which signed-in users work at which pharmacy
-- ---------------------------------------------------------------------------
create table public.pharmacy_staff (
  user_id     uuid not null references auth.users (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  role        text not null default 'staff' check (role in ('staff', 'manager')),
  created_at  timestamptz not null default now(),
  primary key (user_id, pharmacy_id)
);

-- ---------------------------------------------------------------------------
-- Stock status: one row per pharmacy + medicine
-- ---------------------------------------------------------------------------
create table public.stock_status (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  level       public.stock_level not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (pharmacy_id, medicine_id)
);

create index stock_status_medicine_idx on public.stock_status (medicine_id);

-- ---------------------------------------------------------------------------
-- Stock requests: "can you confirm you have X?" between pharmacies
-- ---------------------------------------------------------------------------
create table public.stock_requests (
  id               uuid primary key default gen_random_uuid(),
  from_pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  to_pharmacy_id   uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id      uuid not null references public.medicines (id) on delete cascade,
  status           public.request_status not null default 'pending',
  message          text check (char_length(message) <= 500),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  responded_at     timestamptz,
  check (from_pharmacy_id <> to_pharmacy_id)
);

create index stock_requests_to_idx on public.stock_requests (to_pharmacy_id, status);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the current user staff at the given pharmacy?
create or replace function public.is_staff_of(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pharmacy_staff
    where user_id = auth.uid() and pharmacy_id = p_pharmacy_id
  );
$$;

-- Stamp who updated stock and when, so readers can judge freshness.
create or replace function public.touch_stock_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger stock_status_touch
  before insert or update on public.stock_status
  for each row execute function public.touch_stock_status();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.pharmacies     enable row level security;
alter table public.medicines      enable row level security;
alter table public.pharmacy_staff enable row level security;
alter table public.stock_status   enable row level security;
alter table public.stock_requests enable row level security;

create policy "Anyone can read pharmacies"
  on public.pharmacies for select to anon, authenticated using (true);

create policy "Anyone can read medicines"
  on public.medicines for select to anon, authenticated using (true);

create policy "Users can see their own staff memberships"
  on public.pharmacy_staff for select to authenticated
  using (user_id = auth.uid());

-- TODO (Day 7): change "to anon, authenticated" to "to authenticated" in a new migration.
create policy "Stock levels are readable (dev: no sign-in needed yet)"
  on public.stock_status for select to anon, authenticated using (true);

create policy "Staff can add stock rows for their pharmacy"
  on public.stock_status for insert to authenticated
  with check (public.is_staff_of(pharmacy_id));

create policy "Staff can update stock rows for their pharmacy"
  on public.stock_status for update to authenticated
  using (public.is_staff_of(pharmacy_id))
  with check (public.is_staff_of(pharmacy_id));

create policy "Pharmacies involved can see a request"
  on public.stock_requests for select to authenticated
  using (public.is_staff_of(from_pharmacy_id) or public.is_staff_of(to_pharmacy_id));

create policy "Staff can send requests from their pharmacy"
  on public.stock_requests for insert to authenticated
  with check (public.is_staff_of(from_pharmacy_id) and created_by = auth.uid());

create policy "Receiving pharmacy can answer a request"
  on public.stock_requests for update to authenticated
  using (public.is_staff_of(to_pharmacy_id))
  with check (public.is_staff_of(to_pharmacy_id));

-- ---------------------------------------------------------------------------
-- Queries the app calls (via supabase.rpc)
-- security invoker = row level security still applies to the caller
-- ---------------------------------------------------------------------------

-- Medicine autocomplete (Days 3–4)
create or replace function public.search_medicines(p_query text, p_limit int default 10)
returns setof public.medicines
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select m.*
  from public.medicines m
  where m.name ilike '%' || p_query || '%'
     or m.equivalence_group ilike '%' || p_query || '%'
  order by similarity(m.name, p_query) desc, m.name
  limit least(greatest(p_limit, 1), 50);
$$;

-- Nearby pharmacies with a medicine (Days 5–6)
-- p_include_equivalents = also match other products in the same equivalence group
create or replace function public.nearby_stock(
  p_medicine_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_include_equivalents boolean default false
)
returns table (
  pharmacy_id   uuid,
  pharmacy_name text,
  address_line  text,
  town          text,
  postcode      text,
  phone         text,
  lat           double precision,
  lng           double precision,
  distance_m    double precision,
  medicine_id   uuid,
  medicine_name text,
  level         public.stock_level,
  updated_at    timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  ),
  wanted as (
    select m.id
    from public.medicines m
    where m.id = p_medicine_id
       or (p_include_equivalents and m.equivalence_group = (
             select equivalence_group from public.medicines where id = p_medicine_id))
  )
  select
    p.id, p.name, p.address_line, p.town, p.postcode, p.phone,
    st_y(p.location::geometry), st_x(p.location::geometry),
    st_distance(p.location, o.g),
    m.id, m.name,
    s.level, s.updated_at
  from public.pharmacies p
  cross join origin o
  join public.stock_status s on s.pharmacy_id = p.id
  join public.medicines m on m.id = s.medicine_id
  where s.medicine_id in (select id from wanted)
    and st_dwithin(p.location, o.g, least(p_radius_m, 50000))
  order by
    case s.level when 'in_stock' then 0 when 'low' then 1 else 2 end,
    st_distance(p.location, o.g);
$$;

-- ---------------------------------------------------------------------------
-- Live updates (Days 9–10): broadcast stock changes and new requests
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.stock_status;
alter publication supabase_realtime add table public.stock_requests;
