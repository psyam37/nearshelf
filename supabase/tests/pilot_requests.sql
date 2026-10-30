-- =============================================================================
-- Tests for pilot requests, demo accounts and keeping demo and real apart.
--
-- Run in the Supabase SQL Editor. Acts as hoxton@example.com (staff at the
-- demo pharmacy DEMO01) and oldstreet@example.com (moved to a real test
-- pharmacy for the test), then ALWAYS undoes everything by finishing with an
-- "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  med uuid := (select id from public.medicines order by name limit 1);
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  real_pharmacy uuid;
  request_id uuid;
  results text := '';
  n integer;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;

  -- Setup, as the database owner: a real pharmacy next door to Hoxton, with
  -- stock, and Old Street working there instead of at its demo pharmacy.
  delete from public.platform_admins where user_id in (user_h, user_o);
  insert into public.pharmacies (ods_code, name, address_line, town, postcode, location)
    values ('TEST97', 'Real Test Pharmacy', '1 Real Street', 'London', 'N1 6AB',
            st_setsrid(st_makepoint(-0.0815, 51.5276), 4326)::geography)
    returning id into real_pharmacy;
  insert into public.stock_status (pharmacy_id, medicine_id, level) values (real_pharmacy, med, 'in_stock');
  delete from public.pharmacy_staff where user_id = user_o;
  insert into public.pharmacy_staff (user_id, pharmacy_id, role) values (user_o, real_pharmacy, 'manager');
  insert into public.pilot_requests (contact_name, role, pharmacy_name, postcode, email)
    values ('Test Contact', 'Pharmacist', 'Test Pharmacy', 'NG1 5FS', 'test@example.com')
    returning id into request_id;

  -- 1. The owner can't attach a demo account to a real pharmacy.
  begin
    perform public.approve_pilot_request(request_id, user_h, user_o, real_pharmacy, repeat('x', 32));
    results := results || E'\n1. Demo account at a real pharmacy refused: FAIL';
  exception when raise_exception then
    results := results || E'\n1. Demo account at a real pharmacy refused: PASS';
  end;

  perform set_config('role', 'authenticated', true);

  ------------------------------------------- as Hoxton's user (demo pharmacy)
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 2. Pilot requests are private to admins.
  select count(*) into n from public.pilot_requests;
  results := results || format(E'\n2. Non-admin sees %s pilot requests: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 3. Only the server approves; admins reject.
  begin
    perform public.approve_pilot_request(request_id, user_h, user_h, hox, repeat('x', 32));
    results := results || E'\n3. Approving without the secret key refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n3. Approving without the secret key refused: PASS';
  end;
  begin
    perform public.reject_pilot_request(request_id);
    results := results || E'\n4. Non-admin rejecting refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n4. Non-admin rejecting refused: PASS';
  end;

  -- 5. Demo staff see demo stock, and none of the real pharmacy's.
  select count(*) into n from public.stock_status where pharmacy_id = hox;
  results := results || format(E'\n5. Demo staff see demo stock (%s rows): %s', n, case when n > 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.stock_status where pharmacy_id = real_pharmacy;
  results := results || format(E'\n6. ...and no real stock (%s rows): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 7. A direct request from demo to real is refused.
  begin
    insert into public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id, created_by)
      values (hox, real_pharmacy, med, user_h);
    results := results || E'\n7. Demo-to-real request refused: FAIL';
  exception when raise_exception then
    results := results || E'\n7. Demo-to-real request refused: PASS';
  end;

  -- 8. A broadcast reaches demo neighbours but skips the real one next door.
  perform public.broadcast_stock_request(hox, med, 2000);
  select count(*) into n from public.stock_requests where from_pharmacy_id = hox and to_pharmacy_id = real_pharmacy;
  results := results || format(E'\n8. Demo broadcast skips the real pharmacy (%s sent to it): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.stock_requests where from_pharmacy_id = hox and medicine_id = med and status = 'pending' and closed_at is null;
  results := results || format(E'\n9. ...but still reaches demo pharmacies (%s): %s', n, case when n > 0 then 'PASS' else 'FAIL' end);

  ---------------------------------------- as Old Street's user (real pharmacy)
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 10. Real staff never see the fictional demo stock.
  select count(*) into n from public.stock_status where pharmacy_id = hox;
  results := results || format(E'\n10. Real staff see no demo stock (%s rows): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.stock_status where pharmacy_id = real_pharmacy;
  results := results || format(E'\n11. ...but do see their own (%s rows): %s', n, case when n > 0 then 'PASS' else 'FAIL' end);

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
