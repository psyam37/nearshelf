-- =============================================================================
-- Tests for the 2-hour verification, the 30-minute hold and broadcasts.
--
-- Run in the Supabase SQL Editor. It acts as the two test accounts
-- (hoxton@example.com at DEMO01, oldstreet@example.com at DEMO02), then
-- ALWAYS undoes everything: it finishes by raising an "error" whose message
-- is the list of results, which rolls the whole block back.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  old uuid := (select id from public.pharmacies where ods_code = 'DEMO02');
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  med uuid := (select id from public.medicines where name = 'Sertraline 50mg tablets');
  results text := '';
  n integer;
  ok boolean;
  b record;
  req record;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;

  -- Setup (as admin): make Hoxton's sertraline a 3-hour-old "in stock"
  -- (the touch trigger would reset the time), and clear their old requests.
  alter table public.stock_status disable trigger stock_status_touch;
  insert into public.stock_status (pharmacy_id, medicine_id, level, updated_at)
    values (hox, med, 'in_stock', now() - interval '3 hours')
    on conflict (pharmacy_id, medicine_id)
    do update set level = 'in_stock', updated_at = now() - interval '3 hours';
  alter table public.stock_status enable trigger stock_status_touch;
  delete from public.stock_requests
    where from_pharmacy_id in (hox, old) or to_pharmacy_id in (hox, old);

  ------------------------------------------------------------- as Hoxton
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 1. A 3-hour-old "in stock" comes back unverified.
  select not verified into ok
    from public.nearby_stock(med, 51.526, -0.08, 5000) where pharmacy_id = hox;
  results := results || format(E'\n1. 3h-old stock shows unverified: %s',
    case when ok then 'PASS' else 'FAIL' end);

  -- 2. No verified "in stock" row is ranked below an unverified one.
  with ranked as (
    select row_number() over () as pos, level, verified
    from public.nearby_stock(med, 51.526, -0.08, 5000)
  )
  select not exists (
    select 1 from ranked u join ranked v on v.pos > u.pos
    where u.level <> 'out_of_stock' and not u.verified
      and v.verified and v.level = 'in_stock'
  ) into ok;
  results := results || format(E'\n2. Verified stock ranks above unverified: %s',
    case when ok then 'PASS' else 'FAIL' end);

  -- 3. "Still in stock" re-confirms Hoxton's rows, making that one verified.
  select public.reconfirm_stock(hox) into n;
  select verified into ok
    from public.nearby_stock(med, 51.526, -0.08, 5000) where pharmacy_id = hox;
  results := results || format(E'\n3. Reconfirm updated %s rows and re-verified: %s',
    n, case when n > 0 and ok then 'PASS' else 'FAIL' end);

  -- 4. ...but it can't touch another pharmacy's stock.
  select public.reconfirm_stock(old) into n;
  results := results || format(E'\n4. Reconfirm on Old Street changed %s rows: %s',
    n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 5. A broadcast reaches every other pharmacy within 5 km, as pending,
  --    with the pack details, signed by Hoxton's user.
  select * into b from public.broadcast_stock_request(hox, med, 5000, 28, 2);
  select count(*) = b.recipients
     and bool_and(status = 'pending' and pack_size = 28 and quantity = 2
                  and created_by = user_h and to_pharmacy_id <> hox)
    into ok from public.stock_requests where broadcast_id = b.broadcast_id;
  results := results || format(E'\n5. Broadcast reached %s pharmacies, all pending: %s',
    b.recipients, case when b.recipients > 0 and ok then 'PASS' else 'FAIL' end);

  -- 6. Broadcasting again skips pharmacies that haven't answered yet.
  select recipients into n from public.broadcast_stock_request(hox, med, 5000, 28, 2);
  results := results || format(E'\n6. Repeat broadcast reached %s (no duplicates): %s',
    n, case when n = 0 then 'PASS' else 'FAIL' end);

  -- 7. Hoxton can't broadcast pretending to be Old Street.
  begin
    perform public.broadcast_stock_request(old, med, 5000, null, 1);
    results := results || E'\n7. Broadcast as Old Street refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n7. Broadcast as Old Street refused: PASS';
  end;

  -- 8. Hoxton can't answer a request sent to Old Street (0 rows change).
  update public.stock_requests set status = 'confirmed'
    where broadcast_id = b.broadcast_id and to_pharmacy_id = old;
  get diagnostics n = row_count;
  results := results || format(E'\n8. Hoxton answering for Old Street changed %s rows: %s',
    n, case when n = 0 then 'PASS' else 'FAIL' end);

  --------------------------------------------------------- as Old Street
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 9. The receiver can answer, but not quietly change the details too.
  begin
    update public.stock_requests set status = 'confirmed', quantity = 99
      where broadcast_id = b.broadcast_id and to_pharmacy_id = old;
    results := results || E'\n9. Editing the quantity refused: FAIL';
  exception when raise_exception then
    results := results || E'\n9. Editing the quantity refused: PASS';
  end;

  -- 10. "Available" starts a 30-minute hold.
  update public.stock_requests set status = 'confirmed'
    where broadcast_id = b.broadcast_id and to_pharmacy_id = old
    returning * into req;
  ok := req.reserved_until between now() + interval '29 minutes'
                               and now() + interval '31 minutes';
  results := results || format(E'\n10. Available holds it until %s: %s',
    to_char(req.reserved_until, 'HH24:MI'), case when ok then 'PASS' else 'FAIL' end);

  -- 11. The answer can't be changed afterwards.
  begin
    update public.stock_requests set status = 'declined' where id = req.id;
    results := results || E'\n11. Changing the answer refused: FAIL';
  exception when raise_exception then
    results := results || E'\n11. Changing the answer refused: PASS';
  end;

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
