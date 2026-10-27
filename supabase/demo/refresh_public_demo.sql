-- =============================================================================
-- DEMO DATA ONLY. Makes the patient finder (/find) show results.
--
-- Patients only see medicines a pharmacy chose to list, confirmed in the last
-- 2 hours. The seed stock is older than that, so /find shows nothing until
-- pharmacies list and re-confirm stock. This does both for the demo pharmacies:
--   1. lists every non-controlled medicine each demo pharmacy has in stock/low
--   2. re-confirms that stock now (it shows to patients for the next 2 hours)
-- Re-run it whenever you want fresh demo results. Controlled drugs are never
-- listed (the database refuses them anyway).
-- =============================================================================

insert into public.public_listings (pharmacy_id, medicine_id)
select s.pharmacy_id, s.medicine_id
from public.stock_status s
join public.medicines m on m.id = s.medicine_id
join public.pharmacies p on p.id = s.pharmacy_id
where p.ods_code like 'DEMO%'
  and not m.is_controlled
  and s.level <> 'out_of_stock'
on conflict do nothing;

-- Setting the level to itself fires the touch trigger, which stamps "now".
update public.stock_status s
set level = s.level
from public.public_listings l
join public.pharmacies p on p.id = l.pharmacy_id
where s.pharmacy_id = l.pharmacy_id
  and s.medicine_id = l.medicine_id
  and p.ods_code like 'DEMO%'
  and s.level <> 'out_of_stock';

-- What patients can now see, per medicine.
select m.name as medicine, count(*) as pharmacies_listing_it
from public.public_listings l
join public.medicines m on m.id = l.medicine_id
join public.stock_status s on s.pharmacy_id = l.pharmacy_id and s.medicine_id = l.medicine_id
where s.updated_at > now() - interval '2 hours' and s.level <> 'out_of_stock'
group by m.name
order by m.name;
