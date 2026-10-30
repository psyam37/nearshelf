-- =============================================================================
-- Tests for open sign-up and clinician access.
--
-- Run in the Supabase SQL Editor. Acts as the test accounts hoxton@example.com
-- (manager at DEMO01, made an admin for the test) and oldstreet@example.com
-- (taken out of DEMO02 for the test, so they start as a pharmacist outside
-- community pharmacy), then ALWAYS undoes everything by finishing with an
-- "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  med uuid := (select id from public.medicines order by name limit 1);
  hidden_pharmacy uuid;
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  new_pharmacy uuid;
  results text := '';
  app_c public.clinician_applications;
  app_s public.staff_applications;
  role_now text;
  n integer;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;

  -- Setup, as the database owner.
  delete from public.clinician_applications where user_id in (user_h, user_o);
  delete from public.staff_applications where user_id in (user_h, user_o);
  delete from public.pharmacy_staff where user_id = user_o;
  insert into public.platform_admins (user_id) values (user_h) on conflict do nothing;
  update public.pharmacies set share_with_clinicians = true where id = hox;
  -- Two real (non-demo) pharmacies with stock: one shares with clinicians, one doesn't.
  insert into public.pharmacies (ods_code, name, address_line, town, postcode, location)
    values ('TEST99', 'Test Pharmacy', '1 Test Street', 'Nottingham', 'NG1 1AA',
            st_setsrid(st_makepoint(-1.15, 52.95), 4326)::geography)
    returning id into new_pharmacy;
  insert into public.pharmacies (ods_code, name, address_line, town, postcode, location, share_with_clinicians)
    values ('TEST98', 'Private Test Pharmacy', '2 Test Street', 'Nottingham', 'NG1 1AB',
            st_setsrid(st_makepoint(-1.15, 52.951), 4326)::geography, false)
    returning id into hidden_pharmacy;
  insert into public.stock_status (pharmacy_id, medicine_id, level)
    values (new_pharmacy, med, 'in_stock'), (hidden_pharmacy, med, 'in_stock');

  perform set_config('role', 'authenticated', true);

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 1. Applying can't pre-approve yourself or apply as someone else.
  insert into public.clinician_applications (full_name, gphc_number, setting, ods_code, workplace, postcode, status, user_id)
    values ('Olivia Street', '9990003', 'gp_practice', 'C84023', 'Test Health Centre', 'NG7 2QW', 'approved', user_h)
    returning * into app_c;
  results := results || format(E'\n1. Clinician application forced to pending, as yourself: %s',
    case when app_c.status = 'pending' and app_c.user_id = user_o then 'PASS' else 'FAIL' end);

  -- 2. A GP practice application needs the practice's ODS code.
  begin
    delete from public.clinician_applications where id = app_c.id;
    insert into public.clinician_applications (full_name, gphc_number, setting, workplace, postcode)
      values ('Olivia Street', '9990003', 'gp_practice', 'Test Health Centre', 'NG7 2QW');
    results := results || E'\n2. GP practice without an ODS code refused: FAIL';
  exception when check_violation then
    results := results || E'\n2. GP practice without an ODS code refused: PASS';
  end;

  -- 3. Signed in but not approved: no stock levels at all.
  select count(*) into n from public.stock_status;
  results := results || format(E'\n3. Pending clinician sees %s stock rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 4. Only admins approve clinicians.
  begin
    perform public.review_clinician_application(app_c.id, true);
    results := results || E'\n4. Approving yourself as a clinician refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n4. Approving yourself as a clinician refused: PASS';
  end;

  -- 5. Signed-in users can't add pharmacies directly (only the server can).
  begin
    perform public.add_nhs_pharmacy('FAKE01', 'Fake', 'x', 'x', 'NG1 1AA', '', 52.95, -1.15);
    results := results || E'\n5. Adding a pharmacy without the secret key refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n5. Adding a pharmacy without the secret key refused: PASS';
  end;

  -- 6. Only a pharmacy's staff can change who sees its stock.
  begin
    perform public.set_clinician_sharing(hox, false);
    results := results || E'\n6. Changing another pharmacy''s sharing refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n6. Changing another pharmacy''s sharing refused: PASS';
  end;

  ------------------------------------------------- as Hoxton's user (an admin)
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 7. An admin approves the clinician.
  results := results || format(E'\n7. Admin approves the clinician: %s',
    case when public.review_clinician_application(app_c.id, true) = 'approved' then 'PASS' else 'FAIL' end);

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 8. Approved: sees stock at real pharmacies that share, none at those that
  -- don't, and none at the fictional demo pharmacies.
  select count(*) into n from public.stock_status where pharmacy_id = new_pharmacy;
  results := results || format(E'\n8. Approved clinician sees a sharing pharmacy''s stock (%s rows): %s', n, case when n > 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.stock_status where pharmacy_id in (hidden_pharmacy, hox);
  results := results || format(E'\n9. ...and none from one that doesn''t share, or a demo one (%s rows): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 10. Clinicians still can't change stock.
  update public.stock_status set level = 'out_of_stock' where pharmacy_id = new_pharmacy;
  get diagnostics n = row_count;
  results := results || format(E'\n10. Clinician changing stock changed %s rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- Old Street applies to the brand new pharmacy.
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number)
    values (new_pharmacy, 'Olivia Street', '9990001')
    returning * into app_s;

  ------------------------------------------------- as Hoxton's user (an admin)
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 11. The first approved member of a pharmacy becomes its manager.
  perform public.review_staff_application(app_s.id, true);
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number)
    values (new_pharmacy, 'Harry Hoxton', '9990002')
    returning * into app_s;

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  select role into role_now from public.pharmacy_staff where pharmacy_id = new_pharmacy;
  results := results || format(E'\n11. First approved member is %s: %s', role_now, case when role_now = 'manager' then 'PASS' else 'FAIL' end);

  -- 12. ...so they can approve the next person, who joins as staff.
  perform public.review_staff_application(app_s.id, true);

  ------------------------------------------------------------ as Hoxton's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  select role into role_now from public.pharmacy_staff where pharmacy_id = new_pharmacy;
  results := results || format(E'\n12. Second member approved by the new manager is %s: %s', role_now, case when role_now = 'staff' then 'PASS' else 'FAIL' end);

  -- 13. Staff can switch their own pharmacy's sharing off.
  perform public.set_clinician_sharing(hox, false);
  select count(*) into n from public.pharmacies where id = hox and not share_with_clinicians;
  results := results || format(E'\n13. Staff switch off sharing for their pharmacy: %s', case when n = 1 then 'PASS' else 'FAIL' end);

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
