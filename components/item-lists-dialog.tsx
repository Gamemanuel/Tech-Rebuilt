"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { ItemTodo, ShoppingItem } from "@/lib/types";

export function ItemListsDialog({
  itemId,
  itemDescription,
  open,
  onOpenChange,
}: {
  itemId: string;
  itemDescription: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const [todos, setTodos] = useState<ItemTodo[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodo, setNewTodo] = useState("");
  const [newShopping, setNewShopping] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: todoRows }, { data: shopRows }] = await Promise.all([
        supabase.from("item_todos").select("*").eq("receipt_item_id", itemId).order("created_at"),
        supabase.from("item_shopping_items").select("*").eq("receipt_item_id", itemId).order("created_at"),
      ]);
      if (!active) return;
      setTodos((todoRows ?? []) as ItemTodo[]);
      setShopping((shopRows ?? []) as ShoppingItem[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, itemId]);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodo.trim()) return;
    const { data, error } = await supabase
      .from("item_todos")
      .insert({ receipt_item_id: itemId, description: newTodo.trim() })
      .select()
      .single();
    if (!error && data) {
      setTodos((p) => [...p, data as ItemTodo]);
      setNewTodo("");
    }
  }

  async function toggleTodo(todo: ItemTodo) {
    setTodos((p) => p.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)));
    await supabase.from("item_todos").update({ done: !todo.done }).eq("id", todo.id);
  }

  async function deleteTodo(id: string) {
    setTodos((p) => p.filter((t) => t.id !== id));
    await supabase.from("item_todos").delete().eq("id", id);
  }

  async function addShopping(e: React.FormEvent) {
    e.preventDefault();
    if (!newShopping.trim()) return;
    const { data, error } = await supabase
      .from("item_shopping_items")
      .insert({ receipt_item_id: itemId, description: newShopping.trim() })
      .select()
      .single();
    if (!error && data) {
      setShopping((p) => [...p, data as ShoppingItem]);
      setNewShopping("");
    }
  }

  async function toggleShopping(item: ShoppingItem) {
    setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, done: !s.done } : s)));
    await supabase.from("item_shopping_items").update({ done: !item.done }).eq("id", item.id);
  }

  async function deleteShopping(id: string) {
    setShopping((p) => p.filter((s) => s.id !== id));
    await supabase.from("item_shopping_items").delete().eq("id", id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lists</DialogTitle>
          <DialogDescription>{itemDescription}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To-do</h4>
              <div className="space-y-1">
                {todos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t)} />
                    <span className={t.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{t.description}</span>
                    <button onClick={() => deleteTodo(t.id)} className="text-muted-foreground hover:text-destructive">
                      <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {todos.length === 0 && <p className="text-xs text-muted-foreground">Nothing yet.</p>}
              </div>
              <form onSubmit={addTodo} className="flex gap-2">
                <Input
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Clean shell, test HDMI..."
                  className="h-8 text-xs"
                />
                <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
                  <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                </Button>
              </form>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shopping list</h4>
              <div className="space-y-1">
                {shopping.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={s.done} onChange={() => toggleShopping(s)} />
                    <span className={s.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{s.description}</span>
                    <button onClick={() => deleteShopping(s.id)} className="text-muted-foreground hover:text-destructive">
                      <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {shopping.length === 0 && <p className="text-xs text-muted-foreground">Nothing yet.</p>}
              </div>
              <form onSubmit={addShopping} className="flex gap-2">
                <Input
                  value={newShopping}
                  onChange={(e) => setNewShopping(e.target.value)}
                  placeholder="Replacement joycon rails..."
                  className="h-8 text-xs"
                />
                <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
                  <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
