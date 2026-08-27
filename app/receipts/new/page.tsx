"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { ITEM_CATEGORY_LABELS, ItemCategory } from "@/lib/types";

const SOURCE_OPTIONS = ["eBay", "Goodwill", "ShopGoodwill", "Other"];

interface DraftBundle {
  tempId: string;
  description: string;
  totalDollars: string;
}

interface DraftItem {
  tempId: string;
  category: ItemCategory;
  description: string;
  costDollars: string; // used when bundleTempId is null
  bundleTempId: string | null;
}

function newId() {
  return Math.random().toString(36).slice(2);
}

export default function NewReceiptPage() {
  const router = useRouter();
  const supabase = createClient();

  const [source, setSource] = useState("eBay");
  const [customSource, setCustomSource] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);

  const [items, setItems] = useState<DraftItem[]>([
    { tempId: newId(), category: "part", description: "", costDollars: "", bundleTempId: null },
  ]);
  const [bundles, setBundles] = useState<DraftBundle[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { tempId: newId(), category: "part", description: "", costDollars: "", bundleTempId: null }]);
  }
  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }
  function updateItem(tempId: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  }

  function addBundle() {
    setBundles((prev) => [...prev, { tempId: newId(), description: "", totalDollars: "" }]);
  }
  function updateBundle(tempId: string, patch: Partial<DraftBundle>) {
    setBundles((prev) => prev.map((b) => (b.tempId === tempId ? { ...b, ...patch } : b)));
  }
  function removeBundle(tempId: string) {
    setBundles((prev) => prev.filter((b) => b.tempId !== tempId));
    setItems((prev) => prev.map((i) => (i.bundleTempId === tempId ? { ...i, bundleTempId: null } : i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanItems = items.filter((i) => i.description.trim());
    if (cleanItems.length === 0) {
      setError("Add at least one item.");
      return;
    }
    for (const item of cleanItems) {
      if (!item.bundleTempId) {
        const num = parseFloat(item.costDollars);
        if (Number.isNaN(num) || num < 0) {
          setError(`Enter a valid cost for "${item.description}", or mark it as part of a bundle.`);
          return;
        }
      }
    }
    for (const bundle of bundles) {
      const num = parseFloat(bundle.totalDollars);
      if (Number.isNaN(num) || num < 0) {
        setError(`Enter a valid total for the bundle "${bundle.description || "(untitled)"}".`);
        return;
      }
    }

    setSaving(true);

    let fileUrl: string | null = null;
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);
      if (uploadError) {
        setSaving(false);
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }
      fileUrl = path;
    }

    const finalSource = source === "Other" ? customSource.trim() || null : source;

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        source_type: file ? "image" : "manual",
        source: finalSource,
        receipt_date: receiptDate || null,
        file_url: fileUrl,
      })
      .select()
      .single();

    if (receiptError || !receipt) {
      setSaving(false);
      setError(receiptError?.message ?? "Couldn't create the receipt.");
      return;
    }

    // Bundles first, so items below can reference their real ids.
    const bundleIdByTempId = new Map<string, string>();
    if (bundles.length > 0) {
      const { data: insertedBundles, error: bundleError } = await supabase
        .from("receipt_bundles")
        .insert(
          bundles.map((b) => ({
            receipt_id: receipt.id,
            description: b.description.trim() || null,
            total_cents: Math.round(parseFloat(b.totalDollars) * 100),
          }))
        )
        .select();

      if (bundleError || !insertedBundles) {
        setSaving(false);
        setError(bundleError?.message ?? "Couldn't save bundles.");
        return;
      }
      bundles.forEach((b, i) => bundleIdByTempId.set(b.tempId, insertedBundles[i].id));
    }

    const { error: itemsError } = await supabase.from("receipt_items").insert(
      cleanItems.map((item) => ({
        receipt_id: receipt.id,
        bundle_id: item.bundleTempId ? bundleIdByTempId.get(item.bundleTempId) ?? null : null,
        unit_id: null,
        category: item.category,
        description: item.description.trim(),
        cost_cents: item.bundleTempId ? null : Math.round(parseFloat(item.costDollars) * 100),
      }))
    );

    setSaving(false);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    router.push(`/receipts/${receipt.id}`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">Upload a receipt</h1>
        <p className="text-sm text-muted-foreground">
          Add every item this receipt covers. You&apos;ll attach items to specific units next — or leave a
          Supply item unassigned, since it&apos;s a business expense rather than something you&apos;re reselling.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {source === "Other" && (
                  <Input
                    className="mt-2"
                    placeholder="Where from?"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">Photo (optional)</Label>
              <input
                id="file"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {bundles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bundles</CardTitle>
              <CardDescription>
                One price covering multiple items — tag which items came from it below and the cost splits evenly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bundles.map((bundle) => (
                <div key={bundle.tempId} className="flex items-end gap-2 rounded-md border border-border p-3">
                  <div className="flex-1 space-y-1.5">
                    <Label>What was it</Label>
                    <Input
                      placeholder="e.g. lot of 4 controllers"
                      value={bundle.description}
                      onChange={(e) => updateBundle(bundle.tempId, { description: e.target.value })}
                    />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label>Total ($)</Label>
                    <Input
                      inputMode="decimal"
                      value={bundle.totalDollars}
                      onChange={(e) => updateBundle(bundle.tempId, { totalDollars: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBundle(bundle.tempId)}>
                    <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Items</CardTitle>
              <CardDescription>One row per thing you bought.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addBundle}>
              + Add a bundle
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={item.tempId} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <div className="w-36 space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateItem(item.tempId, { category: v as ItemCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      placeholder="Switch OLED, joy-con drift repair kit, shipping boxes..."
                      value={item.description}
                      onChange={(e) => updateItem(item.tempId, { description: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.tempId)}>
                    <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                  </Button>
                </div>

                {bundles.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-1.5 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item.bundleTempId !== null}
                        onChange={(e) =>
                          updateItem(item.tempId, { bundleTempId: e.target.checked ? bundles[0].tempId : null })
                        }
                      />
                      Part of a bundle
                    </label>
                    {item.bundleTempId !== null && (
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={item.bundleTempId}
                        onChange={(e) => updateItem(item.tempId, { bundleTempId: e.target.value })}
                      >
                        {bundles.map((b) => (
                          <option key={b.tempId} value={b.tempId}>
                            {b.description || "(untitled bundle)"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {item.bundleTempId === null && (
                  <div className="w-32 space-y-1.5">
                    <Label>Cost ($)</Label>
                    <Input
                      inputMode="decimal"
                      value={item.costDollars}
                      onChange={(e) => updateItem(item.tempId, { costDollars: e.target.value })}
                    />
                  </div>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />
              Add item
            </Button>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save receipt"}
        </Button>
      </form>
    </div>
  );
}
