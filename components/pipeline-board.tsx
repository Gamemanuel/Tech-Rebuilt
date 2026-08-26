"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UnitCard } from "@/components/unit-card";
import { PIPELINE_STAGES, UNIT_STATUS_LABELS, UnitWithFinancials } from "@/lib/types";
import { computeUnitCost } from "@/lib/calculations";
import { cn } from "@/lib/utils";

/**
 * Simple click-to-advance board rather than drag-and-drop, to keep the
 * dependency list small. Swap in @hello-pangea/dnd later if you want
 * actual dragging between columns.
 */
export function PipelineBoard({ initialUnits }: { initialUnits: UnitWithFinancials[] }) {
  const [units, setUnits] = useState(initialUnits);
  const supabase = createClient();

  async function advanceUnit(unit: UnitWithFinancials) {
    const idx = PIPELINE_STAGES.indexOf(unit.status);
    if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return;
    const nextStatus = PIPELINE_STAGES[idx + 1];

    setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: nextStatus } : u)));

    const { error } = await supabase.from("units").update({ status: nextStatus }).eq("id", unit.id);
    if (error) {
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: unit.status } : u)));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {PIPELINE_STAGES.map((stage) => {
        const stageUnits = units.filter((u) => u.status === stage);
        return (
          <div key={stage} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {UNIT_STATUS_LABELS[stage]}
              </h3>
              <span className="font-mono text-xs text-muted-foreground">{stageUnits.length}</span>
            </div>
            <div className="flex min-h-[80px] flex-col gap-2">
              {stageUnits.map((unit) => (
                <div key={unit.id} className="group relative">
                  <UnitCard unit={unit} totalCostCents={computeUnitCost(unit).totalCostCents} />
                  {stage !== "sold" && (
                    <button
                      onClick={() => advanceUnit(unit)}
                      className={cn(
                        "absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                      )}
                      title={`Move to ${UNIT_STATUS_LABELS[PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage) + 1]]}`}
                    >
                      Advance →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
