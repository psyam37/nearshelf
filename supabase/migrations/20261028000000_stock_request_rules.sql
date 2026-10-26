-- =============================================================================
-- Days 9–10: tighten the rules for stock requests.
--
-- Row level security decides WHICH rows someone may insert or update, but not
-- WHICH COLUMNS or VALUES. Without this, a sender could create a request that
-- is already "confirmed", and the receiver could rewrite the medicine or the
-- message. This trigger allows only the intended changes.
-- =============================================================================

create or replace function public.guard_stock_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- New requests always start as pending, stamped now, by the sender.
    new.status := 'pending';
    new.responded_at := null;
    new.created_at := now();
    new.created_by := auth.uid();
    return new;
  end if;

  -- UPDATE: only the answer may change, and only once.
  if old.status <> 'pending' then
    raise exception 'This request has already been answered';
  end if;
  if new.status = 'pending' then
    raise exception 'A response must confirm or decline the request';
  end if;
  if (new.from_pharmacy_id, new.to_pharmacy_id, new.medicine_id, new.message, new.created_by, new.created_at)
     is distinct from
     (old.from_pharmacy_id, old.to_pharmacy_id, old.medicine_id, old.message, old.created_by, old.created_at) then
    raise exception 'Only the status of a request can be changed';
  end if;
  new.responded_at := now();
  return new;
end;
$$;

create trigger stock_requests_guard
  before insert or update on public.stock_requests
  for each row execute function public.guard_stock_request();

-- One open request per pharmacy pair and medicine, so nobody can be spammed.
create unique index stock_requests_one_pending
  on public.stock_requests (from_pharmacy_id, to_pharmacy_id, medicine_id)
  where status = 'pending';
