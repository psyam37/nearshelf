-- =============================================================================
-- Pilot requests and demo links.
--
-- 1. A pharmacy asks to join the pilot with a form on /pilot, instead of an
--    email. Only the server saves these (with the secret key), and only
--    NearShelf admins can read them.
-- 2. An admin approves a request: the app makes a demo account for it, as
--    staff at the nearest demo pharmacy, and a private demo link to send.
-- 3. Demo and real stay apart. Staff at demo pharmacies only see demo stock
--    and can only ask demo pharmacies; real staff and GP practice
--    pharmacists never see the demo pharmacies. Until now, staff anywhere
--    saw every pharmacy's stock, demo or real.
-- =============================================================================


-- 1. Pilot requests -------------------------------------------------------------

create table public.pilot_requests (
  id            uuid primary key default gen_random_uuid(),
  contact_name  text not null check (char_length(contact_name) between 2 and 100),
  role          text not null check (char_length(role) between 2 and 60),
  pharmacy_name text not null check (char_length(pharmacy_name) between 2 and 120),
  ods_code      text check (ods_code ~ '^[A-Z0-9]{3,10}$'),
  postcode      text not null check (char_length(postcode) between 5 and 8),
  email         text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text check (phone ~ '^[0-9 +()]{6,20}$'),
  message       text check (char_length(message) <= 1000),
  status        public.application_status not null default 'pending',
  -- Set on approval: the demo account, and the secret in its demo link.
  demo_user_id  uuid references auth.users (id) on delete set null,
  demo_token    text unique check (char_length(demo_token) >= 32),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users (id) on delete set null
);

create index pilot_requests_status_idx on public.pilot_requests (status, created_at);

alter table public.pilot_requests enable row level security;

-- No insert or update policies: the server saves and approves requests with
-- the secret key, after its own checks.
create policy "Admins can read pilot requests"
  on public.pilot_requests for select to authenticated
  using (public.is_platform_admin());


-- 2. Approving, rejecting -------------------------------------------------------

-- Is this one of the fictional demo pharmacies? (Their ODS codes start DEMO.)
create or replace function public.is_demo_pharmacy(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ods_code like 'DEMO%' from public.pharmacies where id = p_pharmacy_id), false);
$$;

-- The demo pharmacy nearest a point, so a Nottingham pharmacist gets a
-- Nottingham demo.
create or replace function public.nearest_demo_pharmacy(p_lat double precision, p_lng double precision)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select id from public.pharmacies
  where ods_code like 'DEMO%'
  order by location <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 1;
$$;

-- The server calls this after making the demo account. One transaction, so a
-- request is never approved without its demo access, or the other way round.
create or replace function public.approve_pilot_request(
  p_request_id uuid,
  p_reviewer uuid,
  p_demo_user_id uuid,
  p_demo_pharmacy_id uuid,
  p_demo_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_demo_pharmacy(p_demo_pharmacy_id) then
    raise exception 'Demo accounts can only join demo pharmacies';
  end if;
  update public.pilot_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = p_reviewer,
      demo_user_id = p_demo_user_id, demo_token = p_demo_token
  where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'This request was already reviewed';
  end if;
  insert into public.pharmacy_staff (user_id, pharmacy_id, role)
  values (p_demo_user_id, p_demo_pharmacy_id, 'staff');
end;
$$;

-- Admins reject from the app with their own session.
create or replace function public.reject_pilot_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a NearShelf admin can review this' using errcode = '42501';
  end if;
  update public.pilot_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'This request was already reviewed';
  end if;
end;
$$;

-- Only the server (secret key) may approve or look up the nearest demo.
revoke execute on function public.approve_pilot_request(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_pilot_request(uuid, uuid, uuid, uuid, text)
  to service_role;
revoke execute on function public.nearest_demo_pharmacy(double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.nearest_demo_pharmacy(double precision, double precision)
  to service_role;


-- 3. Demo and real stay apart ----------------------------------------------------

-- Staff see stock at pharmacies in their own world (demo or real); admins see
-- everything; approved GP practice pharmacists see real pharmacies that share.
create or replace function public.can_see_stock(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
      or exists (
           select 1 from public.pharmacy_staff s
           where s.user_id = auth.uid()
             and public.is_demo_pharmacy(s.pharmacy_id) = public.is_demo_pharmacy(p_pharmacy_id))
      or (public.is_approved_clinician()
          and not public.is_demo_pharmacy(p_pharmacy_id)
          and exists (select 1 from public.pharmacies
                      where id = p_pharmacy_id and share_with_clinicians));
$$;

-- Requests only go between two demo pharmacies or two real ones. A broadcast
-- just skips pharmacies in the other world; a direct request is refused.
create or replace function public.guard_request_world()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_demo_pharmacy(new.from_pharmacy_id) = public.is_demo_pharmacy(new.to_pharmacy_id) then
    return new;
  end if;
  if new.broadcast_id is not null then
    return null;
  end if;
  raise exception 'Demo pharmacies and real pharmacies can''t send each other requests';
end;
$$;

create trigger stock_requests_same_world
  before insert on public.stock_requests
  for each row execute function public.guard_request_world();
