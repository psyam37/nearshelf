# NearShelf roadmap

NearShelf grows in four phases: a core app that lets pharmacies find stock nearby,
then insights that show shortages coming, then smart stock built on each pharmacy's
own PMR data, and finally a connected area. Each phase has its own branch, and each
finished stage of work is a tagged release.

| Phase                  | What it adds                                                                                                                                   | Status          | Branch                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| **0 · Core app**       | Live stock, one-tap requests, 30-minute hold, handover chat, push alerts, patient finder, PMR CSV import, install as an app                    | ✅ Live         | [`phase/0-core`](https://github.com/psyam37/pharmacy-stock-finder/tree/phase/0-core)                     |
| **1 · Insights**       | Unmet demand, response and reliability scores, referral log, NHS dispensing trends by ICB, price-concession shortage signals, seasonal outlook | 🟡 Preview live | [`phase/1-insights`](https://github.com/psyam37/pharmacy-stock-finder/tree/phase/1-insights)             |
| **2 · Smart stock**    | Days of stock left from PMR uploads, slow-moving stock, reorder alerts                                                                         | 🔜 Next         | [`phase/2-smart-stock`](https://github.com/psyam37/pharmacy-stock-finder/tree/phase/2-smart-stock)       |
| **3 · Connected area** | Direct ProScript Connect and Titan links, one view across a group's branches, shortage early-warning for LPCs and ICBs                         | 🌱 Later        | [`phase/3-connected-area`](https://github.com/psyam37/pharmacy-stock-finder/tree/phase/3-connected-area) |

## Phase 0 · Core app ✅

Everything a pilot pharmacy needs, live at the pilot site.

- Medicine search with autocomplete, and a map of nearby stock (PostGIS)
- Email sign-in, GPhC-verified staff, pharmacies checked against the NHS ODS directory
- In stock / Low / Out levels, Unverified after 2 hours, one-tap re-confirm
- Ask every pharmacy within 2, 5 or 10 miles; urgent requests first
- "Confirm we have it" holds the pack for 30 minutes and opens a text-only handover chat
- Patient details blocked by the database itself
- Web push notifications; installable app for phones and dispensary PCs
- Patient finder for opt-in listings; controlled drugs never public
- Stock report upload from ProScript Connect, Titan and other PMRs (CSV)
- Admin tools: refresh the demo, add a real pharmacy by ODS code

## Phase 1 · Insights 🟡

A preview is live at `/insights` for pharmacy staff.

- [x] Your pharmacy: unmet requests nearby, response time vs the network, requests answered, stock freshness
- [x] Referral log
- [x] Demand in your ICB from NHSBSA Prescription Cost Analysis open data (Jan 2021 onwards)
- [x] Shortage signals from Community Pharmacy England price concessions
- [x] Seasonal outlook for the next three months
- [ ] Anonymous search logging, to measure demand nobody asked for out loud
- [ ] Demand heat map (grouped areas, shown only above a minimum count)
- [ ] Serious Shortage Protocol flags

## Phase 2 · Smart stock 🔜

Built on each pharmacy's own PMR uploads. Quantities stay private to that pharmacy.

- [ ] Keep pack counts from each upload (private to the pharmacy)
- [ ] Days of stock left per medicine, from how fast counts fall between uploads
- [ ] Slow-moving stock: items whose count hasn't changed for weeks
- [ ] Reorder alerts: local demand rising and your stock Low

## Phase 3 · Connected area 🌱

- [ ] Direct integration with ProScript Connect
- [ ] Direct integration with Titan
- [ ] One view across a pharmacy group's branches
- [ ] Area shortage early-warning for Local Pharmaceutical Committees and ICBs

## Release history

| Release                                                                        | Date        | Stage                                                                               |
| ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------- |
| [v0.1.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.1.0) | 26 Oct 2026 | Foundations: medicine search, nearby stock list and map                             |
| [v0.2.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.2.0) | 26 Oct 2026 | Accounts and live stock: sign-in, My pharmacy, live updates, stock requests         |
| [v0.3.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.3.0) | 26 Oct 2026 | Brand and scanning: logo, design system, barcode scanning                           |
| [v0.4.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.4.0) | 27 Oct 2026 | Verified network: GPhC sign-up, holds, broadcasts, handover chat, push alerts       |
| [v0.5.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.5.0) | 27 Oct 2026 | Patient finder with pharmacy-controlled listings                                    |
| [v0.6.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.6.0) | 28 Oct 2026 | Pitch-ready pilot: pitch page, PMR import, admin tools, link previews, install page |
| [v0.7.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.7.0) | 28 Oct 2026 | Insights preview with NHS open data                                                 |
| [v0.8.0](https://github.com/psyam37/pharmacy-stock-finder/releases/tag/v0.8.0) | 29 Oct 2026 | Renamed to NearShelf                                                                |

## How the branches work

- **`main`** is what's live. Every push to it deploys to Vercel.
- **`phase/0-core`** is frozen at v0.6.0, the end of the core app.
- **`phase/1-insights`**, **`phase/2-smart-stock`** and **`phase/3-connected-area`** are
  where each phase's work happens. Finished work goes into `main` through a pull request,
  and each finished stage gets a release tag.
- Database migrations are only ever added, never edited, so every branch can run on the
  same Supabase project.

The original day-by-day learning plan is in [`LEARNING-PLAN.md`](LEARNING-PLAN.md).
