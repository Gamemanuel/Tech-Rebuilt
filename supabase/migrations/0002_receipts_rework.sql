-- 0002: Receipts rework, returns handling, shop settings, vendor removal
-- Run this after 0001_init.sql, in the Supabase SQL editor.
--
-- THIS VERSION SUPERSEDES ANY EARLIER 0002. If your project ever had
-- `0002_itemized_inventory.sql` applied (an old, abandoned design that
-- reused the name `receipt_items` for something incompatible), this
-- migration tears those objects out first. It also unconditionally
-- rebuilds `receipt_items` / `receipt_bundles` / the `item_category` type
-- from scratch, since both designs used those same names with different
-- shapes — if you already have real data in either, back it up before
-- running this. Everything else here is safe to re-run if a previous
-- attempt partially completed.
--
-- What this does:
--   1. Tears out the old itemized-inventory design (unit_items,
--      labor_entries) and the old vendors/parts/repair_parts tables.
--   2. Rebuilds receipt_items/receipt_bundles/item_category fresh, so one
--      receipt can hold many line items, each with its own price,
--      category, and optional unit assignment.
--   3. Adds receipt_bundles for "I bought 4 controllers for $40, no idea
--      what each one cost" purchases — enter ONE total, tag the items that
--      came out of it, and the app splits it evenly across them.
--   4. Moves a unit's acquisition cost out of `units` and into receipt_items
--      (category = 'product').
--   5. Adds a 'returned' pipeline stage + a `returns` table, and loosens
--      `sales` so a unit can be sold more than once over its life.
--   6. Adds shop_settings for your one global labor rate.

-- ---------- Tear out the old itemized-inventory design ----------
drop table if exists labor_entries;
drop table if exists unit_items;

-- ---------- Tear out even older stuff ----------
drop table if exists repair_parts;
drop table if exists parts;
drop table if exists vendors cascade;

-- receipts.vendor_id/unit_id/amount_cents/category/description move to
-- receipt_items below; "vendor" becomes a plain text field on the receipt
-- itself (eBay, Goodwill, ShopGoodwill, or whatever you type).
alter table receipts drop column if exists vendor_id;
alter table receipts drop column if exists unit_id;
alter table receipts drop column if exists amount_cents;
alter table receipts drop column if exists category;
alter table receipts drop column if exists description;
alter table receipts add column if not exists source text;

-- units no longer carries its own acquisition price/date/vendor — that's
-- now just a receipt_item (category='product') linked to the unit.
alter table units drop column if exists purchase_price_cents;
alter table units drop column if exists purchase_date;
alter table units drop column if exists vendor_id;

-- ---------- New pipeline stage ----------
-- If this line errors because it's bundled with the rest of the file in one
-- transaction, run just this line by itself first, then run the rest.
alter type unit_status add value if not exists 'returned' after 'sold';

-- ---------- A unit can be sold, returned, and resold ----------
alter table sales drop constraint if exists sales_unit_id_key;
create index if not exists sales_unit_id_idx on sales(unit_id);

-- ---------- Rebuild receipt_items / receipt_bundles / item_category fresh ----------
-- Dropped unconditionally: this table/type name existed in the old
-- itemized-inventory design too, with an incompatible shape, so we can't
-- safely assume whatever's there (if anything) matches what follows.
drop table if exists receipt_items cascade;
drop table if exists receipt_bundles cascade;
drop type if exists item_category cascade;

create type item_category as enum ('part', 'accessory', 'product', 'supply');

-- A bundle groups items bought together for one price you don't want to
-- split by hand. Items in a bundle store no cost of their own — the app
-- divides bundle.total_cents evenly across however many items point at it.
create table receipt_bundles (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  description text,
  total_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  bundle_id uuid references receipt_bundles(id) on delete set null,
  -- null = "supply"/overhead item not tied to a specific unit
  unit_id uuid references units(id) on delete set null,
  category item_category not null,
  description text not null,
  -- null exactly when this item belongs to a bundle (see check below)
  cost_cents bigint,
  created_at timestamptz not null default now(),
  constraint cost_xor_bundle check (
    (bundle_id is null and cost_cents is not null)
    or (bundle_id is not null and cost_cents is null)
  )
);

create index if not exists receipt_items_receipt_id_idx on receipt_items(receipt_id);
create index if not exists receipt_items_unit_id_idx on receipt_items(unit_id);
create index if not exists receipt_items_bundle_id_idx on receipt_items(bundle_id);

-- ---------- Returns ----------
create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  return_shipping_cents bigint not null default 0,
  returned_at timestamptz not null default now(),
  resolved_at timestamptz, -- set when it's sent back to Listed
  notes text
);

create index if not exists returns_unit_id_idx on returns(unit_id);

-- ---------- Shop-wide settings (just your labor rate for now) ----------
create table if not exists shop_settings (
  id boolean primary key default true,
  labor_rate_cents_per_hour bigint not null default 0,
  constraint shop_settings_singleton check (id)
);
insert into shop_settings (id, labor_rate_cents_per_hour) values (true, 0)
on conflict (id) do nothing;

-- ---------- RLS ----------
alter table receipt_items enable row level security;
alter table receipt_bundles enable row level security;
alter table returns enable row level security;
alter table shop_settings enable row level security;

drop policy if exists "Authenticated users have full access" on receipt_items;
create policy "Authenticated users have full access" on receipt_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on receipt_bundles;
create policy "Authenticated users have full access" on receipt_bundles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on returns;
create policy "Authenticated users have full access" on returns
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on shop_settings;
create policy "Authenticated users have full access" on shop_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
