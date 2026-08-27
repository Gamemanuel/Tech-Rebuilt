import type { SupabaseClient } from "@supabase/supabase-js";
import { ReceiptItem, ResolvedReceiptItem } from "./types";
import { resolveItemCosts } from "./calculations";

/**
 * Resolves cost for a set of receipt items that may reference bundles.
 * Bundle math needs the FULL group of items sharing a bundle — which can
 * span multiple units — not just the ones you passed in. This fetches
 * whatever's missing from the other bundle members, resolves everything
 * together, then filters back down to just the items you asked about.
 */
export async function resolveItemsWithBundleContext(
  supabase: SupabaseClient,
  items: ReceiptItem[]
): Promise<ResolvedReceiptItem[]> {
  const bundleIds = Array.from(
    new Set(items.filter((i) => i.bundle_id).map((i) => i.bundle_id as string))
  );

  if (bundleIds.length === 0) {
    return resolveItemCosts(items, []);
  }

  const [{ data: bundles }, { data: bundleItems }] = await Promise.all([
    supabase.from("receipt_bundles").select("*").in("id", bundleIds),
    supabase.from("receipt_items").select("*").in("bundle_id", bundleIds),
  ]);

  const byId = new Map<string, ReceiptItem>();
  for (const item of items) byId.set(item.id, item);
  for (const item of bundleItems ?? []) byId.set(item.id, item);

  const resolved = resolveItemCosts(Array.from(byId.values()), bundles ?? []);
  const resolvedById = new Map(resolved.map((r) => [r.id, r]));

  return items.map(
    (item) =>
      resolvedById.get(item.id) ?? {
        ...item,
        isBundled: !!item.bundle_id,
        resolvedCostCents: item.cost_cents ?? 0,
      }
  );
}
