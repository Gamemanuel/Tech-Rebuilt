"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
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

// Radix Select doesn't allow an empty-string item value (it's reserved
// for "no selection"), so these sentinels stand in for "none picked"
// and get translated back to "" wherever the app expects that.
const UNASSIGNED = "__unassigned__";
const NO_BUNDLE = "__none__";

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
        {/*
        Accessible horizontal scroll region:
        - tabIndex + role="region" + aria-label let keyboard/screen-reader
          users discover and scroll the region even when it doesn't
          otherwise receive focus (WCAG 2.1.1 / 1.4.10).
        - focus-visible ring gives sighted keyboard users a visible cue.
        - min-w on the table keeps columns from crushing on desktop
          (priority layout); overflow-x-auto lets narrow/mobile viewports
          scroll instead of wrapping awkwardly.
      */}
        <div
            tabIndex={0}
            role="region"
            aria-label="Receipt items table, scroll horizontally to see all columns"
            className="overflow-x-auto rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Table className="min-w-[720px] table-fixed">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[120px] text-xs uppercase tracking-wide">Category</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Item</TableHead>
                <TableHead className="w-[220px] text-xs uppercase tracking-wide">Unit</TableHead>
                <TableHead className="w-[120px] text-right text-xs uppercase tracking-wide">Cost</TableHead>
                <TableHead className="w-20 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const selectedUnit = item.unit_id ? units.find((u) => u.id === item.unit_id) : undefined;
                const selectedUnitLabel = selectedUnit ? unitLabel(selectedUnit) : "Unassigned";
                return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="secondary">{ITEM_CATEGORY_LABELS[item.category]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden">
                        {item.category === "supply" ? (
                            <span className="text-xs text-muted-foreground">Overhead — not unit-specific</span>
                        ) : (
                            <Select
                                value={item.unit_id ?? UNASSIGNED}
                                onValueChange={(v) => assignUnit(item.id, v === UNASSIGNED ? "" : v)}
                            >
                              <SelectTrigger
                                  className="h-8 w-full min-w-0 overflow-hidden text-xs"
                                  aria-label={`Assign unit for ${item.description}`}
                                  title={selectedUnitLabel}
                              >
                                <SelectValue>
                            <span
                                style={{
                                  display: "block",
                                  minWidth: 0,
                                  flex: "1 1 auto",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                            >
                              {selectedUnitLabel}
                            </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="w-auto max-w-[90vw]">
                                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                                {units.map((u) => (
                                    <SelectItem key={u.id} value={u.id} className="whitespace-nowrap">
                                      {unitLabel(u)}
                                    </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {formatCurrency(item.resolvedCostCents)}
                        {item.isBundled && <span className="ml-1 text-xs text-muted-foreground">(split)</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                            onClick={() => deleteItem(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${item.description}`}
                        >
                          <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                );
              })}
              {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      No items yet.
                    </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
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
                <Select
                    value={bundleId || NO_BUNDLE}
                    onValueChange={(v) => setBundleId(v === NO_BUNDLE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BUNDLE}>None</SelectItem>
                    {bundles.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.description || "(untitled)"}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select
                    value={unitId || UNASSIGNED}
                    onValueChange={(v) => setUnitId(v === UNASSIGNED ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {unitLabel(u)}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          )}
          <Button type="submit" size="sm" disabled={adding}>
            <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />
            {adding ? "Adding..." : "Add item"}
          </Button>
        </form>

      </div>
  );
}