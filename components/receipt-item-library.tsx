"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ITEM_CATEGORY_LABELS, Receipt, ReceiptItem } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const EMPTY = "unassigned";

type ReceiptWithSummary = Pick<Receipt, "id" | "receipt_date" | "description" | "source_type">;
type ItemRow = ReceiptItem & { receipt: ReceiptWithSummary | null };

export function ReceiptItemLibrary() {
  const [receipts, setReceipts] = useState<ReceiptWithSummary[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsAvailable, setItemsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    receiptId: EMPTY,
    name: "",
    category: "part" as ReceiptItem["category"],
    quantity: "1",
    cost: "",
    price: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const [{ data: receiptRows }, { data: itemRows, error: itemError }] = await Promise.all([
      supabase.from("receipts").select("id, receipt_date, description, source_type").order("created_at", { ascending: false }),
      supabase
        .from("receipt_items")
        .select("*, receipt:receipts(id, receipt_date, description, source_type)")
        .order("created_at", { ascending: false }),
    ]);

    setReceipts((receiptRows ?? []) as ReceiptWithSummary[]);
    if (itemError && isMissingSchemaObject(itemError)) {
      setItems([]);
      setItemsAvailable(false);
    } else {
      setItems((itemRows ?? []) as ItemRow[]);
      setItemsAvailable(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!itemsAvailable) {
      setError("Run the itemized inventory migration first.");
      return;
    }
    if (!form.name.trim()) {
      setError("Enter an item name.");
      return;
    }

    const quantity = Number.parseInt(form.quantity, 10);
    const cost = Number.parseFloat(form.cost);
    const price = Number.parseFloat(form.price);
    if (Number.isNaN(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }
    if (Number.isNaN(cost) || cost < 0) {
      setError("Cost must be zero or higher.");
      return;
    }
    if (form.price && (Number.isNaN(price) || price < 0)) {
      setError("Price must be zero or higher.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("receipt_items").insert({
      receipt_id: form.receiptId === EMPTY ? null : form.receiptId,
      name: form.name.trim(),
      category: form.category,
      quantity,
      cost_cents: Math.round(cost * 100),
      price_cents: Math.round((form.price ? price : cost) * 100),
      notes: form.notes.trim() || null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm({
      receiptId: form.receiptId,
      name: "",
      category: form.category,
      quantity: "1",
      cost: "",
      price: "",
      notes: "",
    });
    await load();
  }

  async function updatePrice(itemId: string, price: string) {
    const supabase = createClient();
    if (!itemsAvailable) return;
    const parsed = Number.parseFloat(price);
    if (Number.isNaN(parsed) || parsed < 0) return;

    const { error: updateError } = await supabase
      .from("receipt_items")
      .update({ price_cents: Math.round(parsed * 100) })
      .eq("id", itemId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  async function deleteItem(itemId: string) {
    const supabase = createClient();
    if (!itemsAvailable) return;

    const { error: deleteError } = await supabase.from("receipt_items").delete().eq("id", itemId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Define receipt items</CardTitle>
          <CardDescription>
            Build reusable parts and accessories from a receipt, then attach them to any listing later.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {!itemsAvailable && (
              <p className="mb-3 rounded-lg border border-border/80 bg-muted/50 p-3 text-sm text-muted-foreground">
                Item definitions need the newer inventory migration. Run `supabase/migrations/0002_itemized_inventory.sql` first.
              </p>
            )}
            <form onSubmit={createItem} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Receipt</Label>
              <Select value={form.receiptId} onValueChange={(value) => setForm((f) => ({ ...f, receiptId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Standalone item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Standalone item</SelectItem>
                  {receipts.map((receipt) => (
                    <SelectItem key={receipt.id} value={receipt.id}>
                      {receipt.description || receipt.source_type} {receipt.receipt_date ? `· ${formatDate(receipt.receipt_date)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="HDMI cable" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm((f) => ({ ...f, category: value as ReceiptItem["category"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="part">{ITEM_CATEGORY_LABELS.part}</SelectItem>
                  <SelectItem value="accessory">{ITEM_CATEGORY_LABELS.accessory}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Cost ($)</Label>
              <Input value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Price ($)</Label>
              <Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" size="sm" disabled={saving || !itemsAvailable}>
                {saving ? "Saving..." : "Add item"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receipt item library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No item definitions yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ITEM_CATEGORY_LABELS[item.category]}{item.receipt?.description ? ` · ${item.receipt.description}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Meta label="Cost" value={formatCurrency(item.cost_cents)} />
                    <Meta label="Price" value={formatCurrency(item.price_cents)} />
                    <Meta label="Qty" value={String(item.quantity)} />
                    <Meta label="Receipt" value={item.receipt?.receipt_date ? formatDate(item.receipt.receipt_date) : "—"} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="w-40 space-y-1">
                    <Label className="text-xs">Edit price</Label>
                    <Input
                      defaultValue={(item.price_cents / 100).toFixed(2)}
                      inputMode="decimal"
                      onBlur={(e) => {
                        if (e.currentTarget.value !== (item.price_cents / 100).toFixed(2)) {
                          void updatePrice(item.id, e.currentTarget.value);
                        }
                      }}
                    />
                  </div>
                  <Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-xs">{value}</p>
    </div>
  );
}

function isMissingSchemaObject(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || /schema cache|could not find the table|could not find a relationship/i.test(error.message ?? "");
}
