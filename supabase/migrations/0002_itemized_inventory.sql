-- Itemized receipts, reusable inventory items, and labor logging

do $$ begin
  create type item_category as enum ('part', 'accessory');
exception
  when duplicate_object then null;
end $$;

create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references receipts(id) on delete cascade,
  name text not null,
  category item_category not null default 'part',
  quantity integer not null default 1,
  cost_cents bigint not null default 0,
  price_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists receipt_items_receipt_id_idx on receipt_items(receipt_id);

create table if not exists unit_items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  receipt_item_id uuid not null references receipt_items(id) on delete restrict,
  quantity integer not null default 1,
  cost_cents bigint not null default 0,
  price_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists unit_items_unit_id_idx on unit_items(unit_id);
create index if not exists unit_items_receipt_item_id_idx on unit_items(receipt_item_id);

create table if not exists labor_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  unit_item_id uuid references unit_items(id) on delete set null,
  hours numeric(6,2) not null default 0,
  rate_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists labor_entries_unit_id_idx on labor_entries(unit_id);
create index if not exists labor_entries_unit_item_id_idx on labor_entries(unit_item_id);

alter table if exists receipt_items enable row level security;
alter table if exists unit_items enable row level security;
alter table if exists labor_entries enable row level security;

drop policy if exists "Authenticated users have full access" on receipt_items;
create policy "Authenticated users have full access" on receipt_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on unit_items;
create policy "Authenticated users have full access" on unit_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on labor_entries;
create policy "Authenticated users have full access" on labor_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
