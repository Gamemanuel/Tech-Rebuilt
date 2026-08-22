import { UnitWithFinancials } from "./types";

/**
 * All amounts are integer cents in, integer cents out.
 * Keeping money as cents everywhere avoids the classic 0.1 + 0.2 float bug
 * and matches how Postgres/Supabase should store it (bigint or numeric(10,0)).
 */

export interface UnitCostBreakdown {
  purchaseCents: number;
  partsCents: number;
  laborCents: number;
  totalCostCents: number;
}

export function computeUnitCost(unit: UnitWithFinancials): UnitCostBreakdown {
  const partsCents = unit.repairs.reduce((sum, repair) => {
    const repairParts = repair.repair_parts.reduce(
      (s, rp) => s + rp.cost_at_time_cents * rp.qty_used,
      0
    );
    return sum + repairParts;
  }, 0);

  const laborCents = unit.repairs.reduce(
    (sum, repair) => sum + Math.round(repair.labor_hours * repair.labor_rate_cents),
    0
  );

  const purchaseCents = unit.purchase_price_cents;

  return {
    purchaseCents,
    partsCents,
    laborCents,
    totalCostCents: purchaseCents + partsCents + laborCents,
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
  if (!unit.sale) return null;

  const { totalCostCents } = computeUnitCost(unit);
  const salePriceCents = unit.sale.sale_price_cents;
  const feesCents = unit.sale.fees_cents;
  const netProfitCents = salePriceCents - feesCents - totalCostCents;
  const marginPercent =
    salePriceCents > 0 ? (netProfitCents / salePriceCents) * 100 : 0;

  return { salePriceCents, feesCents, totalCostCents, netProfitCents, marginPercent };
}

/** Days a unit has been sitting in its current pipeline stage. */
export function daysInCurrentStage(currentStageSince: string): number {
  const since = new Date(currentStageSince).getTime();
  const now = Date.now();
  return Math.floor((now - since) / (1000 * 60 * 60 * 24));
}
