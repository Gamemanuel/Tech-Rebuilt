-- 0006: Archive sold units so they don't pile up forever in the Sold column
-- archived_at is a timestamp, not a boolean, so the Archive page can sort
-- by "most recently archived" and unit detail can show when it happened.
alter table if exists units
    add column if not exists archived_at timestamptz;

create index if not exists units_archived_at_idx on units(archived_at);