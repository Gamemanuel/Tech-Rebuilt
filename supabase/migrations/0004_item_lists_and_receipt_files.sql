-- 0004: CSV/PDF receipt support, per-item to-do & shopping lists
-- Run this after 0002_receipts_rework.sql. (0003_special_number.sql is
-- unrelated — an older, orthogonal migration already in this folder.)

-- ---------- CSV / PDF receipts ----------
-- receipt_source already has 'csv' and 'image' (see 0001_init.sql); adding
-- 'pdf' as a third file type alongside them.
alter type receipt_source add value if not exists 'pdf';

-- For CSV receipts, we store the parsed rows so the detail page can render
-- them as a table without re-parsing the file every time. headers/rows are
-- kept as parallel arrays (not array-of-objects) so column order survives
-- the JSON round-trip cleanly.
alter table receipts add column if not exists csv_headers text[];
alter table receipts add column if not exists csv_rows jsonb;

-- ---------- Per-item lists ----------
-- Each receipt item can carry its own to-do list (things to do to it) and
-- shopping list (things you still need to buy for it). "done" on a
-- shopping-list row means "purchased."
create table if not exists item_todos (
  id uuid primary key default gen_random_uuid(),
  receipt_item_id uuid not null references receipt_items(id) on delete cascade,
  description text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists item_shopping_items (
  id uuid primary key default gen_random_uuid(),
  receipt_item_id uuid not null references receipt_items(id) on delete cascade,
  description text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists item_todos_receipt_item_id_idx on item_todos(receipt_item_id);
create index if not exists item_shopping_items_receipt_item_id_idx on item_shopping_items(receipt_item_id);

alter table item_todos enable row level security;
alter table item_shopping_items enable row level security;

drop policy if exists "Authenticated users have full access" on item_todos;
create policy "Authenticated users have full access" on item_todos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users have full access" on item_shopping_items;
create policy "Authenticated users have full access" on item_shopping_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
