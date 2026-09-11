import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnarchiveButton } from "@/components/unarchive-button";
import { UnarchiveReceiptButton } from "@/components/unarchive-receipt-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeMargin, resolveItemCosts } from "@/lib/calculations";
import { UnitWithFinancials } from "@/lib/types";

export default async function ArchivePage() {
    const supabase = createClient();

    const [
        { data: units, error: unitsError },
        { data: repairs },
        { data: returns },
        { data: sales },
        { data: items },
        { data: bundles },
        { data: receipts, error: receiptsError },
    ] = await Promise.all([
        supabase.from("units").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
        supabase.from("repairs").select("*"),
        supabase.from("returns").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("receipt_items").select("*"),
        supabase.from("receipt_bundles").select("*"),
        supabase
            .from("receipts")
            .select("*, receipt_items(*), receipt_bundles(*)")
            .not("archived_at", "is", null)
            .order("archived_at", { ascending: false }),
    ]);

    const resolvedItems = resolveItemCosts(items ?? [], bundles ?? []);

    const byUnit = new Map<string, UnitWithFinancials>();
    for (const unit of units ?? []) {
        byUnit.set(unit.id, { ...unit, repairs: [], receipt_items: [], returns: [], sale: null });
    }
    for (const repair of repairs ?? []) {
        byUnit.get(repair.unit_id)?.repairs.push(repair);
    }
    for (const item of resolvedItems) {
        if (item.unit_id) byUnit.get(item.unit_id)?.receipt_items.push(item);
    }
    for (const ret of returns ?? []) {
        byUnit.get(ret.unit_id)?.returns.push(ret);
    }
    for (const sale of sales ?? []) {
        const unit = byUnit.get(sale.unit_id);
        if (!unit) continue;
        if (!unit.sale || new Date(sale.sold_at) > new Date(unit.sale.sold_at)) {
            unit.sale = sale;
        }
    }

    const archivedUnits = Array.from(byUnit.values());
    const archivedReceipts = receipts ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-medium">Archive</h1>
                <p className="text-sm text-muted-foreground">
                    Sold units and fully-handled receipts you&apos;ve tucked away. Nothing here affects your
                    Dashboard totals — it&apos;s just out of the way.
                </p>
            </div>

            <Tabs defaultValue="units" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="units">Units ({archivedUnits.length})</TabsTrigger>
                    <TabsTrigger value="receipts">Receipts ({archivedReceipts.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="units" className="space-y-2">
                    {unitsError && <p className="text-sm text-destructive">Couldn&apos;t load archived units: {unitsError.message}</p>}
                    {archivedUnits.map((unit) => {
                        const margin = computeMargin(unit);
                        return (
                            <div key={unit.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                                <div>
                                    <Link href={`/units/${unit.id}`} className="font-medium hover:underline">
                                        {unit.model}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        Sold {unit.sale ? formatDate(unit.sale.sold_at) : "—"} · Archived{" "}
                                        {unit.archived_at ? formatDate(unit.archived_at) : "—"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="font-mono">{unit.sale ? formatCurrency(unit.sale.sale_price_cents) : "—"}</p>
                                        <p className={`font-mono text-xs ${(margin?.netProfitCents ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                                            {margin ? formatCurrency(margin.netProfitCents) : "—"} profit
                                        </p>
                                    </div>
                                    <UnarchiveButton unitId={unit.id} />
                                </div>
                            </div>
                        );
                    })}
                    {archivedUnits.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Nothing archived yet. Archive a sold unit from its detail page once you&apos;re done with it.
                        </p>
                    )}
                </TabsContent>

                <TabsContent value="receipts" className="space-y-2">
                    {receiptsError && <p className="text-sm text-destructive">Couldn&apos;t load archived receipts: {receiptsError.message}</p>}
                    {archivedReceipts.map((receipt: any) => {
                        const resolved = resolveItemCosts(receipt.receipt_items ?? [], receipt.receipt_bundles ?? []);
                        const totalCents = resolved.reduce((s, i) => s + i.resolvedCostCents, 0);
                        return (
                            <div key={receipt.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                                <div>
                                    <Link href={`/receipts/${receipt.id}`} className="font-medium hover:underline">
                                        {receipt.source ?? "Receipt"}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {receipt.receipt_date ? formatDate(receipt.receipt_date) : "No date"} · Archived{" "}
                                        {receipt.archived_at ? formatDate(receipt.archived_at) : "—"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="font-mono">{formatCurrency(totalCents)}</p>
                                    <UnarchiveReceiptButton receiptId={receipt.id} />
                                </div>
                            </div>
                        );
                    })}
                    {archivedReceipts.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Nothing archived yet. Once every item on a receipt is assigned to a unit, archive it from
                            the receipt&apos;s page.
                        </p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}