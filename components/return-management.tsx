"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReturnRecord } from "@/lib/types";

export function MarkReturnedButton({ unitId, saleId }: { unitId: string; saleId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Mark this sale as returned? It'll drop out of realized revenue until resolved.")) return;
    setSaving(true);
    setError(null);

    const { error: returnError } = await supabase.from("returns").insert({
      unit_id: unitId,
      sale_id: saleId,
    });
    if (returnError) {
      setSaving(false);
      setError(returnError.message);
      return;
    }

    const { error: statusError } = await supabase.from("units").update({ status: "returned" }).eq("id", unitId);

    setSaving(false);
    if (statusError) {
      setError(statusError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1 pt-2">
      <Button size="sm" variant="destructive" onClick={handleClick} disabled={saving}>
        {saving ? "Marking..." : "Mark as returned"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ResolveReturnForm({ returnRecord }: { returnRecord: ReturnRecord }) {
  const router = useRouter();
  const supabase = createClient();
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState(returnRecord.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(shipping || "0");
    if (Number.isNaN(num) || num < 0) {
      setError("Return shipping must be a non-negative number.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: returnError } = await supabase
      .from("returns")
      .update({
        return_shipping_cents: Math.round(num * 100),
        notes: notes.trim() || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", returnRecord.id);

    if (returnError) {
      setSaving(false);
      setError(returnError.message);
      return;
    }

    const { error: statusError } = await supabase
      .from("units")
      .update({ status: "listed" })
      .eq("id", returnRecord.unit_id);

    setSaving(false);
    if (statusError) {
      setError(statusError.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Check it out, note what happened, and send it back to Listed when it's ready to sell again.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="shipping">Return shipping cost ($)</Label>
        <Input id="shipping" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="0.00" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="return-notes">Notes (condition, why it came back)</Label>
        <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Send back to Listed"}
      </Button>
    </form>
  );
}
