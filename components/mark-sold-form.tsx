"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MarkSoldForm({ unitId }: { unitId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [channel, setChannel] = useState("eBay");
  const [salePrice, setSalePrice] = useState("");
  const [fees, setFees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(salePrice);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setError("Enter a sale price greater than $0.");
      return;
    }
    const feesNum = parseFloat(fees || "0");
    if (Number.isNaN(feesNum) || feesNum < 0) {
      setError("Fees must be a non-negative number.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: saleError } = await supabase.from("sales").insert({
      unit_id: unitId,
      channel,
      sale_price_cents: Math.round(priceNum * 100),
      fees_cents: Math.round(feesNum * 100),
    });

    if (saleError) {
      setSaving(false);
      setError(saleError.message);
      return;
    }

    const { error: statusError } = await supabase
      .from("units")
      .update({ status: "sold" })
      .eq("id", unitId);

    setSaving(false);

    if (statusError) {
      setError(statusError.message);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="channel">Channel</Label>
          <Input id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salePrice">Sale price ($)</Label>
          <Input id="salePrice" inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fees">Fees ($)</Label>
          <Input id="fees" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Mark sold"}
      </Button>
    </form>
  );
}
