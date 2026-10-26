-- =============================================================================
-- Days 11–12: barcodes on medicine packs (GTIN / EAN-13) → medicine.
--
-- One medicine can have many barcodes (different brands, pack sizes), so this
-- is its own table rather than a column on medicines. The real numbers come
-- from the NHS dm+d (AMPP GTINs); until that's imported, the demo rows below
-- use the 200–299 prefix, which GS1 reserves for in-store use, so they can
-- never clash with a real product's barcode.
-- =============================================================================

create table public.medicine_barcodes (
  gtin        text primary key check (gtin ~ '^[0-9]{8,14}$'),
  medicine_id uuid not null references public.medicines (id) on delete cascade
);

create index medicine_barcodes_medicine_idx on public.medicine_barcodes (medicine_id);

alter table public.medicine_barcodes enable row level security;

create policy "Anyone can read medicine barcodes"
  on public.medicine_barcodes for select to anon, authenticated using (true);

-- Demo barcodes, one per seeded medicine (matched by name).
insert into public.medicine_barcodes (gtin, medicine_id)
select v.gtin, m.id
from (values
  ('2000000000015', 'Adrenaline 300micrograms auto-injector'),
  ('2000000000022', 'Amlodipine 5mg tablets'),
  ('2000000000039', 'Amoxicillin 250mg/5ml oral suspension'),
  ('2000000000046', 'Amoxicillin 500mg capsules'),
  ('2000000000053', 'Atorvastatin 20mg tablets'),
  ('2000000000060', 'Estradiol 0.06% gel'),
  ('2000000000077', 'Estradiol 2mg tablets'),
  ('2000000000084', 'Insulin glargine 100units/ml pre-filled pen'),
  ('2000000000091', 'Levothyroxine 50microgram tablets'),
  ('2000000000107', 'Lisdexamfetamine 30mg capsules'),
  ('2000000000114', 'Metformin 500mg tablets'),
  ('2000000000121', 'Methylphenidate 18mg modified-release tablets'),
  ('2000000000138', 'Methylphenidate 36mg modified-release tablets'),
  ('2000000000145', 'Nitrofurantoin 100mg modified-release capsules'),
  ('2000000000152', 'Omeprazole 20mg gastro-resistant capsules'),
  ('2000000000169', 'Phenoxymethylpenicillin 250mg tablets'),
  ('2000000000176', 'Ramipril 5mg capsules'),
  ('2000000000183', 'Salbutamol 100micrograms/dose inhaler'),
  ('2000000000190', 'Sertraline 100mg tablets'),
  ('2000000000206', 'Sertraline 50mg tablets')
) as v (gtin, medicine_name)
join public.medicines m on m.name = v.medicine_name;
