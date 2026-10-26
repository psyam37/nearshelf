# MediBase

When a pharmacy can't fill a prescription, staff phone around nearby pharmacies to find one that has the medicine. This app lets pharmacy teams see, at a glance, which pharmacies near them have a medicine in stock, and ask one to confirm.

- **Availability levels, not counts.** In stock / low / out, which is less sensitive and easier to keep accurate.
- **Freshness shown.** Every level shows when it was last confirmed.
- **Built for pharmacy staff (B2B).** Only staff can update their own pharmacy's stock, enforced in the database.
- **Shaped after the NHS dm+d.** Medicines are grouped by equivalence, so a search can include other brands and strengths.

> Demo project. All pharmacies in the seed data are fictional. Not for clinical use.

## Tech stack

| Part | Choice |
| --- | --- |
| Front end and API | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Database, auth, live updates | Supabase (Postgres) |
| Geospatial search | PostGIS |
| Validation | Zod |
| Hosting (later) | Vercel + Supabase free tiers |

## Getting started

You need **Node.js 20+**. For the local database you also need **Docker Desktop** running. If you'd rather not install Docker, use option B.

```bash
npm install
cp .env.example .env.local
```

### Option A: local database (recommended)

```bash
npm run db:start     # first run downloads Docker images, takes a few minutes
```

It prints an **API URL** and an **anon key**. Put them in `.env.local`. Then:

```bash
npm run db:reset     # creates the tables and loads the demo data
npm run dev
```

Open http://localhost:3000. The **Setup check** card should say the database is connected with 12 pharmacies and 20 medicines. Supabase Studio (a database UI) runs at http://127.0.0.1:54323.

### Option B: hosted Supabase (no Docker)

1. Create a free project at supabase.com.
2. In the dashboard's **SQL Editor**, run `supabase/migrations/20261026000000_initial_schema.sql`, then `supabase/seed.sql`.
3. Copy the project URL and anon key from **Project Settings → API** into `.env.local`.
4. `npm run dev`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at localhost:3000 |
| `npm run typecheck` | Check all TypeScript types |
| `npm run lint` | Run ESLint |
| `npm run format` | Format everything with Prettier |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Rebuild the database from migrations + seed |
| `npm run db:types` | Generate exact TypeScript types from the database |

## Project structure

```
src/
  app/
    layout.tsx            page shell
    page.tsx              home page with the setup check
  components/
    StockBadge.tsx        in stock / low / out badge
  lib/
    types.ts              domain types (Pharmacy, Medicine, StockLevel…)
    schemas.ts            Zod schemas for every user input
    stock.ts              helpers: labels, "updated 3 h ago", distance
    env.ts                validates .env.local
    supabase/
      client.ts           Supabase client for browser code
      server.ts           Supabase client for server code
supabase/
  migrations/             database schema (tables, security rules, functions)
  seed.sql                fictional pharmacies, common medicines, random stock
  config.toml             local Supabase settings
docs/
  ROADMAP.md              the 14-day build plan with checklists
```

## Database overview

| Table | Holds |
| --- | --- |
| `pharmacies` | Name, address, location (PostGIS point), opening hours |
| `medicines` | Name, strength, form, `equivalence_group`, `is_controlled`, dm+d id |
| `pharmacy_staff` | Which signed-in users work at which pharmacy |
| `stock_status` | One row per pharmacy + medicine: level and when it was updated |
| `stock_requests` | "Can you confirm you have X?" messages between pharmacies |

Database functions the app calls with `supabase.rpc(...)`:

- `search_medicines(p_query, p_limit)`: fuzzy medicine search for autocomplete
- `nearby_stock(p_medicine_id, p_lat, p_lng, p_radius_m, p_include_equivalents)`: pharmacies within a radius that stock the medicine, best availability and nearest first

**Security** is enforced with Postgres row level security, so the rules hold even if the front end has a bug. Staff can only change their own pharmacy's stock, and requests are only visible to the two pharmacies involved. Stock levels are readable without signing in until auth is built on Day 7 (see the TODO in the migration).

## Importing dm+d (later)

The seed uses common generic medicines with `dmd_vmp_id` left empty. The real catalogue is the NHS Dictionary of Medicines and Devices, free from NHSBSA via the TRUD service (free account needed). A good stretch task: write a TypeScript script that reads the dm+d VMP and VTM files and loads them into `medicines`, using the VTM name as `equivalence_group`.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).
