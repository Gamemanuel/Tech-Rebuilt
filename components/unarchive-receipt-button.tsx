"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function UnarchiveReceiptButton({ receiptId }: { receiptId: string }) {
    const router = useRouter();
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        setSaving(true);
        setError(null);
        const { error } = await supabase.from("receipts").update({ archived_at: null }).eq("id", receiptId);
        setSaving(false);
        if (error) {
            setError(error.message);
            return;
        }
        router.refresh();
    }

    return (
        <div className="space-y-1">
            <Button variant="outline" size="sm" onClick={handleClick} disabled={saving}>
                {saving ? "..." : "Unarchive"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}