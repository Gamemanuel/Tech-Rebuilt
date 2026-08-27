import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { DashboardCharts } from "@/components/dashboard-charts";
import { formatCurrency } from "@/lib/utils";
import { computeMargin, computeUnitCost, resolveItemCosts } from "@/lib/calculations";
import { ITEM_CATEGORY_LABELS, ItemCategory, UnitWithFinancials } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const [
    { data: units, error: unitsError },
    { data: repairs },
    { data: returns },
    { data: sales },
    { data: items },
    { data: bundles },
  ] = await Promise.all([
    supabase.from("units").select("*"),
    supabase.from("repairs").select("*"),
    supabase.from("returns").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("receipt_items").select("*"),
    supabase.from("receipt_bundles").select("*"),
  ]);

  if (unitsError) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-medium">Dashboard</h1>
        <p className="text-sm text-destructive">
          Couldn&apos;t load data: {unitsError.message}. Have you run every migration in
          supabase/migrations yet?
        </p>
      </div>
    );
  }

  // Resolve every item's cost once, globally — bundle math needs the full
  // group of items sharing a bundle, which this naturally has.
  const resolvedItems = resolveItemCosts(items ?? [], bundles ?? []);

  const byUnit = new Map<string, UnitWithFinancials>();
  for (const unit of units ?? []) {
    byUnit.set(unit.id, { ...unit, repairs: [], receipt_items: [], returns: [], sale: null });
  }
  for (const repair of repairs ?? []) {
    byUnit.get(repair.unit_id)?.repairs.push(repair);
  }
  for (const item of resolvedItems) {
    if (item.unit_id) byUnit.get(item.unit_id)?.receipt_items.push(item);
  }
  for (const ret of returns ?? []) {
    byUnit.get(ret.unit_id)?.returns.push(ret);
  }
  for (const sale of sales ?? []) {
    const unit = byUnit.get(sale.unit_id);
    if (!unit) continue;
    if (!unit.sale || new Date(sale.sold_at) > new Date(unit.sale.sold_at)) {
      unit.sale = sale;
    }
  }

  const allUnits = Array.from(byUnit.values());
  const soldUnits = allUnits.filter((u) => u.status === "sold" && u.sale);
  const inProgress = allUnits.filter((u) => !["sold", "parted_out"].includes(u.status));

  const totalRevenueCents = soldUnits.reduce((s, u) => s + (u.sale?.sale_price_cents ?? 0), 0);
  const totalProfitCents = soldUnits.reduce((s, u) => s + (computeMargin(u)?.netProfitCents ?? 0), 0);
  const avgMargin =
    soldUnits.length > 0
      ? soldUnits.reduce((s, u) => s + (computeMargin(u)?.marginPercent ?? 0), 0) / soldUnits.length
      : 0;
  const capitalTiedUpCents = inProgress.reduce((s, u) => s + computeUnitCost(u).totalCostCents, 0);

  // Spend by category, all-time — supplies included, even though they
  // never attach to a unit.
  const spendByCategory: Record<ItemCategory, number> = { part: 0, accessory: 0, product: 0, supply: 0 };
  for (const item of resolvedItems) {
    spendByCategory[item.category] += item.resolvedCostCents;
  }

  // Avg profit by product (model), sold units only.
  const marginByModel = new Map<string, { totalProfitCents: number; count: number }>();
  for (const unit of soldUnits) {
    const margin = computeMargin(unit);
    if (!margin) continue;
    const entry = marginByModel.get(unit.model) ?? { totalProfitCents: 0, count: 0 };
    entry.totalProfitCents += margin.netProfitCents;
    entry.count += 1;
    marginByModel.set(unit.model, entry);
  }
  const productMargins = Array.from(marginByModel.entries())
    .map(([model, { totalProfitCents, count }]) => ({
      model,
      avgProfitCents: Math.round(totalProfitCents / count),
      count,
    }))
    .sort((a, b) => b.avgProfitCents - a.avgProfitCents);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">Dashboard</h1>
        <p className="text-sm text-muted-foreground">How the shop is actually doing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Revenue (all-time)" value={formatCurrency(totalRevenueCents)} sublabel={`${soldUnits.length} units sold`} />
        <StatCard
          label="Net profit"
          value={formatCurrency(totalProfitCents)}
          tone={totalProfitCents >= 0 ? "success" : "destructive"}
        />
        <StatCard label="Avg margin" value={`${avgMargin.toFixed(1)}%`} />
        <StatCard
          label="Capital tied up"
          value={formatCurrency(capitalTiedUpCents)}
          sublabel={`${inProgress.length} units in the pipeline`}
        />
      </div>

      <DashboardCharts
        spendByCategory={Object.entries(spendByCategory).map(([category, cents]) => ({
          category: ITEM_CATEGORY_LABELS[category as ItemCategory],
          cents,
        }))}
        productMargins={productMargins}
      />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent sales</h2>
        <div className="space-y-2">
          {soldUnits
            .slice()
            .sort((a, b) => new Date(b.sale!.sold_at).getTime() - new Date(a.sale!.sold_at).getTime())
            .slice(0, 8)
            .map((u) => {
              const margin = computeMargin(u);
              return (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{u.model}</p>
                    <p className="text-xs text-muted-foreground">{u.sale?.channel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{formatCurrency(u.sale?.sale_price_cents ?? 0)}</p>
                    <p
                      className={`font-mono text-xs ${
                        (margin?.netProfitCents ?? 0) >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(margin?.netProfitCents ?? 0)} profit
                    </p>
                  </div>
                </div>
              );
            })}
          {soldUnits.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No sales recorded yet. Once you mark a unit sold, it&apos;ll show up here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
