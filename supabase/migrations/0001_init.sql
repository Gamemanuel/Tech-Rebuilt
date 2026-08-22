-- Refurb Tracker schema
-- Run this in the Supabase SQL editor, or via `supabase db push` if you're
-- using the CLI. All money columns are integer cents (bigint) to avoid
-- floating point rounding on currency.

create extension if not exists "pgcrypto";

create type unit_status as enum (
  'sourced',
  'intake',
  'in_repair',
  'qc_testing',
  'listed',
  'sold',
  'parted_out'
);

create type receipt_source as enum ('csv', 'image', 'manual');

-- Where units and expenses come from
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  notes text,
  created_at timestamptz not null default now()
);

-- One row per physical console
create table units (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  generation text,
  serial_number text,
  condition_grade text,
  vendor_id uuid references vendors(id) on delete set null,
  purchase_price_cents bigint not null default 0,
  purchase_date date,
  status unit_status not null default 'sourced',
  current_stage_since timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index units_status_idx on units(status);

-- Bump current_stage_since automatically whenever status changes,
-- so "days in current stage" is always accurate without extra app logic.
create or replace function touch_stage_timestamp()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    new.current_stage_since := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger units_stage_timestamp
  before update on units
  for each row execute function touch_stage_timestamp();

-- Parts inventory
create table parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  cost_per_unit_cents bigint not null default 0,
  qty_on_hand integer not null default 0,
  reorder_threshold integer not null default 0
);

-- A repair job on a unit (can span multiple parts)
create table repairs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  labor_hours numeric(6,2) not null default 0,
  labor_rate_cents bigint not null default 0,
  notes text
);

create index repairs_unit_id_idx on repairs(unit_id);

-- Parts consumed by a specific repair. cost_at_time_cents is a snapshot
-- of the part's cost when used, so later price changes don't retroactively
-- change historical margins.
create table repair_parts (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references repairs(id) on delete cascade,
  part_id uuid not null references parts(id) on delete restrict,
  qty_used integer not null default 1,
  cost_at_time_cents bigint not null default 0
);

-- Receipts imported via CSV, photographed, or entered manually
create table receipts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  source_type receipt_source not null default 'manual',
  file_url text,
  amount_cents bigint not null default 0,
  receipt_date date,
  category text,
  description text,
  created_at timestamptz not null default now()
);

create index receipts_unit_id_idx on receipts(unit_id);

-- One sale per unit (one-to-one; a unit sells once)
create table sales (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references units(id) on delete cascade,
  channel text not null,
  sale_price_cents bigint not null default 0,
  fees_cents bigint not null default 0,
  sold_at timestamptz not null default now(),
  buyer_notes text
);

-- Storage bucket for receipt photos and unit condition photos.
-- Run separately if this errors on your project (buckets are sometimes
-- created via the Storage UI instead of SQL).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Row Level Security: start locked down, then open up for authenticated
-- users. Tighten further (e.g. per-user ownership) once you add auth.
alter table vendors enable row level security;
alter table units enable row level security;
alter table parts enable row level security;
alter table repairs enable row level security;
alter table repair_parts enable row level security;
alter table receipts enable row level security;
alter table sales enable row level security;

create policy "Authenticated users have full access" on vendors
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on units
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on parts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on repairs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on repair_parts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on receipts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
