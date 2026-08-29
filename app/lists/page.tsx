import { createClient } from "@/lib/supabase/server";
import { MasterLists } from "@/components/master-lists";

export default async function ListsPage() {
  const supabase = createClient();
  const [{ data: todos }, { data: shopping }] = await Promise.all([
    supabase
      .from("unit_todos")
      .select("*, receipt_item:receipt_items(id, description, receipt_id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("item_shopping_items")
      .select("*, receipt_item:receipt_items(id, description, receipt_id)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-medium">Lists</h1>
        <p className="text-sm text-muted-foreground">
          Every item&apos;s to-do and shopping list, rolled up in one place.
        </p>
      </div>
      <MasterLists initialTodos={(todos ?? []) as any} initialShopping={(shopping ?? []) as any} />
    </div>
  );
}
