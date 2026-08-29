"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCartShopping, faPlus } from "@fortawesome/free-solid-svg-icons";
import { ItemShoppingListDialog } from "@/components/item-shopping-list-dialog";
import { formatCurrency } from "@/lib/utils";
import { ITEM_CATEGORY_LABELS, ItemCategory, UnitTodo } from "@/lib/types";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface UnitItem {
  id: string;
  description: string;
  category: ItemCategory;
  resolvedCostCents: number;
  isBundled: boolean;
}

interface ShoppingEntry {
  id: string;
  description: string;
  done: boolean;
  receipt_item: { id: string; description: string; receipt_id: string } | null;
}

/*
  NOTE ON SCOPE: this reproduces the *look* of the shadcn dashboard-01
  table (colored header, checkbox column, compact bordered rows) using
  the Table + Checkbox primitives you already have installed. It does
  NOT include the dashboard-01 example's drag-and-drop row reordering
  or client-side pagination — those need @dnd-kit and @tanstack/react-table,
  which aren't part of this project yet. Happy to wire those up too if
  you want the full interactive version; just say the word.

  Todos are unit-scoped (unit_todos.unit_id) as of the 0005 migration, so
  they're a flat list with no per-item link and no per-item "add" dialog —
  there's a quick-add form at the bottom of the To-do tab instead. Shopping
  entries are still per-item, added via the cart icon next to an item above.
*/

export function UnitItemLists({
  unitId,
  items,
  initialTodos,
  initialShopping,
}: {
  unitId: string;
  items: UnitItem[];
  initialTodos: UnitTodo[];
  initialShopping: ShoppingEntry[];
}) {
  const supabase = createClient();
  const [todos, setTodos] = useState(initialTodos);
  const [shopping, setShopping] = useState(initialShopping);
  const [shoppingItem, setShoppingItem] = useState<{ id: string; description: string } | null>(null);

  async function addTodo(description: string) {
    const { data, error } = await supabase
      .from("unit_todos")
      .insert({ unit_id: unitId, description })
      .select()
      .single();
    if (!error && data) setTodos((prev) => [...prev, data as UnitTodo]);
  }

  async function toggleTodo(id: string, done: boolean) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !done } : t)));
    await supabase.from("unit_todos").update({ done: !done }).eq("id", id);
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("unit_todos").delete().eq("id", id);
  }

  async function toggleShopping(id: string, done: boolean) {
    setShopping((prev) => prev.map((s) => (s.id === id ? { ...s, done: !done } : s)));
    await supabase.from("item_shopping_items").update({ done: !done }).eq("id", id);
  }

  async function deleteShopping(id: string) {
    setShopping((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("item_shopping_items").delete().eq("id", id);
  }

    function splitByDone<T extends { done: boolean }>(entries: T[]) {
        return { open: entries.filter((e) => !e.done), done: entries.filter((e) => e.done) };
    }

    function renderTodoTable() {
        return (
            <div className="space-y-3">
                {todos.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Nothing here yet — add one below.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead className="w-10">
                                        <span className="sr-only">Done</span>
                                    </TableHead>
                                    <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                                    <TableHead className="w-10 text-right">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {todos.map((todo) => (
                                    <TableRow key={todo.id}>
                                        <TableCell>
                                            <Checkbox checked={todo.done} onCheckedChange={() => toggleTodo(todo.id, todo.done)} />
                                        </TableCell>
                                        <TableCell className={todo.done ? "text-muted-foreground line-through" : ""}>
                                            {todo.description}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <button
                                                onClick={() => deleteTodo(todo.id)}
                                                className="text-muted-foreground hover:text-destructive"
                                                aria-label={`Delete ${todo.description}`}
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <TodoQuickAdd onAdd={addTodo} />
            </div>
        );
    }

  function renderShoppingTable() {
    if (shopping.length === 0) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          Nothing here yet — use the cart icon next to an item above to add one.
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
            {shopping.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Checkbox checked={entry.done} onCheckedChange={() => toggleShopping(entry.id, entry.done)} />
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
                    onClick={() => deleteShopping(entry.id)}
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
                    onClick={() => setShoppingItem({ id: item.id, description: item.description })}
                    className="text-muted-foreground hover:text-primary"
                    title="Shopping list for this item"
                    aria-label={`Open shopping list for ${item.description}`}
                  >
                    <FontAwesomeIcon icon={faCartShopping} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Click the cart icon on an item to add a shopping entry for it.
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
            <TabsContent value="todo">{renderTodoTable()}</TabsContent>
            <TabsContent value="shopping">{renderShoppingTable()}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {shoppingItem && (
        <ItemShoppingListDialog
          itemId={shoppingItem.id}
          itemDescription={shoppingItem.description}
          open={!!shoppingItem}
          onOpenChange={(open) => !open && setShoppingItem(null)}
        />
      )}
    </div>
  );
}

function TodoQuickAdd({ onAdd }: { onAdd: (description: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setAdding(true);
    await onAdd(value.trim());
    setAdding(false);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Clean shell, test HDMI, replace joycon rails..."
        className="h-9 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={adding}>
        <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />
        Add
      </Button>
    </form>
  );
}
