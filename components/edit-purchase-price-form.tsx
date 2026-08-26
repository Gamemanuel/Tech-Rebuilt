"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditPurchasePriceForm({
  unitId,
  initialPurchasePriceCents,
}: {
  unitId: string;
  initialPurchasePriceCents: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [price, setPrice] = useState((initialPurchasePriceCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(price);

    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Enter a valid purchase price.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("units")
      .update({ purchase_price_cents: Math.round(priceNum * 100) })
      .eq("id", unitId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="purchase-price">Purchase price ($)</Label>
        <Input
          id="purchase-price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Update purchase price"}
      </Button>
    </form>
  );
}
