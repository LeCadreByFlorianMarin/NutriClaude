"use client";

import { useState, useTransition } from "react";
import { updateAisle, deleteAisle } from "./actions";
import type { Aisle } from "@/lib/supabase/types";

export default function AisleRow({ aisle }: { aisle: Aisle }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(aisle.name);
  const [icon, setIcon] = useState(aisle.icon ?? "");
  const [sortOrder, setSortOrder] = useState(aisle.sort_order);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const fd = new FormData();
    fd.set("id", aisle.id);
    fd.set("name", name);
    fd.set("icon", icon);
    fd.set("sort_order", String(sortOrder));
    startTransition(async () => {
      const res = await updateAisle(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setError(null);
    });
  }

  function remove() {
    if (!confirm(`Supprimer le rayon "${aisle.name}" ?`)) return;
    const fd = new FormData();
    fd.set("id", aisle.id);
    startTransition(async () => {
      const res = await deleteAisle(fd);
      if (res?.error) setError(res.error);
    });
  }

  if (editing) {
    return (
      <li className="grid grid-cols-[60px_60px_1fr_auto] gap-3 items-center px-2 py-2 bg-surface2 border border-accent/40 rounded-lg">
        <input
          type="number"
          className="input !py-1.5"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
        <input
          className="input !py-1.5 text-center"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={2}
        />
        <input
          className="input !py-1.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="btn-primary !py-1 !px-3 text-xs"
          >
            OK
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="btn-ghost !py-1 !px-3 text-xs"
          >
            Annuler
          </button>
        </div>
        {error && <p className="col-span-4 text-red text-xs">{error}</p>}
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[60px_60px_1fr_auto] gap-3 items-center px-2 py-2 hover:bg-surface2 rounded-lg group">
      <span className="text-muted text-sm tabular-nums">{aisle.sort_order}</span>
      <span className="text-xl">{aisle.icon || "·"}</span>
      <span className="font-medium">{aisle.name}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => setEditing(true)}
          className="btn-ghost !py-1 !px-2 text-xs"
        >
          Éditer
        </button>
        <button
          onClick={remove}
          disabled={isPending}
          className="btn-ghost !py-1 !px-2 text-xs hover:text-red"
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}
