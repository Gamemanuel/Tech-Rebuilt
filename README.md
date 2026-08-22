# Refurb Tracker

A local Next.js app for tracking refurbished game console inventory, repairs,
receipts, and profit margins. Built with Next.js (App Router), Tailwind CSS,
shadcn-style components, and Supabase (Postgres + Auth + Storage).

## What's here

- **Dashboard** (`/`) — revenue, net profit, average margin, capital tied up
  in unsold inventory, and a recent-sales feed.
- **Pipeline** (`/units`) — a status board (Sourced → Intake → In repair →
  QC testing → Listed → Sold). Hover a card and click "Advance" to move it
  forward a stage.
- **Unit detail** (`/units/[id]`) — full cost breakdown (purchase + parts +
  labor) and, once sold, the resulting margin.
- **Receipts** (`/receipts`) — import a CSV export from your bank/card, or
  upload a photo of a paper receipt. Photo receipts are parsed automatically
  if you set `ANTHROPIC_API_KEY` (uses Claude's vision to read the total,
  date, and vendor); otherwise you fill those fields in by hand.
- **Vendors** (`/vendors`) — track where units and parts get sourced from.

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then open the
SQL editor and run everything in `supabase/migrations/0001_init.sql`. That
creates all the tables, the `receipts` storage bucket, and row-level
security policies that require a logged-in user.

If the storage bucket insert fails (sometimes blocked by SQL editor
permissions), create it manually: Storage → New bucket → name it `receipts`,
leave it private.

### 2. Set environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
Supabase → Project Settings → API. `ANTHROPIC_API_KEY` is optional — only
needed for automatic receipt-photo parsing.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/login` — sign up with any email/password (Supabase's default settings
allow this without email verification; tighten that in Auth settings if
you'd rather require it).

## Notes on the data model

- All money is stored as **integer cents**, never floats, to avoid rounding
  errors. `lib/utils.ts` has `formatCurrency()` for display.
- `computeUnitCost()` and `computeMargin()` in `lib/calculations.ts` are the
  only place cost/margin math happens — if you want to change how margin is
  calculated (e.g. add a flat per-unit overhead), that's the one file to
  touch.
- `repair_parts.cost_at_time_cents` snapshots a part's cost when it's used,
  so raising a part's price later doesn't retroactively change historical
  margins.
- The pipeline board advances one stage at a time via a button, not drag-
  and-drop, to keep the dependency list small. `@hello-pangea/dnd` is a
  reasonable next step if you want actual dragging.

## Reasonable next features

- Aging-inventory alerts (flag units sitting in one stage too long — the
  data's already there via `current_stage_since`)
- Parts inventory with low-stock warnings
- Sales-channel fee presets (eBay ~13%, PayPal ~3%, etc.) to auto-fill fees
- Tax-ready expense export by category and quarter
- QR/barcode labels per unit for physical bin tracking
