-- 0007: Archive receipts once every item on them has been assigned
-- Mirrors 0006_archive_units.sql.
alter table if exists receipts
    add column if not exists archived_at timestamptz;

create index if not exists receipts_archived_at_idx on receipts(archived_at);