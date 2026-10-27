-- =============================================================================
-- Tests for verified sign-up (staff applications and approvals).
--
-- Run in the Supabase SQL Editor. Acts as the test accounts hoxton@example.com
-- (manager at DEMO01) and oldstreet@example.com (manager at DEMO02), then
-- ALWAYS undoes everything by finishing with an "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  sho uuid := (select id from public.pharmacies where ods_code = 'DEMO03');
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  results text := '';
  app_o public.staff_applications;
  app_h public.staff_applications;
  n integer;
  ok boolean;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;
  -- Start clean: no applications for these two, and Old Street not yet at Hoxton.
  delete from public.staff_applications where user_id in (user_h, user_o);
  delete from public.pharmacy_staff where user_id = user_o and pharmacy_id = hox;
  delete from public.platform_admins where user_id in (user_h, user_o);

  perform set_config('role', 'authenticated', true);

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 1. Applying can't pre-approve yourself or apply as someone else.
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number, status, user_id)
    values (hox, 'Olivia Street', '1234567', 'approved', user_h)
    returning * into app_o;
  ok := app_o.status = 'pending' and app_o.user_id = user_o;
  results := results || format(E'\n1. New application forced to pending, as yourself: %s', case when ok then 'PASS' else 'FAIL' end);

  -- 2. Only one open application per person.
  begin
    insert into public.staff_applications (pharmacy_id, full_name, gphc_number) values (sho, 'Olivia Street', '1111111');
    results := results || E'\n2. Second open application refused: FAIL';
  exception when unique_violation then
    results := results || E'\n2. Second open application refused: PASS';
  end;

  -- 3. GPhC numbers must be 7 digits.
  begin
    delete from public.staff_applications where id = app_o.id;
    insert into public.staff_applications (pharmacy_id, full_name, gphc_number) values (hox, 'Olivia Street', '12345');
    results := results || E'\n3. Malformed GPhC number refused: FAIL';
  exception when check_violation then
    results := results || E'\n3. Malformed GPhC number refused: PASS';
  end;
  -- (The failed block undid the delete, so app_o is still there.)

  ------------------------------------------------------------ as Hoxton's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 4. A GPhC number can only be on one account.
  begin
    insert into public.staff_applications (pharmacy_id, full_name, gphc_number) values (sho, 'Harry Hoxton', '1234567');
    results := results || E'\n4. Reused GPhC number refused: FAIL';
  exception when unique_violation then
    results := results || E'\n4. Reused GPhC number refused: PASS';
  end;

  -- 5. Can't apply to a pharmacy you already work at.
  begin
    insert into public.staff_applications (pharmacy_id, full_name, gphc_number) values (hox, 'Harry Hoxton', '7654321');
    results := results || E'\n5. Applying to your own pharmacy refused: FAIL';
  exception when raise_exception then
    results := results || E'\n5. Applying to your own pharmacy refused: PASS';
  end;

  -- A real application from Hoxton's user to Shoreditch (DEMO03), for later tests.
  insert into public.staff_applications (pharmacy_id, full_name, gphc_number)
    values (sho, 'Harry Hoxton', '7654321') returning * into app_h;

  -- 6. Hoxton's manager can see the application to Hoxton.
  select count(*) into n from public.staff_applications where id = app_o.id;
  results := results || format(E'\n6. Manager sees applications to their pharmacy: %s', case when n = 1 then 'PASS' else 'FAIL' end);

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 7. ...but others' applications elsewhere stay private.
  select count(*) into n from public.staff_applications where user_id <> user_o;
  results := results || format(E'\n7. Can''t see other people''s applications (%s visible): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 8. A non-manager can't review.
  begin
    perform public.review_staff_application(app_h.id, true);
    results := results || E'\n8. Non-manager review refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n8. Non-manager review refused: PASS';
  end;

  -- 9. Nobody can just flip the status (there's no update policy).
  update public.staff_applications set status = 'approved' where id = app_o.id;
  get diagnostics n = row_count;
  results := results || format(E'\n9. Direct status change changed %s rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  ------------------------------------------------------------ as Hoxton's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 10. The manager approves: the applicant becomes staff (not manager).
  perform public.review_staff_application(app_o.id, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);
  select exists (select 1 from public.pharmacy_staff where user_id = user_o and pharmacy_id = hox and role = 'staff') into ok;
  results := results || format(E'\n10. Approval adds them as staff: %s', case when ok then 'PASS' else 'FAIL' end);
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 11. It can't be reviewed twice.
  begin
    perform public.review_staff_application(app_o.id, false);
    results := results || E'\n11. Second review refused: FAIL';
  exception when raise_exception then
    results := results || E'\n11. Second review refused: PASS';
  end;

  -- 12. Even an admin can't approve their own application.
  perform set_config('role', 'postgres', true);
  insert into public.platform_admins (user_id) values (user_h);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.review_staff_application(app_h.id, true);
    results := results || E'\n12. Approving your own application refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n12. Approving your own application refused: PASS';
  end;

  -- 13. You can withdraw your own pending application...
  delete from public.staff_applications where id = app_h.id;
  get diagnostics n = row_count;
  results := results || format(E'\n13. Withdrawing your pending application: %s', case when n = 1 then 'PASS' else 'FAIL' end);

  ------------------------------------------------------- as Old Street's user
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 14. ...but not one that's already been approved (it's the audit trail).
  delete from public.staff_applications where id = app_o.id;
  get diagnostics n = row_count;
  results := results || format(E'\n14. Deleting an approved application changed %s rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
