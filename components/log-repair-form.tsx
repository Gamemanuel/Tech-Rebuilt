"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LogRepairForm({ unitId }: { unitId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(hours);
    if (Number.isNaN(num) || num <= 0) {
      setError("Enter hours worked, greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: settings } = await supabase
      .from("shop_settings")
      .select("labor_rate_cents_per_hour")
      .single();
    const rate = settings?.labor_rate_cents_per_hour ?? 0;

    const { error: insertError } = await supabase.from("repairs").insert({
      unit_id: unitId,
      labor_hours: num,
      labor_rate_cents: rate,
      notes: notes.trim() || null,
      completed_at: new Date().toISOString(),
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setHours("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
      <div className="space-y-1.5">
        <Label htmlFor="hours">Log time (hours)</Label>
        <Input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="repair-notes">Notes</Label>
        <Textarea id="repair-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you fixed" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Logging..." : "Log time"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Billed at your rate from Settings, applied as one total — not itemized per repair entry.
      </p>
    </form>
  );
}
