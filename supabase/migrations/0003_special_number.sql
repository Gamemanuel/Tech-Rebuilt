-- Add a separate unit identifier in the format index.day.month.year
alter table if exists units
  add column if not exists special_number text;

create unique index if not exists units_special_number_idx
  on units (special_number)
  where special_number is not null;
