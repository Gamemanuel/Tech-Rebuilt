"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { UnitTodo } from "@/lib/types";

export function UnitTodoList({ unitId, initialTodos }: { unitId: string; initialTodos: UnitTodo[] }) {
    const supabase = createClient();
    const [todos, setTodos] = useState(initialTodos);
    const [newTodo, setNewTodo] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function addTodo(e: React.FormEvent) {
        e.preventDefault();
        if (!newTodo.trim()) return;
        setError(null);
        const { data, error } = await supabase
            .from("unit_todos")
            .insert({ unit_id: unitId, description: newTodo.trim() })
            .select()
            .single();
        if (error) {
            setError(error.message);
            return;
        }
        if (data) {
            setTodos((p) => [...p, data as UnitTodo]);
            setNewTodo("");
        }
    }

    async function toggle(todo: UnitTodo) {
        setTodos((p) => p.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)));
        await supabase.from("unit_todos").update({ done: !todo.done }).eq("id", todo.id);
    }

    async function remove(id: string) {
        setTodos((p) => p.filter((t) => t.id !== id));
        await supabase.from("unit_todos").delete().eq("id", id);
    }

    const open = todos.filter((t) => !t.done);
    const done = todos.filter((t) => t.done);

    return (
        <div className="space-y-3">
            {todos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing on the list yet.</p>
            ) : (
                <div className="space-y-1.5">
                    {open.map((t) => (
                        <TodoRow key={t.id} todo={t} onToggle={() => toggle(t)} onDelete={() => remove(t.id)} />
                    ))}
                    {done.length > 0 && (
                        <div className="space-y-1.5 border-t border-border pt-2">
                            {done.map((t) => (
                                <TodoRow key={t.id} todo={t} onToggle={() => toggle(t)} onDelete={() => remove(t.id)} />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <form onSubmit={addTodo} className="flex gap-2">
                <Input
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    placeholder="Clean shell, test HDMI, replace joycon rails..."
                    className="h-8 text-sm"
                />
                <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
                    <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                </Button>
            </form>
        </div>
    );
}

function TodoRow({ todo, onToggle, onDelete }: { todo: UnitTodo; onToggle: () => void; onDelete: () => void }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={todo.done} onChange={onToggle} />
            <span className={todo.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{todo.description}</span>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
                <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
            </button>
        </div>
    );
}