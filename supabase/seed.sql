-- =============================================================================
-- Demo seed data. ALL pharmacies are fictional (ODS codes start with "DEMO").
-- Medicines are common generics; dmd_vmp_id is left null until real dm+d data
-- is imported (see README: "Importing dm+d").
-- Runs automatically on `npx supabase db reset`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Pharmacies: around Hoxton/Shoreditch (London) and central Nottingham
-- st_makepoint takes (longitude, latitude)
-- ---------------------------------------------------------------------------
insert into public.pharmacies (ods_code, name, address_line, town, postcode, phone, location, opening_hours) values
  ('DEMO01', 'Hoxton Square Pharmacy',   '12 Example Street',  'London', 'N1 6AA',  '020 0000 0001', extensions.st_setsrid(extensions.st_makepoint(-0.0817, 51.5274), 4326)::extensions.geography, '{"mon_fri":"09:00-18:30","sat":"09:00-17:00"}'),
  ('DEMO02', 'Old Street Chemist',       '45 Sample Road',     'London', 'EC1V 9AA','020 0000 0002', extensions.st_setsrid(extensions.st_makepoint(-0.0877, 51.5257), 4326)::extensions.geography, '{"mon_fri":"08:30-19:00","sat":"09:00-16:00"}'),
  ('DEMO03', 'Shoreditch Health Pharmacy','3 Placeholder Lane', 'London', 'E2 7AA',  '020 0000 0003', extensions.st_setsrid(extensions.st_makepoint(-0.0755, 51.5245), 4326)::extensions.geography, '{"mon_fri":"09:00-18:00"}'),
  ('DEMO04', 'Haggerston Pharmacy',      '88 Demo Avenue',     'London', 'E8 4AA',  '020 0000 0004', extensions.st_setsrid(extensions.st_makepoint(-0.0758, 51.5387), 4326)::extensions.geography, '{"mon_fri":"09:00-18:00","sat":"10:00-14:00"}'),
  ('DEMO05', 'Angel Late Pharmacy',      '201 Mock Street',    'London', 'N1 9AA',  '020 0000 0005', extensions.st_setsrid(extensions.st_makepoint(-0.1057, 51.5322), 4326)::extensions.geography, '{"mon_sun":"08:00-22:00"}'),
  ('DEMO06', 'Liverpool Street Pharmacy','9 Test Place',       'London', 'EC2M 7AA','020 0000 0006', extensions.st_setsrid(extensions.st_makepoint(-0.0817, 51.5178), 4326)::extensions.geography, '{"mon_fri":"07:30-19:30"}'),
  ('DEMO07', 'Dalston Community Pharmacy','150 Fictional Road', 'London', 'E8 2AA',  '020 0000 0007', extensions.st_setsrid(extensions.st_makepoint(-0.0753, 51.5463), 4326)::extensions.geography, '{"mon_fri":"09:00-18:30","sat":"09:00-13:00"}'),
  ('DEMO08', 'Bethnal Green Pharmacy',   '60 Sample Street',   'London', 'E2 0AA',  '020 0000 0008', extensions.st_setsrid(extensions.st_makepoint(-0.0553, 51.5270), 4326)::extensions.geography, '{"mon_fri":"09:00-18:00"}'),
  ('DEMO11', 'Market Square Pharmacy',   '1 Example Row',      'Nottingham', 'NG1 2AA', '0115 000 0011', extensions.st_setsrid(extensions.st_makepoint(-1.1505, 52.9536), 4326)::extensions.geography, '{"mon_sat":"08:30-18:00"}'),
  ('DEMO12', 'Lenton Pharmacy',          '22 Demo Road',       'Nottingham', 'NG7 1AA', '0115 000 0012', extensions.st_setsrid(extensions.st_makepoint(-1.1717, 52.9478), 4326)::extensions.geography, '{"mon_fri":"09:00-18:00"}'),
  ('DEMO13', 'Beeston Village Pharmacy', '7 Placeholder Street','Nottingham', 'NG9 1AA', '0115 000 0013', extensions.st_setsrid(extensions.st_makepoint(-1.2167, 52.9257), 4326)::extensions.geography, '{"mon_fri":"09:00-18:00","sat":"09:00-13:00"}'),
  ('DEMO14', 'Sneinton Pharmacy',        '310 Mock Lane',      'Nottingham', 'NG2 4AA', '0115 000 0014', extensions.st_setsrid(extensions.st_makepoint(-1.1291, 52.9521), 4326)::extensions.geography, '{"mon_fri":"09:00-17:30"}');

-- ---------------------------------------------------------------------------
-- Medicines: common generics, including some that often have supply problems
-- ---------------------------------------------------------------------------
insert into public.medicines (name, strength, form, equivalence_group, is_controlled) values
  ('Sertraline 50mg tablets',                    '50mg',   'tablet',   'Sertraline',      false),
  ('Sertraline 100mg tablets',                   '100mg',  'tablet',   'Sertraline',      false),
  ('Amlodipine 5mg tablets',                     '5mg',    'tablet',   'Amlodipine',      false),
  ('Atorvastatin 20mg tablets',                  '20mg',   'tablet',   'Atorvastatin',    false),
  ('Metformin 500mg tablets',                    '500mg',  'tablet',   'Metformin',       false),
  ('Omeprazole 20mg gastro-resistant capsules',  '20mg',   'capsule',  'Omeprazole',      false),
  ('Ramipril 5mg capsules',                      '5mg',    'capsule',  'Ramipril',        false),
  ('Levothyroxine 50microgram tablets',          '50mcg',  'tablet',   'Levothyroxine',   false),
  ('Salbutamol 100micrograms/dose inhaler',      '100mcg', 'inhaler',  'Salbutamol',      false),
  ('Amoxicillin 500mg capsules',                 '500mg',  'capsule',  'Amoxicillin',     false),
  ('Amoxicillin 250mg/5ml oral suspension',      '250mg/5ml','oral suspension','Amoxicillin', false),
  ('Phenoxymethylpenicillin 250mg tablets',      '250mg',  'tablet',   'Phenoxymethylpenicillin', false),
  ('Nitrofurantoin 100mg modified-release capsules','100mg','capsule', 'Nitrofurantoin',  false),
  ('Estradiol 0.06% gel',                        '0.06%',  'gel',      'Estradiol',       false),
  ('Estradiol 2mg tablets',                      '2mg',    'tablet',   'Estradiol',       false),
  ('Methylphenidate 18mg modified-release tablets','18mg', 'tablet',   'Methylphenidate', true),
  ('Methylphenidate 36mg modified-release tablets','36mg', 'tablet',   'Methylphenidate', true),
  ('Lisdexamfetamine 30mg capsules',             '30mg',   'capsule',  'Lisdexamfetamine',true),
  ('Adrenaline 300micrograms auto-injector',     '300mcg', 'injection','Adrenaline',      false),
  ('Insulin glargine 100units/ml pre-filled pen','100u/ml','injection','Insulin glargine',false);

-- ---------------------------------------------------------------------------
-- Stock: give every pharmacy a random level for every medicine (~60% in stock,
-- ~25% low, ~15% out), with "last updated" spread over the past two days.
-- The trigger normally stamps updated_at/updated_by, so disable it for seeding.
-- ---------------------------------------------------------------------------
alter table public.stock_status disable trigger stock_status_touch;

insert into public.stock_status (pharmacy_id, medicine_id, level, updated_at)
select
  t.pharmacy_id,
  t.medicine_id,
  case
    when t.r < 0.60 then 'in_stock'::public.stock_level
    when t.r < 0.85 then 'low'::public.stock_level
    else 'out_of_stock'::public.stock_level
  end,
  now() - (random() * interval '48 hours')
from (
  select p.id as pharmacy_id, m.id as medicine_id, random() as r
  from public.pharmacies p
  cross join public.medicines m
) t;

alter table public.stock_status enable trigger stock_status_touch;
