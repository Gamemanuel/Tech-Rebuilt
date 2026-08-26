"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewUnitPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    model: "",
    generation: "",
    serial_number: "",
    special_number: "",
    condition_grade: "",
    purchase_price: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model.trim()) {
      setError("Enter a model name — e.g. \"Nintendo Switch OLED\".");
      return;
    }
    const priceNum = parseFloat(form.purchase_price);
    if (form.purchase_price && Number.isNaN(priceNum)) {
      setError("Purchase price must be a number.");
      return;
    }

    const now = new Date();
    const dateString = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    const specialNumber = (form.special_number || "").trim();
    const { count } = await supabase.from("units").select("id", { count: "exact", head: true });
    const nextSpecialNumber = specialNumber || `${(count ?? 0) + 1}.${dateString}`;

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("units").insert({
      model: form.model.trim(),
      generation: form.generation.trim() || null,
      serial_number: form.serial_number.trim() || null,
      special_number: nextSpecialNumber || null,
      condition_grade: form.condition_grade.trim() || null,
      purchase_price_cents: priceNum ? Math.round(priceNum * 100) : 0,
      status: "sourced",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/units");
    router.refresh();
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-medium">New unit</h1>
        <p className="text-sm text-muted-foreground">Logs a unit at the &quot;Sourced&quot; stage.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Unit details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="Nintendo Switch OLED" value={form.model} onChange={(e) => update("model", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="generation">Generation / variant</Label>
              <Input id="generation" placeholder="OLED, V2, Lite..." value={form.generation} onChange={(e) => update("generation", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial">Serial number</Label>
              <Input id="serial" value={form.serial_number} onChange={(e) => update("serial_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="special-number">Special number</Label>
              <Input
                id="special-number"
                placeholder="1.22.08.2026"
                value={form.special_number}
                onChange={(e) => update("special_number", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Blank = auto-generated index.day.month.year.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="condition">Condition grade</Label>
              <Input id="condition" placeholder="A, B, C, parts-only..." value={form.condition_grade} onChange={(e) => update("condition_grade", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Purchase price ($)</Label>
              <Input id="price" inputMode="decimal" placeholder="45.00" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Add unit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
