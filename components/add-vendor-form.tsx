"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddVendorForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a vendor name.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("vendors").insert({
      name: name.trim(),
      type: type.trim() || null,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setType("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[160px] space-y-1.5">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goodwill on 5th" />
      </div>
      <div className="flex-1 min-w-[140px] space-y-1.5">
        <label className="text-xs text-muted-foreground">Type</label>
        <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Thrift store" />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Adding..." : "Add"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
