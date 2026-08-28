import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline-board";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Unit } from "@/lib/types";

export default async function UnitsPage() {
  const supabase = createClient();
  const { data: units, error } = await supabase
    .from("units")
    .select("*")
    .neq("status", "parted_out")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Hover a card and click &quot;Advance&quot; to move it to the next stage.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/units/new">+ New unit</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load units: {error.message}
        </p>
      )}

      <PipelineBoard initialUnits={(units ?? []) as Unit[]} />
    </div>
  );
}
