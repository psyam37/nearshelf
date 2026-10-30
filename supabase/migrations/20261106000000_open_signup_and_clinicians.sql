-- =============================================================================
-- Opening NearShelf up.
--
-- 1. Any real NHS pharmacy can join. The first time someone from a pharmacy
--    applies, the app adds it using its details from the NHS directory.
-- 2. The first approved member of a pharmacy becomes its manager, so they
--    can approve their own colleagues from then on.
-- 3. Pharmacists outside community pharmacy (GP practices, locums) can apply
--    for view-only access to stock. A NearShelf admin approves them.
-- 4. Each pharmacy chooses whether those pharmacists see its stock.
-- 5. Stock levels are only readable by people with a reason to see them.
--    Until now, any signed-in account could read them.
-- =============================================================================


-- 1. Adding a pharmacy from the NHS directory ---------------------------------

-- Only the server calls this, with the secret key, after checking the ODS code
-- with the NHS directory and the postcode with postcodes.io. If two people
-- from a new pharmacy apply at once, both get the same pharmacy.
create or replace function public.add_nhs_pharmacy(
  p_ods_code text,
  p_name text,
  p_address_line text,
  p_town text,
  p_postcode text,
  p_phone text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result uuid;
begin
  insert into public.pharmacies (ods_code, name, address_line, town, postcode, phone, location)
  values (upper(p_ods_code), p_name, p_address_line, p_town, upper(p_postcode), nullif(p_phone, ''),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  on conflict (ods_code) do nothing
  returning id into result;

  if result is null then
    select id into result from public.pharmacies where ods_code = upper(p_ods_code);
  end if;
  return result;
end;
$$;

-- Supabase lets signed-in users call new functions by default. Not this one.
revoke execute on function public.add_nhs_pharmacy(text, text, text, text, text, text, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.add_nhs_pharmacy(text, text, text, text, text, text, double precision, double precision)
  to service_role;


-- 2. The first approved member becomes the manager ------------------------------

-- Same as before, except for the role given on approval.
create or replace function public.review_staff_application(p_application_id uuid, p_approve boolean)
returns public.application_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.staff_applications;
begin
  select * into app from public.staff_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if not (public.is_manager_of(app.pharmacy_id) or public.is_platform_admin()) then
    raise exception 'Only a manager at this pharmacy or a NearShelf admin can review this'
      using errcode = '42501';
  end if;
  if app.user_id = auth.uid() then
    raise exception 'You can''t review your own application' using errcode = '42501';
  end if;
  if app.status <> 'pending' then
    raise exception 'This application was already reviewed';
  end if;

  update public.staff_applications
  set status = case when p_approve then 'approved' else 'rejected' end::public.application_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = app.id;

  if p_approve then
    insert into public.pharmacy_staff (user_id, pharmacy_id, role)
    values (
      app.user_id,
      app.pharmacy_id,
      case
        when exists (select 1 from public.pharmacy_staff
                     where pharmacy_id = app.pharmacy_id and role = 'manager') then 'staff'
        else 'manager'
      end
    )
    on conflict do nothing;
  end if;

  return case when p_approve then 'approved' else 'rejected' end::public.application_status;
end;
$$;


-- 3. Pharmacists outside community pharmacy --------------------------------------

-- Where they work: a GP practice (checked against the NHS directory) or
-- anywhere else, e.g. a locum, in their own words.
create type public.clinician_setting as enum ('gp_practice', 'other');

create table public.clinician_applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 100),
  gphc_number text not null check (gphc_number ~ '^[0-9]{7}$'),
  setting     public.clinician_setting not null,
  -- The GP practice's ODS code; empty for other settings.
  ods_code    text check (ods_code ~ '^[A-Z0-9]{3,10}$'),
  -- The practice's name from the NHS directory, or where they work.
  workplace   text not null check (char_length(workplace) between 2 and 120),
  postcode    text not null check (char_length(postcode) between 5 and 8),
  status      public.application_status not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  constraint clinician_applications_gp_has_code
    check ((setting = 'gp_practice') = (ods_code is not null))
);

-- One open or approved application per person, and per GPhC number.
create unique index clinician_applications_one_per_user
  on public.clinician_applications (user_id) where status <> 'rejected';
create unique index clinician_applications_gphc_once
  on public.clinician_applications (gphc_number) where status <> 'rejected';
create index clinician_applications_status_idx
  on public.clinician_applications (status, created_at);

-- New applications always start pending, for the signed-in user.
create or replace function public.guard_clinician_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.created_at := now();
  new.reviewed_at := null;
  new.reviewed_by := null;
  return new;
end;
$$;

create trigger clinician_applications_guard
  before insert on public.clinician_applications
  for each row execute function public.guard_clinician_application();

create or replace function public.is_approved_clinician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinician_applications
    where user_id = auth.uid() and status = 'approved'
  );
$$;

alter table public.clinician_applications enable row level security;

create policy "People can apply for themselves"
  on public.clinician_applications for insert to authenticated
  with check (user_id = auth.uid());

create policy "Applicants and admins can see an application"
  on public.clinician_applications for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "Applicants can withdraw a pending application"
  on public.clinician_applications for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- No update policy: decisions only go through review_clinician_application().
create or replace function public.review_clinician_application(p_application_id uuid, p_approve boolean)
returns public.application_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.clinician_applications;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a NearShelf admin can review this' using errcode = '42501';
  end if;
  select * into app from public.clinician_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if app.user_id = auth.uid() then
    raise exception 'You can''t review your own application' using errcode = '42501';
  end if;
  if app.status <> 'pending' then
    raise exception 'This application was already reviewed';
  end if;

  update public.clinician_applications
  set status = case when p_approve then 'approved' else 'rejected' end::public.application_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = app.id;

  return case when p_approve then 'approved' else 'rejected' end::public.application_status;
end;
$$;


-- 4. Each pharmacy chooses -----------------------------------------------------

-- On by default: being findable by local prescribers brings patients in.
alter table public.pharmacies
  add column share_with_clinicians boolean not null default true;

-- Any staff member can switch it. (Pharmacies have no update policy, so this
-- is the only way to change it.)
create or replace function public.set_clinician_sharing(p_pharmacy_id uuid, p_share boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_of(p_pharmacy_id) then
    raise exception 'Only staff at this pharmacy can change this' using errcode = '42501';
  end if;
  update public.pharmacies set share_with_clinicians = p_share where id = p_pharmacy_id;
end;
$$;


-- 5. Who can read stock levels --------------------------------------------------

-- Staff at any pharmacy (the network shares with itself), NearShelf admins,
-- and approved clinicians for pharmacies that share with them.
create or replace function public.can_see_stock(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pharmacy_staff where user_id = auth.uid())
      or public.is_platform_admin()
      or (public.is_approved_clinician()
          and exists (select 1 from public.pharmacies
                      where id = p_pharmacy_id and share_with_clinicians));
$$;

drop policy "Signed-in users can read stock levels" on public.stock_status;

create policy "Staff, admins and approved clinicians can read stock levels"
  on public.stock_status for select to authenticated
  using (public.can_see_stock(pharmacy_id));
