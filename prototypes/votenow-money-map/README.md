# VoteNow — Money Map (prototype)

A running prototype of the VoteNow money-in-politics flow: a real geographic US
money map (shaded **per registered voter**) → drill Nation → State → District →
Race → the **source → vehicle → race** money chain, ending at the dark-money wall.

This is a **Vite + React** spike. It lives in `prototypes/` **on purpose** —
outside the pnpm workspace globs (`apps/*`, `packages/*`), so it is NOT part of
the root `pnpm install` / turbo build and cannot break them. It is fully
self-contained (its own `package.json` + lockfile; run `npm install` inside this
directory). The **production home is `apps/votenow-web` (Next.js)** — port it
there when it graduates from spike to product (`react-simple-maps` + `us-atlas`
work under Next with a `'use client'` map component).

Includes the companion research audit: `PAE-campaign-finance-audit.md` (+ PDF).

## Run

```bash
npm install      # already installed if copied with node_modules
npm run dev      # http://localhost:5187
```

Click **Georgia** (the one state with real, reporting-sourced data) to drill in.

## Make the whole map real

The map reads `src/data.json`. Only Georgia is seeded. To compute money per
registered voter for **every** state from OpenFEC:

```bash
# Free key: https://api.data.gov/signup/
FEC_API_KEY=your_key node scripts/fec-ingest.mjs
```

That writes `src/data.json` (candidate House+Senate receipts per state,
normalized by `src/registration.js`). Restart the dev server to see it.

## What's real vs illustrative

- **Real geometry** — `react-simple-maps` + `us-atlas` state shapes.
- **Real normalization** — `src/registration.js` (ballpark registered voters).
- **Georgia** — real reporting-sourced numbers (Ossoff/Collins + the super-PAC
  chain, One Nation / Majority Forward). Verify vs FEC before publishing.
- **Every other state + all districts** — illustrative placeholder shading until
  you run the ingest (money) and add district data.

## Next (per the design doc)

- Independent expenditures (Schedule E) + the full source→vehicle→race graph
  (see the design doc's Money-Flow Graph Model; bounded 2-hop v1).
- District-level races between the state view and the race view.
- Promote to `apps/votenow-web` (Next.js) in the Civica monorepo.
