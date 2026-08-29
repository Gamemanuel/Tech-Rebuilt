"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

// 1. Updated interface to handle both unit_todos (unit) and item_shopping_items (receipt_item)
interface Entry {
    id: string;
    description: string;
    done: boolean;
    receipt_item?: { id: string; description: string; receipt_id: string } | null;
    unit?: { id: string; name: string } | null; // Assuming your units table uses 'name'
}

type ListTable = "unit_todos" | "item_shopping_items";

export function MasterLists({
                                initialTodos,
                                initialShopping,
                            }: {
    initialTodos: Entry[];
    initialShopping: Entry[];
}) {
    const supabase = createClient();
    const [todos, setTodos] = useState(initialTodos);
    const [shopping, setShopping] = useState(initialShopping);

    async function toggle(table: ListTable, id: string, done: boolean) {
        // 2. Fixed string check here
        const setter = table === "unit_todos" ? setTodos : setShopping;
        setter((prev) => prev.map((e) => (e.id === id ? { ...e, done: !done } : e)));
        await supabase.from(table).update({ done: !done }).eq("id", id);
    }

    async function remove(table: ListTable, id: string) {
        // 3. Fixed string check here
        const setter = table === "unit_todos" ? setTodos : setShopping;
        setter((prev) => prev.filter((e) => e.id !== id));
        await supabase.from(table).delete().eq("id", id);
    }

    function renderList(entries: Entry[], table: ListTable) {
        if (entries.length === 0) {
            return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
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
            {/* 4. Pass "unit_todos" instead of "item_todos" */}
            <TabsContent value="todo">{renderList(todos, "unit_todos")}</TabsContent>
            <TabsContent value="shopping">{renderList(shopping, "item_shopping_items")}</TabsContent>
        </Tabs>
    );
}

function Row({ entry, onToggle, onDelete }: { entry: Entry; onToggle: () => void; onDelete: () => void }) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm">
            <input type="checkbox" checked={entry.done} onChange={onToggle} />
            <div className="min-w-0 flex-1">
                <span className={entry.done ? "text-muted-foreground line-through" : ""}>{entry.description}</span>

                {/* Render receipt link for shopping items */}
                {entry.receipt_item && (
                    <Link href={`/receipts/${entry.receipt_item.receipt_id}`} className="ml-2 text-xs text-primary hover:underline">
                        {entry.receipt_item.description}
                    </Link>
                )}

                {/* Render unit link for todo items */}
                {entry.unit && (
                    <Link href={`/units/${entry.unit.id}`} className="ml-2 text-xs text-primary hover:underline">
                        {entry.unit.name}
                    </Link>
                )}
            </div>
            <button onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive">
                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}