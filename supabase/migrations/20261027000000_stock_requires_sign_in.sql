-- =============================================================================
-- Day 7: stock levels are only readable when signed in.
-- Pharmacies and medicines stay public; what each pharmacy has in stock is
-- for pharmacy staff only.
-- =============================================================================

drop policy "Stock levels are readable (dev: no sign-in needed yet)" on public.stock_status;

create policy "Signed-in users can read stock levels"
  on public.stock_status for select to authenticated using (true);
