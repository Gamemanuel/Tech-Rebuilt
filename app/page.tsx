import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/utils";
import { computeMargin, computeUnitCost } from "@/lib/calculations";
import { Unit } from "@/lib/types";
import { loadUnitsWithFinancials } from "@/lib/financials";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: units, error } = await supabase.from("units").select("*");

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-medium">Dashboard</h1>
        <p className="text-sm text-destructive">
          Couldn&apos;t load data: {error.message}. Have you run the migration in
          supabase/migrations/0001_init.sql yet?
        </p>
      </div>
    );
  }

  const allUnits = await loadUnitsWithFinancials(supabase, (units ?? []) as Unit[]);

  const soldUnits = allUnits.filter((u) => u.sale);
  const inProgress = allUnits.filter((u) => !u.sale && u.status !== "parted_out");

  const totalRevenueCents = soldUnits.reduce((s, u) => s + (u.sale?.sale_price_cents ?? 0), 0);
  const totalProfitCents = soldUnits.reduce((s, u) => s + (computeMargin(u)?.netProfitCents ?? 0), 0);
  const avgMargin =
    soldUnits.length > 0
      ? soldUnits.reduce((s, u) => s + (computeMargin(u)?.marginPercent ?? 0), 0) / soldUnits.length
      : 0;
  const capitalTiedUpCents = inProgress.reduce((s, u) => s + computeUnitCost(u).totalCostCents, 0);

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

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent sales</h2>
        <div className="space-y-2">
          {soldUnits.slice(0, 8).map((u) => {
            const margin = computeMargin(u);
            return (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm"
              >
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
