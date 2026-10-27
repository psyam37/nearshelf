-- =============================================================================
-- Web push: each browser or phone that turns on notifications saves a
-- "subscription" (where to send, plus encryption keys). When a pharmacy
-- broadcasts, the server notifies staff at the pharmacies in range.
-- Notifications only ever contain stock details, never patient data.
-- =============================================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- People see and remove only their own devices.
create policy "Users can see their own devices"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy "Users can remove their own devices"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- Saving goes through this function, so a shared computer that someone else
-- used before simply moves over to whoever turned notifications on last.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
$$;

-- Devices of everyone who works at these pharmacies, except the sender.
-- Only the server (with the secret key) may call this: it reads other
-- people's devices, so it's locked away from signed-in users.
create or replace function public.push_targets(p_pharmacy_ids uuid[], p_exclude_user uuid)
returns table (endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.endpoint, s.p256dh, s.auth
  from public.pharmacy_staff ps
  join public.push_subscriptions s on s.user_id = ps.user_id
  where ps.pharmacy_id = any (p_pharmacy_ids)
    and ps.user_id is distinct from p_exclude_user;
$$;

revoke execute on function public.push_targets(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.push_targets(uuid[], uuid) to service_role;
