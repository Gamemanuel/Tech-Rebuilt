// Mirrors the Supabase schema in supabase/migrations/0001_init.sql
// All money values are stored as integer cents to avoid float rounding errors.

export type UnitStatus =
  | "sourced"
  | "intake"
  | "in_repair"
  | "qc_testing"
  | "listed"
  | "sold"
  | "parted_out";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  sourced: "Sourced",
  intake: "Intake & diagnosis",
  in_repair: "In repair",
  qc_testing: "QC testing",
  listed: "Listed for sale",
  sold: "Sold & shipped",
  parted_out: "Parted out",
};

// Ordered left-to-right for the pipeline board. parted_out is an exit, not a stage.
export const PIPELINE_STAGES: UnitStatus[] = [
  "sourced",
  "intake",
  "in_repair",
  "qc_testing",
  "listed",
  "sold",
];

export interface Vendor {
  id: string;
  name: string;
  type: string | null;
  notes: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  model: string;
  generation: string | null;
  serial_number: string | null;
  special_number: string | null;
  condition_grade: string | null;
  vendor_id: string | null;
  purchase_price_cents: number;
  purchase_date: string | null;
  status: UnitStatus;
  current_stage_since: string;
  notes: string | null;
  created_at: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string | null;
  cost_per_unit_cents: number;
  qty_on_hand: number;
  reorder_threshold: number;
}

export interface Repair {
  id: string;
  unit_id: string;
  started_at: string;
  completed_at: string | null;
  labor_hours: number;
  labor_rate_cents: number;
  notes: string | null;
}

export interface RepairPart {
  id: string;
  repair_id: string;
  part_id: string;
  qty_used: number;
  cost_at_time_cents: number;
}

export type ItemCategory = "part" | "accessory";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  part: "Part",
  accessory: "Accessory",
};

export interface Receipt {
  id: string;
  vendor_id: string | null;
  unit_id: string | null;
  source_type: "csv" | "image" | "manual";
  file_url: string | null;
  amount_cents: number;
  receipt_date: string | null;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string | null;
  name: string;
  category: ItemCategory;
  quantity: number;
  cost_cents: number;
  price_cents: number;
  notes: string | null;
  created_at: string;
}

export interface UnitItem {
  id: string;
  unit_id: string;
  receipt_item_id: string;
  quantity: number;
  cost_cents: number;
  price_cents: number;
  notes: string | null;
  created_at: string;
}

export interface LaborEntry {
  id: string;
  unit_id: string;
  unit_item_id: string | null;
  hours: number;
  rate_cents: number;
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  unit_id: string;
  channel: string;
  sale_price_cents: number;
  fees_cents: number;
  sold_at: string;
  buyer_notes: string | null;
}

// Convenience shape for a unit with everything needed to compute margin
export interface UnitWithFinancials extends Unit {
  repairs: (Repair & { repair_parts: RepairPart[] })[];
  unit_items: (UnitItem & { receipt_item: ReceiptItem })[];
  labor_entries: LaborEntry[];
  sale: Sale | null;
}
