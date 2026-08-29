"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { ItemListsDialog } from "@/components/item-lists-dialog";
import { formatCurrency } from "@/lib/utils";
import { ITEM_CATEGORY_LABELS, ItemCategory } from "@/lib/types";

interface UnitItem {
    id: string;
    description: string;
    category: ItemCategory;
    resolvedCostCents: number;
    isBundled: boolean;
}

interface EntryWithItem {
    id: string;
    description: string;
    done: boolean;
    receipt_item: { id: string; description: string; receipt_id: string } | null;
}

type ListTable = "item_todos" | "item_shopping_items";

/*
  NOTE ON SCOPE: this reproduces the *look* of the shadcn dashboard-01
  table (colored header, checkbox column, compact bordered rows) using
  the Table + Checkbox primitives you already have installed. It does
  NOT include the dashboard-01 example's drag-and-drop row reordering
  or client-side pagination — those need @dnd-kit and @tanstack/react-table,
  which aren't part of this project yet. Happy to wire those up too if
  you want the full interactive version; just say the word.
*/

export function UnitItemLists({
                                  items,
                                  initialTodos,
                                  initialShopping,
                              }: {
    items: UnitItem[];
    initialTodos: EntryWithItem[];
    initialShopping: EntryWithItem[];
}) {
    const supabase = createClient();
    const [todos, setTodos] = useState(initialTodos);
    const [shopping, setShopping] = useState(initialShopping);
    const [listsItem, setListsItem] = useState<{ id: string; description: string } | null>(null);

    async function toggle(table: ListTable, id: string, done: boolean) {
        const setter = table === "item_todos" ? setTodos : setShopping;
        setter((prev) => prev.map((e) => (e.id === id ? { ...e, done: !done } : e)));
        await supabase.from(table).update({ done: !done }).eq("id", id);
    }

    async function remove(table: ListTable, id: string) {
        const setter = table === "item_todos" ? setTodos : setShopping;
        setter((prev) => prev.filter((e) => e.id !== id));
        await supabase.from(table).delete().eq("id", id);
    }

    function renderTable(entries: EntryWithItem[], table: ListTable) {
        if (entries.length === 0) {
            return (
                <p className="p-4 text-sm text-muted-foreground">
                    Nothing here yet — use the list icon next to an item above to add one.
                </p>
            );
        }
        return (
            <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            <TableHead className="w-10 text-xs uppercase tracking-wide">
                                <span className="sr-only">Done</span>
                            </TableHead>
                            <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                            <TableHead className="text-xs uppercase tracking-wide">Item</TableHead>
                            <TableHead className="w-10 text-right">
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>
                                    <Checkbox checked={entry.done} onCheckedChange={() => toggle(table, entry.id, entry.done)} />
                                </TableCell>
                                <TableCell className={entry.done ? "text-muted-foreground line-through" : ""}>
                                    {entry.description}
                                </TableCell>
                                <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                                    {entry.receipt_item ? (
                                        <Link href={`/receipts/${entry.receipt_item.receipt_id}`} className="hover:underline">
                                            {entry.receipt_item.description}
                                        </Link>
                                    ) : (
                                        "—"
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <button
                                        onClick={() => remove(table, entry.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Delete ${entry.description}`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    const openTodos = todos.filter((t) => !t.done).length;
    const openShopping = shopping.filter((s) => !s.done).length;

    return (
        <div className="space-y-6">
            {items.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Items on this unit</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{ITEM_CATEGORY_LABELS[item.category]} · </span>
                                    <span>{item.description}</span>
                                </div>
                                <div className="flex items-center gap-3">
                  <span className="font-mono">
                    {formatCurrency(item.resolvedCostCents)}
                      {item.isBundled && <span className="ml-1 text-xs text-muted-foreground">(split)</span>}
                  </span>
                                    <button
                                        onClick={() => setListsItem({ id: item.id, description: item.description })}
                                        className="text-muted-foreground hover:text-primary"
                                        title="To-do & shopping list"
                                        aria-label={`Open to-do and shopping list for ${item.description}`}
                                    >
                                        <FontAwesomeIcon icon={faListCheck} className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <p className="pt-1 text-xs text-muted-foreground">
                            Click the list icon on an item to add a to-do or shopping entry for it.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">To-do &amp; shopping</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="todo" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="todo">To-do ({openTodos})</TabsTrigger>
                            <TabsTrigger value="shopping">Shopping list ({openShopping})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="todo">{renderTable(todos, "item_todos")}</TabsContent>
                        <TabsContent value="shopping">{renderTable(shopping, "item_shopping_items")}</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {listsItem && (
                <ItemListsDialog
                    itemId={listsItem.id}
                    itemDescription={listsItem.description}
                    open={!!listsItem}
                    onOpenChange={(open) => !open && setListsItem(null)}
                />
            )}
        </div>
    );
}