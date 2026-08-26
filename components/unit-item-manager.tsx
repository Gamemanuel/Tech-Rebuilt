"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { ITEM_CATEGORY_LABELS, LaborEntry, ReceiptItem, UnitItem } from "@/lib/types";

type UnitItemRow = UnitItem & { receipt_item: ReceiptItem };

const EMPTY = "unassigned";

export function UnitItemManager({
  unitId,
  initialItems,
  initialLaborEntries,
}: {
  unitId: string;
  initialItems: UnitItemRow[];
  initialLaborEntries: LaborEntry[];
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ReceiptItem[]>([]);
  const [items, setItems] = useState<UnitItemRow[]>(initialItems);
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>(initialLaborEntries);
  const [loading, setLoading] = useState(true);
  const [inventoryReady, setInventoryReady] = useState(true);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("receipt_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error && isMissingSchemaObject(error)) {
        setCatalog([]);
        setInventoryReady(false);
      } else {
        setCatalog((data ?? []) as ReceiptItem[]);
        setInventoryReady(true);
      }
      setLoading(false);
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  const parts = useMemo(() => items.filter((item) => item.receipt_item.category === "part"), [items]);
  const accessories = useMemo(
    () => items.filter((item) => item.receipt_item.category === "accessory"),
    [items]
  );

  function refreshAll() {
    router.refresh();
  }

  async function addItem(payload: {
    receiptItemId: string;
    quantity: string;
    price: string;
    notes: string;
  }) {
    const supabase = createClient();
    if (!inventoryReady) return;
    const item = catalog.find((entry) => entry.id === payload.receiptItemId);
    if (!item) return;

    const quantity = Number.parseInt(payload.quantity, 10);
    const price = Number.parseFloat(payload.price);
    if (Number.isNaN(quantity) || quantity < 1) return;
    if (Number.isNaN(price) || price < 0) return;

    const { data, error } = await supabase
      .from("unit_items")
      .insert({
        unit_id: unitId,
        receipt_item_id: item.id,
        quantity,
        cost_cents: item.cost_cents,
        price_cents: Math.round(price * 100),
        notes: payload.notes.trim() || null,
      })
      .select("*, receipt_item:receipt_items(*)")
      .single();

    if (error || !data) return;
    setItems((prev) => [data as UnitItemRow, ...prev]);
    refreshAll();
  }

  async function updateItemPrice(unitItemId: string, price: string) {
    const supabase = createClient();
    if (!inventoryReady) return;
    const parsed = Number.parseFloat(price);
    if (Number.isNaN(parsed) || parsed < 0) return;

    const { error } = await supabase
      .from("unit_items")
      .update({ price_cents: Math.round(parsed * 100) })
      .eq("id", unitItemId);
    if (error) return;

    setItems((prev) =>
      prev.map((item) => (item.id === unitItemId ? { ...item, price_cents: Math.round(parsed * 100) } : item))
    );
    refreshAll();
  }

  async function deleteUnitItem(unitItemId: string) {
    const supabase = createClient();
    if (!inventoryReady) return;

    const { error } = await supabase.from("unit_items").delete().eq("id", unitItemId);
    if (error) return;

    setItems((prev) => prev.filter((item) => item.id !== unitItemId));
    refreshAll();
  }

  async function addLabor(payload: {
    hours: string;
    rate: string;
    notes: string;
    unitItemId: string;
  }) {
    const supabase = createClient();
    if (!inventoryReady) return;
    const hours = Number.parseFloat(payload.hours);
    const rate = Number.parseFloat(payload.rate);
    if (Number.isNaN(hours) || hours <= 0) return;
    if (Number.isNaN(rate) || rate < 0) return;

    const { data, error } = await supabase
      .from("labor_entries")
      .insert({
        unit_id: unitId,
        unit_item_id: payload.unitItemId === EMPTY ? null : payload.unitItemId,
        hours,
        rate_cents: Math.round(rate * 100),
        notes: payload.notes.trim() || null,
      })
      .select("*")
      .single();

    if (error || !data) return;
    setLaborEntries((prev) => [data as LaborEntry, ...prev]);
    refreshAll();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Parts and accessories</CardTitle>
          <CardDescription>
            Attach reusable items from your receipt library to this listing whenever you want.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {!inventoryReady && (
              <p className="mb-3 rounded-lg border border-border/80 bg-muted/50 p-3 text-sm text-muted-foreground">
                Parts, accessories, and labor logs need the newer inventory migration. Run `supabase/migrations/0002_itemized_inventory.sql` first.
              </p>
            )}
            <Tabs defaultValue="part" className="space-y-4">
            <TabsList>
              <TabsTrigger value="part">Parts</TabsTrigger>
              <TabsTrigger value="accessory">Accessories</TabsTrigger>
            </TabsList>
            <TabsContent value="part" className="space-y-4">
              <ItemForm catalog={catalog.filter((item) => item.category === "part")} onSubmit={addItem} loading={loading} disabled={!inventoryReady} />
              <ItemList
                title="Parts on this listing"
                items={parts}
                onPriceSave={updateItemPrice}
                onDelete={deleteUnitItem}
              />
            </TabsContent>
            <TabsContent value="accessory" className="space-y-4">
              <ItemForm catalog={catalog.filter((item) => item.category === "accessory")} onSubmit={addItem} loading={loading} disabled={!inventoryReady} />
              <ItemList
                title="Accessories on this listing"
                items={accessories}
                onPriceSave={updateItemPrice}
                onDelete={deleteUnitItem}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Labor log</CardTitle>
          <CardDescription>Track hours spent on the unit or on a specific part/accessory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LaborForm items={items} onSubmit={addLabor} disabled={!inventoryReady} />
          <div className="space-y-2">
            {laborEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No labor logged yet.</p>
            ) : (
              laborEntries.map((entry) => {
                const linked = items.find((item) => item.id === entry.unit_item_id);
                return (
                  <div key={entry.id} className="rounded-xl border border-border/80 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {entry.hours}h @ {formatCurrency(entry.rate_cents)}/hr
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatCurrency(Math.round(entry.hours * entry.rate_cents))}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linked ? `Linked to ${linked.receipt_item.name}` : "General labor"}
                    </p>
                    {entry.notes && <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemForm({
  catalog,
  onSubmit,
  loading,
  disabled,
}: {
  catalog: ReceiptItem[];
  onSubmit: (payload: { receiptItemId: string; quantity: string; price: string; notes: string }) => Promise<void>;
  loading: boolean;
  disabled?: boolean;
}) {
  const [receiptItemId, setReceiptItemId] = useState(EMPTY);
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ receiptItemId, quantity, price, notes });
      }}
    >
      <div className="space-y-1.5 md:col-span-2">
        <Label>Item</Label>
        <Select
          value={receiptItemId}
          onValueChange={(value) => {
            setReceiptItemId(value);
            const selected = catalog.find((item) => item.id === value);
            if (selected) setPrice((selected.price_cents / 100).toFixed(2));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading items..." : "Choose an item"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>Choose an item</SelectItem>
            {catalog.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} · {formatCurrency(item.price_cents)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Quantity</Label>
        <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label>Price ($)</Label>
        <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={loading || disabled}>
          Add to listing
        </Button>
      </div>
    </form>
  );
}

function ItemList({
  title,
  items,
  onPriceSave,
  onDelete,
}: {
  title: string;
  items: UnitItemRow[];
  onPriceSave: (unitItemId: string, price: string) => Promise<void>;
  onDelete: (unitItemId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items added yet.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.receipt_item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.cost_cents)} cost · {ITEM_CATEGORY_LABELS[item.receipt_item.category]}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm">{formatCurrency(item.price_cents)} / item</p>
                <p className="font-mono text-xs text-muted-foreground">Qty {item.quantity}</p>
              </div>
            </div>
            <div className="mt-3 flex w-full max-w-xs items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Edit price</Label>
                <Input defaultValue={(item.price_cents / 100).toFixed(2)} inputMode="decimal" />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null);
                  if (input) void onPriceSave(item.id, input.value);
                }}
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void onDelete(item.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LaborForm({
  items,
  onSubmit,
  disabled,
}: {
  items: UnitItemRow[];
  onSubmit: (payload: { hours: string; rate: string; notes: string; unitItemId: string }) => Promise<void>;
  disabled?: boolean;
}) {
  const [unitItemId, setUnitItemId] = useState(EMPTY);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ hours, rate, notes, unitItemId });
      }}
    >
      <div className="space-y-1.5 md:col-span-2">
        <Label>Attach to item (optional)</Label>
        <Select value={unitItemId} onValueChange={setUnitItemId}>
          <SelectTrigger>
            <SelectValue placeholder="General labor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>General labor</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.receipt_item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Hours</Label>
        <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" />
      </div>
      <div className="space-y-1.5">
        <Label>Rate ($/hr)</Label>
        <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={disabled}>
          Log labor
        </Button>
      </div>
    </form>
  );
}

function isMissingSchemaObject(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || /schema cache|could not find the table|could not find a relationship/i.test(error.message ?? "");
}
