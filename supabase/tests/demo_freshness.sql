-- =============================================================================
-- Tests for fresh demo stock, and demo pharmacies being marked for the public.
--
-- Run in the Supabase SQL Editor. ALWAYS undoes everything by finishing with
-- an "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  old uuid := (select id from public.pharmacies where ods_code = 'DEMO02');
  sert uuid := (select id from public.medicines where name ilike 'Sertraline 50mg%' limit 1);
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  real_pharmacy uuid;
  results text := '';
  first_row record;
  n integer;
  stamp timestamptz;
begin
  if user_h is null then
    raise exception 'Create the test account hoxton@example.com first.';
  end if;

  -- Setup, as the database owner: a real pharmacy near Hoxton, further from
  -- the search point than the demo one, with listed stock.
  insert into public.pharmacies (ods_code, name, address_line, town, postcode, location)
    values ('TEST96', 'Real Test Pharmacy', '1 Real Street', 'London', 'N1 6AB',
            st_setsrid(st_makepoint(-0.09, 51.535), 4326)::geography)
    returning id into real_pharmacy;
  insert into public.stock_status (pharmacy_id, medicine_id, level) values
    (real_pharmacy, sert, 'in_stock'), (hox, sert, 'in_stock'), (old, sert, 'in_stock')
    on conflict (pharmacy_id, medicine_id) do update set level = 'in_stock';
  insert into public.public_listings (pharmacy_id, medicine_id)
    values (real_pharmacy, sert), (hox, sert) on conflict do nothing;

  -- 1. Real pharmacies come first, unmarked; demo ones are marked.
  select * into first_row from public.public_find_stock(sert, 51.5274, -0.0817, 8047) limit 1;
  results := results || format(E'\n1. Real pharmacy listed first, not marked demo: %s',
    case when first_row.pharmacy_id = real_pharmacy and not first_row.is_demo then 'PASS' else 'FAIL' end);
  select count(*) into n from public.public_find_stock(sert, 51.5274, -0.0817, 8047)
    where pharmacy_id = hox and is_demo;
  results := results || format(E'\n2. Demo pharmacy marked as demo: %s', case when n = 1 then 'PASS' else 'FAIL' end);

  -- Make stock old: Hoxton's and the real pharmacy's 5 hours, Old Street's 10 minutes.
  perform set_config('medibase.keep_stock_times', 'on', true);
  update public.stock_status set updated_at = now() - interval '5 hours' where pharmacy_id in (hox, real_pharmacy);
  update public.stock_status set updated_at = now() - interval '10 minutes' where pharmacy_id = old and medicine_id = sert;
  perform set_config('medibase.keep_stock_times', 'off', true);
  select updated_at into stamp from public.stock_status where pharmacy_id = old and medicine_id = sert;

  perform public.refresh_demo_stock_times();

  -- 3. Old demo stock is fresh again, and stays verified for over an hour.
  select count(*) into n from public.stock_status
    where pharmacy_id = hox and (updated_at > now() - interval '4 minutes' or updated_at < now() - interval '46 minutes');
  results := results || format(E'\n3. Old demo stock now 5-45 minutes old (%s rows outside that): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 4. What a demo user changed recently keeps its true time.
  select count(*) into n from public.stock_status
    where pharmacy_id = old and medicine_id = sert and updated_at = stamp;
  results := results || format(E'\n4. Recently confirmed demo stock left alone: %s', case when n = 1 then 'PASS' else 'FAIL' end);

  -- 5. Real pharmacies are never touched.
  select count(*) into n from public.stock_status
    where pharmacy_id = real_pharmacy and updated_at > now() - interval '4 hours';
  results := results || format(E'\n5. Real stock not refreshed (%s rows changed): %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 6. Signed-in users can't call it: only the server can.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);
  begin
    perform public.refresh_demo_stock_times();
    results := results || E'\n6. Refreshing without the secret key refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n6. Refreshing without the secret key refused: PASS';
  end;

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
