"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function DeleteUnitButton({ unitId, unitModel }: { unitId: string; unitModel: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete ${unitModel}? Its repairs, sales, and return history go with it. Receipt items attached to it stay on their receipt, just unlinked.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    const { error } = await supabase.from("units").delete().eq("id", unitId);
    setDeleting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/units");
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete this unit"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
