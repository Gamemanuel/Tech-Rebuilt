"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface CsvRow {
  date?: string;
  amount?: string;
  description?: string;
  category?: string;
  [key: string]: string | undefined;
}

export default function ReceiptsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">Receipts</h1>
        <p className="text-sm text-muted-foreground">
          Import a bank/card export as CSV, or upload a photo of a paper receipt.
        </p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv">CSV import</TabsTrigger>
          <TabsTrigger value="image">Photo receipt</TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <CsvImport />
        </TabsContent>
        <TabsContent value="image">
          <ImageImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CsvImport() {
  const supabase = createClient();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRows(results.data);
        setStatus(`Parsed ${results.data.length} rows. Review below, then import.`);
      },
      error: (err) => setStatus(`Couldn't parse that file: ${err.message}`),
    });
  }

  // Best-effort column mapping — bank exports vary a lot in header naming.
  function guessAmount(row: CsvRow): number {
    const key = Object.keys(row).find((k) => /amount|total|price/i.test(k));
    const raw = key ? row[key] : undefined;
    const num = parseFloat((raw ?? "0").replace(/[^0-9.-]/g, ""));
    return Number.isNaN(num) ? 0 : Math.round(num * 100);
  }
  function guessDate(row: CsvRow): string | null {
    const key = Object.keys(row).find((k) => /date/i.test(k));
    return key ? row[key] ?? null : null;
  }
  function guessDescription(row: CsvRow): string | null {
    const key = Object.keys(row).find((k) => /description|memo|merchant|name/i.test(k));
    return key ? row[key] ?? null : null;
  }

  async function importRows() {
    setSaving(true);
    const payload = rows.map((row) => ({
      source_type: "csv" as const,
      amount_cents: guessAmount(row),
      receipt_date: guessDate(row),
      description: guessDescription(row),
    }));

    const { error } = await supabase.from("receipts").insert(payload);
    setSaving(false);

    if (error) {
      setStatus(`Import failed: ${error.message}`);
      return;
    }
    setStatus(`Imported ${payload.length} receipts.`);
    setRows([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Import from CSV</CardTitle>
        <CardDescription>
          Column names are matched loosely (anything with &quot;amount&quot;, &quot;date&quot;,
          &quot;description&quot; in the header). Review the preview before importing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInput}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
        />
        {status && <p className="text-sm text-muted-foreground">{status}</p>}

        {rows.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">{guessDate(row) ?? "—"}</td>
                    <td className="p-2">{guessDescription(row) ?? "—"}</td>
                    <td className="p-2 text-right font-mono">
                      {(guessAmount(row) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <Button onClick={importRows} disabled={saving} size="sm">
            {saving ? "Importing..." : `Import ${rows.length} rows`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ImageImport() {
  const supabase = createClient();
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ amount: number; date: string; vendor: string; category: string } | null>(null);
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus("Uploading...");
    setPreview(null);

    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);

    if (uploadError) {
      setUploading(false);
      setStatus(`Upload failed: ${uploadError.message}`);
      return;
    }

    setPendingFileUrl(path);
    setStatus("Uploaded. Extracting details...");

    // Ask the server route to read the receipt with Claude's vision and
    // return structured fields. Falls back to manual entry if that's not
    // configured (see app/api/parse-receipt/route.ts).
    try {
      const { data: signedUrl } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: signedUrl?.signedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
        setStatus("Extracted — review and save below.");
      } else {
        setStatus("Uploaded, but automatic extraction isn't set up. Enter details manually.");
        setPreview({ amount: 0, date: "", vendor: "", category: "" });
      }
    } catch {
      setStatus("Uploaded, but automatic extraction isn't set up. Enter details manually.");
      setPreview({ amount: 0, date: "", vendor: "", category: "" });
    }

    setUploading(false);
  }

  async function saveReceipt() {
    if (!preview || !pendingFileUrl) return;
    const { error } = await supabase.from("receipts").insert({
      source_type: "image",
      file_url: pendingFileUrl,
      amount_cents: Math.round(preview.amount * 100),
      receipt_date: preview.date || null,
      description: preview.vendor || null,
      category: preview.category || null,
    });
    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }
    setStatus("Receipt saved.");
    setPreview(null);
    setPendingFileUrl(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upload a photo receipt</CardTitle>
        <CardDescription>
          Stored in the private &quot;receipts&quot; Supabase bucket. If ANTHROPIC_API_KEY is set,
          the amount/date/vendor are extracted automatically — otherwise fill them in by hand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
        />
        {status && <p className="text-sm text-muted-foreground">{status}</p>}

        {preview && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <LabeledInput label="Vendor" value={preview.vendor} onChange={(v) => setPreview({ ...preview, vendor: v })} />
            <LabeledInput label="Date (YYYY-MM-DD)" value={preview.date} onChange={(v) => setPreview({ ...preview, date: v })} />
            <LabeledInput label="Category" value={preview.category} onChange={(v) => setPreview({ ...preview, category: v })} />
            <LabeledInput
              label="Amount ($)"
              value={String(preview.amount)}
              onChange={(v) => setPreview({ ...preview, amount: parseFloat(v) || 0 })}
            />
            <Button size="sm" onClick={saveReceipt}>
              Save receipt
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
