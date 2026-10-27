-- =============================================================================
-- Patients can find medicines too (the brief's "Model 2"), safely:
--   * a pharmacy chooses, medicine by medicine, what the public may see
--   * only stock confirmed in the last 2 hours is shown
--   * controlled drugs are never shown publicly (theft risk)
--   * no patient accounts and nothing stored about who searched; we only
--     count, per pharmacy and medicine and day, how often a listing appeared
-- =============================================================================

-- What each pharmacy shows to the public. A row = "listed".
create table public.public_listings (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (pharmacy_id, medicine_id)
);

-- How often each listing appeared in public searches, per day. Counts only:
-- nothing about who searched or where from.
create table public.public_listing_views (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  day         date not null default current_date,
  views       integer not null default 0,
  primary key (pharmacy_id, medicine_id, day)
);

alter table public.public_listings enable row level security;
alter table public.public_listing_views enable row level security;

-- Staff manage their own pharmacy's listings. Controlled drugs can't be
-- listed at all: the check is here in the database, not just in the app.
create policy "Staff can see their pharmacy's listings"
  on public.public_listings for select to authenticated
  using (public.is_staff_of(pharmacy_id));

create policy "Staff can list non-controlled medicines for their pharmacy"
  on public.public_listings for insert to authenticated
  with check (
    public.is_staff_of(pharmacy_id)
    and not exists (
      select 1 from public.medicines m where m.id = medicine_id and m.is_controlled
    )
  );

create policy "Staff can unlist their pharmacy's medicines"
  on public.public_listings for delete to authenticated
  using (public.is_staff_of(pharmacy_id));

create policy "Staff can see how often their listings were shown"
  on public.public_listing_views for select to authenticated
  using (public.is_staff_of(pharmacy_id));

-- The public search. Callable without signing in. It runs with the owner's
-- rights (stock is otherwise staff-only), so every rule is written here.
create or replace function public.public_find_stock(
  p_medicine_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 8047
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
  medicine_name text,
  level         public.stock_level,
  confirmed_at  timestamptz
)
language plpgsql
volatile -- it records view counts
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  shown uuid[] := '{}';
begin
  -- Controlled drugs: never, whatever any listing says.
  if exists (select 1 from public.medicines m where m.id = p_medicine_id and m.is_controlled) then
    return;
  end if;

  for pharmacy_id, pharmacy_name, address_line, town, postcode, phone, lat, lng,
      distance_m, medicine_name, level, confirmed_at in
    select p.id, p.name, p.address_line, p.town, p.postcode, p.phone,
           st_y(p.location::geometry), st_x(p.location::geometry),
           st_distance(p.location, o.g), m.name, s.level, s.updated_at
    from public.public_listings l
    join public.stock_status s on s.pharmacy_id = l.pharmacy_id and s.medicine_id = l.medicine_id
    join public.pharmacies p on p.id = l.pharmacy_id
    join public.medicines m on m.id = l.medicine_id
    cross join (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g) o
    where l.medicine_id = p_medicine_id
      and s.level in ('in_stock', 'low')                                   -- not out of stock
      and s.updated_at > now() - public.stock_verified_window()            -- confirmed in 2 hours
      and st_dwithin(p.location, o.g, least(greatest(p_radius_m, 500), 16100))  -- up to 10 miles
    order by case s.level when 'in_stock' then 0 else 1 end, st_distance(p.location, o.g)
    limit 20
  loop
    shown := shown || pharmacy_id;
    return next;
  end loop;

  -- Count that each listing was shown once more today (counts only).
  insert into public.public_listing_views as v (pharmacy_id, medicine_id, day, views)
  select unnest(shown), p_medicine_id, current_date, 1
  on conflict on constraint public_listing_views_pkey
    do update set views = v.views + 1;
end;
$$;

grant execute on function public.public_find_stock(uuid, double precision, double precision, integer)
  to anon, authenticated;

-- A pharmacy's listing stats for the last 30 days (staff only, via RLS on
-- the tables underneath).
create or replace function public.public_listing_stats(p_pharmacy_id uuid)
returns table (medicine_id uuid, medicine_name text, views_30d bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.medicine_id, m.name, coalesce(sum(v.views), 0)
  from public.public_listings l
  join public.medicines m on m.id = l.medicine_id
  left join public.public_listing_views v
    on v.pharmacy_id = l.pharmacy_id and v.medicine_id = l.medicine_id
   and v.day > current_date - 30
  where l.pharmacy_id = p_pharmacy_id
  group by l.medicine_id, m.name
  order by 3 desc, m.name;
$$;
