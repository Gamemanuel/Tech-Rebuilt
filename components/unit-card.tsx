"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { daysInCurrentStage } from "@/lib/calculations";
import { Unit } from "@/lib/types";

export function UnitCard({ unit, totalCostCents }: { unit: Unit; totalCostCents?: number }) {
  const days = daysInCurrentStage(unit.current_stage_since);
  const stale = days >= 10;
  const displayCost = totalCostCents ?? unit.purchase_price_cents;

  return (
    <Link
      href={`/units/${unit.id}`}
      className="block rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{unit.model}</p>
          <div className="space-y-0.5">
            {unit.serial_number && (
              <p className="font-mono text-xs text-muted-foreground">{unit.serial_number}</p>
            )}
            {unit.special_number && (
              <p className="font-mono text-[10px] text-muted-foreground">{unit.special_number}</p>
            )}
          </div>
        </div>
        {unit.condition_grade && (
          <Badge variant="secondary" className="shrink-0">
            {unit.condition_grade}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-mono text-muted-foreground">
          {formatCurrency(displayCost)} sum
        </span>
        <span className={stale ? "text-destructive" : "text-muted-foreground"}>
          {days}d in stage
        </span>
      </div>
    </Link>
  );
}
