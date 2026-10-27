-- =============================================================================
-- Verified sign-up: pharmacy staff apply to join a pharmacy with their GPhC
-- registration number and the pharmacy's NHS ODS code, and a person approves.
--
-- Why a person: the GPhC register has no public API, so a manager at the
-- pharmacy (or a MediBase admin, for a pharmacy's first member) checks the
-- number on the register before approving. The ODS code is checked
-- automatically by the app against the NHS directory.
-- =============================================================================

create type public.application_status as enum ('pending', 'approved', 'rejected');

-- MediBase's own admins: they approve the first member of a pharmacy, which
-- has no manager yet. Add one with:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.staff_applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 100),
  -- GPhC registration numbers are 7 digits (pharmacists and technicians).
  gphc_number text not null check (gphc_number ~ '^[0-9]{7}$'),
  status      public.application_status not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

-- One open application per person, and each GPhC number on one account only.
create unique index staff_applications_one_pending
  on public.staff_applications (user_id) where status = 'pending';
create unique index staff_applications_gphc_once
  on public.staff_applications (gphc_number) where status <> 'rejected';
create index staff_applications_pharmacy_idx
  on public.staff_applications (pharmacy_id, status);

-- Helpers (security definer so they can read the tables they check) ---------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_manager_of(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pharmacy_staff
    where user_id = auth.uid() and pharmacy_id = p_pharmacy_id and role = 'manager'
  );
$$;

-- New applications always start pending, for the signed-in user, and only
-- for a pharmacy they don't already work at.
create or replace function public.guard_staff_application()
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
  if public.is_staff_of(new.pharmacy_id) then
    raise exception 'You already work at this pharmacy';
  end if;
  return new;
end;
$$;

create trigger staff_applications_guard
  before insert on public.staff_applications
  for each row execute function public.guard_staff_application();

-- Row level security -----------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.staff_applications enable row level security;

create policy "Admins can see that they are admins"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create policy "People can apply for themselves"
  on public.staff_applications for insert to authenticated
  with check (user_id = auth.uid());

create policy "Applicants, the pharmacy's managers and admins can see an application"
  on public.staff_applications for select to authenticated
  using (user_id = auth.uid() or public.is_manager_of(pharmacy_id) or public.is_platform_admin());

create policy "Applicants can withdraw a pending application"
  on public.staff_applications for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- No update policy: decisions only go through review_staff_application().

-- Approve or reject ------------------------------------------------------------

-- The only way to decide an application. Approving adds the person to
-- pharmacy_staff as "staff" (a manager can promote them later).
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
    raise exception 'Only a manager at this pharmacy or a MediBase admin can review this'
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
    values (app.user_id, app.pharmacy_id, 'staff')
    on conflict do nothing;
  end if;

  return case when p_approve then 'approved' else 'rejected' end::public.application_status;
end;
$$;

-- Live updates: managers see new applications, applicants see decisions.
alter publication supabase_realtime add table public.staff_applications;
