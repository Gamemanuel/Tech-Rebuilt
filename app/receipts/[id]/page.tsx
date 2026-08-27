import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptItemsManager } from "@/components/receipt-items-manager";
import { resolveItemCosts } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: receipt, error }, { data: units }] = await Promise.all([
    supabase.from("receipts").select("*, receipt_items(*), receipt_bundles(*)").eq("id", params.id).single(),
    supabase.from("units").select("id, model, generation, serial_number").order("model"),
  ]);

  if (error || !receipt) notFound();

  const resolved = resolveItemCosts(receipt.receipt_items ?? [], receipt.receipt_bundles ?? []);
  const totalCents = resolved.reduce((s, i) => s + i.resolvedCostCents, 0);

  let signedPhotoUrl: string | null = null;
  if (receipt.file_url) {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(receipt.file_url, 3600);
    signedPhotoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">{receipt.source ?? "Receipt"}</h1>
        <p className="text-sm text-muted-foreground">
          {receipt.receipt_date ? formatDate(receipt.receipt_date) : "No date set"} · {formatCurrency(totalCents)} total
        </p>
      </div>

      {signedPhotoUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Photo</CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedPhotoUrl} alt="Receipt" className="max-h-96 rounded-md border border-border" />
          </CardContent>
        </Card>
      )}

      <ReceiptItemsManager
        receiptId={receipt.id}
        initialItems={resolved}
        bundles={receipt.receipt_bundles ?? []}
        units={units ?? []}
      />
    </div>
  );
}
