"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UnitCard } from "@/components/unit-card";
import { PIPELINE_STAGES, UNIT_STATUS_LABELS, Unit } from "@/lib/types";

/**
 * Simple click-to-advance board rather than drag-and-drop, to keep the
 * dependency list small. Swap in @hello-pangea/dnd later if you want
 * actual dragging between columns.
 *
 * "Returned" units don't live on the 6-stage board — they need review
 * before you decide what happens next — so they get their own strip up
 * top instead.
 */
export function PipelineBoard({ initialUnits }: { initialUnits: Unit[] }) {
  const [units, setUnits] = useState(initialUnits);
  const supabase = createClient();

  async function advanceUnit(unit: Unit) {
    const idx = PIPELINE_STAGES.indexOf(unit.status);
    if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return;
    const nextStatus = PIPELINE_STAGES[idx + 1];

    setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: nextStatus } : u)));

    const { error } = await supabase.from("units").update({ status: nextStatus }).eq("id", unit.id);
    if (error) {
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, status: unit.status } : u)));
    }
  }

  async function deleteUnit(unit: Unit) {
    if (
      !window.confirm(`Delete ${unit.model}${unit.serial_number ? ` (${unit.serial_number})` : ""}? This can't be undone.`)
    ) {
      return;
    }
    const prev = units;
    setUnits((p) => p.filter((u) => u.id !== unit.id));
    const { error } = await supabase.from("units").delete().eq("id", unit.id);
    if (error) {
      setUnits(prev);
      window.alert(`Couldn't delete: ${error.message}`);
    }
  }

  const returnedUnits = units.filter((u) => u.status === "returned");

  return (
    <div className="space-y-6">
      {returnedUnits.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-destructive">
            Returned — needs review ({returnedUnits.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {returnedUnits.map((unit) => (
              <Link
                key={unit.id}
                href={`/units/${unit.id}`}
                className="block rounded-md border border-border bg-card p-3 text-sm transition-colors hover:border-destructive/60"
              >
                <p className="font-medium">{unit.model}</p>
                {unit.serial_number && <p className="font-mono text-xs text-muted-foreground">{unit.serial_number}</p>}
                <p className="mt-1 text-xs text-destructive">Review and resolve →</p>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                    <UnitCard unit={unit} />
                    <div className="absolute -top-2 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {stage !== "sold" && (
                        <button
                          onClick={() => advanceUnit(unit)}
                          className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground"
                          title={`Move to ${UNIT_STATUS_LABELS[PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage) + 1]]}`}
                        >
                          Advance →
                        </button>
                      )}
                      <button
                        onClick={() => deleteUnit(unit)}
                        className="rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
