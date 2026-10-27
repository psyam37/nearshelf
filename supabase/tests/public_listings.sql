-- =============================================================================
-- Tests for the public (patient) finder and pharmacies' public listings.
--
-- Run in the Supabase SQL Editor. Acts as hoxton@example.com (DEMO01),
-- oldstreet@example.com (DEMO02) and a signed-out visitor, then ALWAYS
-- undoes everything by finishing with an "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  old uuid := (select id from public.pharmacies where ods_code = 'DEMO02');
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  sert uuid := (select id from public.medicines where name = 'Sertraline 50mg tablets');
  ritalin uuid := (select id from public.medicines where name = 'Methylphenidate 18mg modified-release tablets');
  results text := '';
  n integer;
  ok boolean;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;

  -- Setup (as admin): both pharmacies have sertraline and methylphenidate,
  -- confirmed just now; Old Street's methylphenidate too. Start with no listings.
  delete from public.public_listings where pharmacy_id in (hox, old);
  delete from public.public_listing_views where pharmacy_id in (hox, old);
  insert into public.stock_status (pharmacy_id, medicine_id, level)
    values (hox, sert, 'in_stock'), (old, sert, 'in_stock'), (hox, ritalin, 'in_stock')
    on conflict (pharmacy_id, medicine_id) do update set level = 'in_stock';

  perform set_config('role', 'authenticated', true);

  ------------------------------------------------------------- as Hoxton
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 1. Staff can list a medicine for their own pharmacy...
  insert into public.public_listings (pharmacy_id, medicine_id) values (hox, sert);
  results := results || E'\n1. Listing a medicine for your pharmacy: PASS';

  -- 2. ...but never a controlled drug.
  begin
    insert into public.public_listings (pharmacy_id, medicine_id) values (hox, ritalin);
    results := results || E'\n2. Listing a controlled drug refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n2. Listing a controlled drug refused: PASS';
  end;

  -- 3. ...and not for another pharmacy.
  begin
    insert into public.public_listings (pharmacy_id, medicine_id) values (old, sert);
    results := results || E'\n3. Listing for another pharmacy refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n3. Listing for another pharmacy refused: PASS';
  end;

  ------------------------------------------------------ as a signed-out visitor
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  -- 4. The public sees Hoxton (listed) but not Old Street (in stock, not listed).
  select bool_or(pharmacy_id = hox) and not bool_or(pharmacy_id = old) into ok
    from public.public_find_stock(sert, 51.526, -0.08, 8047);
  results := results || format(E'\n4. Only listed pharmacies are shown: %s', case when ok then 'PASS' else 'FAIL' end);

  -- 5. Controlled drugs never come back, even though Hoxton has it in stock.
  select count(*) into n from public.public_find_stock(ritalin, 51.526, -0.08, 8047);
  results := results || format(E'\n5. Controlled drug search returns %s: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 6. The public can't read stock or listings directly.
  select count(*) into n from public.stock_status;
  select n + count(*) into n from public.public_listings;
  results := results || format(E'\n6. Direct reads by the public see %s rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 7. Stock older than 2 hours disappears from the public view.
  perform set_config('role', 'postgres', true);
  alter table public.stock_status disable trigger stock_status_touch;
  update public.stock_status set updated_at = now() - interval '3 hours' where pharmacy_id = hox and medicine_id = sert;
  alter table public.stock_status enable trigger stock_status_touch;
  perform set_config('role', 'anon', true);
  select count(*) into n from public.public_find_stock(sert, 51.526, -0.08, 8047) where pharmacy_id = hox;
  results := results || format(E'\n7. 3h-old stock hidden from the public: %s', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 8. Out of stock is never shown either.
  perform set_config('role', 'postgres', true);
  update public.stock_status set level = 'out_of_stock' where pharmacy_id = hox and medicine_id = sert;
  perform set_config('role', 'anon', true);
  select count(*) into n from public.public_find_stock(sert, 51.526, -0.08, 8047) where pharmacy_id = hox;
  results := results || format(E'\n8. Out-of-stock hidden from the public: %s', case when n = 0 then 'PASS' else 'FAIL' end);

  -- Put it back in stock (fresh) for the view-count tests.
  perform set_config('role', 'postgres', true);
  update public.stock_status set level = 'in_stock' where pharmacy_id = hox and medicine_id = sert;
  perform set_config('role', 'anon', true);
  perform public.public_find_stock(sert, 51.526, -0.08, 8047);
  perform public.public_find_stock(sert, 51.526, -0.08, 8047);

  ------------------------------------------------------------- as Hoxton
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 9. Each appearance was counted (anonymously) for Hoxton to see.
  select views_30d into n from public.public_listing_stats(hox) where medicine_id = sert;
  results := results || format(E'\n9. Views counted for the pharmacy: %s (%s)', case when n >= 2 then 'PASS' else 'FAIL' end, n);

  ------------------------------------------------------------ as Old Street
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 10. Other pharmacies can't see Hoxton's numbers.
  select count(*) into n from public.public_listing_views where pharmacy_id = hox;
  results := results || format(E'\n10. Another pharmacy sees %s of Hoxton''s view rows: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  ------------------------------------------------------------- as Hoxton
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 11. Unlisting removes it from the public view straight away.
  delete from public.public_listings where pharmacy_id = hox and medicine_id = sert;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  select count(*) into n from public.public_find_stock(sert, 51.526, -0.08, 8047) where pharmacy_id = hox;
  results := results || format(E'\n11. Unlisted medicine gone from public view: %s', case when n = 0 then 'PASS' else 'FAIL' end);

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
