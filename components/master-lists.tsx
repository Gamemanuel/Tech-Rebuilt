"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

interface EntryWithItem {
  id: string;
  description: string;
  done: boolean;
  receipt_item: { id: string; description: string; receipt_id: string } | null;
}

type ListTable = "item_todos" | "item_shopping_items";

export function MasterLists({
  initialTodos,
  initialShopping,
}: {
  initialTodos: EntryWithItem[];
  initialShopping: EntryWithItem[];
}) {
  const supabase = createClient();
  const [todos, setTodos] = useState(initialTodos);
  const [shopping, setShopping] = useState(initialShopping);

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

  function renderList(entries: EntryWithItem[], table: ListTable) {
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground">Nothing here yet — add entries from a receipt&apos;s item.</p>;
    }
    const open = entries.filter((e) => !e.done);
    const done = entries.filter((e) => e.done);
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything&apos;s done. Nice.</p>
          ) : (
            open.map((entry) => (
              <Row key={entry.id} entry={entry} onToggle={() => toggle(table, entry.id, entry.done)} onDelete={() => remove(table, entry.id)} />
            ))
          )}
        </div>
        {done.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Done</p>
            {done.map((entry) => (
              <Row key={entry.id} entry={entry} onToggle={() => toggle(table, entry.id, entry.done)} onDelete={() => remove(table, entry.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="todo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="todo">To-do ({todos.filter((t) => !t.done).length})</TabsTrigger>
        <TabsTrigger value="shopping">Shopping list ({shopping.filter((s) => !s.done).length})</TabsTrigger>
      </TabsList>
      <TabsContent value="todo">{renderList(todos, "item_todos")}</TabsContent>
      <TabsContent value="shopping">{renderList(shopping, "item_shopping_items")}</TabsContent>
    </Tabs>
  );
}

function Row({ entry, onToggle, onDelete }: { entry: EntryWithItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm">
      <input type="checkbox" checked={entry.done} onChange={onToggle} />
      <div className="min-w-0 flex-1">
        <span className={entry.done ? "text-muted-foreground line-through" : ""}>{entry.description}</span>
        {entry.receipt_item && (
          <Link href={`/receipts/${entry.receipt_item.receipt_id}`} className="ml-2 text-xs text-primary hover:underline">
            {entry.receipt_item.description}
          </Link>
        )}
      </div>
      <button onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive">
        <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
