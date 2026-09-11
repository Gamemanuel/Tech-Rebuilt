"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ArchiveUnitButton({ unitId }: { unitId: string }) {
    const router = useRouter();
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        if (
            !window.confirm(
                "Archive this unit? It'll drop off the Pipeline board — you can still find it, and un-archive it, from the Archive page."
            )
        ) {
            return;
        }
        setSaving(true);
        setError(null);

        const { error } = await supabase
            .from("units")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", unitId);

        setSaving(false);

        if (error) {
            setError(error.message);
            return;
        }

        router.push("/units");
        router.refresh();
    }

    return (
        <div className="space-y-1">
            <Button variant="outline" size="sm" onClick={handleClick} disabled={saving}>
                {saving ? "Archiving..." : "Archive this unit"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}