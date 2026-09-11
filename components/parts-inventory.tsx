"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ITEM_CATEGORY_LABELS, ResolvedReceiptItem } from "@/lib/types";

interface UnitOption {
    id: string;
    model: string;
    generation: string | null;
    serial_number: string | null;
}

interface InventoryItem extends ResolvedReceiptItem {
    receipt: { id: string; source: string | null; receipt_date: string | null } | null;
}

function unitLabel(u: UnitOption) {
    return [u.model, u.generation, u.serial_number].filter(Boolean).join(" · ");
}

const UNASSIGNED = "__unassigned__";

export function PartsInventory({
                                   initialItems,
                                   units,
                               }: {
    initialItems: InventoryItem[];
    units: UnitOption[];
}) {
    const supabase = createClient();
    const [items, setItems] = useState(initialItems);
    const [query, setQuery] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function assign(itemId: string, unitId: string) {
        setError(null);
        const prev = items;
        // Once assigned it's no longer "on hand" — drop it from this view.
        setItems((p) => p.filter((i) => i.id !== itemId));

        const { error } = await supabase.from("receipt_items").update({ unit_id: unitId }).eq("id", itemId);
        if (error) {
            setItems(prev);
            setError(error.message);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((i) => i.description.toLowerCase().includes(q));
    }, [items, query]);

    const groups = useMemo(() => {
        const map = new Map<string, InventoryItem[]>();
        for (const item of filtered) {
            const key = item.description.trim().toLowerCase();
            const group = map.get(key) ?? [];
            group.push(item);
            map.set(key, group);
        }
        return Array.from(map.values())
            .map((groupItems) => ({
                description: groupItems[0].description,
                items: groupItems,
                count: groupItems.length,
                totalCents: groupItems.reduce((s, i) => s + i.resolvedCostCents, 0),
            }))
            .sort((a, b) => b.count - a.count);
    }, [filtered]);

    const grandTotalCents = items.reduce((s, i) => s + i.resolvedCostCents, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                    placeholder="Search by description..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">{items.length}</span> item
                    {items.length === 1 ? "" : "s"} on hand ·{" "}
                    <span className="font-mono font-medium text-foreground">{formatCurrency(grandTotalCents)}</span>{" "}
                    tied up
                </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {groups.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {items.length === 0
                        ? "Nothing unassigned right now — every part and accessory is on a unit."
                        : "No items match that search."}
                </p>
            )}

            <div className="space-y-3">
                {groups.map((group) => (
                    <div key={group.description.toLowerCase()} className="rounded-lg border border-border">
                        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2">
                            <p className="text-sm font-medium">{group.description}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                                {group.count} on hand · {formatCurrency(group.totalCents)}
                            </p>
                        </div>
                        <div className="divide-y divide-border">
                            {group.items.map((item) => (
                                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="text-[10px]">
                                            {ITEM_CATEGORY_LABELS[item.category]}
                                        </Badge>
                                        {item.receipt && (
                                            <Link href={`/receipts/${item.receipt.id}`} className="hover:underline">
                                                {item.receipt.source ?? "Receipt"}
                                                {item.receipt.receipt_date && ` · ${formatDate(item.receipt.receipt_date)}`}
                                            </Link>
                                        )}
                                        <span className="font-mono">{formatCurrency(item.resolvedCostCents)}</span>
                                        {item.isBundled && <span>(split)</span>}
                                    </div>
                                    <Select value={UNASSIGNED} onValueChange={(v) => v !== UNASSIGNED && assign(item.id, v)}>
                                        <SelectTrigger className="h-8 w-48 text-xs">
                                            <SelectValue placeholder="Assign to unit..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={UNASSIGNED} disabled>
                                                Assign to unit...
                                            </SelectItem>
                                            {units.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {unitLabel(u)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}