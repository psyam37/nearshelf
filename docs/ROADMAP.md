# Build roadmap (14 days)

Tick items off as you go. Each stage should end with a commit.

## Days 1–2: Setup and database ✅ baseline provided
- [x] Next.js + TypeScript (strict) + Tailwind project
- [x] Supabase schema: pharmacies, medicines, staff, stock, requests
- [x] Row level security rules
- [x] `search_medicines` and `nearby_stock` database functions
- [x] Demo seed data (12 fictional pharmacies, 20 medicines)
- [ ] Get it running locally (README → Getting started); Setup check shows ✓ ✓
- [ ] Run `npm run db:types` and use the generated `Database` type in both Supabase clients (`createBrowserClient<Database>(...)`). Notice how query results become typed.
- [ ] Read through `src/lib/types.ts` and `src/lib/schemas.ts`: how does `z.infer` work?
- [ ] Push to a new GitHub repo

## Days 3–4: Medicine search with autocomplete
- [ ] `/search` page with a search box (Client Component)
- [ ] Route handler `src/app/api/medicines/route.ts` that validates `?q=` with `medicineSearchSchema` and calls `search_medicines`
- [ ] Debounce typing (≈250 ms) with a small custom hook `useDebouncedValue<T>()`; practise generics
- [ ] Keyboard support: arrow keys and Enter in the results list
- [ ] Show a "controlled drug" tag for `is_controlled` medicines

## Days 5–6: Nearby search, map and list
- [ ] Get the user's location (browser geolocation), with a postcode fallback
- [ ] Call `nearby_stock` and validate inputs with `nearbyStockSchema`
- [ ] Results list: name, distance (`formatDistance`), `StockBadge`, "updated 3 h ago" (`formatUpdatedAgo`), stale warning (`isStale`)
- [ ] "Include equivalents" toggle
- [ ] Map with Leaflet (react-leaflet) and OpenStreetMap tiles; markers coloured by stock level

## Days 7–8: Auth and stock updates
- [ ] Email sign-in with Supabase Auth
- [ ] `src/proxy.ts` to refresh sessions (Next.js 16 renamed middleware to proxy; check `node_modules/next/dist/docs`)
- [ ] New migration: stock levels readable only when signed in (remove `anon`)
- [ ] Link a test user to a demo pharmacy in `pharmacy_staff`
- [ ] "My pharmacy" page: search a medicine and set in stock / low / out (Server Action + `stockUpdateSchema`)
- [ ] Test that staff can't update another pharmacy's stock

## Days 9–10: Live updates and stock requests
- [ ] Subscribe to `stock_status` changes with Supabase Realtime; results update without refreshing
- [ ] "Ask to confirm" button sends a `stock_requests` row
- [ ] Inbox for incoming requests: confirm or decline, with live notification

## Days 11–12: Barcode scanning, polish, deploy
- [ ] Scan a medicine pack barcode with the phone camera (e.g. @zxing/browser)
- [ ] Empty, loading and error states everywhere
- [ ] Check it works at phone width
- [ ] Hosted Supabase project + deploy to Vercel

## Days 13–14: Show it off
- [ ] README screenshots and a GIF or short demo video
- [ ] Write up the design decisions (levels not counts, B2B first, row level security, dm+d)
- [ ] Add to CV and LinkedIn
- [ ] Message a few pharmacy-tech companies with the link

## Stretch ideas
- Import real dm+d data (see README)
- Shortage signal: many "out" reports for one medicine in an area
- Unit tests for `src/lib/stock.ts` with Vitest
