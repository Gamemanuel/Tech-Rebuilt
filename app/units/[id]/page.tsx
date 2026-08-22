import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkSoldForm } from "@/components/mark-sold-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeUnitCost, computeMargin } from "@/lib/calculations";
import { UNIT_STATUS_LABELS, UnitWithFinancials } from "@/lib/types";

export default async function UnitDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: unit, error } = await supabase
    .from("units")
    .select(`*, repairs(*, repair_parts(*)), sale:sales(*), vendor:vendors(name)`)
    .eq("id", params.id)
    .single();

  if (error || !unit) notFound();

  const withFinancials: UnitWithFinancials = {
    ...unit,
    sale: Array.isArray(unit.sale) ? unit.sale[0] ?? null : unit.sale,
  };

  const cost = computeUnitCost(withFinancials);
  const margin = computeMargin(withFinancials);

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
          <Row label="Purchase price" value={formatCurrency(cost.purchaseCents)} />
          <Row label="Parts used" value={formatCurrency(cost.partsCents)} />
          <Row label="Labor" value={formatCurrency(cost.laborCents)} />
          <div className="border-t border-border pt-2">
            <Row label="Total cost" value={formatCurrency(cost.totalCostCents)} bold />
          </div>
          {unit.purchase_date && (
            <p className="pt-1 text-xs text-muted-foreground">
              Purchased {formatDate(unit.purchase_date)}
              {unit.vendor?.name ? ` from ${unit.vendor.name}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {margin ? (
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

      {unit.repairs?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Repair history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      )}
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
