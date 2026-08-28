import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptItemsManager } from "@/components/receipt-items-manager";
import { ReceiptImageZoom } from "@/components/receipt-image-zoom";
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

  let signedFileUrl: string | null = null;
  if (receipt.file_url) {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(receipt.file_url, 3600);
    signedFileUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">{receipt.source ?? "Receipt"}</h1>
        <p className="text-sm text-muted-foreground">
          {receipt.receipt_date ? formatDate(receipt.receipt_date) : "No date set"} · {formatCurrency(totalCents)} total
        </p>
      </div>

      {receipt.source_type === "image" && signedFileUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiptImageZoom src={signedFileUrl} alt="Receipt photo" />
          </CardContent>
        </Card>
      )}

      {receipt.source_type === "pdf" && signedFileUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Receipt PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Browsers render PDFs natively in an embed — no extra library needed. */}
            <embed src={signedFileUrl} type="application/pdf" className="h-[600px] w-full rounded-md border border-border" />
            <a href={signedFileUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary hover:underline">
              Open in a new tab →
            </a>
          </CardContent>
        </Card>
      )}

      {receipt.source_type === "csv" && receipt.csv_rows && receipt.csv_rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Imported statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {(receipt.csv_headers ?? []).map((h: string, i: number) => (
                      <th key={i} className="p-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receipt.csv_rows.map((row: string[], i: number) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="p-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {signedFileUrl && (
              <a href={signedFileUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary hover:underline">
                Download original file →
              </a>
            )}
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
