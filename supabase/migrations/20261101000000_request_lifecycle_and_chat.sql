-- =============================================================================
-- Requests: urgency, a full lifecycle, a feed sorted by urgency and distance,
-- and a text-only handover chat that refuses patient details.
--
-- Lifecycle of one request (one row per pharmacy asked):
--   open      waiting for an answer (expires after 2 hours)
--   held      "Confirm we have it": stock held for 30 minutes
--   dispensed the receiving pharmacy downloaded the prescription (closed)
--   declined  "Not available"
--   cancelled the requesting pharmacy closed it
--   expired   nobody answered in 2 hours, or the 30-minute hold ran out
-- "expired" is never stored: it's worked out from the times whenever the
-- data is read, so it happens on time without any scheduled job.
-- =============================================================================


-- 1. New columns ----------------------------------------------------------------

create type public.request_urgency as enum ('urgent', 'routine');

alter table public.stock_requests
  add column urgency      public.request_urgency not null default 'routine',
  add column closed_at    timestamptz,
  add column close_reason text check (close_reason in ('dispensed', 'cancelled', 'expired'));

-- How long an unanswered request stays open.
create or replace function public.request_open_window()
returns interval
language sql
immutable
as $$ select interval '2 hours' $$;

-- The lifecycle state of a request, as described at the top of this file.
create or replace function public.request_state(r public.stock_requests)
returns text
language sql
stable
as $$
  select case
    when r.close_reason is not null then r.close_reason
    when r.status = 'declined' then 'declined'
    when r.status = 'confirmed' then
      case when r.reserved_until > now() then 'held' else 'expired' end
    when r.created_at <= now() - public.request_open_window() then 'expired'
    else 'open'
  end;
$$;


-- 2. Request rules (replaces the previous version) -----------------------------

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
    new.closed_at := null;
    new.close_reason := null;
    new.created_at := now();
    new.created_by := auth.uid();
    return new;
  end if;

  if old.closed_at is not null then
    raise exception 'This request is closed';
  end if;
  -- What was asked for can never change after sending.
  if (new.from_pharmacy_id, new.to_pharmacy_id, new.medicine_id, new.message, new.created_by,
      new.created_at, new.pack_size, new.quantity, new.broadcast_id, new.urgency)
     is distinct from
     (old.from_pharmacy_id, old.to_pharmacy_id, old.medicine_id, old.message, old.created_by,
      old.created_at, old.pack_size, old.quantity, old.broadcast_id, old.urgency) then
    raise exception 'Only the status of a request can be changed';
  end if;

  if new.status is distinct from old.status then
    -- Answering.
    if old.status <> 'pending' then
      raise exception 'This request has already been answered';
    end if;
    if new.status = 'pending' then
      raise exception 'A response must confirm or decline the request';
    end if;
    if old.created_at <= now() - public.request_open_window() then
      raise exception 'This request has expired';
    end if;
    new.responded_at := now();
    new.reserved_until := case when new.status = 'confirmed' then now() + interval '30 minutes' end;
    new.closed_at := null;
    new.close_reason := null;
  else
    -- Closing (only via close_stock_request below). Times are set here.
    if (new.responded_at, new.reserved_until) is distinct from (old.responded_at, old.reserved_until) then
      raise exception 'Only the status of a request can be changed';
    end if;
    if new.close_reason is not null then
      -- Closing only happens inside close_stock_request(), close_broadcast()
      -- or expire_stale_requests(), which check the rules first. They run as
      -- the database owner; a direct API call runs as "authenticated".
      if current_user = 'authenticated' then
        raise exception 'Close requests with close_stock_request()' using errcode = '42501';
      end if;
      new.closed_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Close a request: "dispensed" by the pharmacy holding the stock (during the
-- hold), or "cancelled" by the pharmacy that asked.
create or replace function public.close_stock_request(p_request_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_requests;
begin
  select * into r from public.stock_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;

  if p_reason = 'dispensed' then
    if not public.is_staff_of(r.to_pharmacy_id) then
      raise exception 'Only the pharmacy holding the stock can mark it dispensed'
        using errcode = '42501';
    end if;
    if public.request_state(r) <> 'held' then
      raise exception 'Only a held request can be marked dispensed';
    end if;
  elsif p_reason = 'cancelled' then
    if not public.is_staff_of(r.from_pharmacy_id) then
      raise exception 'Only the pharmacy that asked can cancel' using errcode = '42501';
    end if;
    if public.request_state(r) not in ('open', 'held') then
      raise exception 'This request is already closed';
    end if;
  else
    raise exception 'Unknown reason';
  end if;

  update public.stock_requests set close_reason = p_reason where id = r.id;
  return p_reason;
end;
$$;

-- Close every still-open request of a broadcast ("got it elsewhere").
create or replace function public.close_broadcast(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not exists (
    select 1 from public.stock_requests
    where broadcast_id = p_broadcast_id and public.is_staff_of(from_pharmacy_id)
  ) then
    raise exception 'Only the pharmacy that asked can close this' using errcode = '42501';
  end if;

  update public.stock_requests r set close_reason = 'cancelled'
  where r.broadcast_id = p_broadcast_id and public.request_state(r) in ('open', 'held');
  get diagnostics n = row_count;
  return n;
end;
$$;


-- 3. Broadcasts gain an urgency (signature change: drop and recreate) -----------

-- An unanswered request that's past its 2 hours is shown as "expired", but
-- until it's actually closed it still counts as an open request to that
-- pharmacy, which would stop us asking them again. This closes those first.
create or replace function public.expire_stale_requests(p_from_pharmacy_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_staff_of(p_from_pharmacy_id) then
    raise exception 'Not your pharmacy' using errcode = '42501';
  end if;
  update public.stock_requests set close_reason = 'expired'
  where from_pharmacy_id = p_from_pharmacy_id
    and status = 'pending' and closed_at is null
    and created_at <= now() - public.request_open_window();
  get diagnostics n = row_count;
  return n;
end;
$$;

drop function public.broadcast_stock_request(uuid, uuid, integer, integer, integer);

create function public.broadcast_stock_request(
  p_from_pharmacy_id uuid,
  p_medicine_id uuid,
  p_radius_m integer,
  p_pack_size integer default null,
  p_quantity integer default 1,
  p_urgency public.request_urgency default 'routine'
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
  if not public.is_staff_of(p_from_pharmacy_id) then
    raise exception 'You can only send requests from your own pharmacy' using errcode = '42501';
  end if;
  perform public.expire_stale_requests(p_from_pharmacy_id);

  insert into public.stock_requests
    (from_pharmacy_id, to_pharmacy_id, medicine_id, pack_size, quantity, urgency, broadcast_id)
  select p_from_pharmacy_id, p.id, p_medicine_id, p_pack_size, p_quantity, p_urgency, v_broadcast_id
  from public.pharmacies p
  join public.pharmacies me on me.id = p_from_pharmacy_id
  where p.id <> me.id
    and st_dwithin(p.location, me.location, least(greatest(p_radius_m, 100), 50000))
  -- Must match the unique index below exactly, or Postgres can't use it.
  on conflict (from_pharmacy_id, to_pharmacy_id, medicine_id)
    where status = 'pending' and closed_at is null
    do nothing;

  get diagnostics v_recipients = row_count;
  return query select v_broadcast_id, v_recipients;
end;
$$;

-- An old unanswered request no longer blocks asking the same pharmacy again:
-- the "one open request" index now ignores closed ones.
drop index public.stock_requests_one_pending;
create unique index stock_requests_one_pending
  on public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id)
  where status = 'pending' and closed_at is null;


-- 4. The feeds the requests page shows -----------------------------------------

-- Requests TO a pharmacy: open first, then urgent, then nearest.
create or replace function public.incoming_requests(p_pharmacy_id uuid)
returns table (
  id                uuid,
  state             text,
  urgency           public.request_urgency,
  medicine_name     text,
  medicine_strength text,
  medicine_form     text,
  pack_size         integer,
  quantity          integer,
  from_name         text,
  from_postcode     text,
  distance_m        double precision,
  created_at        timestamptz,
  reserved_until    timestamptz,
  broadcast_id      uuid
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select r.id, public.request_state(r), r.urgency,
         m.name, m.strength, m.form, r.pack_size, r.quantity,
         f.name, f.postcode, st_distance(f.location, me.location),
         r.created_at, r.reserved_until, r.broadcast_id
  from public.stock_requests r
  join public.medicines m on m.id = r.medicine_id
  join public.pharmacies f on f.id = r.from_pharmacy_id
  join public.pharmacies me on me.id = r.to_pharmacy_id
  where r.to_pharmacy_id = p_pharmacy_id
    and r.created_at > now() - interval '7 days'
  order by
    case public.request_state(r) when 'held' then 0 when 'open' then 1 else 2 end,
    case r.urgency when 'urgent' then 0 else 1 end,
    st_distance(f.location, me.location),
    r.created_at desc
  limit 100;
$$;

-- Requests FROM a pharmacy, with the other pharmacy's contact details for
-- the handover. Newest first.
create or replace function public.outgoing_requests(p_pharmacy_id uuid)
returns table (
  id             uuid,
  state          text,
  urgency        public.request_urgency,
  medicine_name  text,
  pack_size      integer,
  quantity       integer,
  to_name        text,
  to_address     text,
  to_postcode    text,
  to_phone       text,
  distance_m     double precision,
  created_at     timestamptz,
  reserved_until timestamptz,
  broadcast_id   uuid
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select r.id, public.request_state(r), r.urgency,
         m.name, r.pack_size, r.quantity,
         t.name, t.address_line, t.postcode, t.phone, st_distance(t.location, me.location),
         r.created_at, r.reserved_until, r.broadcast_id
  from public.stock_requests r
  join public.medicines m on m.id = r.medicine_id
  join public.pharmacies t on t.id = r.to_pharmacy_id
  join public.pharmacies me on me.id = r.from_pharmacy_id
  where r.from_pharmacy_id = p_pharmacy_id
    and r.created_at > now() - interval '7 days'
  order by r.created_at desc, st_distance(t.location, me.location)
  limit 200;
$$;


-- 5. Handover chat ---------------------------------------------------------------

-- True if the text looks like it contains patient details: an NHS number,
-- a date (of birth), a UK postcode, a phone number, or words like "DOB".
-- Kept in step with src/lib/patient-data.ts, which checks before sending.
create or replace function public.contains_patient_details(p_text text)
returns boolean
language sql
immutable
as $$
  select p_text ~ '(^|[^0-9])[0-9]{3} ?[0-9]{3} ?[0-9]{4}([^0-9]|$)'                 -- NHS number
      or p_text ~ '(^|[^0-9])[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}([^0-9]|$)'      -- date
      or p_text ~* '(^|[^a-z0-9])[a-z]{1,2}[0-9][a-z0-9]? ?[0-9][a-z]{2}([^a-z0-9]|$)' -- postcode
      or p_text ~ '(^|[^0-9])(\+44 ?|0)[0-9]( ?[0-9]){8,9}([^0-9]|$)'                -- phone
      or p_text ~* '(^|[^a-z])(dob|d\.o\.b|date of birth|nhs (no|num|number))([^a-z]|$)';
$$;

create table public.request_messages (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references public.stock_requests (id) on delete cascade,
  sender_pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  sender_user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body               text not null check (char_length(body) between 1 and 500),
  created_at         timestamptz not null default now()
);

create index request_messages_request_idx on public.request_messages (request_id, created_at);

-- Who is sending (worked out here, not trusted from the app), whether the
-- chat is open, and no patient details.
create or replace function public.guard_request_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_requests;
begin
  select * into r from public.stock_requests where id = new.request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  new.sender_user_id := auth.uid();
  new.created_at := now();
  new.body := btrim(new.body);
  new.sender_pharmacy_id := case
    when public.is_staff_of(r.to_pharmacy_id) then r.to_pharmacy_id
    when public.is_staff_of(r.from_pharmacy_id) then r.from_pharmacy_id
  end;
  if new.sender_pharmacy_id is null then
    raise exception 'Only the two pharmacies can use this chat' using errcode = '42501';
  end if;
  if public.request_state(r) <> 'held' then
    raise exception 'The chat is closed';
  end if;
  if public.contains_patient_details(new.body) then
    raise exception 'Messages can''t include patient details' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger request_messages_guard
  before insert on public.request_messages
  for each row execute function public.guard_request_message();

alter table public.request_messages enable row level security;

create policy "The two pharmacies can read their chat"
  on public.request_messages for select to authenticated
  using (exists (
    select 1 from public.stock_requests r
    where r.id = request_id
      and (public.is_staff_of(r.from_pharmacy_id) or public.is_staff_of(r.to_pharmacy_id))
  ));

create policy "The two pharmacies can write in their chat"
  on public.request_messages for insert to authenticated
  with check (sender_user_id = auth.uid());

-- Messages can't be edited or deleted: no update or delete policies.

alter publication supabase_realtime add table public.request_messages;
