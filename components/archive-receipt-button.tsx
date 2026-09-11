"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ArchiveReceiptButton({
                                         receiptId,
                                         unassignedCount,
                                     }: {
    receiptId: string;
    unassignedCount: number;
}) {
    const router = useRouter();
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        const message =
            unassignedCount > 0
                ? `This receipt still has ${unassignedCount} item${unassignedCount === 1 ? "" : "s"} not assigned to a unit. Archive it anyway? You can unarchive it later.`
                : "Archive this receipt? It'll drop off your Receipts list — you can still find it, and unarchive it, from the Archive page.";
        if (!window.confirm(message)) return;

        setSaving(true);
        setError(null);

        const { error } = await supabase
            .from("receipts")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", receiptId);

        setSaving(false);

        if (error) {
            setError(error.message);
            return;
        }

        router.push("/receipts");
        router.refresh();
    }

    return (
        <div className="space-y-1 text-right">
            <Button variant="outline" size="sm" onClick={handleClick} disabled={saving}>
                {saving ? "Archiving..." : "Archive this receipt"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}