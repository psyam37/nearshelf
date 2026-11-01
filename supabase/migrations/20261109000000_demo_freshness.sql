-- =============================================================================
-- Keeping the pilot demo convincing, and honest.
--
-- 1. Demo stock lapses to "Unverified" 2 hours after it was last confirmed, so
--    someone opening a demo link at a random time saw a stale demo. Now the
--    app refreshes the times whenever a demo link is opened.
-- 2. Fresh demo stock also shows on the public finder, which patients use. So
--    the finder now marks demo pharmacies, and lists real pharmacies first.
-- =============================================================================


-- 1. Fresh demo stock -----------------------------------------------------------

-- Only the server calls this, when a demo link is opened. It moves times only:
-- no levels, listings or requests change, so another demo user's session
-- carries on as it was. Anything confirmed in the last hour is left alone, so
-- what someone has just changed keeps its true time. New times are 5 to 45
-- minutes ago, which keeps the demo verified for over an hour.
create or replace function public.refresh_demo_stock_times()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  perform set_config('medibase.keep_stock_times', 'on', true);
  update public.stock_status s
  set updated_at = now() - interval '5 minutes' - (random() * interval '40 minutes'), updated_by = null
  from public.pharmacies p
  where p.id = s.pharmacy_id
    and p.ods_code like 'DEMO%'
    and s.updated_at < now() - interval '1 hour';
  get diagnostics touched = row_count;
  perform set_config('medibase.keep_stock_times', 'off', true);
  return touched;
end;
$$;

revoke execute on function public.refresh_demo_stock_times() from public, anon, authenticated;
grant execute on function public.refresh_demo_stock_times() to service_role;


-- 2. The public finder marks demo pharmacies ---------------------------------------

-- Same as before, with an is_demo column and real pharmacies listed first.
-- (Changing a function's columns means dropping and recreating it.)
drop function public.public_find_stock(uuid, double precision, double precision, integer);

create function public.public_find_stock(
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
  confirmed_at  timestamptz,
  is_demo       boolean
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
      distance_m, medicine_name, level, confirmed_at, is_demo in
    select p.id, p.name, p.address_line, p.town, p.postcode, p.phone,
           st_y(p.location::geometry), st_x(p.location::geometry),
           st_distance(p.location, o.g), m.name, s.level, s.updated_at,
           coalesce(p.ods_code like 'DEMO%', false)
    from public.public_listings l
    join public.stock_status s on s.pharmacy_id = l.pharmacy_id and s.medicine_id = l.medicine_id
    join public.pharmacies p on p.id = l.pharmacy_id
    join public.medicines m on m.id = l.medicine_id
    cross join (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g) o
    where l.medicine_id = p_medicine_id
      and s.level in ('in_stock', 'low')                                   -- not out of stock
      and s.updated_at > now() - public.stock_verified_window()            -- confirmed in 2 hours
      and st_dwithin(p.location, o.g, least(greatest(p_radius_m, 500), 16100))  -- up to 10 miles
    order by coalesce(p.ods_code like 'DEMO%', false),                     -- real pharmacies first
             case s.level when 'in_stock' then 0 else 1 end, st_distance(p.location, o.g)
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
