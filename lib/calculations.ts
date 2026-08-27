import { ReceiptBundle, ReceiptItem, ResolvedReceiptItem, UnitWithFinancials } from "./types";

/**
 * All amounts are integer cents in, integer cents out.
 * Keeping money as cents everywhere avoids the classic 0.1 + 0.2 float bug
 * and matches how Postgres/Supabase should store it (bigint or numeric(10,0)).
 */

/**
 * Turns a receipt's raw items + bundles into items with an actual cost
 * attached. Items priced individually pass through untouched. Items that
 * belong to a bundle (you entered one total for a lot of stuff, not a
 * price per item) get an even split of that bundle's total — with any
 * leftover pennies handed to the first few items so the split always sums
 * back to exactly what you paid, no fractional cents floating around.
 *
 * This is intentionally computed on the fly rather than stored: if you add
 * or remove an item from a bundle later, every affected item's share
 * updates automatically instead of going stale.
 */
export function resolveItemCosts(
  items: ReceiptItem[],
  bundles: ReceiptBundle[]
): ResolvedReceiptItem[] {
  const bundleById = new Map(bundles.map((b) => [b.id, b]));

  const groups = new Map<string, ReceiptItem[]>();
  for (const item of items) {
    if (!item.bundle_id) continue;
    const group = groups.get(item.bundle_id) ?? [];
    group.push(item);
    groups.set(item.bundle_id, group);
  }

  const splitByItemId = new Map<string, number>();
  for (const [bundleId, groupItems] of groups) {
    const total = bundleById.get(bundleId)?.total_cents ?? 0;
    const count = groupItems.length;
    const base = count > 0 ? Math.floor(total / count) : 0;
    const remainder = total - base * count;
    groupItems.forEach((item, i) => {
      splitByItemId.set(item.id, base + (i < remainder ? 1 : 0));
    });
  }

  return items.map((item) => ({
    ...item,
    isBundled: item.bundle_id !== null,
    resolvedCostCents: item.bundle_id
      ? splitByItemId.get(item.id) ?? 0
      : item.cost_cents ?? 0,
  }));
}

export interface UnitCostBreakdown {
  itemsCents: number; // every receipt item (product/part/accessory) attached to this unit
  laborCents: number;
  returnShippingCents: number;
  totalCostCents: number;
}

export function computeUnitCost(unit: UnitWithFinancials): UnitCostBreakdown {
  const itemsCents = unit.receipt_items.reduce((sum, item) => sum + item.resolvedCostCents, 0);

  const laborCents = unit.repairs.reduce(
    (sum, repair) => sum + Math.round(repair.labor_hours * repair.labor_rate_cents),
    0
  );

  const returnShippingCents = unit.returns.reduce((sum, r) => sum + r.return_shipping_cents, 0);

  return {
    itemsCents,
    laborCents,
    returnShippingCents,
    totalCostCents: itemsCents + laborCents + returnShippingCents,
  };
}

export interface MarginResult {
  salePriceCents: number;
  feesCents: number;
  totalCostCents: number;
  netProfitCents: number;
  marginPercent: number; // net profit / sale price, 0-100
}

export function computeMargin(unit: UnitWithFinancials): MarginResult | null {
  // Mid-return: not a realized sale, so no margin to show yet.
  if (!unit.sale || unit.status === "returned") return null;

  const { totalCostCents } = computeUnitCost(unit);
  const salePriceCents = unit.sale.sale_price_cents;
  const feesCents = unit.sale.fees_cents;
  const netProfitCents = salePriceCents - feesCents - totalCostCents;
  const marginPercent = salePriceCents > 0 ? (netProfitCents / salePriceCents) * 100 : 0;

  return { salePriceCents, feesCents, totalCostCents, netProfitCents, marginPercent };
}

/** Days a unit has been sitting in its current pipeline stage. */
export function daysInCurrentStage(currentStageSince: string): number {
  const since = new Date(currentStageSince).getTime();
  const now = Date.now();
  return Math.floor((now - since) / (1000 * 60 * 60 * 24));
}
