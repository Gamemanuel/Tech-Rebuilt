-- 0005: Move to-do lists from per-receipt-item to per-unit
--
-- Todos are really about the physical unit you're refurbishing, not about
-- which receipt a part came from — a unit can pull parts from several
-- receipts, but it should have one continuous to-do list. The shopping
-- list is unchanged and stays on receipt_items.

create table if not exists unit_todos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  description text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists unit_todos_unit_id_idx on unit_todos(unit_id);

-- Carry over anything already entered, for items that were attached to a
-- unit. Todos on items with no unit assigned have nowhere to go and are
-- dropped — there weren't many of these yet, if any.
insert into unit_todos (unit_id, description, done, created_at)
select ri.unit_id, it.description, it.done, it.created_at
from item_todos it
join receipt_items ri on ri.id = it.receipt_item_id
where ri.unit_id is not null;

drop table if exists item_todos;

alter table unit_todos enable row level security;

drop policy if exists "Authenticated users have full access" on unit_todos;
create policy "Authenticated users have full access" on unit_todos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
