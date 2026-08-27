"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SettingsPage() {
  const supabase = createClient();
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("labor_rate_cents_per_hour")
        .single();
      if (!error && data) {
        setRate((data.labor_rate_cents_per_hour / 100).toFixed(2));
      }
      setLoading(false);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(rate);
    if (Number.isNaN(num) || num < 0) {
      setStatus("Enter a valid hourly rate.");
      return;
    }
    setSaving(true);
    setStatus(null);

    const { error } = await supabase
      .from("shop_settings")
      .update({ labor_rate_cents_per_hour: Math.round(num * 100) })
      .eq("id", true);

    setSaving(false);
    setStatus(error ? error.message : "Saved.");
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">Shop-wide defaults.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Labor rate</CardTitle>
          <CardDescription>
            Used automatically every time you log time on a unit — set it once here instead of typing it
            in per repair. Changing this only affects repairs logged from now on; past repairs keep the
            rate they were logged at, so old margins don&apos;t shift under you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="rate">Hourly rate ($)</Label>
                <Input id="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="25.00" />
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </form>
          )}
          {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
