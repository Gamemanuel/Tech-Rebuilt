"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { ItemListsDialog } from "@/components/item-lists-dialog";
import { formatCurrency } from "@/lib/utils";
import { ITEM_CATEGORY_LABELS, ItemCategory, ReceiptBundle, ResolvedReceiptItem } from "@/lib/types";

interface UnitOption {
  id: string;
  model: string;
  generation: string | null;
  serial_number: string | null;
}

function unitLabel(u: UnitOption) {
  return [u.model, u.generation, u.serial_number].filter(Boolean).join(" · ");
}

export function ReceiptItemsManager({
  receiptId,
  initialItems,
  bundles,
  units,
}: {
  receiptId: string;
  initialItems: ResolvedReceiptItem[];
  bundles: ReceiptBundle[];
  units: UnitOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [listsItem, setListsItem] = useState<{ id: string; description: string } | null>(null);

  // New item mini-form
  const [category, setCategory] = useState<ItemCategory>("part");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [bundleId, setBundleId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  async function assignUnit(itemId: string, newUnitId: string) {
    setError(null);
    const prev = items;
    setItems((p) => p.map((i) => (i.id === itemId ? { ...i, unit_id: newUnitId || null } : i)));

    const { error } = await supabase.from("receipt_items").update({ unit_id: newUnitId || null }).eq("id", itemId);

    if (error) {
      setItems(prev);
      setError(error.message);
    }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm("Remove this item from the receipt? Its to-do and shopping list entries go with it.")) return;
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== itemId));
    const { error } = await supabase.from("receipt_items").delete().eq("id", itemId);
    if (error) {
      setItems(prev);
      setError(error.message);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    if (!bundleId) {
      const num = parseFloat(cost);
      if (Number.isNaN(num) || num < 0) {
        setError("Enter a valid cost, or pick a bundle.");
        return;
      }
    }
    setAdding(true);

    const { error: insertError } = await supabase.from("receipt_items").insert({
      receipt_id: receiptId,
      bundle_id: bundleId || null,
      unit_id: category === "supply" ? null : unitId || null,
      category,
      description: description.trim(),
      cost_cents: bundleId ? null : Math.round(parseFloat(cost) * 100),
    });

    setAdding(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDescription("");
    setCost("");
    setBundleId("");
    setUnitId("");
    // Bundle math depends on sibling items, so re-fetch rather than
    // patch local state — keeps the split accurate.
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Unit</th>
              <th className="p-3 text-right">Cost</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="p-3">
                  <Badge variant="secondary">{ITEM_CATEGORY_LABELS[item.category]}</Badge>
                </td>
                <td className="p-3">{item.description}</td>
                <td className="p-3">
                  {item.category === "supply" ? (
                    <span className="text-xs text-muted-foreground">Overhead — not unit-specific</span>
                  ) : (
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={item.unit_id ?? ""}
                      onChange={(e) => assignUnit(item.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {unitLabel(u)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatCurrency(item.resolvedCostCents)}
                  {item.isBundled && <span className="ml-1 text-xs text-muted-foreground">(split)</span>}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setListsItem({ id: item.id, description: item.description })}
                      className="text-muted-foreground hover:text-primary"
                      title="To-do & shopping list"
                    >
                      <FontAwesomeIcon icon={faListCheck} className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-destructive">
                      <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form onSubmit={addItem} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <div className="w-36 space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
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
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {bundles.length > 0 && (
          <div className="w-40 space-y-1.5">
            <Label>Bundle</Label>
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
            >
              <option value="">None</option>
              {bundles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.description || "(untitled)"}
                </option>
              ))}
            </select>
          </div>
        )}
        {!bundleId && (
          <div className="w-28 space-y-1.5">
            <Label>Cost ($)</Label>
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
        )}
        {category !== "supply" && (
          <div className="w-48 space-y-1.5">
            <Label>Unit</Label>
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" size="sm" disabled={adding}>
          <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />
          {adding ? "Adding..." : "Add item"}
        </Button>
      </form>

      {listsItem && (
        <ItemListsDialog
          itemId={listsItem.id}
          itemDescription={listsItem.description}
          open={!!listsItem}
          onOpenChange={(open) => !open && setListsItem(null)}
        />
      )}
    </div>
  );
}
