-- =============================================================================
-- NHS email badge on applications.
--
-- NHSmail (@nhs.net) and NHS organisation addresses (ending .nhs.uk) are only
-- given to NHS staff, and signing in proves the applicant owns the address.
-- So an application made while signed in with one is more likely genuine.
-- It's a hint for reviewers, not a replacement for checking the register.
--
-- Only a yes/no is stored: managers can see their pharmacy's applications,
-- and they don't need the applicant's email address.
-- =============================================================================

alter table public.staff_applications
  add column nhs_email boolean not null default false;
alter table public.clinician_applications
  add column nhs_email boolean not null default false;

-- Is the signed-in user's email an NHS one? Read from their session token,
-- which Supabase signs, so it can't be faked from the browser.
create or replace function public.has_nhs_email()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') ~ '(@nhs\.net|\.nhs\.uk)$', false);
$$;

-- The guards now also set nhs_email, so applicants can't set it themselves.
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
  new.nhs_email := public.has_nhs_email();
  if public.is_staff_of(new.pharmacy_id) then
    raise exception 'You already work at this pharmacy';
  end if;
  return new;
end;
$$;

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
  new.nhs_email := public.has_nhs_email();
  return new;
end;
$$;
