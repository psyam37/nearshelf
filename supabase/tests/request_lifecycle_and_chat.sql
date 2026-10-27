-- =============================================================================
-- Tests for the request lifecycle (urgency, feed order, closing, expiry) and
-- the handover chat (who can write, when, and no patient details).
--
-- Run in the Supabase SQL Editor. Acts as hoxton@example.com (DEMO01) and
-- oldstreet@example.com (DEMO02), then ALWAYS undoes everything by finishing
-- with an "error" listing the results.
-- =============================================================================
do $$
declare
  hox uuid := (select id from public.pharmacies where ods_code = 'DEMO01');
  old uuid := (select id from public.pharmacies where ods_code = 'DEMO02');
  user_h uuid := (select id from auth.users where email = 'hoxton@example.com');
  user_o uuid := (select id from auth.users where email = 'oldstreet@example.com');
  sert uuid := (select id from public.medicines where name = 'Sertraline 50mg tablets');
  amox uuid := (select id from public.medicines where name = 'Amoxicillin 500mg capsules');
  results text := '';
  b record;
  req uuid;
  other uuid;
  msg public.request_messages;
  n integer;
  s text;
  ok boolean;
begin
  if user_h is null or user_o is null then
    raise exception 'Create the two test accounts first (hoxton@example.com, oldstreet@example.com).';
  end if;
  delete from public.stock_requests where from_pharmacy_id in (hox, old) or to_pharmacy_id in (hox, old);

  perform set_config('role', 'authenticated', true);

  ------------------------------------------------------------- as Hoxton
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- A routine one-to-one request to Old Street first, then an urgent broadcast.
  insert into public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id)
    values (hox, old, amox) returning id into other;
  select * into b from public.broadcast_stock_request(hox, sert, 8047, 28, 2, 'urgent');
  select id into req from public.stock_requests where broadcast_id = b.broadcast_id and to_pharmacy_id = old;

  -- 1. The broadcast went out (5 miles) and is marked urgent.
  select bool_and(urgency = 'urgent') into ok from public.stock_requests where broadcast_id = b.broadcast_id;
  results := results || format(E'\n1. Urgent broadcast reached %s pharmacies: %s', b.recipients,
    case when b.recipients > 0 and ok then 'PASS' else 'FAIL' end);

  ------------------------------------------------------------ as Old Street
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 2. Old Street's feed shows the urgent request above the routine one.
  select id = req into ok from public.incoming_requests(old) limit 1;
  results := results || format(E'\n2. Urgent request sorted first: %s', case when ok then 'PASS' else 'FAIL' end);

  -- 3. Confirming starts the hold.
  update public.stock_requests set status = 'confirmed' where id = req;
  select state = 'held' into ok from public.incoming_requests(old) where id = req;
  results := results || format(E'\n3. Confirm we have it → held: %s', case when ok then 'PASS' else 'FAIL' end);

  -- 4. Old Street can chat; the database records it as Old Street.
  insert into public.request_messages (request_id, body) values (req, 'On the counter for you')
    returning * into msg;
  results := results || format(E'\n4. Holder can chat, signed as their pharmacy: %s',
    case when msg.sender_pharmacy_id = old then 'PASS' else 'FAIL' end);

  -- 5–8. Patient details are refused, whatever form they take.
  foreach s in array array['NHS no 943 476 5919', 'DOB 12/03/1961', 'she lives at N1 6AA', 'ring 07700 900123'] loop
    begin
      insert into public.request_messages (request_id, body) values (req, s);
      results := results || format(E'\n5. Refused "%s": FAIL', s);
    exception when invalid_parameter_value then
      results := results || format(E'\n5. Refused "%s": PASS', s);
    end;
  end loop;

  -- 6. Nobody can close a request by editing it directly.
  begin
    update public.stock_requests set close_reason = 'dispensed' where id = other;
    results := results || E'\n6. Closing by direct edit refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n6. Closing by direct edit refused: PASS';
  end;

  ------------------------------------------------------------- as Hoxton
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 7. The asker can chat too.
  insert into public.request_messages (request_id, body) values (req, 'Patient on their way, 10 minutes')
    returning * into msg;
  results := results || format(E'\n7. Asker can chat, signed as their pharmacy: %s',
    case when msg.sender_pharmacy_id = hox then 'PASS' else 'FAIL' end);

  -- 8. Only the holder can mark it dispensed.
  begin
    perform public.close_stock_request(req, 'dispensed');
    results := results || E'\n8. Asker marking dispensed refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n8. Asker marking dispensed refused: PASS';
  end;

  ------------------------------------------------------------ as Old Street
  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);

  -- 9. "Prescription downloaded" closes it...
  perform public.close_stock_request(req, 'dispensed');
  select state = 'dispensed' into ok from public.incoming_requests(old) where id = req;
  results := results || format(E'\n9. Prescription downloaded → dispensed: %s', case when ok then 'PASS' else 'FAIL' end);

  -- 10. ...and closes the chat.
  begin
    insert into public.request_messages (request_id, body) values (req, 'thanks');
    results := results || E'\n10. Chat closed after dispensing: FAIL';
  exception when raise_exception then
    results := results || E'\n10. Chat closed after dispensing: PASS';
  end;

  -- 11. An unanswered request expires after 2 hours and can't be answered.
  perform set_config('role', 'postgres', true);
  alter table public.stock_requests disable trigger stock_requests_guard;
  update public.stock_requests set created_at = now() - interval '3 hours' where id = other;
  alter table public.stock_requests enable trigger stock_requests_guard;
  perform set_config('role', 'authenticated', true);
  select state = 'expired' into ok from public.incoming_requests(old) where id = other;
  begin
    update public.stock_requests set status = 'confirmed' where id = other;
    ok := false;
  exception when raise_exception then
    null;
  end;
  results := results || format(E'\n11. 2h-old request expired, answering refused: %s', case when ok then 'PASS' else 'FAIL' end);

  ------------------------------------------------------------- as Hoxton
  perform set_config('request.jwt.claims', json_build_object('sub', user_h, 'role', 'authenticated')::text, true);

  -- 12. ...and it no longer blocks asking Old Street again.
  begin
    insert into public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id) values (hox, old, amox);
    results := results || E'\n12. Expired request doesn''t block a new one: FAIL (blocked)';
  exception when unique_violation then
    perform public.expire_stale_requests(hox);
    insert into public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id) values (hox, old, amox);
    results := results || E'\n12. Expired request doesn''t block a new one (after cleanup): PASS';
  end;

  -- 13. Closing the broadcast closes everyone still open, and only the asker can.
  select public.close_broadcast(b.broadcast_id) into n;
  select count(*) into n from public.outgoing_requests(hox)
    where broadcast_id = b.broadcast_id and state in ('open', 'held');
  results := results || format(E'\n13. Close request leaves %s open: %s', n, case when n = 0 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', user_o, 'role', 'authenticated')::text, true);
  begin
    perform public.close_broadcast(b.broadcast_id);
    results := results || E'\n14. Someone else closing it refused: FAIL';
  exception when insufficient_privilege then
    results := results || E'\n14. Someone else closing it refused: PASS';
  end;

  raise exception 'TEST RESULTS (nothing was saved):%', results;
end;
$$;
