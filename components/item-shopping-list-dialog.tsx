"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { ShoppingItem } from "@/lib/types";

export function ItemShoppingListDialog({
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
    const [shopping, setShopping] = useState<ShoppingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newShopping, setNewShopping] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let active = true;
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from("item_shopping_items")
                .select("*")
                .eq("receipt_item_id", itemId)
                .order("created_at");
            if (!active) return;
            setShopping((data ?? []) as ShoppingItem[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [open, itemId]);

    async function addShopping(e: React.FormEvent) {
        e.preventDefault();
        if (!newShopping.trim()) return;
        setError(null);
        const { data, error } = await supabase
            .from("item_shopping_items")
            .insert({ receipt_item_id: itemId, description: newShopping.trim() })
            .select()
            .single();
        if (error) {
            setError(error.message);
            return;
        }
        if (data) {
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
                    <DialogTitle>Shopping list</DialogTitle>
                    <DialogDescription>{itemDescription}</DialogDescription>
                </DialogHeader>
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                    <div className="space-y-2">
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
                        {error && <p className="text-sm text-destructive">{error}</p>}
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
                )}
            </DialogContent>
        </Dialog>
    );
}