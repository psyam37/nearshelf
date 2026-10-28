-- =============================================================================
-- MediBase Insights: a working preview of roadmap phases 1 and 2.
--
-- 1. NHS dispensing data. How many items of each catalogue medicine English
--    pharmacies dispensed, per month and per Integrated Care Board (ICB), from
--    the NHSBSA's open Prescription Cost Analysis data (Open Government
--    Licence v3.0). Loaded by an admin from /admin; readable by signed-in staff.
-- 2. pharmacy_insights(): one pharmacy's own MediBase numbers: unmet requests
--    nearby, response times, fresh stock, and its referral log.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Which NHS products each catalogue medicine is. BNF presentation codes, as
-- used in NHS prescribing and dispensing data. A medicine can have several
-- (e.g. sugar-free and standard amoxicillin suspension).
-- ---------------------------------------------------------------------------
alter table public.medicines add column bnf_codes text[] not null default '{}';

update public.medicines m
set bnf_codes = v.codes
from (values
  ('Sertraline 50mg tablets',                         array['0403030Q0AAAAAA']),
  ('Sertraline 100mg tablets',                        array['0403030Q0AAABAB']),
  ('Amlodipine 5mg tablets',                          array['0206020A0AAAAAA']),
  ('Atorvastatin 20mg tablets',                       array['0212000B0AAABAB']),
  ('Metformin 500mg tablets',                         array['0601022B0AAABAB']),
  ('Omeprazole 20mg gastro-resistant capsules',       array['0103050P0AAAAAA']),
  ('Ramipril 5mg capsules',                           array['0205051R0AAACAC']),
  ('Levothyroxine 50microgram tablets',               array['0602010V0AABXBX']),
  ('Salbutamol 100micrograms/dose inhaler',           array['0301011R0AAAPAP', '0301011R0AAAAAA']),
  ('Amoxicillin 500mg capsules',                      array['0501013B0AAABAB']),
  ('Amoxicillin 250mg/5ml oral suspension',           array['0501013B0AAAKAK', '0501013B0AAATAT']),
  ('Phenoxymethylpenicillin 250mg tablets',           array['0501011P0AAAJAJ']),
  ('Nitrofurantoin 100mg modified-release capsules',  array['0501130R0AAAGAG']),
  ('Estradiol 0.06% gel',                             array['0604011G0AAAUAU']),
  ('Estradiol 2mg tablets',                           array['0604011G0AAAIAI']),
  ('Methylphenidate 18mg modified-release tablets',   array['0404000M0AAAMAM']),
  ('Methylphenidate 36mg modified-release tablets',   array['0404000M0AAANAN']),
  ('Lisdexamfetamine 30mg capsules',                  array['0404000U0AAABAB']),
  ('Adrenaline 300micrograms auto-injector',          array['0304030C0AAA3A3']),
  ('Insulin glargine 100units/ml pre-filled pen',     array['0601012V0AAADAD'])
) as v(name, codes)
where m.name = v.name;

-- ---------------------------------------------------------------------------
-- NHS dispensing, per month, ICB and medicine.
-- ---------------------------------------------------------------------------
create table public.nhs_dispensing (
  month       date    not null check (extract(day from month) = 1),
  icb_name    text    not null, -- as the NHS writes it, e.g. 'NHS NORTH EAST LONDON INTEGRATED CARE BOARD'
  medicine_id uuid    not null references public.medicines (id) on delete cascade,
  items       integer not null check (items >= 0),
  primary key (month, icb_name, medicine_id)
);

alter table public.nhs_dispensing enable row level security;

create policy "signed-in users read NHS dispensing data"
  on public.nhs_dispensing for select to authenticated
  using (true);

create policy "admins load NHS dispensing data"
  on public.nhs_dispensing for insert to authenticated
  with check (public.is_platform_admin());

create policy "admins update NHS dispensing data"
  on public.nhs_dispensing for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Monthly items for England and for one ICB, per medicine. Returned as one
-- JSON value, so the API's 1,000-row limit can't cut the history short.
create function public.nhs_dispensing_series(p_icb_name text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('medicine_id', medicine_id, 'month', month, 'england', england, 'local', local)
      order by medicine_id, month
    ),
    '[]'::jsonb
  )
  from (
    select
      d.medicine_id,
      d.month,
      sum(d.items)::integer as england,
      (sum(d.items) filter (where d.icb_name = upper(p_icb_name)))::integer as local
    from public.nhs_dispensing d
    group by d.medicine_id, d.month
  ) s;
$$;

-- The newest month loaded, so the admin sync only fetches what's new.
create function public.nhs_dispensing_months()
returns setof date
language sql
stable
security invoker
set search_path = ''
as $$ select distinct month from public.nhs_dispensing order by month $$;

-- ---------------------------------------------------------------------------
-- One pharmacy's own numbers for the last 30 days. Security definer, because
-- "unmet" needs to know whether *any* pharmacy confirmed a broadcast, which
-- RLS rightly hides; it returns counts only, never other pharmacies' rows,
-- apart from the referrals this pharmacy took part in.
-- ---------------------------------------------------------------------------
create function public.pharmacy_insights(p_pharmacy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since  timestamptz := now() - interval '30 days';
  result jsonb;
begin
  if not exists (
    select 1 from public.pharmacy_staff s
    where s.pharmacy_id = p_pharmacy_id and s.user_id = auth.uid()
  ) then
    raise exception 'Only staff of this pharmacy can see its insights' using errcode = '42501';
  end if;

  with incoming as (
    select r.* from public.stock_requests r
    where r.to_pharmacy_id = p_pharmacy_id and r.created_at >= since
  ),
  -- Each "ask" is a broadcast, or a single direct request.
  asks as (
    select distinct coalesce(r.broadcast_id, r.id) as ask_id, r.medicine_id, r.created_at
    from incoming r
  ),
  -- Unmet: nobody confirmed it, and it's had its 2 hours.
  unmet as (
    select a.* from asks a
    where a.created_at < now() - interval '2 hours'
      and not exists (
        select 1 from public.stock_requests o
        where (o.broadcast_id = a.ask_id or o.id = a.ask_id) and o.status = 'confirmed'
      )
  ),
  everyone as (
    select r.created_at, r.responded_at from public.stock_requests r
    where r.created_at >= since and r.responded_at is not null
  ),
  referrals as (
    select r.created_at, r.from_pharmacy_id, r.to_pharmacy_id, m.name as medicine
    from public.stock_requests r
    join public.medicines m on m.id = r.medicine_id
    where r.status = 'confirmed'
      and (r.to_pharmacy_id = p_pharmacy_id or r.from_pharmacy_id = p_pharmacy_id)
    order by r.created_at desc
    limit 8
  )
  select jsonb_build_object(
    'asks_received', (select count(*) from asks),
    'unmet', (select count(*) from unmet),
    'unmet_by_medicine', coalesce((
      select jsonb_agg(jsonb_build_object('medicine', x.name, 'count', x.n) order by x.n desc, x.name)
      from (
        select m.name, count(*) as n from unmet u join public.medicines m on m.id = u.medicine_id
        group by m.name order by n desc, m.name limit 5
      ) x
    ), '[]'::jsonb),
    'requests_received', (select count(*) from incoming),
    'requests_answered', (select count(*) from incoming where responded_at is not null),
    'confirmed_by_you', (select count(*) from incoming where status = 'confirmed'),
    'avg_response_minutes', (
      select round(avg(extract(epoch from responded_at - created_at) / 60)::numeric, 1)
      from incoming where responded_at is not null
    ),
    'network_avg_response_minutes', (
      select round(avg(extract(epoch from responded_at - created_at) / 60)::numeric, 1) from everyone
    ),
    'stock_available', (
      select count(*) from public.stock_status s
      where s.pharmacy_id = p_pharmacy_id and s.level in ('in_stock', 'low')
    ),
    'stock_fresh', (
      select count(*) from public.stock_status s
      where s.pharmacy_id = p_pharmacy_id and s.level in ('in_stock', 'low')
        and s.updated_at > now() - interval '2 hours'
    ),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', f.created_at,
        'medicine', f.medicine,
        'direction', case when f.to_pharmacy_id = p_pharmacy_id then 'helped' else 'helped_you' end,
        'other_pharmacy', p.name
      ) order by f.created_at desc)
      from referrals f
      join public.pharmacies p
        on p.id = case when f.to_pharmacy_id = p_pharmacy_id then f.from_pharmacy_id else f.to_pharmacy_id end
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.pharmacy_insights(uuid) from public, anon;
grant execute on function public.pharmacy_insights(uuid) to authenticated;
