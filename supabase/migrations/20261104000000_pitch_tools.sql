-- =============================================================================
-- Tools for demos and onboarding (MediBase admins only):
--   * refresh_demo_data()  fresh demo stock times, patient listings, and a
--                          clean slate of demo requests, before a pitch
--   * admin_add_pharmacy() add a real pharmacy (details come from the NHS ODS
--                          directory, looked up by the app)
-- =============================================================================

-- The stock trigger stamps every change with "now". refresh_demo_data()
-- needs to set realistic times instead ("8 min ago", "1 h ago"), so the
-- trigger keeps the given time when that function asks it to. Only database
-- functions can set this flag: it isn't reachable through the API.
create or replace function public.touch_stock_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('medibase.keep_stock_times', true), '') <> 'on' then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Before a demo: every demo pharmacy's stock looks freshly checked (within
-- the last 100 minutes, so inside the 2-hour window), their non-controlled
-- stock is listed for patients, and old requests between demo pharmacies
-- are cleared. Real pharmacies are never touched.
create or replace function public.refresh_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
  listed integer;
  cleared integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only MediBase admins can refresh the demo' using errcode = '42501';
  end if;

  perform set_config('medibase.keep_stock_times', 'on', true);
  update public.stock_status s
  set updated_at = now() - (random() * interval '100 minutes'), updated_by = null
  from public.pharmacies p
  where p.id = s.pharmacy_id and p.ods_code like 'DEMO%';
  get diagnostics touched = row_count;
  perform set_config('medibase.keep_stock_times', 'off', true);

  insert into public.public_listings (pharmacy_id, medicine_id)
  select s.pharmacy_id, s.medicine_id
  from public.stock_status s
  join public.medicines m on m.id = s.medicine_id
  join public.pharmacies p on p.id = s.pharmacy_id
  where p.ods_code like 'DEMO%' and not m.is_controlled and s.level <> 'out_of_stock'
  on conflict do nothing;
  get diagnostics listed = row_count;

  delete from public.stock_requests r
  using public.pharmacies f, public.pharmacies t
  where f.id = r.from_pharmacy_id and t.id = r.to_pharmacy_id
    and f.ods_code like 'DEMO%' and t.ods_code like 'DEMO%';
  get diagnostics cleared = row_count;

  return jsonb_build_object('stock_refreshed', touched, 'newly_listed', listed, 'requests_cleared', cleared);
end;
$$;

-- Add a real pharmacy. The app looks the ODS code up in the NHS directory
-- and the postcode up for coordinates, then calls this.
create or replace function public.admin_add_pharmacy(
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
  new_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only MediBase admins can add pharmacies' using errcode = '42501';
  end if;
  if exists (select 1 from public.pharmacies where ods_code = upper(p_ods_code)) then
    raise exception 'A pharmacy with that ODS code is already on MediBase' using errcode = '23505';
  end if;

  insert into public.pharmacies (ods_code, name, address_line, town, postcode, phone, location)
  values (upper(p_ods_code), p_name, p_address_line, p_town, upper(p_postcode), nullif(p_phone, ''),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  returning id into new_id;
  return new_id;
end;
$$;
