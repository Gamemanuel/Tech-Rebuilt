// Mirrors the Supabase schema in supabase/migrations/0001_init.sql,
// 0002_receipts_rework.sql, and 0004_item_lists_and_receipt_files.sql.
// All money values are integer cents.

export type UnitStatus =
  | "sourced"
  | "intake"
  | "in_repair"
  | "qc_testing"
  | "listed"
  | "sold"
  | "returned"
  | "parted_out";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  sourced: "Sourced",
  intake: "Intake & diagnosis",
  in_repair: "In repair",
  qc_testing: "QC testing",
  listed: "Listed for sale",
  sold: "Sold & shipped",
  returned: "Returned",
  parted_out: "Parted out",
};

// Ordered left-to-right for the pipeline board's forward "Advance" flow.
// "returned" isn't reached by advancing — it's set explicitly when a sale
// is marked returned, then resolved back to "listed". parted_out is an
// exit, not a stage on the board.
export const PIPELINE_STAGES: UnitStatus[] = [
  "sourced",
  "intake",
  "in_repair",
  "qc_testing",
  "listed",
  "sold",
];

export type ItemCategory = "part" | "accessory" | "product" | "supply";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  product: "Product",
  part: "Part",
  accessory: "Accessory",
  supply: "Supply / overhead",
};

export interface Unit {
  id: string;
  model: string;
  generation: string | null;
  serial_number: string | null;
  condition_grade: string | null;
  status: UnitStatus;
  current_stage_since: string;
  notes: string | null;
  created_at: string;
}

export interface Repair {
  id: string;
  unit_id: string;
  started_at: string;
  completed_at: string | null;
  labor_hours: number;
  // Snapshotted from shop_settings.labor_rate_cents_per_hour at the moment
  // the repair was logged, so past margins don't shift if you change your
  // rate later. The UI auto-fills this — you never type it by hand.
  labor_rate_cents: number;
  notes: string | null;
}

export interface Receipt {
  id: string;
  source_type: "csv" | "image" | "manual" | "pdf";
  source: string | null; // "eBay", "Goodwill", "ShopGoodwill", or free text
  file_url: string | null;
  receipt_date: string | null;
  created_at: string;
  // Only set when source_type === "csv" — parallel arrays (not
  // array-of-objects) so column order survives the JSON round-trip.
  csv_headers: string[] | null;
  csv_rows: string[][] | null;
}

export interface ReceiptBundle {
  id: string;
  receipt_id: string;
  description: string | null;
  total_cents: number;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  bundle_id: string | null;
  unit_id: string | null; // null = supply/overhead item, not tied to a unit
  category: ItemCategory;
  description: string;
  cost_cents: number | null; // null exactly when bundle_id is set
}

// A receipt item after bundle math has been applied — see resolveItemCosts
// in lib/calculations.ts. This is what the UI should actually render/sum.
export interface ResolvedReceiptItem extends ReceiptItem {
  resolvedCostCents: number;
  isBundled: boolean;
}

export interface ReceiptWithItems extends Receipt {
  receipt_items: ReceiptItem[];
  receipt_bundles: ReceiptBundle[];
}

export interface UnitTodo {
    id: string;
    unit_id: string;
    description: string;
    done: boolean;
    created_at: string;
}

export interface ShoppingItem {
  id: string;
  receipt_item_id: string;
  description: string;
  done: boolean; // "purchased"
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

export interface ReturnRecord {
  id: string;
  unit_id: string;
  sale_id: string | null;
  return_shipping_cents: number;
  returned_at: string;
  resolved_at: string | null; // set when it's sent back to Listed
  notes: string | null;
}

export interface ShopSettings {
  labor_rate_cents_per_hour: number;
}

// Convenience shape for a unit with everything needed to compute cost/margin.
// `sale` should be the most recent sale for the unit (a unit can be sold,
// returned, and resold, so don't assume there's only ever one).
export interface UnitWithFinancials extends Unit {
  repairs: Repair[];
  receipt_items: ResolvedReceiptItem[];
  returns: ReturnRecord[];
  sale: Sale | null;
}
