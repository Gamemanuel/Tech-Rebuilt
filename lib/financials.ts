import { SupabaseClient } from "@supabase/supabase-js";
import { ReceiptItem, Repair, RepairPart, Sale, Unit, UnitItem, LaborEntry, UnitWithFinancials } from "./types";

function groupBy<T, K extends string | number>(rows: T[], getKey: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

function fallbackReceiptItem(item: UnitItem): ReceiptItem {
  return {
    id: item.receipt_item_id,
    receipt_id: null,
    name: "Unknown item",
    category: "part",
    quantity: 1,
    cost_cents: item.cost_cents,
    price_cents: item.price_cents,
    notes: null,
    created_at: item.created_at,
  };
}

function isMissingSchemaObject(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || /schema cache|could not find the table|could not find a relationship/i.test(error.message ?? "");
}

export async function loadUnitsWithFinancials(
  supabase: SupabaseClient,
  units: Unit[]
): Promise<UnitWithFinancials[]> {
  if (units.length === 0) return [];

  const unitIds = units.map((unit) => unit.id);

  const [
    { data: repairsRows, error: repairsError },
    { data: repairPartRows, error: repairPartError },
    { data: unitItemRows, error: unitItemError },
    { data: laborRows, error: laborError },
    { data: saleRows, error: saleError },
    { data: receiptItemRows, error: receiptItemError },
  ] = await Promise.all([
    supabase.from("repairs").select("*").in("unit_id", unitIds),
    supabase.from("repair_parts").select("*"),
    supabase.from("unit_items").select("*").in("unit_id", unitIds),
    supabase.from("labor_entries").select("*").in("unit_id", unitIds),
    supabase.from("sales").select("*").in("unit_id", unitIds),
    supabase.from("receipt_items").select("*"),
  ]);

  const firstError =
    (repairsError && !isMissingSchemaObject(repairsError) ? repairsError : null) ||
    (repairPartError && !isMissingSchemaObject(repairPartError) ? repairPartError : null) ||
    (unitItemError && !isMissingSchemaObject(unitItemError) ? unitItemError : null) ||
    (laborError && !isMissingSchemaObject(laborError) ? laborError : null) ||
    (saleError && !isMissingSchemaObject(saleError) ? saleError : null) ||
    (receiptItemError && !isMissingSchemaObject(receiptItemError) ? receiptItemError : null);
  if (firstError) {
    throw firstError;
  }

  const repairs = isMissingSchemaObject(repairsError) ? [] : ((repairsRows ?? []) as Repair[]);
  const repairParts = isMissingSchemaObject(repairPartError) ? [] : ((repairPartRows ?? []) as RepairPart[]);
  const unitItems = isMissingSchemaObject(unitItemError) ? [] : ((unitItemRows ?? []) as UnitItem[]);
  const laborEntries = isMissingSchemaObject(laborError) ? [] : ((laborRows ?? []) as LaborEntry[]);
  const sales = (saleRows ?? []) as Sale[];
  const receiptItems = isMissingSchemaObject(receiptItemError) ? [] : ((receiptItemRows ?? []) as ReceiptItem[]);

  const repairPartsByRepair = groupBy(repairParts, (row) => row.repair_id);
  const repairsByUnit = groupBy(repairs, (row) => row.unit_id);
  const unitItemsByUnit = groupBy(unitItems, (row) => row.unit_id);
  const laborByUnit = groupBy(laborEntries, (row) => row.unit_id);
  const salesByUnit = new Map(sales.map((sale) => [sale.unit_id, sale]));
  const receiptItemById = new Map(receiptItems.map((item) => [item.id, item]));

  return units.map((unit) => {
    const unitRepairs = (repairsByUnit.get(unit.id) ?? []).map((repair) => ({
      ...repair,
      repair_parts: repairPartsByRepair.get(repair.id) ?? [],
    }));

    const unitItemRows = (unitItemsByUnit.get(unit.id) ?? []).map((item) => ({
      ...item,
      receipt_item: receiptItemById.get(item.receipt_item_id) ?? fallbackReceiptItem(item),
    }));

    return {
      ...unit,
      repairs: unitRepairs,
      unit_items: unitItemRows,
      labor_entries: laborByUnit.get(unit.id) ?? [],
      sale: salesByUnit.get(unit.id) ?? null,
    };
  });
}
