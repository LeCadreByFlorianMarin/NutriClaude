"use client";

import { useTransition } from "react";
import { toggleItemStatus, deleteItem } from "./actions";
import type { GroceryListByAisleRow } from "@/lib/supabase/types";

type Group = {
  key: string;
  name: string;
  icon: string | null;
  sort: number;
  items: GroceryListByAisleRow[];
};

export default function GroceryGroup({ group }: { group: Group }) {
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, current: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", current === "pending" ? "bought" : "pending");
    startTransition(() => {
      toggleItemStatus(fd);
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteItem(fd);
    });
  }

  return (
    <li className="card !p-0 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 bg-surface2 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="text-lg">{group.icon}</span>
          {group.name}
        </h3>
        <span className="text-xs text-muted">
          {group.items.length} article{group.items.length > 1 ? "s" : ""}
        </span>
      </header>
      <ul className="divide-y divide-border">
        {group.items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface2 group transition"
          >
            <input
              type="checkbox"
              checked={false}
              onChange={() => toggle(it.id, "pending")}
              disabled={isPending}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <span className="flex-1">
              <span className="font-medium">{it.name}</span>
              {it.quantity != null && (
                <span className="text-muted text-sm ml-2">
                  {it.quantity} {it.unit ?? ""}
                </span>
              )}
            </span>
            <button
              onClick={() => remove(it.id)}
              disabled={isPending}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red text-sm transition"
              title="Retirer"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}
