import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkSoldForm } from "@/components/mark-sold-form";
import { LogRepairForm } from "@/components/log-repair-form";
import { MarkReturnedButton, ResolveReturnForm } from "@/components/return-management";
import { DeleteUnitButton } from "@/components/delete-unit-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeUnitCost, computeMargin } from "@/lib/calculations";
import { resolveItemsWithBundleContext } from "@/lib/data";
import { UNIT_STATUS_LABELS, UnitWithFinancials, ITEM_CATEGORY_LABELS, Sale, ReturnRecord } from "@/lib/types";

export default async function UnitDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: unit, error } = await supabase
    .from("units")
    .select(`*, repairs(*), returns(*), sales(*), receipt_items(*)`)
    .eq("id", params.id)
    .single();

  if (error || !unit) notFound();

  const sales = (unit.sales ?? []) as Sale[];
  const currentSale =
    sales.length > 0
      ? sales.slice().sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())[0]
      : null;

  const resolvedItems = await resolveItemsWithBundleContext(supabase, unit.receipt_items ?? []);

  const withFinancials: UnitWithFinancials = {
    ...unit,
    receipt_items: resolvedItems,
    returns: (unit.returns ?? []) as ReturnRecord[],
    sale: currentSale,
  };

  const cost = computeUnitCost(withFinancials);
  const margin = computeMargin(withFinancials);
  const openReturn = withFinancials.returns.find((r) => !r.resolved_at) ?? null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">{unit.model}</h1>
          <p className="text-sm text-muted-foreground">
            {unit.generation && `${unit.generation} · `}
            {unit.serial_number && <span className="font-mono">{unit.serial_number}</span>}
          </p>
        </div>
        <Badge>{UNIT_STATUS_LABELS[unit.status as keyof typeof UNIT_STATUS_LABELS]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Items (acquisition, parts, accessories)" value={formatCurrency(cost.itemsCents)} />
          <Row label="Labor" value={formatCurrency(cost.laborCents)} />
          {cost.returnShippingCents > 0 && (
            <Row label="Return shipping" value={formatCurrency(cost.returnShippingCents)} />
          )}
          <div className="border-t border-border pt-2">
            <Row label="Total cost" value={formatCurrency(cost.totalCostCents)} bold />
          </div>
        </CardContent>
      </Card>

      {resolvedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Items on this unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolvedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">{ITEM_CATEGORY_LABELS[item.category]} · </span>
                  <Link href={`/receipts/${item.receipt_id}`} className="hover:underline">
                    {item.description}
                  </Link>
                </div>
                <span className="font-mono">
                  {formatCurrency(item.resolvedCostCents)}
                  {item.isBundled && <span className="ml-1 text-xs text-muted-foreground">(split)</span>}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Attach more items to this unit from the Receipts page.</p>
          </CardContent>
        </Card>
      )}

      {unit.status === "returned" && openReturn ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolve return</CardTitle>
          </CardHeader>
          <CardContent>
            <ResolveReturnForm returnRecord={openReturn} />
          </CardContent>
        </Card>
      ) : margin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sale &amp; margin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sale price" value={formatCurrency(margin.salePriceCents)} />
            <Row label="Fees" value={`-${formatCurrency(margin.feesCents)}`} />
            <Row label="Total cost" value={`-${formatCurrency(margin.totalCostCents)}`} />
            <div className="border-t border-border pt-2">
              <Row
                label="Net profit"
                value={formatCurrency(margin.netProfitCents)}
                bold
                tone={margin.netProfitCents >= 0 ? "success" : "destructive"}
              />
            </div>
            <p className="text-xs text-muted-foreground">{margin.marginPercent.toFixed(1)}% margin</p>
            {currentSale && <MarkReturnedButton unitId={unit.id} saleId={currentSale.id} />}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mark as sold</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkSoldForm unitId={unit.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Repair history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {unit.repairs?.length > 0 && (
            <div className="space-y-3">
              {unit.repairs.map((repair: any) => (
                <div key={repair.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between">
                    <span>{formatDate(repair.started_at)}</span>
                    <span className="font-mono text-muted-foreground">
                      {repair.labor_hours}h @ {formatCurrency(repair.labor_rate_cents)}/hr
                    </span>
                  </div>
                  {repair.notes && <p className="mt-1 text-muted-foreground">{repair.notes}</p>}
                </div>
              ))}
            </div>
          )}
          <LogRepairForm unitId={unit.id} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteUnitButton unitId={unit.id} unitModel={unit.model} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono ${bold ? "font-medium" : ""} ${
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
