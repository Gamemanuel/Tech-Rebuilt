import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { resolveItemCosts } from "@/lib/calculations";
import { ITEM_CATEGORY_LABELS, ItemCategory } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReceiptsPage() {
  const supabase = createClient();
  const { data: receipts, error } = await supabase
    .from("receipts")
    .select("*, receipt_items(*), receipt_bundles(*)")
    .order("receipt_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Receipts</h1>
          <p className="text-sm text-muted-foreground">Every dollar you&apos;ve spent, in one place.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/receipts/new">+ Upload receipt</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load receipts: {error.message}</p>}

      {/* table-layout: fixed + explicit column widths so a long items
          summary truncates instead of shoving Total off-screen. */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-24" />
            <col className="w-32" />
            <col />
            <col className="w-24" />
            <col className="w-14" />
          </colgroup>
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Source</th>
              <th className="p-3 text-left">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {(receipts ?? []).map((receipt: any) => {
              const resolved = resolveItemCosts(receipt.receipt_items ?? [], receipt.receipt_bundles ?? []);
              const totalCents = resolved.reduce((s, i) => s + i.resolvedCostCents, 0);
              const itemCount = resolved.length;
              const categories = Array.from(new Set(resolved.map((i) => i.category as ItemCategory)));
              const itemsSummary =
                itemCount === 0
                  ? "No items yet"
                  : `${itemCount} item${itemCount === 1 ? "" : "s"} · ${categories
                      .map((c) => ITEM_CATEGORY_LABELS[c])
                      .join(", ")}`;

              return (
                <tr key={receipt.id} className="border-t border-border hover:bg-accent/40">
                  <td className="truncate p-3">
                    <Link href={`/receipts/${receipt.id}`}>
                      {receipt.receipt_date ? formatDate(receipt.receipt_date) : "—"}
                    </Link>
                  </td>
                  <td className="truncate p-3">{receipt.source ?? "—"}</td>
                  <td className="truncate p-3 text-muted-foreground" title={itemsSummary}>
                    {itemsSummary}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-mono">{formatCurrency(totalCents)}</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <Link href={`/receipts/${receipt.id}`} className="text-xs text-primary hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {receipts?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                  No receipts yet. Upload your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
