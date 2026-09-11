import { createClient } from "@/lib/supabase/server";
import { PartsInventory } from "@/components/parts-inventory";
import { resolveItemsWithBundleContext } from "@/lib/data";

export default async function InventoryPage() {
    const supabase = createClient();

    const [{ data: rawItems, error }, { data: units }] = await Promise.all([
        supabase
            .from("receipt_items")
            .select("*, receipts(id, source, receipt_date)")
            .is("unit_id", null)
            .neq("category", "supply")
            .order("description"),
        supabase.from("units").select("id, model, generation, serial_number").order("model"),
    ]);

    // Bundle math needs the full sibling group, which resolveItemsWithBundleContext
    // fetches for us — it can strip the joined `receipts` field along the way for
    // bundle-mates that get re-fetched plain, so we reattach it afterward.
    const resolved =
        rawItems && rawItems.length > 0 ? await resolveItemsWithBundleContext(supabase, rawItems as any) : [];
    const receiptById = new Map((rawItems ?? []).map((i: any) => [i.id, i.receipts]));
    const itemsWithReceipt = resolved.map((item) => ({
        ...item,
        receipt: receiptById.get(item.id) ?? null,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-medium">Parts inventory</h1>
                <p className="text-sm text-muted-foreground">
                    Everything you&apos;ve bought that isn&apos;t assigned to a unit yet — bulk-bought parts and
                    accessories sitting on the shelf, waiting for a listing. Assign straight from here.
                </p>
            </div>

            {error && <p className="text-sm text-destructive">Couldn&apos;t load inventory: {error.message}</p>}

            <PartsInventory initialItems={itemsWithReceipt as any} units={units ?? []} />
        </div>
    );
}