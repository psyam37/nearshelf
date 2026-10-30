-- =============================================================================
-- Tests for the NHS email badge on applications.
--
-- Run in the Supabase SQL Editor. Acts as oldstreet@example.com, pretending
-- its session carries different email addresses, then ALWAYS undoes
-- everything by finishing with an "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  results text := '';
  app_s public.staff_applications;
  app_c public.clinician_applications;
begin
  if user_o is null then
    raise exception 'Create the test account oldstreet@example.com first.';
  end if;
  delete from public.staff_applications where user_id = user_o;
  delete from public.clinician_applications where user_id = user_o;

  perform set_config('role', 'authenticated', true);

  -- 1. An @nhs.net session marks a staff application, whatever the form sent.
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated', 'email', 'Olivia.Street@NHS.NET')::text, true);
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number)
    values (hox, 'Olivia Street', '9990011')
    returning * into app_s;
  results := results || format(E'\n1. nhs.net email gives the badge: %s', case when app_s.nhs_email then 'PASS' else 'FAIL' end);

  -- 2. So does an NHS organisation address, on a clinician application.
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated', 'email', 'o.street@nottshc.nhs.uk')::text, true);
  insert into public.clinician_applications (full_name, gphc_number, setting, workplace, postcode)
    values ('Olivia Street', '9990012', 'other', 'Locum, Nottingham', 'NG1 5FS')
    returning * into app_c;
  results := results || format(E'\n2. .nhs.uk email gives the badge: %s', case when app_c.nhs_email then 'PASS' else 'FAIL' end);

  -- 3. Any other email doesn't, even if the form claims it.
  delete from public.staff_applications where id = app_s.id;
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated', 'email', 'olivia@nhs.net.example.com')::text, true);
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number, nhs_email)
    values (hox, 'Olivia Street', '9990011', true)
    returning * into app_s;
  results := results || format(E'\n3. Look-alike email, and the form saying yes, give no badge: %s', case when not app_s.nhs_email then 'PASS' else 'FAIL' end);

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
