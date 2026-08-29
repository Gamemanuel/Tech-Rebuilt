import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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

        {/*
        Accessible horizontal scroll region (same pattern as the receipt
        items table): tabIndex + role="region" + aria-label so keyboard
        and screen-reader users can find and scroll it (WCAG 2.1.1 /
        1.4.10). min-w keeps the desktop column layout intact; narrower
        viewports scroll instead of squeezing columns unreadable.
      */}
        <div
            tabIndex={0}
            role="region"
            aria-label="Receipts table, scroll horizontally to see all columns"
            className="overflow-x-auto rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Table className="min-w-[640px] table-fixed">
            <colgroup>
              <col className="w-24" />
              <col className="w-32" />
              <col />
              <col className="w-24" />
              <col className="w-14" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                    <TableRow key={receipt.id}>
                      <TableCell className="truncate">
                        <Link href={`/receipts/${receipt.id}`}>
                          {receipt.receipt_date ? formatDate(receipt.receipt_date) : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="truncate">{receipt.source ?? "—"}</TableCell>
                      <TableCell className="truncate text-muted-foreground" title={itemsSummary}>
                        {itemsSummary}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">
                        {formatCurrency(totalCents)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Link href={`/receipts/${receipt.id}`} className="text-xs text-primary hover:underline">
                          View →
                        </Link>
                      </TableCell>
                    </TableRow>
                );
              })}
              {receipts?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      No receipts yet. Upload your first one to get started.
                    </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
  );
}