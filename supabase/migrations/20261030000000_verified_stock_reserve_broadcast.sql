-- =============================================================================
-- 1. Stock is "verified" for 2 hours, then shown as "Unverified".
-- 2. A "yes" to a request holds the stock for 30 minutes (a soft reserve).
-- 3. Broadcast one request to every pharmacy within a radius.
--
-- The app never moves medicine between businesses (that needs a Wholesale
-- Dealer's Licence). It only shows who has it, so the patient's electronic
-- prescription can go to the pharmacy that does.
-- =============================================================================


-- 1. Two-hour verification window ----------------------------------------------

-- One place for the window, used by every query below. Keep in step with
-- UNVERIFIED_AFTER_HOURS in src/lib/stock.ts.
create or replace function public.stock_verified_window()
returns interval
language sql
immutable
as $$ select interval '2 hours' $$;

-- nearby_stock gains a `verified` column, and verified stock now ranks above
-- unverified. Nothing has to run on a timer: "verified" is worked out from
-- updated_at every time someone searches, so it lapses on its own.
-- (Changing a function's columns means dropping and recreating it.)
drop function public.nearby_stock(uuid, double precision, double precision, integer, boolean);

create function public.nearby_stock(
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
  updated_at    timestamptz,
  verified      boolean
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
    s.level, s.updated_at,
    s.updated_at > now() - public.stock_verified_window()
  from public.pharmacies p
  cross join origin o
  join public.stock_status s on s.pharmacy_id = p.id
  join public.medicines m on m.id = s.medicine_id
  where s.medicine_id in (select id from wanted)
    and st_dwithin(p.location, o.g, least(p_radius_m, 50000))
  order by
    case
      when s.level = 'out_of_stock' then 3
      when s.updated_at <= now() - public.stock_verified_window() then 2  -- unverified
      when s.level = 'low' then 1
      else 0
    end,
    st_distance(p.location, o.g);
$$;

-- "Still in stock": re-confirm every in-stock/low row of a pharmacy in one go.
-- The touch trigger stamps updated_at and updated_by. Row level security
-- still applies, so only that pharmacy's staff can do it.
create or replace function public.reconfirm_stock(p_pharmacy_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  with touched as (
    update public.stock_status
    set updated_at = now()
    where pharmacy_id = p_pharmacy_id and level <> 'out_of_stock'
    returning 1
  )
  select count(*)::integer from touched;
$$;


-- 2 + 3. Request details, soft reserve, broadcasts -------------------------------

alter table public.stock_requests
  add column pack_size      integer check (pack_size between 1 and 1000),
  add column quantity       integer check (quantity between 1 and 100),
  add column reserved_until timestamptz,
  add column broadcast_id   uuid;

create index stock_requests_broadcast_idx on public.stock_requests (broadcast_id);

-- The request rules from Days 9–10, extended: new fields can't be changed
-- after sending, and a "confirmed" answer starts a 30-minute hold.
create or replace function public.guard_stock_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.responded_at := null;
    new.reserved_until := null;
    new.created_at := now();
    new.created_by := auth.uid();
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'This request has already been answered';
  end if;
  if new.status = 'pending' then
    raise exception 'A response must confirm or decline the request';
  end if;
  if (new.from_pharmacy_id, new.to_pharmacy_id, new.medicine_id, new.message, new.created_by,
      new.created_at, new.pack_size, new.quantity, new.broadcast_id)
     is distinct from
     (old.from_pharmacy_id, old.to_pharmacy_id, old.medicine_id, old.message, old.created_by,
      old.created_at, old.pack_size, old.quantity, old.broadcast_id) then
    raise exception 'Only the status of a request can be changed';
  end if;

  new.responded_at := now();
  -- "Yes, we have it" holds the stock while the patient travels.
  new.reserved_until := case when new.status = 'confirmed' then now() + interval '30 minutes' end;
  return new;
end;
$$;

-- Send one request to every other pharmacy within p_radius_m of the sender.
-- Pharmacies already asked about this medicine (still pending) are skipped.
-- Returns the broadcast's id and how many pharmacies it reached.
create or replace function public.broadcast_stock_request(
  p_from_pharmacy_id uuid,
  p_medicine_id uuid,
  p_radius_m integer,
  p_pack_size integer default null,
  p_quantity integer default 1
)
returns table (broadcast_id uuid, recipients integer)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_broadcast_id uuid := gen_random_uuid();
  v_recipients integer;
begin
  -- Row level security checks each insert too; this gives a clearer error.
  if not public.is_staff_of(p_from_pharmacy_id) then
    raise exception 'You can only send requests from your own pharmacy' using errcode = '42501';
  end if;

  insert into public.stock_requests
    (from_pharmacy_id, to_pharmacy_id, medicine_id, pack_size, quantity, broadcast_id)
  select p_from_pharmacy_id, p.id, p_medicine_id, p_pack_size, p_quantity, v_broadcast_id
  from public.pharmacies p
  join public.pharmacies me on me.id = p_from_pharmacy_id
  where p.id <> me.id
    and st_dwithin(p.location, me.location, least(greatest(p_radius_m, 100), 50000))
  on conflict (from_pharmacy_id, to_pharmacy_id, medicine_id) where status = 'pending'
    do nothing;

  get diagnostics v_recipients = row_count;
  return query select v_broadcast_id, v_recipients;
end;
$$;
