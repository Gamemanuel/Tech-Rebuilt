"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface TodoEntry {
  id: string;
  description: string;
  done: boolean;
  unit: { id: string; model: string; generation: string | null; serial_number: string | null } | null;
}

interface ShoppingEntry {
  id: string;
  description: string;
  done: boolean;
  receipt_item: { id: string; description: string; receipt_id: string } | null;
}

function unitLabel(u: NonNullable<TodoEntry["unit"]>) {
  return [u.model, u.generation, u.serial_number].filter(Boolean).join(" · ");
}

function splitByDone<T extends { done: boolean }>(entries: T[]) {
  return { open: entries.filter((e) => !e.done), done: entries.filter((e) => e.done) };
}

export function MasterLists({
                              initialTodos,
                              initialShopping,
                            }: {
  initialTodos: TodoEntry[];
  initialShopping: ShoppingEntry[];
}) {
  const supabase = createClient();
  const [todos, setTodos] = useState(initialTodos);
  const [shopping, setShopping] = useState(initialShopping);

  async function toggleTodo(id: string, done: boolean) {
    setTodos((prev) => prev.map((e) => (e.id === id ? { ...e, done: !done } : e)));
    await supabase.from("unit_todos").update({ done: !done }).eq("id", id);
  }
  async function removeTodo(id: string) {
    setTodos((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("unit_todos").delete().eq("id", id);
  }
  async function toggleShopping(id: string, done: boolean) {
    setShopping((prev) => prev.map((e) => (e.id === id ? { ...e, done: !done } : e)));
    await supabase.from("item_shopping_items").update({ done: !done }).eq("id", id);
  }
  async function removeShopping(id: string) {
    setShopping((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("item_shopping_items").delete().eq("id", id);
  }

  async function toggleAllTodos(entries: TodoEntry[], done: boolean) {
    const ids = entries.map((e) => e.id);
    setTodos((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, done } : e)));
    await supabase.from("unit_todos").update({ done }).in("id", ids);
  }
  async function toggleAllShopping(entries: ShoppingEntry[], done: boolean) {
    const ids = entries.map((e) => e.id);
    setShopping((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, done } : e)));
    await supabase.from("item_shopping_items").update({ done }).in("id", ids);
  }

  const todoSplit = splitByDone(todos);
  const shoppingSplit = splitByDone(shopping);

  function renderTodoTable(entries: TodoEntry[], sectionDone: boolean) {
    return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                      checked={sectionDone}
                      onCheckedChange={(checked) => toggleAllTodos(entries, !!checked)}
                      aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Unit</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Checkbox
                          checked={entry.done}
                          onCheckedChange={() => toggleTodo(entry.id, entry.done)}
                      />
                    </TableCell>
                    <TableCell className={entry.done ? "text-muted-foreground line-through" : ""}>
                      {entry.description}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {entry.unit ? (
                          <Link href={`/units/${entry.unit.id}`} className="text-primary hover:underline">
                            {unitLabel(entry.unit)}
                          </Link>
                      ) : (
                          "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                          onClick={() => removeTodo(entry.id)}
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

  function renderShoppingTable(entries: ShoppingEntry[], sectionDone: boolean) {
    return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                      checked={sectionDone}
                      onCheckedChange={(checked) => toggleAllShopping(entries, !!checked)}
                      aria-label="Select all"
                  />
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
                      <Checkbox
                          checked={entry.done}
                          onCheckedChange={() => toggleShopping(entry.id, entry.done)}
                      />
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
                          onClick={() => removeShopping(entry.id)}
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

  function renderDoneSection(count: number, content: React.ReactNode) {
    return (
        <Collapsible>
          <CollapsibleTrigger className="group flex w-full items-center gap-2 border-t border-border pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FontAwesomeIcon
                icon={faChevronRight}
                className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90"
            />
            Done ({count})
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">{content}</CollapsibleContent>
        </Collapsible>
    );
  }

  return (
      <Tabs defaultValue="todo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todo">To-do ({todoSplit.open.length})</TabsTrigger>
          <TabsTrigger value="shopping">Shopping list ({shoppingSplit.open.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="todo">
          {todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet — add entries from a unit&apos;s page.</p>
          ) : (
              <div className="space-y-4">
                {todoSplit.open.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Everything&apos;s done. Nice.</p>
                ) : (
                    renderTodoTable(todoSplit.open, false)
                )}
                {todoSplit.done.length > 0 &&
                    renderDoneSection(todoSplit.done.length, renderTodoTable(todoSplit.done, true))}
              </div>
          )}
        </TabsContent>

        <TabsContent value="shopping">
          {shopping.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet — add entries from a receipt&apos;s item.</p>
          ) : (
              <div className="space-y-4">
                {shoppingSplit.open.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Everything&apos;s done. Nice.</p>
                ) : (
                    renderShoppingTable(shoppingSplit.open, false)
                )}
                {shoppingSplit.done.length > 0 &&
                    renderDoneSection(shoppingSplit.done.length, renderShoppingTable(shoppingSplit.done, true))}
              </div>
          )}
        </TabsContent>
      </Tabs>
  );
}