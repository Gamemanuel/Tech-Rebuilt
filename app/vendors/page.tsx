import { createClient } from "@/lib/supabase/server";
import { AddVendorForm } from "@/components/add-vendor-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VendorsPage() {
  const supabase = createClient();
  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Where units and parts get sourced from — thrift stores, pawn shops, wholesalers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add a vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <AddVendorForm />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load vendors: {error.message}</p>}

      <div className="space-y-2">
        {(vendors ?? []).map((v) => (
          <div key={v.id} className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium">{v.name}</p>
            {v.type && <p className="text-xs text-muted-foreground">{v.type}</p>}
            {v.notes && <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p>}
          </div>
        ))}
        {vendors?.length === 0 && (
          <p className="text-sm text-muted-foreground">No vendors yet — add your first sourcing channel above.</p>
        )}
      </div>
    </div>
  );
}
